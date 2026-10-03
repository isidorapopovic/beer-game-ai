import assert from 'node:assert/strict';
import { createGameState, submitOrder } from '../src/game/gameEngine.ts';
import { createGeminiModel } from './gemini.mjs';
import { runWorkflow } from './workflows.mjs';

if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
  console.error('LIVE SMOKE NOT RUN: configure GEMINI_API_KEY and GEMINI_MODEL in .env.');
  process.exitCode = 1;
} else {
  const model = createGeminiModel({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL });
  let state = createGameState();
  const cases = [
    ['decision_coach', state, 'Recommend an order for this week.'],
    ['candidate_order_simulation', state, 'Simulate exactly 9 units and explain shipment timing.'],
  ];
  while (!state.isComplete) state = submitOrder(state, 4);
  cases.push(['game_analyst', state, 'Analyze my completed game using exact verified facts.']);
  cases.push(['scenario_generator', createGameState(), 'Select a hard growth scenario.']);
  for (const [workflow, snapshot, goal] of cases) {
    const before = structuredClone(snapshot);
    const result = await runWorkflow({ workflow, state: snapshot, goal }, model);
    console.log(JSON.stringify(result.evidence));
    assert.equal(result.status, 'completed', `${workflow}: ${result.stopReason}`);
    assert.ok(result.evidence.modelCalls >= 2); assert.ok(result.evidence.toolCallCount >= 1);
    assert.deepEqual(snapshot, before);
  }
  console.log('LIVE SMOKE PASS: all four Gemini workflows completed; game snapshots unchanged.');
}
