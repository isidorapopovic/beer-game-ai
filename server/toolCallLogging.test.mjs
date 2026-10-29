import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createAgentServer } from './index.mjs';
import { createToolCallLogger, readLogConfig, sanitizePayload, EVENT_LIMIT_BYTES, STORAGE_LIMIT_BYTES } from './aiToolCallLog.mjs';
import { readEventLog, renderToolCallMarkdown, exportToolCallLog, budapestTimestamp } from './exportAiToolCallLog.mjs';
import { createGameState, submitOrder } from '../src/game/gameEngine.ts';
import { getParticipantContext, validateParticipant, validateParticipantLabel } from '../src/agent/participantContext.ts';
import { requestAgent, AgentRequestError } from '../src/agent/agentClient.ts';
import { BoundedAgentOrchestrator } from '../src/agent/boundedAgent.ts';
import { createGeminiModel } from './gemini.mjs';
import { runWorkflow } from './workflows.mjs';
import { fakeGemini, testEnvironment, jsonResponse, modelResponse, toolNames } from './testFixtures.mjs';

function environment(t, overrides = {}) {
  const env = testEnvironment(t);
  return { ...env, AI_TOOL_LOG_ENABLED: 'true', AI_TOOL_LOG_MODE: 'mock-test', AI_TOOL_LOG_PATH: join(dirname(env.AI_USAGE_LEDGER_PATH), 'calls.jsonl'), ...overrides };
}
const anonymous = () => ({ sessionId: `session_${crypto.randomUUID()}` });
const input = (workflow = 'decision_coach', participant = anonymous()) => {
  let state = createGameState();
  if (workflow === 'game_analyst') while (!state.isComplete) state = submitOrder(state, 4);
  return { workflow, state, goal: 'Help with this game.', participant };
};
async function start(t, env, fetchImpl) {
  const server = createAgentServer({ env, fetchImpl });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/agent/run`;
  return { url, async send(value = input()) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    return { response, body: await response.json() };
  } };
}
const records = env => readEventLog(env.AI_TOOL_LOG_PATH).events;
const event = (events, type) => events.find(item => item.type === type);

for (const workflow of Object.keys(toolNames)) {
  test(`logging ${workflow}: exact correlated model/tool/final data, four HTTP calls, unchanged game`, async t => {
    const env = environment(t); const fake = fakeGemini(workflow); const app = await start(t, env, fake.fetchImpl);
    const request = input(workflow, { ...anonymous(), label: 'Learner-01' }); const before = structuredClone(request.state);
    const { body, response } = await app.send(request);
    assert.equal(response.status, 200); assert.equal(body.status, 'completed'); assert.equal(body.logging.status, 'recorded');
    assert.equal(fake.requests.length, 4); assert.deepEqual(request.state, before);
    const events = records(env);
    assert.equal(events.length, body.logging.eventsRecorded);
    assert.deepEqual(events.map(item => item.sequence), events.map((_, i) => i + 1));
    assert.equal(new Set(events.map(item => item.requestId)).size, 1);
    assert.ok(events.every(item => item.at.endsWith('Z') && Number.isFinite(Date.parse(item.at))));
    assert.ok(events.every(item => item.elapsedMs >= 0));
    const accepted = event(events, 'request_accepted'); assert.equal(accepted.participant.sessionId, request.participant.sessionId);
    assert.equal(accepted.participant.labelSource, 'participant-supplied-unverified');
    assert.equal(accepted.payload.data.goal, request.goal); assert.equal(accepted.payload.representation, 'exact');
    const proposed = event(events, 'tool_proposed'); assert.equal(proposed.payload.data.name, toolNames[workflow]);
    assert.equal(proposed.runId, body.evidence.runId);
    assert.deepEqual(proposed.payload.data.arguments, workflow === 'candidate_order_simulation' ? { orderQuantity: 4 } : {});
    const executed = event(events, 'tool_execution_completed'); assert.ok(executed.payload.data.result);
    const firstModel = event(events, 'model_request_started');
    assert.equal(firstModel.payload.representation, 'exact'); assert.ok(firstModel.payload.data.systemInstructions);
    assert.equal(firstModel.payload.data.input.goal, request.goal);
    assert.equal(events.filter(item => item.type === 'model_request_completed').length, 2);
    assert.equal(events.filter(item => item.type === 'count_tokens_request_completed').length, 2);
    const final = event(events, 'action_completed'); assert.deepEqual(final.payload.data.finalOutput, body.finalOutput);
    assert.equal(final.payload.data.finalValidation, 'passed'); assert.equal(final.payload.data.evidence.usageStatus, 'complete');
    const text = readFileSync(env.AI_TOOL_LOG_PATH, 'utf8'); assert.equal(text.includes('test-secret'), false); assert.equal(text.includes('PRIVATE_THOUGHT'), false);
    const reportPath = join(dirname(env.AI_TOOL_LOG_PATH), `${workflow}.md`);
    assert.equal(exportToolCallLog(env.AI_TOOL_LOG_PATH, reportPath).requests, 1);
    const markdown = readFileSync(reportPath, 'utf8'); assert.match(markdown, /mock-test/); assert.match(markdown, /Learner-01/);
    assert.match(markdown, /Final AI response/); assert.ok(markdown.includes(toolNames[workflow]));
  });
  test(`logging ${workflow}: rejected final has observed stages, no invented final or extra calls`, async t => {
    const env = environment(t); const fake = fakeGemini(workflow, { transform: value => ({ ...value, completed: false }) });
    const app = await start(t, env, fake.fetchImpl); const { body } = await app.send(input(workflow));
    assert.equal(body.stopReason, 'invalid_final_result'); assert.equal(fake.requests.length, 4);
    const events = records(env); assert.equal(event(events, 'action_completed'), undefined);
    const failure = event(events, 'action_failed'); assert.equal(failure.payload.data.finalOutput, null);
    assert.equal(failure.payload.data.finalValidation, 'not_accepted');
    assert.ok(event(events, 'tool_execution_completed')); assert.equal(body.logging.status, 'recorded');
  });
}

test('participant storage is stable; anonymous fallback and unverified label validation are explicit', () => {
  const values = new Map(); const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const a = getParticipantContext('  Nick  ', storage); const b = getParticipantContext('Other', storage);
  assert.equal(a.sessionId, b.sessionId); assert.equal(a.label, 'Nick');
  assert.equal(validateParticipant(a).sessionSource, 'browser-supplied-unverified');
  assert.equal(validateParticipant().sessionSource, 'server-generated-anonymous');
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(getParticipantContext(undefined, broken).sessionId, getParticipantContext(undefined, broken).sessionId);
  assert.equal(validateParticipantLabel('😀'.repeat(80)), '😀'.repeat(80));
  for (const label of ['😀'.repeat(81), 'bad\nlabel']) assert.throws(() => validateParticipantLabel(label));
  assert.throws(() => validateParticipant({ sessionId: 'forged arbitrary ID' }));
  assert.throws(() => validateParticipant({ ...a, verified: true }));
});

test('Budapest rendering uses correct winter and summer offsets, not host timezone', () => {
  assert.equal(budapestTimestamp('2026-01-15T12:00:00Z'), '2026-01-15T13:00:00+01:00');
  assert.equal(budapestTimestamp('2026-07-15T12:00:00Z'), '2026-07-15T14:00:00+02:00');
});

test('known secrets, credentials, thoughts, personal fields and URLs are redacted before persistence', t => {
  const env = environment(t); const logger = createToolCallLogger({ config: readLogConfig(env) }); const log = logger.begin();
  log.emit('request_accepted', { goal: 'test-secret email user@example.com phone +381 64 1234567 api_key=hidden-value https://private.invalid/a',
    nested: { authorization: 'Bearer private-token', apiKey: 'private', password: 'hidden', thoughts: 'PRIVATE_THOUGHT',
      email: 'user@example.com', fullName: 'Private Name', thoughtsTokenCount: 7 }, undefinedWireField: undefined });
  const saved = records(env)[0]; assert.equal(saved.payload.representation, 'redacted');
  assert.equal(saved.payload.data.nested.thoughtsTokenCount, 7);
  const text = readFileSync(env.AI_TOOL_LOG_PATH, 'utf8');
  for (const secret of ['test-secret', 'user@example.com', '+381 64 1234567', 'hidden-value', 'private.invalid', 'private-token', 'PRIVATE_THOUGHT', 'Private Name']) assert.equal(text.includes(secret), false);
  assert.equal(log.status().status, 'recorded');
  assert.equal(sanitizePayload({ value: 'a', missing: undefined }).representation, 'exact');
  const circular = {}; circular.circular = circular; assert.equal(sanitizePayload(circular).representation, 'omitted');
});

test('oversized Unicode payload is explicitly omitted and whole events stay below 64,000 bytes', t => {
  const env = environment(t); const log = createToolCallLogger({ config: readLogConfig(env) }).begin();
  const payload = { goal: '😀'.repeat(18000) }; log.emit('request_accepted', payload);
  const saved = records(env)[0]; assert.equal(saved.payload.representation, 'omitted');
  assert.equal(saved.payload.originalBytes, Buffer.byteLength(JSON.stringify(payload))); assert.equal(saved.payload.data, null);
  assert.ok(statSync(env.AI_TOOL_LOG_PATH).size <= EVENT_LIMIT_BYTES); assert.equal(log.status().status, 'partial');
});

test('10-MB storage cap and file failures expose unavailable/partial without deleting records', t => {
  const env = environment(t); mkdirSync(dirname(env.AI_TOOL_LOG_PATH), { recursive: true });
  writeFileSync(env.AI_TOOL_LOG_PATH, Buffer.alloc(STORAGE_LIMIT_BYTES, 10));
  const full = createToolCallLogger({ config: readLogConfig(env) }).begin(); full.emit('request_received');
  assert.equal(full.status().status, 'unavailable'); assert.equal(full.status().reason, 'storage_full');
  assert.equal(statSync(env.AI_TOOL_LOG_PATH).size, STORAGE_LIMIT_BYTES);
  const bad = createToolCallLogger({ config: readLogConfig({ ...env, AI_TOOL_LOG_PATH: env.AI_TOOL_LOG_PATH + '/child' }) }).begin();
  bad.emit('request_received'); assert.equal(bad.status().reason, 'write_failed');
});

test('restart preserves earlier records; truncated tail is reported and never silently repaired', t => {
  const env = environment(t); const logger = createToolCallLogger({ config: readLogConfig(env) });
  const log = logger.begin({ requestId: 'req_first' }); log.emit('request_received'); log.emit('action_completed', { status: 'completed' });
  const restarted = createToolCallLogger({ config: readLogConfig(env) });
  restarted.begin({ requestId: 'req_second' }).emit('request_received');
  appendFileSync(env.AI_TOOL_LOG_PATH, '{"schemaVersion":1,"requestId":"req_crash');
  const before = readFileSync(env.AI_TOOL_LOG_PATH, 'utf8'); const latest = restarted.begin(); latest.emit('request_received');
  assert.equal(latest.status().reason, 'truncated_tail'); assert.equal(readFileSync(env.AI_TOOL_LOG_PATH, 'utf8'), before);
  const parsed = readEventLog(env.AI_TOOL_LOG_PATH); assert.equal(parsed.events.length, 3); assert.ok(parsed.warnings.length >= 1);
  const markdown = renderToolCallMarkdown(parsed); assert.match(markdown, /req\\_first/); assert.match(markdown, /partial or incomplete/);
  assert.match(markdown, /invalid\/truncated/); assert.equal(markdown.includes('req_crash'), false);
  log.emit('workflow_finished', { status: 'not_recorded' });
  assert.equal(log.status().status, 'partial'); assert.equal(log.status().reason, 'truncated_tail');
});

test('model deadline events contain a safe reason without extra requests or a fake result', async t => {
  const env = environment(t); const log = createToolCallLogger({ config: readLogConfig(env) }).begin();
  let calls = 0;
  const model = createGeminiModel({ apiKey: 'test-secret', onEvent: (type, payload) => log.emit(type, payload),
    fetchImpl: async (_url, { signal }) => { calls++; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('PRIVATE_TIMEOUT_ERROR')), { once: true })); } });
  const keepAlive = setTimeout(() => {}, 200);
  try { await assert.rejects(model({ instructions: 'Return JSON.', input: { goal: 'Help.' }, deadlineAt: new Date(Date.now() + 30).toISOString() }), error => error.code === 'deadline'); }
  finally { clearTimeout(keepAlive); }
  assert.equal(calls, 1); const events = records(env);
  assert.equal(event(events, 'count_tokens_request_failed').payload.data.reason, 'deadline');
  assert.equal(event(events, 'model_request_started'), undefined);
  assert.equal(JSON.stringify(events).includes('PRIVATE_TIMEOUT_ERROR'), false);
});

test('interleaved sessions remain separate and Markdown escapes hostile labels/data safely', t => {
  const env = environment(t); let wall = Date.parse('2026-10-29T18:00:00Z'); let tick = 0;
  const logger = createToolCallLogger({ config: readLogConfig(env), now: () => wall, monotonic: () => tick++ });
  const a = logger.begin({ requestId: 'req_alpha', participant: { ...anonymous(), label: '<script>|[x](evil)', labelSource: 'participant-supplied-unverified' } });
  const b = logger.begin({ requestId: 'req_beta', participant: { ...anonymous(), label: 'Beta' } });
  a.emit('request_received'); b.emit('request_received'); wall -= 5000;
  a.emit('request_accepted', { goal: '```\n# FAKE HEADING\n<script>alert(1)</script>\n[x](evil)' });
  b.emit('action_failed', { status: 'failed', error: 'Safe failure.' }); a.emit('action_completed', { status: 'completed', finalOutput: { text: '````' } });
  const events = records(env); assert.deepEqual(events.filter(item => item.requestId === 'req_alpha').map(item => item.sequence), [1, 2, 3]);
  assert.ok(events.every(item => item.elapsedMs >= 0));
  const markdown = renderToolCallMarkdown({ events });
  assert.match(markdown, /&lt;script&gt;\\\|\\\[x\\\]/); assert.equal(markdown.includes('\n# FAKE HEADING\n'), false);
  assert.equal(markdown.includes('\n<script>'), false); assert.match(markdown, /mock-test/);
  assert.equal((markdown.match(/^### Record /gm) ?? []).length, 2);
});

test('export requires a new private .md path; never overwrites or writes tracked templates', t => {
  const env = environment(t); const log = createToolCallLogger({ config: readLogConfig(env) }).begin(); log.emit('request_received');
  const output = join(dirname(env.AI_TOOL_LOG_PATH), 'export.md'); exportToolCallLog(env.AI_TOOL_LOG_PATH, output);
  const before = readFileSync(output, 'utf8'); assert.throws(() => exportToolCallLog(env.AI_TOOL_LOG_PATH, output));
  assert.equal(readFileSync(output, 'utf8'), before);
  assert.throws(() => exportToolCallLog(env.AI_TOOL_LOG_PATH, 'specs/002-ai-tool-call-logging/log-template.md'));
  assert.throws(() => exportToolCallLog(env.AI_TOOL_LOG_PATH, output + '.json'));
  assert.equal(readLogConfig({ AI_TOOL_LOG_ENABLED: 'true', AI_TOOL_LOG_PATH: 'docs/transcript.jsonl' }).invalid, true);
});

for (const [name, proposal, expected] of [
  ['unknown tool', { kind: 'tool_request', toolRequest: { name: 'deleteEverything', arguments: {} } }, 'unknown_tool'],
  ['invalid arguments', { kind: 'tool_request', toolRequest: { name: 'getCurrentGameState', arguments: { extra: true } } }, 'invalid_tool_arguments'],
  ['malformed proposal', { kind: 'tool_request', toolRequest: { name: '', arguments: {} } }, 'invalid_model_proposal'],
]) {
  test(`${name}: proposed/rejected recorded but no executed tool or extra model request`, async t => {
    const env = environment(t); let requests = 0;
    const app = await start(t, env, async url => { requests++; return url.endsWith(':countTokens') ? jsonResponse({ totalTokens: 100 }) : modelResponse(proposal); });
    const { body } = await app.send(); assert.equal(body.stopReason, expected); assert.equal(requests, 2);
    const events = records(env); assert.ok(event(events, 'tool_proposed')); assert.ok(event(events, 'tool_rejected'));
    assert.equal(event(events, 'tool_execution_started'), undefined); assert.ok(event(events, 'action_failed'));
  });
}

test('logger unavailable or disabled never changes a successful workflow or provider count', async t => {
  for (const settings of [{ AI_TOOL_LOG_ENABLED: 'false' }, { AI_TOOL_LOG_ENABLED: 'bad' },
    { AI_TOOL_LOG_ENABLED: 'true', AI_TOOL_LOG_PATH: '.local/nonexistent-parent-file/child.jsonl' }]) {
    const env = environment(t, settings);
    if (settings.AI_TOOL_LOG_PATH) {
      env.AI_TOOL_LOG_PATH = env.AI_USAGE_LEDGER_PATH + '/child.jsonl'; writeFileSync(env.AI_USAGE_LEDGER_PATH + '.blocker', 'file');
      env.AI_TOOL_LOG_PATH = env.AI_USAGE_LEDGER_PATH + '.blocker/child.jsonl';
    }
    const fake = fakeGemini('decision_coach'); const app = await start(t, env, fake.fetchImpl);
    const { body } = await app.send(); assert.equal(body.status, 'completed'); assert.equal(fake.requests.length, 4);
    assert.equal(body.logging.status, 'unavailable');
    if (settings.AI_TOOL_LOG_ENABLED === 'false') assert.equal(existsSync(env.AI_TOOL_LOG_PATH), false);
  }
});

test('pre-run configuration/input/identity failures have request IDs, safe errors and no provider calls', async t => {
  const env = environment(t, { GEMINI_API_KEY: '' }); let calls = 0;
  const app = await start(t, env, async () => { calls++; });
  const rejected = await app.send(); assert.equal(rejected.response.status, 503); assert.match(rejected.body.logging.requestId, /^req_/);
  const events = records(env); assert.ok(event(events, 'request_received')); assert.ok(event(events, 'action_failed'));
  assert.equal(event(events, 'run_started'), undefined); assert.equal(calls, 0);
  const invalid = await app.send(input('decision_coach', { ...anonymous(), label: 'x'.repeat(81) }));
  assert.equal(invalid.response.status, 400); assert.ok(invalid.body.logging.requestId);
  assert.equal(event(records(env).filter(item => item.requestId === invalid.body.logging.requestId), 'request_accepted'), undefined);
});

test('missing usage is logged as unknown; malformed final rejected without persisting unsafe response bodies', async t => {
  const env = environment(t); const fake = fakeGemini('decision_coach', { usage: false, transform: value => ({ ...value, recommendedOrderQuantity: 999 }) });
  const app = await start(t, env, fake.fetchImpl); const { body } = await app.send();
  assert.equal(body.stopReason, 'invalid_final_result');
  const final = event(records(env), 'action_failed'); assert.equal(final.payload.data.evidence.usageStatus, 'unknown');
  assert.equal(final.payload.data.evidence.usage.promptTokenCount, null); assert.equal(final.payload.data.finalOutput, null);
  assert.equal(final.payload.data.finalValidation, 'not_accepted'); assert.equal(fake.requests.length, 4);
});

test('upstream failure logs safe status but excludes provider bodies', async t => {
  const env = environment(t); const app = await start(t, env, async url => url.endsWith(':countTokens') ? jsonResponse({ totalTokens: 100 }) : new Response('PRIVATE_PROVIDER_BODY test-secret', { status: 503 }));
  const { body } = await app.send(); assert.notEqual(body.status, 'completed');
  const failed = event(records(env), 'model_request_failed'); assert.equal(failed.payload.data.httpStatus, 503);
  assert.equal(readFileSync(env.AI_TOOL_LOG_PATH, 'utf8').includes('PRIVATE_PROVIDER_BODY'), false);
});

test('client cancellation aborts provider work and records cancelled rather than inventing a final', async t => {
  const env = environment(t); let entered; const started = new Promise(resolve => { entered = resolve; }); let calls = 0;
  const app = await start(t, env, async (_url, { signal }) => { calls++; entered(); return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('private')), { once: true })); });
  const controller = new AbortController();
  const pending = fetch(app.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input()), signal: controller.signal }).catch(() => null);
  await started; controller.abort(); await pending;
  for (let i = 0; i < 100 && !event(records(env), 'action_cancelled'); i++) await new Promise(resolve => setTimeout(resolve, 5));
  const events = records(env); assert.ok(event(events, 'action_cancel_requested')); assert.ok(event(events, 'action_cancelled'));
  assert.equal(event(events, 'action_completed'), undefined); assert.equal(calls, 1);
  assert.equal(event(events, 'count_tokens_request_failed').payload.data.reason, 'cancelled');
});

