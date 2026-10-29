import { mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DEFAULT_MODEL } from './aiPolicy.mjs';

export const toolNames = { decision_coach: 'getCurrentGameState', candidate_order_simulation: 'simulateCandidateOrder', game_analyst: 'getGameHistory', scenario_generator: 'getAllowedScenarioTypes' };
export function testEnvironment(t, overrides = {}) {
  const root = resolve('.local/tests'); mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'ai-'));
  t.after(() => { if (!dir.startsWith(root + '\\') && !dir.startsWith(root + '/')) throw new Error('Unsafe cleanup path'); rmSync(dir, { recursive: true, force: true }); });
  return { GEMINI_API_KEY: 'test-secret', GEMINI_MODEL: DEFAULT_MODEL, AI_USAGE_LEDGER_PATH: join(dir, 'ledger.json'), ...overrides };
}
export function finalFor(workflow, input) {
  const common = { summary: 'Verified result.', confidence: 'medium', completed: true };
  if (workflow === 'decision_coach') return { ...common, recommendation: 'Order 4.', recommendedOrderQuantity: 4, evidence: [{ source: 'game_state', fact: `Inventory is ${input.toolResult.inventory}.` }] };
  if (workflow === 'candidate_order_simulation') return { ...common, recommendation: 'Order 4.', recommendedOrderQuantity: 4, simulation: input.toolResult, evidence: [{ source: workflow, fact: 'Candidate order is 4 units.' }] };
  if (workflow === 'scenario_generator') return { ...common, scenario: 'growth', difficulty: 'hard', explanation: 'Growth requested.', evidence: [{ source: 'allowed_scenarios', fact: 'growth' }] };
  return { ...common, findings: [{ type: 'lesson', title: 'Review demand', explanation: 'Consider recorded demand.', weeks: [1], evidence: [{ source: 'game_history', fact: input.verifiedFacts[0] }] }], nextGameAdvice: ['Review the pipeline.'] };
}
export const jsonResponse = value => new Response(JSON.stringify(value));
export function modelResponse(proposal, { usage = true, finishReason = 'STOP', prompt = 100, candidate = 20, thoughts = 0 } = {}) {
  return jsonResponse({ modelVersion: DEFAULT_MODEL, candidates: [{ finishReason,
    content: { parts: [{ thought: true, text: 'PRIVATE_THOUGHT' }, { text: JSON.stringify(proposal) }] } }],
    ...(usage ? { usageMetadata: { promptTokenCount: prompt, candidatesTokenCount: candidate,
      thoughtsTokenCount: thoughts, totalTokenCount: prompt + candidate + thoughts } } : {}) });
}
export function fakeGemini(workflow, { count = 100, usage = true, transform = value => value } = {}) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body); requests.push({ url, body });
    if (url.endsWith(':countTokens')) return jsonResponse({ totalTokens: count });
    const input = JSON.parse(body.contents[0].parts[0].text);
    const proposal = input.toolResult ? { kind: 'final', final: transform(finalFor(workflow, input)) }
      : { kind: 'tool_request', toolRequest: { name: toolNames[workflow], arguments: workflow === 'candidate_order_simulation' ? { orderQuantity: 4 } : {} } };
    return modelResponse(proposal, { usage });
  };
  return { requests, fetchImpl };
}
