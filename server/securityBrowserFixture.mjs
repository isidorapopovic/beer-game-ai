// Explicit local synthetic browser laboratory. No .env or live provider path.
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createAgentServer } from './index.mjs';
import { createProductionServer } from './secureApp.mjs';
import { fakeGemini, toolNames } from './testFixtures.mjs';

const root = resolve('.local'); mkdirSync(root, { recursive: true });
const directory = mkdtempSync(join(root, 'spec004-browser-')); const dist = join(directory, 'dist');
cpSync(resolve('dist'), dist, { recursive: true });
const index = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = '<script src="/security-probe.js" defer></script><script src="/security-browser-driver.js" defer></script>';
writeFileSync(join(dist, 'index.html'), index.replace('</head>', scripts + '</head>'));
const sentinel = 'W08_SERVER_SECRET_DO_NOT_EXPOSE';
const payload = 'Đorđe kaže: a < b. <img src="/w08-missing.png" onerror="window.__w08XssMarker=true"> [klik](javascript:window.__w08XssMarker=true)';
const fakes = Object.fromEntries(Object.keys(toolNames).map(workflow => [workflow, fakeGemini(workflow, { transform: final => workflow === 'decision_coach' ? { ...final, summary: payload } : final })]));
const logPath = join(directory, 'calls.jsonl'); const securityPath = join(directory, 'security.jsonl');
const api = createAgentServer({ env: { GEMINI_API_KEY: sentinel, AI_USAGE_LEDGER_PATH: join(directory, 'usage.json'),
  AI_TOOL_LOG_ENABLED: 'true', AI_TOOL_LOG_MODE: 'mock-test', AI_TOOL_LOG_PATH: logPath,
  AI_SECURITY_LOG_ENABLED: 'true', AI_SECURITY_LOG_PATH: securityPath }, fetchImpl: (url, options) => {
    const body = JSON.parse(options.body); const request = body.generateContentRequest ?? body;
    const toolResult = JSON.parse(request.contents[0].parts[0].text).toolResult;
    const workflow = Object.keys(toolNames).find(name => request.systemInstruction.parts[0].text.includes(toolNames[name]))
      ?? (toolResult?.recentOrders ? 'decision_coach' : toolResult?.orderQuantity !== undefined ? 'candidate_order_simulation'
        : toolResult?.weeks ? 'game_analyst' : toolResult?.scenarios ? 'scenario_generator' : undefined);
    if (!workflow) throw new Error('Unknown synthetic workflow.');
    return fakes[workflow].fetchImpl(url, options);
  } });
const production = createProductionServer({ apiServer: api, distPath: dist });
const observations = [];
const driverEvents = [];
writeFileSync(join(dist, 'security-probe.js'), readFileSync(new URL('./securityBrowserProbe.js', import.meta.url)));
writeFileSync(join(dist, 'security-browser-driver.js'), readFileSync(new URL('./securityBrowserDriver.js', import.meta.url)));

const server = createServer(async (req, res) => {
  if (new URL(req.url, 'http://localhost').pathname === '/control.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('<!doctype html><title>W08 CSP positive control</title>' + scripts + '<p>W08 control: script executes without CSP</p>'); return;
  }
  if (req.url === '/__security_driver' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4000) { res.writeHead(413); res.end(); return; } }
    try {
      const data = JSON.parse(body);
      if (!data || !['PASS', 'FAIL'].includes(data.status) || typeof data.stage !== 'string' || data.stage.length > 80 || driverEvents.length >= 32) throw new Error('Invalid driver event');
      driverEvents.push({ stage: data.stage, status: data.status, ...(data.error ? { error: String(data.error).slice(0, 300) } : {}) });
    } catch { res.writeHead(400); res.end(); return; }
    res.writeHead(204); res.end(); return;
  }
  if (req.url === '/__security_observation' && req.method === 'POST') {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 4000) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
    try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (observations.length < 256) observations.push(data); } catch { res.writeHead(400); res.end(); return; }
    res.writeHead(204); res.end(); return;
  }
  if (req.url === '/__security_report') {
    const text = path => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
    const logs = text(logPath); const security = text(securityPath);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ mode: 'mock-test', observations, automation: { driver: 'server/securityBrowserDriver.js', events: driverEvents }, liveProviderCalls: 0,
      providerRequests: Object.fromEntries(Object.entries(fakes).map(([name, fake]) => [name, fake.requests.length])),
      activityEvents: logs.trim() ? logs.trim().split('\n').length : 0, securityEvents: security.trim() ? security.trim().split('\n').length : 0,
      sentinelInSecurityLog: security.includes(sentinel), sentinelInActivityLog: logs.includes(sentinel),
      runtimeDirectory: relative(process.cwd(), directory).replaceAll('\\', '/') })); return;
  }
  production.emit('request', req, res);
});
await new Promise(resolve => server.listen(5179, '127.0.0.1', resolve));
console.log(JSON.stringify({ url: 'http://127.0.0.1:5179/?security-auto=1', report: 'http://127.0.0.1:5179/__security_report', directory, mode: 'mock-test', liveProviderCalls: 0 }));
async function close() { await new Promise(resolve => server.close(resolve)); process.exit(0); }
process.once('SIGINT', close); process.once('SIGTERM', close);