test('tool failure and observer exceptions cannot cause a retry or change game results', async () => {
  let executions = 0; const events = [];
  const registry = { broken: { name: 'broken', allowedWorkflows: ['decision_coach'], mode: 'read_only',
    argsSchema: { type: 'object' }, resultSchema: { type: 'object' }, execute() { executions++; throw new Error('PRIVATE_TOOL_ERROR'); } } };
  const orchestrator = new BoundedAgentOrchestrator({ registry, workflow: 'decision_coach' });
  const run = orchestrator.createRun({ goal: 'test', deadlineAt: new Date(Date.now() + 1000).toISOString() });
  const result = await orchestrator.executeRun({ run, modelStep: async () => ({ kind: 'tool_request', toolRequest: { name: 'broken', arguments: {} } }),
    modelStep2: async () => { throw new Error('must not run'); }, onEvent: value => { events.push(value); throw new Error('logger unavailable'); } });
  assert.equal(executions, 1); assert.equal(result.stopReason, 'invalid_tool_result');
  assert.ok(event(events, 'tool_execution_failed')); assert.equal(JSON.stringify(events).includes('PRIVATE_TOOL_ERROR'), false);
  const request = input(); const before = structuredClone(request.state); const fake = fakeGemini('decision_coach');
  const output = await runWorkflow(request, createGeminiModel({ apiKey: 'test-secret', fetchImpl: fake.fetchImpl }), { onEvent: async () => { throw new Error('log rejected'); } });
  assert.equal(output.status, 'completed'); assert.equal(fake.requests.length, 4); assert.deepEqual(request.state, before);
});

test('client sends participant context and retains logging metadata on HTTP rejection', async () => {
  const original = globalThis.fetch; let captured;
  globalThis.fetch = async (_url, options) => { captured = JSON.parse(options.body); return new Response(JSON.stringify({ error: 'Quota reached.', logging: { enabled: true, status: 'recorded', requestId: 'req_test', sessionId: captured.participant.sessionId, eventsRecorded: 2, eventsMissing: 0 } }), { status: 429 }); };
  try {
    await assert.rejects(requestAgent('decision_coach', createGameState(), 'Help.', 'Nick'), error => error instanceof AgentRequestError && error.logging.requestId === 'req_test');
    assert.equal(captured.participant.label, 'Nick'); assert.match(captured.participant.sessionId, /^session_/);
  } finally { globalThis.fetch = original; }
});
