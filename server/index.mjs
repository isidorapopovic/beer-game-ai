import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createGeminiModel } from './gemini.mjs';
import { runWorkflow, validateRequest } from './workflows.mjs';
import { AiPolicyError, HTTP_BODY_BYTES, readAiPolicy } from './aiPolicy.mjs';
import { createUsageLedger } from './aiUsageLedger.mjs';
import { createToolCallLogger, readLogConfig } from './aiToolCallLog.mjs';

export function createAgentServer({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  let policy; let configurationError; let ledger;
  const logger = createToolCallLogger({ config: readLogConfig(env), now });
  try {
    policy = readAiPolicy(env);
    if (!env.GEMINI_API_KEY?.trim()) throw new AiPolicyError('CONFIGURATION', 'Gemini is not configured. Set GEMINI_API_KEY on the server, then restart it.');
    ledger = createUsageLedger({ policy, now });
  } catch (error) { configurationError = error; }
  return createServer(async (req, res) => {
    let log; let terminal = false; let disconnected = false;
    const abortController = new AbortController();
    const finish = (type, payload) => { if (!terminal) { log?.emit(type, payload); terminal = true; } };
    const send = (code, body, headers = {}) => {
      if (code >= 400) finish(disconnected ? 'action_cancelled' : 'action_failed',
        { status: disconnected ? 'cancelled' : 'failed', error: body.error, code: body.code ?? 'REQUEST_REJECTED', finalOutput: null });
      if (log) body.logging = log.status();
      if (res.destroyed) return;
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
      res.end(JSON.stringify(body));
    };
    const sendError = error => {
      const safe = error instanceof AiPolicyError ? error : new AiPolicyError('AI_UNAVAILABLE', 'The AI workflow could not be completed safely.', 502);
      send(safe.status, { error: safe.message, code: safe.code }, safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {});
    };
    if (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)) return send(403, { error: 'Origin not allowed.' });
    if (req.url === '/api/agent/status' && req.method === 'GET') return send(200, {
      provider: 'gemini', configured: !configurationError, model: policy?.model,
      dailyAllowanceUsd: policy?.dailyBudgetUsd, reconciliationVerified: policy?.reconcileVerified,
      activityLoggingEnabled: logger.enabled,
    });
    if (req.url !== '/api/agent/run' || req.method !== 'POST') return send(404, { error: 'Not found.' });
    log = logger.begin({ requestId: `req_${randomUUID()}`,
      participant: { sessionId: 'unknown', sessionSource: 'not_yet_validated', labelSource: 'unknown' } });
    log.emit('request_received', { method: 'POST' });
    res.on('close', () => {
      if (!res.writableEnded && !terminal) {
        disconnected = true; log.emit('action_cancel_requested', { reason: 'client_disconnected' }); abortController.abort();
      }
    });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
    let input;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > HTTP_BODY_BYTES) return send(413, { error: 'AI request exceeds the 20,000-byte limit.' });
        chunks.push(chunk);
      }
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const validated = validateRequest(input);
      log.setContext({ participant: validated.participant, workflow: validated.workflow,
        gameWeek: validated.state.currentWeek, gamePhase: validated.state.isComplete ? 'completed' : validated.state.history.length ? 'in_game' : 'pre_game' });
      log.emit('request_accepted', { goal: validated.goal, taskInput: validated.taskInput, provider: 'gemini', model: policy?.model ?? null });
    } catch { return send(400, { error: 'Invalid workflow, taskInput selection, game state, goal (1–500 characters), or participant label (at most 80 characters).' }); }
    if (configurationError) return sendError(configurationError);
    let ticket;
    try { ticket = ledger.admit(input.workflow); } catch (error) { return sendError(error); }
    log.emit('request_admitted', { admitted: true });
    let model; let result; let runError;
    try {
      model = createGeminiModel({ apiKey: env.GEMINI_API_KEY, model: policy.model, fetchImpl,
        abortSignal: abortController.signal, onEvent: (type, payload) => log.emit(type, payload) });
      result = await runWorkflow(input, model, { onEvent: event => log.observe(event) });
    } catch (error) { runError = error; }
    let accounting;
    try { accounting = ledger.finish(ticket, model?.getEvidence()); }
    catch { accounting = { reservationStatus: 'retained', ledgerStatus: 'unavailable' }; }
    if (runError) return sendError(runError);
    result.evidence.accounting = accounting;
    const cancelled = disconnected || result.stopReason === 'cancelled';
    finish(cancelled ? 'action_cancelled' : result.status === 'completed' ? 'action_completed' : 'action_failed', {
      status: cancelled ? 'cancelled' : result.status, stopReason: cancelled ? 'cancelled' : result.stopReason,
      finalOutput: result.finalOutput ?? null,
      error: result.status === 'completed' ? null : result.error ?? `AI workflow ${result.status}: ${result.stopReason}.`,
      evidence: result.evidence, finalValidation: result.status === 'completed' ? 'passed' : 'not_accepted',
    });
    result.evidence.logging = log.status();
    return send(200, result);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAgentServer();
  server.requestTimeout = 25_000;
  server.listen(3001, '127.0.0.1', () => console.log('Gemini agent service: http://127.0.0.1:3001'));
}
