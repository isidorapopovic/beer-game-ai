import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, submitOrder } from '../src/game/gameEngine.ts';
import { createAgentServer } from './index.mjs';
import { runWorkflow } from './workflows.mjs';
import { createGeminiModel } from './gemini.mjs';
import { DEFAULT_MODEL } from './aiPolicy.mjs';
import { withCoachContext, testEnvironment, toolNames, taskInputFor, fakeGemini, modelResponse, jsonResponse } from './testFixtures.mjs';

for (const workflow of Object.keys(toolNames)) {
  test(`HTTP Gemini wiring: ${workflow}, two model calls, one tool, non-mutation`, async (t) => {
    let state = createGameState();
    if (workflow === 'game_analyst') while (!state.isComplete) state = submitOrder(state, 4);
    const before = structuredClone(state);
    const fake = fakeGemini(workflow);
    const server = createAgentServer({ env: testEnvironment(t), fetchImpl: fake.fetchImpl });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await withCoachContext(`http://127.0.0.1:${server.address().port}/api/agent/run`, { workflow, taskInput: taskInputFor(workflow), state, goal: 'Help me.' })) });
      const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.status, 'completed');
      assert.equal(fake.requests.length, 4);
      assert.equal(result.evidence.countTokenCalls, 2); assert.equal(result.evidence.providerHttpCalls, 4);
      assert.equal(result.evidence.usageStatus, 'complete');
      for (let i = 0; i < 4; i += 2) {
        const { model, ...countedRequest } = fake.requests[i].body.generateContentRequest;
        assert.equal(model, 'models/' + DEFAULT_MODEL);
        assert.deepEqual(countedRequest, fake.requests[i + 1].body);
      } assert.equal(result.evidence.toolCallCount, 1); assert.equal(result.evidence.modelCalls, 2);
      assert.equal(JSON.stringify(result).includes('test-secret'), false); assert.deepEqual(state, before);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}

test('wrong phase and invalid state never call provider', async () => {
  let calls = 0; const model = async () => { calls++; };
  const state = createGameState();
  const result = await runWorkflow({ state, workflow: 'game_analyst', goal: 'Analyze.' }, model);
  assert.equal(result.stopReason, 'preflight_rejected'); assert.equal(calls, 0);
  await assert.rejects(runWorkflow({ state: { ...state, inventory: 999 }, workflow: 'decision_coach', goal: 'Help.' }, model));
  assert.equal(calls, 0);
});
test('unknown tools, invalid quantity and premature final are rejected', async () => {
  for (const proposal of [
    { kind: 'tool_request', toolRequest: { name: 'deleteEverything', arguments: {} } },
    { kind: 'tool_request', toolRequest: { name: 'simulateCandidateOrder', arguments: { orderQuantity: 1000 } } },
    { kind: 'final', final: { summary: 'Skip validation', completed: true } },
  ]) {
    const result = await runWorkflow({ state: createGameState(), workflow: 'candidate_order_simulation', taskInput: { orderQuantity: 4 }, goal: 'Help.' }, async () => proposal);
    assert.notEqual(result.status, 'completed'); assert.equal(result.evidence.toolCallCount, 0);
  }
});
test('adapter sanitizes errors and excludes thinking parts', async () => {
  const input = { instructions: 'Return JSON.', input: {}, deadlineAt: new Date(Date.now() + 1000).toISOString() };
  const model = createGeminiModel({ apiKey: 'secret', model: DEFAULT_MODEL, fetchImpl: async () => { throw new Error('secret diagnostics'); } });
  await assert.rejects(model(input), error => !error.message.includes('secret'));
  const safe = createGeminiModel({ apiKey: 'secret', model: DEFAULT_MODEL, fetchImpl: async url => url.endsWith(':countTokens') ? jsonResponse({ totalTokens: 10 }) : modelResponse({ kind: 'refusal' }) });
  assert.deepEqual(await safe(input), { kind: 'refusal' });
});
test('missing configuration returns 503 without mock fallback', async () => {
  const server = createAgentServer({ env: {}, fetchImpl: async () => { throw new Error('must not call'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflow: 'decision_coach', state: createGameState(), goal: 'Help.' }) });
    assert.equal(response.status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
