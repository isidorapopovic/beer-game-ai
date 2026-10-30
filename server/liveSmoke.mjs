import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createGameState, submitOrder } from '../src/game/gameEngine.ts';
import { createAgentServer } from './index.mjs';
import { readAiPolicy } from './aiPolicy.mjs';

const artifactPath = process.env.AI_LIVE_EVIDENCE_PATH;
const records = [];
let server;
try {
  if (!process.env.GEMINI_API_KEY?.trim()) throw new Error('Configure GEMINI_API_KEY before live smoke.');
  const policy = readAiPolicy();
  server = createAgentServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let state = createGameState();
  const cases = [
    ['decision_coach', state, 'Recommend an order for this week.'],
    ['candidate_order_simulation', state, 'Simulate exactly 9 units and explain shipment timing.'],
  ];
  while (!state.isComplete) state = submitOrder(state, 4);
  cases.push(['game_analyst', state, 'Analyze my completed game using exact verified facts.']);
  cases.push(['scenario_generator', createGameState(), 'Select a hard growth scenario.']);
  const selected = process.env.AI_LIVE_WORKFLOWS?.split(',');
  if (selected?.some(name => !cases.some(([workflow]) => workflow === name))) throw new Error('Unknown smoke workflow.');
  let failed = false;
  for (const [workflow, snapshot, goal] of cases) {
    if (selected && !selected.includes(workflow)) continue;
    const before = structuredClone(snapshot);
    let coachContext;
    if (workflow === 'decision_coach') {
      const contextResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/coach-context`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: snapshot }),
      });
      coachContext = (await contextResponse.json()).coachContext;
      if (!contextResponse.ok) throw new Error('Coach context unavailable.');
    }
    const taskInput = workflow === 'candidate_order_simulation' ? { orderQuantity: 9 }
      : workflow === 'scenario_generator' ? { scenario: 'growth', difficulty: 'hard' } : {};
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow, state: snapshot, goal, taskInput, coachContext }), signal: AbortSignal.timeout(25_000),
    });
    const result = await response.json();
    const record = { at: new Date().toISOString(), mode: 'live', workflow, goal, model: policy.model,
      httpStatus: response.status, status: result.status ?? 'failed', error: result.error,
      stopReason: result.stopReason, evidence: result.evidence, finalOutput: result.finalOutput };
    records.push(record); console.log(JSON.stringify(record));
    try {
      assert.equal(response.status, 200); assert.equal(result.status, 'completed', result.stopReason);
      assert.equal(result.evidence.generationCalls, 2); assert.equal(result.evidence.countTokenCalls, 2);
      assert.equal(result.evidence.toolCallCount, 1);
      // Missing optional thinking metadata stays null (FR-05). Provider totals can
      // still verify the complete output budget without inventing a thinking count.
      for (const call of result.evidence.calls) {
        assert.ok(Number.isSafeInteger(call.usage.promptTokenCount));
        assert.ok(Number.isSafeInteger(call.usage.totalTokenCount));
        assert.ok(call.usage.promptTokenCount <= call.inputTokenLimit);
        const billedOutput = call.usage.totalTokenCount - call.usage.promptTokenCount;
        assert.ok(billedOutput >= 0 && billedOutput <= call.outputTokenLimit);
      }
      assert.deepEqual(snapshot, before);
    } catch { failed = true; }
    // Exactly one attempt per workflow. No retries, continuations, or model changes.
  }
  console.log(failed ? 'LIVE SMOKE FAILED: see sanitized per-workflow records.' : `LIVE SMOKE PASS: ${records.length} workflows completed within observed total-token caps; metadata completeness reported; snapshots unchanged.`);
  if (failed) process.exitCode = 1;
} catch {
  console.error('LIVE SMOKE NOT COMPLETED: check supported model, key, connectivity, and local usage ledger.');
  process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (artifactPath) writeFileSync(artifactPath, JSON.stringify({ mode: 'live', records }, null, 2) + '\n');
}
