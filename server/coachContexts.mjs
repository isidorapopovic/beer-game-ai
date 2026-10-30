import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AiPolicyError } from './aiPolicy.mjs';

export const COACH_CONTEXT_LIMIT = 10;
const TTL_MS = 2 * 60 * 60 * 1000;
const tokenPattern = /^coach_[A-Za-z0-9_-]{43}$/;
export const isCoachContext = value => typeof value === 'string' && tokenPattern.test(value);

// Anonymous local accounting scopes, not authenticated ownership or saved games.
export function createCoachContexts({ now = Date.now } = {}) {
  const contexts = new Map(); let issued = [];
  const unavailable = () => new AiPolicyError('COACH_CONTEXT_INVALID', 'Coach context is unavailable. Start a new game to obtain a new context.', 400);
  return {
    issue(state) {
      const at = now();
      for (const [token, record] of contexts) if (record.expiresAt <= at) contexts.delete(token);
      issued = issued.filter(time => time > at - 60_000);
      if (issued.length >= 6) throw new AiPolicyError('CONTEXT_RATE_LIMIT', 'Wait before starting another coach context.', 429, 60);
      if (contexts.size >= 128) throw new AiPolicyError('CONTEXT_CAPACITY', 'Coach contexts are at capacity. Try later.', 429, 60);
      if (state.isComplete) throw unavailable();
      const coachContext = 'coach_' + randomBytes(32).toString('base64url');
      contexts.set(coachContext, { demand: structuredClone(state.demandSequence), config: structuredClone(state.config),
        history: structuredClone(state.history), used: 0, expiresAt: at + TTL_MS });
      issued.push(at);
      return { coachContext, remaining: 10, expiresAt: new Date(at + TTL_MS).toISOString() };
    },
    check(token, state) {
      const record = isCoachContext(token) ? contexts.get(token) : undefined;
      if (!record || record.expiresAt <= now() || state.isComplete
        || !isDeepStrictEqual(record.demand, state.demandSequence) || !isDeepStrictEqual(record.config, state.config)
        || !isDeepStrictEqual(record.history, state.history.slice(0, record.history.length))) throw unavailable();
      if (record.used >= COACH_CONTEXT_LIMIT) throw new AiPolicyError('COACH_GAME_LIMIT', 'This game context has used its 10 coach requests. Continue playing without AI assistance.', 429);
      return record;
    },
    // Called synchronously directly after global reservation: no interleaving await.
    consume(record, state) { record.used++; record.history = structuredClone(state.history); return COACH_CONTEXT_LIMIT - record.used; },
  };
}
