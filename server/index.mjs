import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createGeminiModel } from './gemini.mjs';
import { runWorkflow, validateRequest } from './workflows.mjs';
import { AiPolicyError, HTTP_BODY_BYTES, readAiPolicy } from './aiPolicy.mjs';
import { createUsageLedger } from './aiUsageLedger.mjs';

export function createAgentServer({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  let policy; let configurationError; let ledger;
  try {
    policy = readAiPolicy(env);
    if (!env.GEMINI_API_KEY?.trim()) throw new AiPolicyError('CONFIGURATION', 'Gemini is not configured. Set GEMINI_API_KEY on the server, then restart it.');
    ledger = createUsageLedger({ policy, now });
  } catch (error) { configurationError = error; }
  return createServer(async (req, res) => {
    const send = (code, body, headers = {}) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
      res.end(JSON.stringify(body));
    };
    const sendError = error => {
      const safe = error instanceof AiPolicyError ? error : new AiPolicyError('AI_UNAVAILABLE', 'The AI workflow could not be completed safely.', 502);
      send(safe.status, { error: safe.message, code: safe.code },
        safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {});
    };
    if (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)) return send(403, { error: 'Origin not allowed.' });
    if (req.url === '/api/agent/status' && req.method === 'GET') return send(200, {
      provider: 'gemini', configured: !configurationError, model: policy?.model,
      dailyAllowanceUsd: policy?.dailyBudgetUsd, reconciliationVerified: policy?.reconcileVerified,
    });
    if (req.url !== '/api/agent/run' || req.method !== 'POST') return send(404, { error: 'Not found.' });
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
      validateRequest(input);
    } catch { return send(400, { error: 'Invalid workflow, game state, or goal (1–500 characters).' }); }
    if (configurationError) return sendError(configurationError);
    let ticket;
    try { ticket = ledger.admit(input.workflow); } catch (error) { return sendError(error); }
    let model; let result; let runError;
    try {
      model = createGeminiModel({ apiKey: env.GEMINI_API_KEY, model: policy.model, fetchImpl });
      result = await runWorkflow(input, model);
    } catch (error) { runError = error; }
    let accounting;
    try { accounting = ledger.finish(ticket, model?.getEvidence()); }
    catch { accounting = { reservationStatus: 'retained', ledgerStatus: 'unavailable' }; }
    if (runError) return sendError(runError);
    result.evidence.accounting = accounting;
    return send(200, result);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAgentServer();
  server.requestTimeout = 25_000;
  server.listen(3001, '127.0.0.1', () => console.log('Gemini agent service: http://127.0.0.1:3001'));
}
