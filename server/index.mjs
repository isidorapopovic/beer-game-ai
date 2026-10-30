import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createGeminiModel } from './gemini.mjs';
import { runWorkflow, validateRequest } from './workflows.mjs';
import { AiPolicyError, HTTP_BODY_BYTES, readAiPolicy } from './aiPolicy.mjs';
import { createUsageLedger } from './aiUsageLedger.mjs';
import { createToolCallLogger, readLogConfig } from './aiToolCallLog.mjs';
import { createCoachContexts } from './coachContexts.mjs';
import { createSecurityLog } from './securityLog.mjs';

export function createAgentServer({ env = process.env, fetchImpl = fetch, now = Date.now, onSecurityEvent, requestTimeoutMs } = {}) {
  let policy; let configurationError; let ledger;
  const logger = createToolCallLogger({ config: readLogConfig(env), now });
  const contexts = createCoachContexts({ now });
  const emitSecurity = createSecurityLog({ env, now, onEvent: onSecurityEvent });
  try {
    policy = readAiPolicy(env);
    if (!env.GEMINI_API_KEY?.trim()) throw new AiPolicyError('CONFIGURATION', 'Gemini is not configured. Set GEMINI_API_KEY on the server, then restart it.');
    ledger = createUsageLedger({ policy, now });
  } catch (error) { configurationError = error; }
  return createServer(async (req, res) => {
    let log; let terminal = false; let disconnected = false;
    let model; let result; let runError; let workflow = 'unknown'; let executedToolCalls = 0;
    const correlationId = `req_${randomUUID()}`; const startedAt = now();
    const security = (type, outcome, reasonCode) => emitSecurity(type, { correlationId, workflow, outcome, reasonCode,
      elapsedMs: Math.max(0, Math.round(now() - startedAt)), providerAttempts: model?.getEvidence().providerHttpCalls ?? 0, executedToolCalls });
    const abortController = new AbortController();
    const finish = (type, payload) => { if (!terminal) { log?.emit(type, payload); terminal = true; } };
    const send = (code, body, headers = {}) => {
      if (code >= 400) finish(disconnected ? 'action_cancelled' : 'action_failed',
        { status: disconnected ? 'cancelled' : 'failed', error: body.error, code: body.code ?? 'REQUEST_REJECTED', finalOutput: null });
      if (code >= 400) security(req.url === '/api/agent/coach-context' ? 'context.denied' : 'request.denied', 'denied', body.code ?? 'INVALID_INPUT');
      if (log) body.logging = log.status();
      if (res.destroyed) return;
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
      res.end(JSON.stringify(body));
    };
    const sendError = error => {
      const safe = error instanceof AiPolicyError ? error : new AiPolicyError('AI_UNAVAILABLE', 'The AI workflow could not be completed safely.', 502);
      send(safe.status, { error: safe.message, code: safe.code }, safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {});
    };
    if (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)) return send(403, { error: 'Origin not allowed.', code: 'ORIGIN_DENIED' });
    if (req.url === '/api/agent/status' && req.method === 'GET') return send(200, {
      provider: 'gemini', configured: !configurationError, model: policy?.model,
      dailyAllowanceUsd: policy?.dailyBudgetUsd, reconciliationVerified: policy?.reconcileVerified,
      activityLoggingEnabled: logger.enabled,
    });
    const contextRequest = req.url === '/api/agent/coach-context';
    if ((!contextRequest && req.url !== '/api/agent/run') || req.method !== 'POST') return send(404, { error: 'Not found.' });
    security('request.received', 'received', 'RECEIVED');
    if (!contextRequest) log = logger.begin({ requestId: correlationId,
      participant: { sessionId: 'unknown', sessionSource: 'not_yet_validated', labelSource: 'unknown' } });
    log?.emit('request_received', { method: 'POST' });
    res.on('close', () => {
      if (!res.writableEnded && !terminal) {
        disconnected = true; log?.emit('action_cancel_requested', { reason: 'client_disconnected' }); abortController.abort();
      }
    });
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(req.headers['content-type'] ?? '')) return send(415, { error: 'JSON required.', code: 'JSON_REQUIRED' });
    let input;
    let validated;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > HTTP_BODY_BYTES) return send(413, { error: 'AI request exceeds the 20,000-byte limit.', code: 'BODY_LIMIT' });
        chunks.push(chunk);
      }
      input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      if (contextRequest) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'state')) throw new Error('Invalid context request.');
        const canonical = validateRequest({ workflow: 'decision_coach', goal: 'Create coach context.', state: input.state }).state;
        const issued = contexts.issue(canonical); workflow = 'decision_coach';
        security('context.issued', 'allowed', 'CONTEXT_ISSUED'); terminal = true;
        return send(201, issued);
      }
      validated = validateRequest(input); workflow = validated.workflow;
      if (workflow === 'decision_coach' && validated.state.isComplete) throw new Error('Coach unavailable after completion.');
      log.setContext({ participant: validated.participant, workflow: validated.workflow,
        gameWeek: validated.state.currentWeek, gamePhase: validated.state.isComplete ? 'completed' : validated.state.history.length ? 'in_game' : 'pre_game' });
      log.emit('request_accepted', { goal: validated.goal, taskInput: validated.taskInput, provider: 'gemini', model: policy?.model ?? null });
    } catch (error) {
      if (error instanceof AiPolicyError) return sendError(error);
      return send(400, { error: 'Invalid workflow, taskInput selection, game state, goal (1–500 characters), or participant label (at most 80 characters).', code: 'INVALID_INPUT' });
    }
    if (configurationError) return sendError(configurationError);
    let ticket;
    let coachRemaining;
    try {
      const context = workflow === 'decision_coach' ? contexts.check(validated.coachContext, validated.state) : undefined;
      ticket = ledger.admit(input.workflow);
      if (context) coachRemaining = contexts.consume(context, validated.state);
    } catch (error) { return sendError(error); }
    log.emit('request_admitted', { admitted: true });
    security('request.admitted', 'allowed', 'ADMITTED');
    try {
      model = createGeminiModel({ apiKey: env.GEMINI_API_KEY, model: policy.model, fetchImpl,
        abortSignal: abortController.signal, requestTimeoutMs, onEvent: (type, payload) => log.emit(type, payload) });
      result = await runWorkflow(input, model, { onEvent: event => {
        if (event.type === 'tool_execution_started') { executedToolCalls++; security('agent.tool.allowed', 'allowed', 'TOOL_ALLOWED'); }
        if (event.type === 'tool_rejected') security('agent.tool.denied', 'denied', 'TOOL_DENIED');
        log.observe(event);
      } });
    } catch (error) { runError = error; }
    let accounting;
    try {
      if (model?.hasPending()) {
        accounting = { reservationStatus: 'retained', ledgerStatus: 'awaiting_provider_cleanup' };
        void model.whenSettled().then(() => { try { ledger.finish(ticket, model.getEvidence()); } catch { /* Reservation remains conservative. */ } });
      } else accounting = ledger.finish(ticket, model?.getEvidence());
    }
    catch { accounting = { reservationStatus: 'retained', ledgerStatus: 'unavailable' }; }
    if (runError) return sendError(runError);
    result.evidence.accounting = accounting;
    if (coachRemaining !== undefined) result.coachRemaining = coachRemaining;
    const cancelled = disconnected || result.stopReason === 'cancelled';
    finish(cancelled ? 'action_cancelled' : result.status === 'completed' ? 'action_completed' : 'action_failed', {
      status: cancelled ? 'cancelled' : result.status, stopReason: cancelled ? 'cancelled' : result.stopReason,
      finalOutput: result.finalOutput ?? null,
      error: result.status === 'completed' ? null : result.error ?? `AI workflow ${result.status}: ${result.stopReason}.`,
      evidence: result.evidence, finalValidation: result.status === 'completed' ? 'passed' : 'not_accepted',
    });
    security('request.finished', cancelled ? 'cancelled' : result.status === 'completed' ? 'completed' : 'failed', cancelled ? 'CANCELLED' : result.status === 'completed' ? 'COMPLETED' : 'REJECTED');
    result.evidence.logging = log.status();
    return send(200, result);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAgentServer();
  server.requestTimeout = 25_000;
  server.listen(3001, '127.0.0.1', () => console.log('Gemini agent service: http://127.0.0.1:3001'));
}
