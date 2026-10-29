// Manual browser interaction fixture. No .env, external fetch, or production ledger.
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createAgentServer } from './index.mjs';
import { fakeGemini, toolNames } from './testFixtures.mjs';

const root = resolve('.local'); mkdirSync(root, { recursive: true });
const directory = mkdtempSync(join(root, 'spec003-browser-'));
const fakes = Object.fromEntries(Object.keys(toolNames).map(workflow => [workflow, fakeGemini(workflow)]));
const api = createAgentServer({ env: { GEMINI_API_KEY: 'browser-mock-only', AI_TOOL_LOG_ENABLED: 'true', AI_TOOL_LOG_MODE: 'mock-test',
  AI_TOOL_LOG_PATH: join(directory, 'calls.jsonl'), AI_USAGE_LEDGER_PATH: join(directory, 'usage.json') },
  fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); const request = body.generateContentRequest ?? body;
    const instructions = request.systemInstruction.parts[0].text;
    const workflow = Object.keys(toolNames).find(key => instructions.includes(toolNames[key]));
    if (!workflow) throw new Error('Unknown mock workflow.');
    return fakes[workflow].fetchImpl(url, options);
  } });
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const vite = await createServer({ configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 5179, strictPort: true,
  proxy: { '/api': `http://127.0.0.1:${api.address().port}` } } });
await vite.listen();
console.log(JSON.stringify({ url: 'http://127.0.0.1:5179', directory, mode: 'mock-test', liveProviderCalls: 0 }));
async function close() { await vite.close(); await new Promise(resolve => api.close(resolve)); process.exit(0); }
process.once('SIGINT', close); process.once('SIGTERM', close);
