import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, submitOrder } from '../src/game/gameEngine.ts';
import { createAgentServer } from './index.mjs';
import { runWorkflow } from './workflows.mjs';
import { createGeminiModel } from './gemini.mjs';

const toolNames = { decision_coach: 'getCurrentGameState', candidate_order_simulation: 'simulateCandidateOrder', game_analyst: 'getGameHistory', scenario_generator: 'getAllowedScenarioTypes' };
function finalFor(workflow, input) {
  const common = { summary: 'Verified result.', confidence: 'medium', completed: true };
  if (workflow === 'decision_coach') return { ...common, recommendation: 'Order 4.', recommendedOrderQuantity: 4, evidence: [{ source: 'game_state', fact: `Inventory is ${input.toolResult.inventory}.` }] };
  if (workflow === 'candidate_order_simulation') return { ...common, recommendation: 'Order 4.', recommendedOrderQuantity: 4, simulation: input.toolResult, evidence: [{ source: workflow, fact: 'Candidate order is 4 units.' }] };
  if (workflow === 'scenario_generator') return { ...common, scenario: 'growth', difficulty: 'hard', explanation: 'Growth requested.', evidence: [{ source: 'allowed_scenarios', fact: 'growth' }] };
  return { ...common, findings: [{ type: 'lesson', title: 'Review demand', explanation: 'Consider recorded demand.', weeks: [1], evidence: [{ source: 'game_history', fact: input.verifiedFacts[0] }] }], nextGameAdvice: ['Review the pipeline.'] };
}

for (const workflow of Object.keys(toolNames)) {
  test(`HTTP Gemini wiring: ${workflow}, two model calls, one tool, non-mutation`, async () => {
    let state = createGameState();
    if (workflow === 'game_analyst') while (!state.isComplete) state = submitOrder(state, 4);
    const before = structuredClone(state); let calls = 0;
    const server = createAgentServer({ env: { GEMINI_API_KEY: 'test-secret', GEMINI_MODEL: 'test-model' }, fetchImpl: async (url, options) => {
      calls++; assert.ok(!url.includes('test-secret')); assert.equal(options.headers['x-goog-api-key'], 'test-secret');
      const body = JSON.parse(options.body); const input = JSON.parse(body.contents[0].parts[0].text);
      const proposal = input.toolResult ? { kind: 'final', final: finalFor(workflow, input) }
        : { kind: 'tool_request', toolRequest: { name: toolNames[workflow], arguments: workflow === 'candidate_order_simulation' ? { orderQuantity: 4 } : {} } };
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(proposal) }] } }] }));
    } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflow, state, goal: 'Help me.' }) });
      const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.status, 'completed');
      assert.equal(calls, 2); assert.equal(result.evidence.toolCallCount, 1); assert.equal(result.evidence.modelCalls, 2);
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
    const result = await runWorkflow({ state: createGameState(), workflow: 'candidate_order_simulation', goal: 'Help.' }, async () => proposal);
    assert.notEqual(result.status, 'completed'); assert.equal(result.evidence.toolCallCount, 0);
  }
});
test('adapter sanitizes errors and excludes thinking parts', async () => {
  const input = { instructions: 'Return JSON.', input: {}, deadlineAt: new Date(Date.now() + 1000).toISOString() };
  const model = createGeminiModel({ apiKey: 'secret', model: 'test', fetchImpl: async () => { throw new Error('secret diagnostics'); } });
  await assert.rejects(model(input), error => !error.message.includes('secret'));
  const safe = createGeminiModel({ apiKey: 'secret', model: 'test', fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden' }, { text: '{"kind":"refusal"}' }] } }] })) });
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
