// Reproducible synthetic security events and sentinel evidence; no live calls.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createAgentServer } from './index.mjs';
import { createGameState } from '../src/game/gameEngine.ts';
import { fakeGemini } from './testFixtures.mjs';

mkdirSync('.local', { recursive: true }); const directory = mkdtempSync(join(resolve('.local'), 'spec004-security-'));
const sentinel = 'W08_SERVER_SECRET_DO_NOT_EXPOSE'; const fake = fakeGemini('decision_coach'); let keyObserved = false;
const path = join(directory, 'security.jsonl'); const state = createGameState(); const before = structuredClone(state);
const server = createAgentServer({ env: { GEMINI_API_KEY: sentinel, AI_USAGE_LEDGER_PATH: join(directory, 'usage.json'),
  AI_SECURITY_LOG_ENABLED: 'true', AI_SECURITY_LOG_PATH: path }, fetchImpl: (...args) => {
    keyObserved = args[1].headers['x-goog-api-key'] === sentinel; return fake.fetchImpl(...args);
  } });
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (route, value) => { const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); return { status: response.status, body: await response.json() }; };
  const context = await post('/api/agent/coach-context', { state }); assert.equal(context.status, 201);
  const request = { workflow: 'decision_coach', state, coachContext: context.body.coachContext, goal: 'GOAL_NOT_FOR_LOG', participant: { sessionId: `session_${crypto.randomUUID()}`, label: 'NICK_NOT_FOR_LOG' } };
  const denied = await post('/api/agent/run', { ...request, role: 'admin' }); assert.equal(denied.status, 400); assert.equal(fake.requests.length, 0);
  const allowed = await post('/api/agent/run', request); assert.equal(allowed.body.status, 'completed'); assert.equal(fake.requests.length, 4); assert.deepEqual(state, before);
  const text = readFileSync(path, 'utf8'); const events = text.trim().split('\n').map(JSON.parse);
  assert.ok(events.some(x => x.event === 'request.denied')); assert.ok(events.some(x => x.event === 'request.finished' && x.outcome === 'completed'));
  for (const forbidden of [sentinel, request.goal, request.participant.label, request.participant.sessionId, request.coachContext]) assert.equal(text.includes(forbidden), false);
  assert.equal(JSON.stringify(fake.requests).includes(sentinel), false); assert.equal(keyObserved, true);
  for (const asset of readdirSync('dist/assets')) assert.equal(readFileSync(join('dist/assets', asset)).includes(Buffer.from(sentinel)), false);
  const summary = { at: new Date().toISOString(), status: 'PASS', mode: 'mock-test', actualLiveProviderCalls: 0, loadedSentinelVerified: keyObserved,
    deniedHttpStatus: 400, deniedProviderCalls: 0, successHttpStatus: 200, successProviderCalls: 4, toolExecutions: allowed.body.evidence.toolCallCount,
    stateUnchanged: true, sentinelAbsentFromBundleResponseModelAndSecurityLog: !JSON.stringify(allowed.body).includes(sentinel),
    events, runtimeDirectory: relative(process.cwd(), directory).replaceAll('\\', '/') };
  writeFileSync('specs/004-secure-game/security-results.json', JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ status: summary.status, events: events.length, providerCalls: 4, actualLiveProviderCalls: 0, loadedSentinelVerified: true }));
} finally { await new Promise(resolve => server.close(resolve)); }
