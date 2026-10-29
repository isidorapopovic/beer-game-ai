import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AiPolicyError, maximumRunCost } from './aiPolicy.mjs';

const active = new Set(); // One Node process; shared even between server instances for one path.
const units = usd => Math.ceil(usd * 1_000_000_000);
const validUnits = value => Number.isSafeInteger(value) && value >= 0;
const unavailable = () => new AiPolicyError('LEDGER_UNAVAILABLE', 'AI usage records are unavailable. Restore the local ledger before requesting AI.');

export function createUsageLedger({ policy, now = Date.now }) {
  const path = resolve(policy.ledgerPath);
  function load() {
    try {
      if (statSync(path).size > 2_000_000) throw new Error('Ledger size.');
      const data = JSON.parse(readFileSync(path, 'utf8'));
      if (data.version !== 1 || !data.days || typeof data.days !== 'object' || Array.isArray(data.days)
        || !Array.isArray(data.recent) || data.recent.some(t => !validUnits(t))) throw new Error('Ledger schema.');
      const ids = new Set();
      for (const [day, entries] of Object.entries(data.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(entries) || entries.length > 100) throw new Error('Day schema.');
        for (const entry of entries) {
          if (typeof entry.id !== 'string' || ids.has(entry.id) || !validUnits(entry.reserved)
            || !validUnits(entry.charge) || !['reserved', 'reconciled'].includes(entry.status)
            || !validUnits(entry.at) || typeof entry.model !== 'string' || typeof entry.priceDate !== 'string') throw new Error('Entry schema.');
          ids.add(entry.id);
        }
      }
      return data;
    } catch (error) {
      // Only a genuinely missing file starts a fresh ledger; invalid data never resets quotas.
      if (error.code === 'ENOENT') return { version: 1, days: {}, recent: [] };
      throw unavailable();
    }
  }
  function save(data) {
    const temp = `${path}.${randomUUID()}.tmp`;
    let fd;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(temp, JSON.stringify(data), { flag: 'wx', mode: 0o600 });
      fd = openSync(temp, 'r+'); fsyncSync(fd); closeSync(fd); fd = undefined;
      renameSync(temp, path);
    } catch {
      if (fd !== undefined) closeSync(fd);
      try { unlinkSync(temp); } catch { /* Keep original ledger/reservations on write failure. */ }
      throw unavailable();
    }
  }
  return {
    admit(workflow) {
      if (active.has(path)) throw new AiPolicyError('AI_BUSY', 'An AI action is already running. Try again shortly.', 429, 1);
      const at = now(); const day = new Date(at).toISOString().slice(0, 10);
      const data = load();
      data.recent = data.recent.filter(t => t > at - 60_000);
      if (data.recent.length >= policy.perMinute) {
        throw new AiPolicyError('RATE_LIMIT', 'AI request limit reached. Wait before asking again.', 429,
          Math.max(1, Math.ceil((data.recent[0] + 60_000 - at) / 1000)));
      }
      const entries = data.days[day] || [];
      const retryTomorrow = Math.max(1, Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86_400_000 - at) / 1000));
      if (entries.length >= policy.perDay) throw new AiPolicyError('DAILY_LIMIT', 'The daily AI action allowance is used. Try tomorrow (UTC).', 429, retryTomorrow);
      const reserved = units(maximumRunCost(policy, workflow));
      if (entries.reduce((sum, entry) => sum + entry.charge, 0) + reserved > units(policy.dailyBudgetUsd)) {
        throw new AiPolicyError('BUDGET_LIMIT', 'The daily estimated AI budget is used or reserved. Try tomorrow (UTC).', 429, retryTomorrow);
      }
      const ticket = { id: randomUUID(), day };
      entries.push({ id: ticket.id, at, reserved, charge: reserved, status: 'reserved', model: policy.model, priceDate: policy.profile.priceDate });
      data.days[day] = entries; data.recent.push(at);
      save(data); // Durable reservation and quota slot BEFORE any provider dispatch.
      active.add(path);
      return ticket;
    },
    finish(ticket, evidence) {
      try {
        const data = load();
        const entry = data.days[ticket.day]?.find(item => item.id === ticket.id);
        if (!entry) throw unavailable();
        const cost = evidence?.estimatedUsd;
        if (policy.reconcileVerified && evidence?.usageStatus === 'complete' && Number.isFinite(cost) && cost >= 0) {
          // Only a complete priced sample can replace the original reservation.
          entry.charge = units(cost); entry.status = 'reconciled';
          save(data);
        }
        return { reservationStatus: entry.status, chargedEstimateUsd: entry.charge / 1_000_000_000,
          dailyAllowanceUsd: policy.dailyBudgetUsd, reconciliationVerified: policy.reconcileVerified };
      } finally { active.delete(path); }
    },
  };
}
