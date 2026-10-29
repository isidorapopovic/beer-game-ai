import { appendFileSync, closeSync, mkdirSync, openSync, readSync, statSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const EVENT_LIMIT_BYTES = 64_000;
export const STORAGE_LIMIT_BYTES = 10_000_000;
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export function isPrivateLocalPath(path) {
  const inside = relative(projectRoot, resolve(path));
  return inside.startsWith('..') || isAbsolute(inside) || inside === '.local' || inside.startsWith('.local/') || inside.startsWith('.local\\');
}
export const EVENT_TYPES = new Set(['request_received', 'request_accepted', 'request_admitted', 'run_started', 'workflow_finished',
  'count_tokens_request_started', 'count_tokens_request_completed', 'count_tokens_request_failed',
  'model_request_started', 'model_request_completed', 'model_request_failed', 'model_output_validated', 'model_output_rejected',
  'tool_proposed', 'tool_rejected', 'tool_execution_started', 'tool_execution_completed', 'tool_execution_failed',
  'action_completed', 'action_failed', 'action_cancel_requested', 'action_cancelled']);

export function readLogConfig(env = process.env) {
  const valid = (env.AI_TOOL_LOG_ENABLED === undefined || ['true', 'false'].includes(env.AI_TOOL_LOG_ENABLED))
    && (env.AI_TOOL_LOG_MODE === undefined || ['live', 'mock-test', 'development'].includes(env.AI_TOOL_LOG_MODE));
  const invalid = !valid || !isPrivateLocalPath(env.AI_TOOL_LOG_PATH || '.local/ai-tool-calls.jsonl');
  return { enabled: !invalid && env.AI_TOOL_LOG_ENABLED === 'true', invalid,
    path: env.AI_TOOL_LOG_PATH || '.local/ai-tool-calls.jsonl', mode: env.AI_TOOL_LOG_MODE || 'live',
    secrets: Object.entries(env).filter(([key, value]) => /KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL/i.test(key)
      && typeof value === 'string' && value.length >= 4).map(([, value]) => value) };
}

// Payloads only: generated IDs and UTC timestamps are separately validated metadata.
export function sanitizePayload(value, secrets = []) {
  let originalBytes = null;
  let normalized;
  try { const serialized = JSON.stringify(value); originalBytes = Buffer.byteLength(serialized); normalized = JSON.parse(serialized); }
  catch { /* Non-JSON data is omitted explicitly. */ }
  if (originalBytes === null) return { representation: 'omitted', originalBytes, reason: 'non_json_payload', data: null };
  const reasons = new Set(); let nodes = 0;
  const privateKey = /^(authorization|cookie|set-cookie|x-goog-api-key|api[-_]?key|password|passwd|secret|credential|access[-_]?token|refresh[-_]?token|token|thought|thoughts|reasoning|chain[_-]?of[_-]?thought|email|phone|address|ssn|dob|full[_-]?name|first[_-]?name|last[_-]?name)$/i;
  const redactString = text => {
    let result = text;
    for (const secret of secrets) {
      for (const form of new Set([secret, encodeURIComponent(secret)])) {
        if (form && result.includes(form)) { result = result.split(form).join('[REDACTED_SECRET]'); reasons.add('known_secret'); }
      }
    }
    const patterns = [
      [/\bAIza[\w-]{20,}\b/g, 'credential'], [/\b(?:sk|ghp|github_pat)[_-][\w-]{12,}\b/g, 'credential'],
      [/\bBearer\s+[^\s"'<>]+/gi, 'credential'],
      [/\b(?:api[_ -]?key|password|secret|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*["']?[^\s"',;}<>]+/gi, 'credential'],
      [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 'personal_data'],
      [/\+\d[\d ()-]{7,}\d/g, 'personal_data'], [/\b\d{3}-\d{2}-\d{4}\b/g, 'personal_data'],
      [/https?:\/\/[^\s<>"')]+/gi, 'url'],
    ];
    for (const [pattern, reason] of patterns) result = result.replace(pattern, () => { reasons.add(reason); return `[REDACTED_${reason.toUpperCase()}]`; });
    return result;
  };
  const walk = (item, depth = 0) => {
    if (++nodes > 12_000 || depth > 16) throw new Error('Complex payload.');
    if (typeof item === 'string') return redactString(item);
    if (item === null || typeof item === 'boolean' || typeof item === 'number') return item;
    if (Array.isArray(item)) return item.map(entry => walk(entry, depth + 1));
    if (typeof item === 'object') {
      const out = Object.create(null);
      for (const [key, nested] of Object.entries(item)) {
        const safeKey = redactString(key);
        if (privateKey.test(key)) { out[safeKey] = '[REDACTED_PRIVATE_FIELD]'; reasons.add('private_field'); }
        else out[safeKey] = walk(nested, depth + 1);
      }
      return out;
    }
    throw new Error('Non-JSON value.');
  };
  try {
    const data = walk(normalized);
    return { representation: reasons.size ? 'redacted' : 'exact', originalBytes, redactions: [...reasons], data };
  } catch { return { representation: 'omitted', originalBytes, reason: 'unsupported_or_complex_payload', data: null }; }
}

export function createToolCallLogger({ config = readLogConfig(), now = Date.now, monotonic = () => performance.now(),
  maxEventBytes = EVENT_LIMIT_BYTES, maxStorageBytes = STORAGE_LIMIT_BYTES } = {}) {
  config = { ...config, enabled: config.enabled && isPrivateLocalPath(config.path), invalid: config.invalid || !isPrivateLocalPath(config.path) };
  const path = resolve(config.path);
  // Synchronous appends serialize in the single Node process, including separate logger instances.
  const append = event => {
    let text = JSON.stringify(event) + '\n';
    if (Buffer.byteLength(text) > maxEventBytes) {
      event.payload = { representation: 'omitted', originalBytes: event.payload.originalBytes, reason: 'event_size_limit', data: null };
      text = JSON.stringify(event) + '\n';
    }
    if (Buffer.byteLength(text) > maxEventBytes) return { ok: false, reason: 'event_size_limit' };
    try {
      let size = 0;
      try {
        size = statSync(path).size;
        if (size) {
          const fd = openSync(path, 'r');
          try { const tail = Buffer.alloc(1); readSync(fd, tail, 0, 1, size - 1); if (tail[0] !== 10) return { ok: false, reason: 'truncated_tail' }; }
          finally { closeSync(fd); }
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (size + Buffer.byteLength(text) > maxStorageBytes) return { ok: false, reason: 'storage_full' };
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, text, { encoding: 'utf8', mode: 0o600, flag: 'a' });
      return { ok: true, omitted: event.payload.representation === 'omitted' };
    } catch { return { ok: false, reason: 'write_failed' }; }
  };
  return {
    enabled: config.enabled,
    begin({ requestId = `req_${randomUUID()}`, participant, workflow = 'unknown', gameWeek = null, gamePhase = 'unknown' } = {}) {
      const started = monotonic(); let sequence = 0; let written = 0; let missed = 0; let reason;
      let identity = participant ?? { sessionId: `session_${randomUUID()}`, sessionSource: 'server-generated-anonymous', labelSource: 'unknown' };
      let identityCapture = sanitizePayload(identity, config.secrets);
      let safeIdentity = identityCapture.data;
      let runId = null;
      const handle = {
        requestId,
        setContext(context) {
          if (context.participant) {
            identity = context.participant; identityCapture = sanitizePayload(identity, config.secrets); safeIdentity = identityCapture.data;
          }
          workflow = context.workflow ?? workflow;
          gameWeek = context.gameWeek ?? gameWeek;
          gamePhase = context.gamePhase ?? gamePhase;
        },
        emit(type, payload = {}, linkedRunId) {
          if (!config.enabled) return;
          try {
            if (!EVENT_TYPES.has(type)) throw new Error('Unsupported event.');
            if (linkedRunId && /^run_[a-zA-Z0-9_-]{1,100}$/.test(linkedRunId)) runId = linkedRunId;
            const event = { schemaVersion: 1, requestId, runId, sequence: ++sequence,
              at: new Date(now()).toISOString(), elapsedMs: Math.max(0, Math.round(monotonic() - started)),
              context: config.mode === 'development' ? 'development' : 'gameplay', mode: config.mode,
              participant: safeIdentity, participantRepresentation: identityCapture.representation, workflow, gameWeek, gamePhase,
              type, payload: sanitizePayload(payload, config.secrets) };
            const result = append(event);
            if (result.ok) { written++; if (result.omitted) { missed++; reason = 'payload_omitted'; } }
            else { missed++; reason = result.reason; }
          } catch { missed++; reason = 'logging_failed'; }
        },
        observe(event) { handle.emit(event.type, event.payload, event.runId); },
        status() {
          return { enabled: config.enabled, requestId, sessionId: identity.sessionId,
            status: written ? (missed ? 'partial' : 'recorded') : 'unavailable',
            reason: config.invalid ? 'invalid_configuration' : !config.enabled ? 'disabled' : reason,
            eventsRecorded: written, eventsMissing: missed };
        },
      };
      return handle;
    },
  };
}
