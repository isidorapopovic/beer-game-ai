import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_MODEL, WORKFLOW_BUDGETS, readAiPolicy, maximumRunCost, estimateCost } from './aiPolicy.mjs';
import { createGeminiModel, readBoundedJson } from './gemini.mjs';
import { createUsageLedger } from './aiUsageLedger.mjs';
import { createAgentServer } from './index.mjs';
import { validateRequest, runWorkflow } from './workflows.mjs';
import { createGameState, submitOrder } from '../src/game/gameEngine.ts';
import { validateGoal } from '../src/agent/aiLimits.ts';
import { normalizeDecisionCoachResult, getCurrentGameStateTool } from '../src/agent/decisionCoach.ts';
import { normalizeCandidateOrderAdvice, simulateCandidateOrder, executeCandidateOrderSimulation } from '../src/agent/candidateOrderSimulation.ts';
import { normalizePostGameAnalysis, getGameHistoryTool } from '../src/agent/gameAnalyst.ts';
import { normalizeScenarioSelectionResult } from '../src/agent/scenarioGenerator.ts';
import { testEnvironment, finalFor, fakeGemini, jsonResponse, modelResponse } from './testFixtures.mjs';

const args = (extra = {}) => ({ instructions: 'Return JSON.', input: { goal: 'Help.' }, deadlineAt: new Date(Date.now() + 5000).toISOString(), ...extra });
const createModel = fetchImpl => createGeminiModel({ apiKey: 'test-secret', fetchImpl });
const ledgerData = env => JSON.parse(readFileSync(env.AI_USAGE_LEDGER_PATH, 'utf8'));
const request = (extra = {}) => ({ workflow: 'decision_coach', state: createGameState(), goal: 'Help.', ...extra });
async function startServer(t, options) {
  const server = createAgentServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/agent/run`;
  return async (input = request()) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    return { response, body: await response.json() };
  };
}

test('policy defaults pin cheap model/prices, reject unsupported or unsafe overrides', () => {
  const policy = readAiPolicy({});
  assert.equal(policy.model, DEFAULT_MODEL); assert.equal(policy.dailyBudgetUsd, 1);
  assert.equal(policy.reconcileVerified, false);
  assert.equal(estimateCost(policy.profile, 1200, 400, 0), 0.0009);
  assert.equal(maximumRunCost(policy, 'decision_coach'), 0.001408);
  for (const env of [{ GEMINI_MODEL: 'expensive-model' }, { GEMINI_MODEL: 'constructor' }, { AI_DAILY_BUDGET_USD: '2' },
    { AI_DAILY_BUDGET_USD: 'NaN' }, { AI_DAILY_BUDGET_USD: '' }, { AI_COST_RECONCILIATION_VERIFIED: 'yes' }]) assert.throws(() => readAiPolicy(env));
  assert.throws(() => createGeminiModel({ apiKey: 'x', model: 'anything' }));
  assert.throws(() => createGeminiModel({ apiKey: '' }));
});

test('Unicode goal limit is shared; trim before counting; browser cannot override model', () => {
  const goal = '😀'.repeat(500);
  assert.equal(validateGoal('  ' + goal + '  '), goal);
  assert.equal(validateRequest(request({ goal })).goal, goal);
  assert.throws(() => validateGoal(goal + 'a'));
  assert.throws(() => validateRequest(request({ goal: goal + 'a' })));
  assert.throws(() => validateRequest(request({ model: DEFAULT_MODEL })));
});

for (const workflow of Object.keys(WORKFLOW_BUDGETS)) {
  for (const stage of ['proposal', 'final']) {
    test(`${workflow} ${stage}: exact token cap accepted, cap+1 blocks generation`, async () => {
      const limit = stage === 'proposal' ? 768 : WORKFLOW_BUDGETS[workflow].input;
      for (const count of [limit, limit + 1]) {
        let generations = 0; let generationBody;
        const model = createModel(async (url, options) => {
          if (url.endsWith(':countTokens')) return jsonResponse({ totalTokens: count });
          generations++; generationBody = JSON.parse(options.body);
          return modelResponse({ kind: 'refusal' }, { prompt: count });
        });
        if (count === limit) {
          await model(args({ workflow, stage }));
          assert.equal(generationBody.generationConfig.maxOutputTokens, stage === 'proposal' ? 128 : WORKFLOW_BUDGETS[workflow].output);
          assert.equal(generationBody.generationConfig.candidateCount, 1);
          assert.equal(generationBody.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
          assert.equal(generations, 1);
        } else {
          await assert.rejects(model(args({ workflow, stage })), error => error.code === 'input_token_limit');
          assert.equal(generations, 0); assert.equal(model.getEvidence().countTokenCalls, 1);
        }
      }
    });
  }
}

test('adapter guards two-generation/four-HTTP ceiling before third dispatch', async () => {
  let http = 0;
  const model = createModel(async url => { http++; return url.endsWith(':countTokens') ? jsonResponse({ totalTokens: 100 }) : modelResponse({ kind: 'refusal' }); });
  await model(args()); await model(args({ stage: 'final' }));
  await assert.rejects(model(args()), error => error.code === 'request_limit');
  assert.equal(http, 4); assert.equal(model.getEvidence().generationCalls, 2);
});

test('invalid count and provider 429/503 stop without generation, retry, or secret leakage', async () => {
  for (const reply of [() => jsonResponse({ totalTokens: -1 }), () => jsonResponse({ totalTokens: '100' }),
    () => new Response('test-secret PRIVATE', { status: 429 }), () => new Response('PRIVATE', { status: 503 })]) {
    let calls = 0;
    const model = createModel(async () => { calls++; return reply(); });
    await assert.rejects(model(args()), error => !error.message.includes('PRIVATE') && !error.message.includes('test-secret'));
    assert.equal(calls, 1); assert.equal(model.getEvidence().generationCalls, 0);
  }
});

test('usage includes thinking once and survives MAX_TOKENS/malformed JSON/refusal', async () => {
  for (const finish of ['MAX_TOKENS', 'SAFETY', 'STOP']) {
    const model = createModel(async url => url.endsWith(':countTokens') ? jsonResponse({ totalTokens: 100 })
      : modelResponse({ kind: 'refusal' }, { finishReason: finish, candidate: 20, thoughts: 4 }));
    if (finish === 'STOP') assert.deepEqual(await model(args()), { kind: 'refusal' });
    else await assert.rejects(model(args()));
    const evidence = model.getEvidence();
    assert.equal(evidence.usage.totalTokenCount, 124); assert.equal(evidence.usageStatus, 'complete');
    assert.equal(evidence.estimatedUsd, (100 * 0.25 + 24 * 1.5) / 1e6);
    assert.equal(JSON.stringify(evidence).includes('PRIVATE_THOUGHT'), false);
  }
  const model = createModel(async url => {
    if (url.endsWith(':countTokens')) return jsonResponse({ totalTokens: 100 });
    const body = await modelResponse({}).json(); body.candidates[0].content.parts = [{ text: '{bad' }]; return jsonResponse(body);
  });
  await assert.rejects(model(args())); assert.equal(model.getEvidence().usageStatus, 'complete');
});

test('missing or inconsistent metadata stays unknown/partial, not zero', async () => {
  const model = createModel(async url => url.endsWith(':countTokens') ? jsonResponse({ totalTokens: 100 }) : modelResponse({}, { usage: false }));
  await model(args()); assert.equal(model.getEvidence().usageStatus, 'unknown'); assert.equal(model.getEvidence().estimatedUsd, null);
  assert.equal(model.getEvidence().usage.promptTokenCount, null);
  let generation = 0;
  const partial = createModel(async url => {
    if (url.endsWith(':countTokens')) return jsonResponse({ totalTokens: 100 });
    generation++; return modelResponse({}, { usage: generation === 1 });
  });
  await partial(args()); await partial(args({ stage: 'final' }));
  const evidence = partial.getEvidence(); assert.equal(evidence.usageStatus, 'partial');
  assert.equal(evidence.usage.promptTokenCount, 100); assert.equal(evidence.estimatedUsd, null); assert.ok(evidence.knownEstimatedUsd > 0);
  const inconsistent = createModel(async url => {
    if (url.endsWith(':countTokens')) return jsonResponse({ totalTokens: 100 });
    const data = await modelResponse({}).json(); data.usageMetadata.totalTokenCount = 125; return jsonResponse(data);
  });
  await inconsistent(args()); assert.equal(inconsistent.getEvidence().usageStatus, 'partial');
  assert.equal(inconsistent.getEvidence().estimatedUsd, null);
});

test('omitted thinking stays null, known cost is a lower bound, total output cap still enforced', async () => {
  for (const total of [120, 229]) {
    const model = createModel(async url => {
      if (url.endsWith(':countTokens')) return jsonResponse({ totalTokens: 100 });
      const data = await modelResponse({}).json(); delete data.usageMetadata.thoughtsTokenCount;
      data.usageMetadata.totalTokenCount = total; return jsonResponse(data);
    });
    if (total === 120) await model(args());
    else await assert.rejects(model(args()), error => error.code === 'provider_budget_mismatch');
    const e = model.getEvidence(); assert.equal(e.usage.thoughtsTokenCount, null);
    assert.equal(e.estimatedUsd, null); assert.equal(e.knownEstimatedUsd, 0.000055);
  }
});

test('provider body and JSON text bounded; timeout covers streaming body reads', async () => {
  await assert.rejects(readBoundedJson(new Response(' '.repeat(64001)), AbortSignal.timeout(1000)));
  let cancelled = false;
  const stream = new ReadableStream({ pull() {}, cancel() { cancelled = true; } });
  await assert.rejects(readBoundedJson(new Response(stream), AbortSignal.timeout(30)));
  assert.equal(cancelled, true);
  const model = createModel(async url => url.endsWith(':countTokens') ? jsonResponse({ totalTokens: 100 }) : modelResponse({ value: 'a'.repeat(12001) }));
  await assert.rejects(model(args())); assert.equal(model.getEvidence().generationCalls, 1);
});

test('one deadline bounds count and generation with no retry', async () => {
  const model = createModel(async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('private')), { once: true });
  }));
  // Keep a test timer alive: AbortSignal's timer is unref'd by Node.
  const timer = setTimeout(() => {}, 200);
  try { await assert.rejects(model(args({ deadlineAt: new Date(Date.now() + 30).toISOString() })), error => error.code === 'deadline'); }
  finally { clearTimeout(timer); }
  assert.equal(model.getEvidence().countTokenCalls, 1); assert.equal(model.getEvidence().generationCalls, 0);
});

test('concise validators accept exact Unicode length and reject overlong fields/items', () => {
  const coach = finalFor('decision_coach', { toolResult: { inventory: 12 } });
  assert.ok(normalizeDecisionCoachResult({ ...coach, summary: '\u{1f600}'.repeat(240) }, getCurrentGameStateTool(createGameState())));
  for (const final of [{ ...coach, summary: 'a'.repeat(241) }, { ...coach, recommendation: 'a'.repeat(241) },
    { ...coach, evidence: [] }, { ...coach, evidence: [...coach.evidence, ...coach.evidence, ...coach.evidence] },
    { ...coach, evidence: [{ source: 'game_state', fact: 'a'.repeat(161) }] }]) assert.throws(() => normalizeDecisionCoachResult(final, getCurrentGameStateTool(createGameState())));
  const simulation = simulateCandidateOrder(createGameState(), { orderQuantity: 4 });
  const candidate = finalFor('candidate_order_simulation', { toolResult: simulation });
  assert.throws(() => normalizeCandidateOrderAdvice({ ...candidate, recommendation: 'a'.repeat(241) }, simulation));
  const scenario = finalFor('scenario_generator', {});
  assert.throws(() => normalizeScenarioSelectionResult({ ...scenario, explanation: 'a'.repeat(241) }));
  let state = createGameState(); while (!state.isComplete) state = submitOrder(state, 4);
  const history = getGameHistoryTool(state);
  const analyst = finalFor('game_analyst', { verifiedFacts: ['Week 1 demand was 4 units.'] });
  for (const final of [{ ...analyst, findings: Array(4).fill(analyst.findings[0]) },
    { ...analyst, nextGameAdvice: ['a', 'b', 'c'] }, { ...analyst, nextGameAdvice: ['a'.repeat(161)] },
    { ...analyst, findings: [{ ...analyst.findings[0], title: 'a'.repeat(81) }] },
    { ...analyst, findings: [{ ...analyst.findings[0], explanation: 'a'.repeat(241) }] }]) assert.throws(() => normalizePostGameAnalysis(final, history));
});

test('candidate final cannot substitute a different valid simulation after tool execution', async () => {
  const state = createGameState();
  const result = await executeCandidateOrderSimulation({ state, goal: 'Simulate 4.',
    modelStep: async () => ({ kind: 'tool_request', toolRequest: { name: 'simulateCandidateOrder', arguments: { orderQuantity: 4 } } }),
    modelStep2: async () => ({ kind: 'final', final: { ...finalFor('candidate_order_simulation', { toolResult: simulateCandidateOrder(state, { orderQuantity: 5 }) }), recommendedOrderQuantity: 5 } }) });
  assert.equal(result.stopReason, 'invalid_final_result');
});

test('ledger reserves durably before dispatch and shares concurrency guard', t => {
  const env = testEnvironment(t); const policy = readAiPolicy(env);
  const a = createUsageLedger({ policy }); const b = createUsageLedger({ policy });
  const ticket = a.admit('decision_coach');
  const entries = Object.values(ledgerData(env).days).flat(); assert.equal(entries.length, 1); assert.ok(entries[0].charge > 0);
  assert.throws(() => b.admit('decision_coach'), error => error.code === 'AI_BUSY');
  a.finish(ticket, { usageStatus: 'unknown', estimatedUsd: null });
  const next = b.admit('decision_coach'); b.finish(next); assert.equal(Object.values(ledgerData(env).days).flat().length, 2);
});

test('ledger rolling minute survives restart and consumes failed admissions', t => {
  const env = testEnvironment(t); const policy = readAiPolicy(env); let time = Date.parse('2026-10-29T12:00:00Z');
  const options = { policy, now: () => time };
  for (let i = 0; i < 6; i++) { const ledger = createUsageLedger(options); ledger.finish(ledger.admit('decision_coach')); }
  assert.throws(() => createUsageLedger(options).admit('decision_coach'), error => error.code === 'RATE_LIMIT' && error.retryAfter === 60);
  time += 60_000; const ledger = createUsageLedger(options); ledger.finish(ledger.admit('decision_coach'));
});

test('daily 100-action quota survives restarts and resets at UTC midnight', t => {
  const env = testEnvironment(t); const policy = readAiPolicy(env); let time = Date.parse('2026-10-29T00:00:00Z');
  for (let i = 0; i < 100; i++) { const ledger = createUsageLedger({ policy, now: () => time }); ledger.finish(ledger.admit('decision_coach')); time += 60_001; }
  const ledger = createUsageLedger({ policy, now: () => time });
  assert.throws(() => ledger.admit('decision_coach'), error => error.code === 'DAILY_LIMIT');
  time = Date.parse('2026-10-30T00:00:00Z'); ledger.finish(ledger.admit('decision_coach'));
  assert.equal(ledgerData(env).days['2026-10-29'].length, 100); assert.equal(ledgerData(env).days['2026-10-30'].length, 1);
});

test('budget rejects before dispatch; unresolved reservations survive profile changes and restart', t => {
  const env = testEnvironment(t, { AI_DAILY_BUDGET_USD: '0.002' }); const policy = readAiPolicy(env);
  const ledger = createUsageLedger({ policy }); ledger.finish(ledger.admit('decision_coach'));
  const next = createUsageLedger({ policy: { ...policy, profile: { ...policy.profile, priceDate: 'future' } } });
  assert.throws(() => next.admit('decision_coach'), error => error.code === 'BUDGET_LIMIT');
  assert.ok(Object.values(ledgerData(env).days).flat()[0].charge > 0);
});

test('a crashed process leaves its spending reservation and daily slot intact', t => {
  const env = testEnvironment(t, { AI_DAILY_BUDGET_USD: '0.002' });
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import { readAiPolicy } from './server/aiPolicy.mjs'; import { createUsageLedger } from './server/aiUsageLedger.mjs'; createUsageLedger({policy:readAiPolicy()}).admit('decision_coach'); process.exit(17);"],
  { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(child.status, 17);
  const ledger = createUsageLedger({ policy: readAiPolicy(env) });
  assert.throws(() => ledger.admit('decision_coach'), error => error.code === 'BUDGET_LIMIT');
  const entry = Object.values(ledgerData(env).days).flat()[0]; assert.equal(entry.status, 'reserved'); assert.ok(entry.charge > 0);
});

test('reconciliation is opt-in and requires complete known usage; partial retains reservation', t => {
  const env = testEnvironment(t); const base = readAiPolicy(env);
  for (const [verified, status] of [[false, 'complete'], [true, 'partial'], [true, 'complete']]) {
    const ledger = createUsageLedger({ policy: { ...base, reconcileVerified: verified } });
    const ticket = ledger.admit('decision_coach');
    const accounting = ledger.finish(ticket, { usageStatus: status, estimatedUsd: 0.0001 });
    assert.equal(accounting.reservationStatus, verified && status === 'complete' ? 'reconciled' : 'reserved');
    assert.equal(accounting.chargedEstimateUsd, verified && status === 'complete' ? 0.0001 : maximumRunCost(base, 'decision_coach'));
  }
});

test('corrupt or unwritable ledger disables AI and never resets counters', t => {
  const env = testEnvironment(t); mkdirSync(dirname(env.AI_USAGE_LEDGER_PATH), { recursive: true });
  writeFileSync(env.AI_USAGE_LEDGER_PATH, '{bad');
  const ledger = createUsageLedger({ policy: readAiPolicy(env) });
  assert.throws(() => ledger.admit('decision_coach'), error => error.code === 'LEDGER_UNAVAILABLE');
  assert.equal(readFileSync(env.AI_USAGE_LEDGER_PATH, 'utf8'), '{bad');
  const bad = createUsageLedger({ policy: readAiPolicy({ ...env, AI_USAGE_LEDGER_PATH: env.AI_USAGE_LEDGER_PATH + '/impossible' }) });
  assert.throws(() => bad.admit('decision_coach'), error => error.code === 'LEDGER_UNAVAILABLE');
});

test('HTTP rejects oversized bodies, invalid goals, tampered state and model overrides before provider', async t => {
  let calls = 0;
  const send = await startServer(t, { env: testEnvironment(t), fetchImpl: async () => { calls++; throw new Error('must not run'); } });
  for (const [input, status] of [[request({ goal: 'x'.repeat(21000) }), 413], [request({ goal: '😀'.repeat(501) }), 400],
    [request({ state: { ...createGameState(), inventory: 999 } }), 400], [request({ model: DEFAULT_MODEL }), 400]]) {
    assert.equal((await send(input)).response.status, status);
  }
  assert.equal(calls, 0);
});

test('HTTP unavailable model makes zero requests; budget rejection supplies Retry-After', async t => {
  let calls = 0;
  const send = await startServer(t, { env: testEnvironment(t, { GEMINI_MODEL: 'unsupported' }), fetchImpl: async () => { calls++; } });
  assert.equal((await send()).response.status, 503); assert.equal(calls, 0);
  const limited = await startServer(t, { env: testEnvironment(t, { AI_DAILY_BUDGET_USD: '0.0001' }), fetchImpl: async () => { calls++; } });
  const result = await limited(); assert.equal(result.response.status, 429);
  assert.equal(result.body.code, 'BUDGET_LIMIT'); assert.ok(result.response.headers.get('retry-after')); assert.equal(calls, 0);
});

test('HTTP concurrent admissions have one winner; busy makes zero extra provider calls', async t => {
  const fake = fakeGemini('decision_coach'); let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  const send = await startServer(t, { env: testEnvironment(t), fetchImpl: async (...input) => {
    requests++; if (requests === 1) { entered(); await gate; } return fake.fetchImpl(...input);
  } });
  const first = send(); await started;
  const second = await send(); assert.equal(second.response.status, 429); assert.equal(second.body.code, 'AI_BUSY'); assert.equal(requests, 1);
  release(); assert.equal((await first).body.status, 'completed'); assert.equal(requests, 4);
});

test('HTTP final validation failure retains usage and costs; full history stays in analysis prompt', async t => {
  const fake = fakeGemini('decision_coach', { transform: value => ({ ...value, summary: 'a'.repeat(241) }) });
  const send = await startServer(t, { env: testEnvironment(t), fetchImpl: fake.fetchImpl });
  const result = await send(); assert.equal(result.body.status, 'failed'); assert.equal(result.body.evidence.usageStatus, 'complete');
  assert.ok(result.body.evidence.estimatedUsd > 0); assert.equal(result.body.evidence.accounting.reservationStatus, 'reserved');
  let state = createGameState(); while (!state.isComplete) state = submitOrder(state, 4);
  const analyst = fakeGemini('game_analyst');
  await runWorkflow(request({ workflow: 'game_analyst', state }), createModel(analyst.fetchImpl));
  const prompt = JSON.parse(analyst.requests[3].body.contents[0].parts[0].text);
  assert.equal(prompt.toolResult.weeks.length, 10); assert.equal(prompt.verifiedFacts.length, 60);
  const invalid = fakeGemini('game_analyst', { transform: value => ({ ...value, summary: 'x'.repeat(241) }) });
  const rejected = await runWorkflow(request({ workflow: 'game_analyst', state }), createModel(invalid.fetchImpl));
  assert.equal(rejected.evidence.validationIssue, 'Summary must contain 1 to 240 characters.');
  assert.equal(JSON.stringify(rejected).includes('x'.repeat(241)), false);
});
