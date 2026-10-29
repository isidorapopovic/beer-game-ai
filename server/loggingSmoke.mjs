// Local synthetic capture/export verification. Never calls Gemini or reads private .env.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createAgentServer } from './index.mjs';
import { createGameState, submitOrder } from '../src/game/gameEngine.ts';
import { fakeGemini, toolNames } from './testFixtures.mjs';
import { DEFAULT_MODEL } from './aiPolicy.mjs';
import { readEventLog } from './exportAiToolCallLog.mjs';

const localRoot = resolve('.local'); mkdirSync(localRoot, { recursive: true });
const directory = mkdtempSync(join(localRoot, 'spec002-smoke-'));
const logPath = join(directory, 'calls.jsonl'); const exportPath = join(directory, 'AI_TOOL_CALL_LOG.md');
const fakes = Object.fromEntries(Object.keys(toolNames).map(name => [name, fakeGemini(name)]));
let current;
const records = [];
const server = createAgentServer({ env: { GEMINI_API_KEY: 'mock-only-secret', GEMINI_MODEL: DEFAULT_MODEL,
  AI_TOOL_LOG_ENABLED: 'true', AI_TOOL_LOG_MODE: 'mock-test', AI_TOOL_LOG_PATH: logPath,
  AI_USAGE_LEDGER_PATH: join(directory, 'usage.json') }, fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); const request = body.generateContentRequest ?? body;
    const instructions = request.systemInstruction.parts[0].text;
    for (const [workflow, tool] of Object.entries(toolNames)) if (instructions.includes(tool)) current = workflow;
    assert.ok(current, 'Expected a known synthetic workflow.');
    return fakes[current].fetchImpl(url, options);
  } });
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let index = 0;
  for (const workflow of Object.keys(toolNames)) {
    let state = createGameState(); if (workflow === 'game_analyst') while (!state.isComplete) state = submitOrder(state, 4);
    const before = structuredClone(state);
    const participant = { sessionId: `session_${crypto.randomUUID()}`, label: `Mock-${++index}` };
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow, state, goal: 'Help with this synthetic game.', participant }),
    });
    const result = await response.json();
    assert.equal(result.status, 'completed'); assert.equal(result.logging.status, 'recorded');
    assert.equal(fakes[workflow].requests.length, 4); assert.deepEqual(state, before);
    records.push({ workflow, mode: 'mock-test', status: 'PASS', requestId: result.logging.requestId,
      runId: result.evidence.runId, eventsRecorded: result.logging.eventsRecorded,
      providerRequests: fakes[workflow].requests.length, gameStateUnchanged: true });
  }
  const exported = spawnSync(process.execPath, ['server/exportAiToolCallLog.mjs', '--input', logPath, '--output', exportPath], { encoding: 'utf8' });
  assert.equal(exported.status, 0, 'Export CLI must succeed.');
  const parsed = readEventLog(logPath); assert.equal(parsed.warnings.length, 0);
  assert.equal(new Set(parsed.events.map(event => event.requestId)).size, 4);
  const markdown = readFileSync(exportPath, 'utf8'); assert.match(markdown, /mock-test/); assert.equal(markdown.includes('mock-only-secret'), false);
  const summary = { at: new Date().toISOString(), mode: 'mock-test', status: 'PASS', records,
    totalEvents: parsed.events.length, exportWarnings: parsed.warnings.length,
    runtimeDirectory: relative(process.cwd(), directory).replaceAll('\\', '/'),
    report: relative(process.cwd(), exportPath).replaceAll('\\', '/'), actualLiveProviderCalls: 0 };
  if (process.env.AI_LOGGING_SMOKE_EVIDENCE_PATH) writeFileSync(process.env.AI_LOGGING_SMOKE_EVIDENCE_PATH, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} finally { await new Promise(resolve => server.close(resolve)); }
