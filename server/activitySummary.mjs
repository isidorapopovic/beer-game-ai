import { isDeepStrictEqual } from 'node:util';
import { EVENT_TYPES, EVENT_LIMIT_BYTES } from './aiToolCallLog.mjs';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
const number = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const workflows = ['unknown', 'decision_coach', 'candidate_order_simulation', 'game_analyst', 'scenario_generator'];
const representations = ['exact', 'redacted', 'omitted'];
const terminalTypes = new Set(['action_completed', 'action_failed', 'action_cancelled']);
const lateObservations = new Set(['count_tokens_request_completed', 'count_tokens_request_failed', 'model_request_completed',
  'model_request_failed', 'model_output_validated', 'model_output_rejected', 'workflow_finished', 'tool_execution_completed', 'tool_execution_failed']);

function validateUsage(value) {
  if (!object(value)) throw new Error('Invalid usage.');
  for (const key of ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount']) {
    if (value[key] !== null && !integer(value[key])) throw new Error('Invalid token usage.');
  }
}

// Explicit v1 contract for metadata and fields consumed by summaries/export. Unknown
// optional payload fields remain data; they never become interpreted instructions.
export function validateActivityEvent(event) {
  if (!object(event) || event.schemaVersion !== 1 || typeof event.requestId !== 'string'
    || !/^req_[a-zA-Z0-9_-]{1,100}$/.test(event.requestId)
    || !(event.runId === null || typeof event.runId === 'string' && /^run_[a-zA-Z0-9_-]{1,100}$/.test(event.runId))
    || !integer(event.sequence) || event.sequence < 1 || !integer(event.elapsedMs)
    || typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at)) || new Date(event.at).toISOString() !== event.at
    || !['live', 'mock-test', 'development'].includes(event.mode) || event.context !== (event.mode === 'development' ? 'development' : 'gameplay')
    || !workflows.includes(event.workflow) || !(event.gameWeek === null || integer(event.gameWeek) && event.gameWeek >= 1 && event.gameWeek <= 10)
    || !['unknown', 'pre_game', 'in_game', 'completed'].includes(event.gamePhase)
    || !representations.includes(event.participantRepresentation) || !EVENT_TYPES.has(event.type)
    || Buffer.byteLength(JSON.stringify(event) + '\n') > EVENT_LIMIT_BYTES) throw new Error('Invalid v1 metadata.');
  const participant = event.participant;
  if (event.participantRepresentation === 'omitted') {
    if (participant !== null) throw new Error('Invalid omitted participant.');
  } else if (!object(participant) || typeof participant.sessionId !== 'string'
    || !(participant.sessionId === 'unknown' || /^session_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(participant.sessionId)
      || event.participantRepresentation === 'redacted' && participant.sessionId.includes('[REDACTED_'))
    || !['not_yet_validated', 'server-generated-anonymous', 'browser-supplied-unverified'].includes(participant.sessionSource)
    || !['unknown', 'participant-supplied-unverified'].includes(participant.labelSource)
    || participant.label !== undefined && (typeof participant.label !== 'string' || /\p{C}/u.test(participant.label)
      || event.participantRepresentation === 'exact' && [...participant.label].length > 80)) throw new Error('Invalid participant metadata.');
  const payload = event.payload;
  if (!object(payload) || !representations.includes(payload.representation)
    || !(payload.originalBytes === null || integer(payload.originalBytes))) throw new Error('Invalid payload envelope.');
  if (payload.representation === 'omitted') {
    if (payload.data !== null || typeof payload.reason !== 'string' || !payload.reason) throw new Error('Invalid omitted payload.');
    return event;
  }
  if (!integer(payload.originalBytes) || !Array.isArray(payload.redactions) || !payload.redactions.every(x => typeof x === 'string')
    || payload.representation === 'exact' && payload.redactions.length || payload.representation === 'redacted' && !payload.redactions.length
    || !object(payload.data)) throw new Error('Invalid captured payload.');
  const data = payload.data;
  for (const key of ['goal', 'provider', 'model', 'stage', 'systemInstructions', 'status', 'stopReason', 'code', 'reason', 'scope', 'finalValidation', 'error', 'name', 'actualModel']) {
    if (data[key] !== undefined && data[key] !== null && typeof data[key] !== 'string') throw new Error('Invalid text payload field.');
  }
  for (const key of ['elapsedMs', 'countedInputTokens', 'inputTokenLimit', 'outputTokenLimit', 'httpStatus', 'attempt']) {
    if (data[key] !== undefined && data[key] !== null && !integer(data[key])) throw new Error('Invalid numeric payload field.');
  }
  for (const key of ['input', 'evidence', 'finalOutput', 'taskInput']) {
    if (data[key] !== undefined && data[key] !== null && !object(data[key])) throw new Error('Invalid object payload field.');
  }
  if (data.usage !== undefined) validateUsage(data.usage);
  if (data.evidence) {
    const evidence = data.evidence;
    if (evidence.usage !== undefined) validateUsage(evidence.usage);
    for (const key of ['estimatedUsd', 'knownEstimatedUsd']) if (evidence[key] !== undefined && evidence[key] !== null && !number(evidence[key])) throw new Error('Invalid cost.');
    if (evidence.usageStatus !== undefined && !['complete', 'partial', 'unknown'].includes(evidence.usageStatus)) throw new Error('Invalid usage status.');
    for (const key of ['runId', 'workflow', 'status', 'priceDate']) if (evidence[key] !== undefined && typeof evidence[key] !== 'string') throw new Error('Invalid evidence metadata.');
    for (const key of ['generationCalls', 'countTokenCalls', 'providerHttpCalls', 'toolCallCount', 'modelCalls']) {
      if (evidence[key] !== undefined && !integer(evidence[key])) throw new Error('Invalid evidence counter.');
    }
  }
  if (/^(count_tokens_request|model_request)_(started|completed|failed)$/.test(event.type)
    && (!['proposal', 'final'].includes(data.stage) || typeof data.model !== 'string' || !data.model)) throw new Error('Invalid provider stage.');
  if (/^tool_execution_(started|completed|failed)$/.test(event.type)
    && (typeof data.name !== 'string' || !data.name || !integer(data.attempt) || data.attempt < 1)) throw new Error('Invalid tool execution.');
  if (event.type === 'request_admitted' && data.admitted !== true) throw new Error('Invalid admission.');
  return event;
}

