import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isPrivateLocalPath } from './aiToolCallLog.mjs';

const types = new Set(['request.received', 'request.denied', 'request.admitted', 'request.finished', 'agent.tool.allowed', 'agent.tool.denied', 'context.issued', 'context.denied']);
const reasons = new Set(['RECEIVED', 'ADMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'TOOL_ALLOWED', 'TOOL_DENIED', 'CONTEXT_ISSUED',
  'INVALID_INPUT', 'JSON_REQUIRED', 'BODY_LIMIT', 'ORIGIN_DENIED', 'CONFIGURATION', 'AI_BUSY', 'RATE_LIMIT', 'DAILY_LIMIT', 'BUDGET_LIMIT',
  'LEDGER_UNAVAILABLE', 'COACH_CONTEXT_INVALID', 'COACH_GAME_LIMIT', 'CONTEXT_RATE_LIMIT', 'CONTEXT_CAPACITY', 'AI_UNAVAILABLE']);
const workflows = new Set(['decision_coach', 'candidate_order_simulation', 'game_analyst', 'scenario_generator', 'unknown']);

export function createSecurityLog({ env = {}, now = Date.now, onEvent } = {}) {
  const path = resolve(env.AI_SECURITY_LOG_PATH || '.local/security-events.jsonl');
  const enabled = env.AI_SECURITY_LOG_ENABLED === 'true' && isPrivateLocalPath(path);
  return (type, metadata) => {
    if (!types.has(type) || !/^req_[a-zA-Z0-9_-]{1,100}$/.test(metadata.correlationId)) return;
    const event = { event: type, timestamp: new Date(now()).toISOString(), correlationId: metadata.correlationId,
      workflow: workflows.has(metadata.workflow) ? metadata.workflow : 'unknown',
      outcome: ['allowed', 'denied', 'completed', 'failed', 'cancelled', 'received'].includes(metadata.outcome) ? metadata.outcome : 'failed',
      reasonCode: reasons.has(metadata.reasonCode) ? metadata.reasonCode : 'REJECTED' };
    for (const key of ['elapsedMs', 'providerAttempts', 'executedToolCalls']) {
      if (Number.isSafeInteger(metadata[key]) && metadata[key] >= 0) event[key] = metadata[key];
    }
    try { const result = onEvent?.(event); if (result) void Promise.resolve(result).catch(() => {}); } catch { /* Diagnostics never change execution. */ }
    if (!enabled) return;
    try {
      const line = JSON.stringify(event) + '\n'; let size = 0;
      try { size = statSync(path).size; } catch (error) { if (error.code !== 'ENOENT') return; }
      if (Buffer.byteLength(line) > 1024 || size + Buffer.byteLength(line) > 1_000_000) return;
      mkdirSync(dirname(path), { recursive: true }); appendFileSync(path, line, { encoding: 'utf8', mode: 0o600 });
    } catch { /* No rotation, source repair, raw error or retry. */ }
  };
}
