import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createGeminiModel } from './gemini.mjs';
import { runWorkflow, validateRequest } from './workflows.mjs';

export function createAgentServer({ env = process.env, fetchImpl = fetch } = {}) {
  return createServer(async (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    // Local development service; browser requests must originate from the local UI.
    if (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)) return send(403, { error: 'Origin not allowed.' });
    if (req.url === '/api/agent/status' && req.method === 'GET') return send(200, { provider: 'gemini', configured: Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL) });
    if (req.url !== '/api/agent/run' || req.method !== 'POST') return send(404, { error: 'Not found.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
    let input;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 100_000) return send(413, { error: 'Request too large.' }); chunks.push(chunk); }
      input = JSON.parse(Buffer.concat(chunks).toString());
      validateRequest(input);
    } catch { return send(400, { error: 'Invalid workflow or game state.' }); }
    if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) return send(503, { error: 'Gemini is not configured. Set GEMINI_API_KEY and GEMINI_MODEL on the server, then restart it.' });
    try {
      const result = await runWorkflow(input, createGeminiModel({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetchImpl }));
      return send(200, result);
    } catch { return send(502, { error: 'The AI workflow could not be completed safely.' }); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAgentServer();
  server.requestTimeout = 25_000;
  server.listen(3001, '127.0.0.1', () => console.log('Gemini agent service: http://127.0.0.1:3001'));
}