export function summarizeActivity({ events, warnings = [], requestIssues = {} }) {
  const groups = new Map(); const validationWarnings = [...warnings];
  for (const raw of events) {
    try {
      const event = validateActivityEvent(raw);
      if (!groups.has(event.requestId)) groups.set(event.requestId, []);
      groups.get(event.requestId).push(event);
    } catch { validationWarnings.push('Invalid event excluded from summary.'); }
  }
  const requests = [];
  for (const [requestId, records] of groups) {
    const issues = [...(requestIssues[requestId] ?? [])];
    const issue = value => { if (!issues.includes(value)) issues.push(value); };
    const count = type => records.filter(event => event.type === type).length;
    const accepted = records.find(event => event.type === 'request_accepted');
    const context = accepted ?? records.find(event => event.workflow !== 'unknown') ?? records[0];
    let runId = null; let terminal; let previousElapsed = -1; let lastContext; let received = false;
    const active = new Map(); let toolProposed = false; let workflowFinished;
    for (const [index, event] of records.entries()) {
      const data = event.payload.data;
      if (event.sequence !== index + 1) issue('sequence gap, duplicate or out-of-order append');
      if (event.elapsedMs < previousElapsed) issue('elapsed duration moved backwards');
      previousElapsed = event.elapsedMs; // UTC can legitimately move backwards.
      if (event.payload.representation === 'omitted') issue('payload omitted');
      if (event.participantRepresentation === 'omitted') issue('participant omitted');
      if (event.runId) { if (runId && event.runId !== runId) issue('run ID changed'); runId ??= event.runId; }
      else if (runId) issue('run ID missing after linkage');
      if (event.context !== records[0].context || event.mode !== records[0].mode) issue('record context changed');
      if (event.workflow !== 'unknown') {
        const current = { workflow: event.workflow, gameWeek: event.gameWeek, gamePhase: event.gamePhase, participant: event.participant };
        if (lastContext && !isDeepStrictEqual(current, lastContext)) issue('workflow, game or participant context changed');
        lastContext ??= current;
      } else if (lastContext) issue('validated context became unknown');
      if (terminal && !lateObservations.has(event.type)) issue('new execution or conflicting terminal after termination');
      if (terminal && terminal.type === 'action_completed') issue('observation after successful termination');
      if (event.type === 'request_received') { if (received || index !== 0) issue('duplicate or late receipt'); received = true; }
      if (event.type === 'request_accepted' && (!received || index !== 1)) issue('protocol acceptance outside receipt');
      if (event.type === 'request_admitted' && (!accepted || event.sequence < accepted.sequence)) issue('admission without prior protocol acceptance');
      if (event.type === 'run_started' && (!accepted || event.sequence < accepted.sequence)) issue('dispatch without prior protocol acceptance');
      if (event.type === 'run_started' && data?.workflow !== event.workflow) issue('run payload workflow mismatch');
      if (event.type === 'tool_proposed') toolProposed = true;
      if (event.type === 'workflow_finished') {
        if (workflowFinished) issue('duplicate workflow outcome');
        if (terminal && data?.status === 'completed') issue('completed workflow after failed or cancelled termination');
        workflowFinished = data;
      }
      const match = /^(count_tokens_request|model_request|tool_execution)_(started|completed|failed)$/.exec(event.type);
      if (match) {
        const key = match[1] + ':' + (match[1] === 'tool_execution' ? data?.name : data?.stage);
        if (match[2] === 'started') {
          if (!accepted || !runId) issue('execution without accepted request and run');
          if (active.has(key)) issue('overlapping execution');
          if (match[1] === 'tool_execution' && !toolProposed) issue('tool execution without proposal');
          active.set(key, true);
        } else { if (!active.has(key)) issue('outcome without matching start'); active.delete(key); }
      }
      if (terminalTypes.has(event.type)) {
        if (terminal) issue('multiple terminal outcomes');
        terminal ??= event;
        if (event.type === 'action_completed' && (data?.status !== 'completed' || data?.finalValidation !== 'passed'
          || !object(data?.finalOutput) || workflowFinished?.status !== 'completed' || workflowFinished?.finalValidation !== 'passed'
          || !count('tool_execution_completed') || !count('run_started') || !count('model_request_completed'))) issue('completion lacks validated workflow/tool evidence');
        if (event.type === 'action_failed' && !['failed', 'stopped'].includes(data?.status)) issue('conflicting failure status');
        if (event.type === 'action_cancelled' && data?.status !== 'cancelled') issue('conflicting cancellation status');
        if (data?.evidence && (data.evidence.runId !== runId || data.evidence.workflow !== context.workflow)) issue('final evidence context mismatch');
        if (event.type === 'action_completed' && data?.evidence) {
          for (const [field, observed] of [['generationCalls', count('model_request_started')], ['countTokenCalls', count('count_tokens_request_started')], ['toolCallCount', count('tool_execution_started')]]) {
            if (data.evidence[field] !== undefined && data.evidence[field] !== observed) issue('final evidence counters disagree with observed starts');
          }
        }
      }
    }
    if (!received) issue('receipt missing');
    if (!terminal) issue('terminal outcome missing');
    if (active.size) issue('execution outcome missing');
    if (count('request_accepted') > 1 || count('request_admitted') > 1 || count('run_started') > 1) issue('duplicate lifecycle stage');
    if (validationWarnings.length) issue('source contains invalid or incomplete records; inspect export warnings');
    const complete = issues.length === 0;
    const evidence = terminal?.payload.data?.evidence;
    const usage = complete ? evidence?.usage ?? null : null;
    const knownTokens = usage ? ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount'].filter(key => integer(usage[key])).length : 0;
    const usageComplete = knownTokens === 4 && usage.totalTokenCount === usage.promptTokenCount + usage.candidatesTokenCount + usage.thoughtsTokenCount;
    const usageStatus = complete && evidence?.usageStatus === 'complete' && usageComplete ? 'complete' : knownTokens ? 'partial' : 'unknown';
    requests.push({ requestId, runId, workflow: context.workflow, participant: context.participant,
      identityProvenance: 'unverified local metadata', records, context, terminal, complete, issues,
      status: complete ? terminal.payload.data?.status ?? terminal.type : 'incomplete', observedStatus: terminal?.payload.data?.status ?? 'unknown',
      received: received, protocolValid: Boolean(accepted), admitted: count('request_admitted') ? true : 'unknown',
      dispatched: count('run_started') > 0 || count('model_request_started') > 0,
      model: { started: count('model_request_started'), completed: count('model_request_completed'), failed: count('model_request_failed') },
      countTokens: { started: count('count_tokens_request_started'), completed: count('count_tokens_request_completed'), failed: count('count_tokens_request_failed') },
      tool: { proposed: count('tool_proposed'), rejected: count('tool_rejected'), started: count('tool_execution_started'), completed: count('tool_execution_completed'), failed: count('tool_execution_failed') },
      usageStatus, usage,
      estimatedUsd: usageStatus === 'complete' ? evidence?.estimatedUsd ?? null : null,
      knownEstimatedUsd: complete && usageStatus !== 'unknown' ? evidence?.knownEstimatedUsd ?? null : null });
  }
  const grouped = field => {
    const totals = new Map();
    for (const request of requests) {
      const key = field(request); const row = totals.get(key) ?? { key, observedRequests: 0, received: 0, protocolValid: 0, admittedObserved: 0,
        admissionUnknown: 0, dispatched: 0, completed: 0, rejected: 0, incomplete: 0, modelStarts: 0, countStarts: 0, toolStarts: 0, knownEstimatedUsd: 0, unknownUsageRequests: 0 };
      row.observedRequests++; row.received += +request.received; row.protocolValid += +request.protocolValid;
      row.admittedObserved += +(request.admitted === true); row.admissionUnknown += +(request.admitted === 'unknown');
      row.dispatched += +request.dispatched; row.completed += +(request.status === 'completed');
      row.rejected += +(['failed', 'stopped', 'cancelled'].includes(request.status)); row.incomplete += +!request.complete;
      row.modelStarts += request.model.started; row.countStarts += request.countTokens.started; row.toolStarts += request.tool.started;
      row.knownEstimatedUsd += request.knownEstimatedUsd ?? 0; row.unknownUsageRequests += +(request.usageStatus !== 'complete'); totals.set(key, row);
    }
    return [...totals.values()];
  };
  return { requests, warnings: validationWarnings, byWorkflow: grouped(x => x.workflow), bySession: grouped(x => x.participant?.sessionId ?? 'unknown'),
    coverage: 'observed local records only; missing or disabled capture is unknown; totals are lower bounds; identity is unverified' };
}
