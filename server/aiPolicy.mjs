export const PRICE_DATE = '2026-10-29';
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
// Browser input cannot choose a model. No automatic fallback.
export const MODEL_PROFILES = Object.freeze({
  [DEFAULT_MODEL]: Object.freeze({ inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5,
    countRequestUsd: 0, thinkingLevel: 'MINIMAL', priceDate: PRICE_DATE }),
});
export const WORKFLOW_BUDGETS = Object.freeze({
  decision_coach: Object.freeze({ input: 1024, output: 512 }),
  candidate_order_simulation: Object.freeze({ input: 1024, output: 640 }),
  game_analyst: Object.freeze({ input: 3072, output: 1024 }),
  scenario_generator: Object.freeze({ input: 1024, output: 384 }),
});
export const PROPOSAL_BUDGET = Object.freeze({ input: 768, output: 128 });
export const HTTP_BODY_BYTES = 20_000;
export const PROVIDER_BODY_BYTES = 64_000;
export const JSON_TEXT_BYTES = 12_000;
export const PROVIDER_TIMEOUT_MS = 8_000;

export class AiPolicyError extends Error {
  constructor(code, message, status = 503, retryAfter) {
    super(message); this.name = 'AiPolicyError'; this.code = code;
    this.status = status; this.retryAfter = retryAfter;
  }
}

export function readAiPolicy(env = process.env) {
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (!Object.hasOwn(MODEL_PROFILES, model)) {
    throw new AiPolicyError('CONFIGURATION', 'Unsupported AI model. Configure gemini-3.1-flash-lite; no automatic upgrade is enabled.');
  }
  const dailyBudgetUsd = env.AI_DAILY_BUDGET_USD === undefined ? 1 : Number(env.AI_DAILY_BUDGET_USD);
  if (!Number.isFinite(dailyBudgetUsd) || dailyBudgetUsd <= 0 || dailyBudgetUsd > 1) {
    throw new AiPolicyError('CONFIGURATION', 'AI_DAILY_BUDGET_USD must be greater than zero and at most 1.');
  }
  if (env.AI_COST_RECONCILIATION_VERIFIED !== undefined
    && !['true', 'false'].includes(env.AI_COST_RECONCILIATION_VERIFIED)) {
    throw new AiPolicyError('CONFIGURATION', 'AI_COST_RECONCILIATION_VERIFIED must be true or false.');
  }
  return Object.freeze({ model, profile: MODEL_PROFILES[model], dailyBudgetUsd,
    ledgerPath: env.AI_USAGE_LEDGER_PATH || '.local/ai-usage.json',
    reconcileVerified: env.AI_COST_RECONCILIATION_VERIFIED === 'true',
    maxActive: 2, perMinute: 6, perDay: 100 });
}

export function estimateCost(profile, prompt, candidates, thoughts) {
  return (prompt * profile.inputUsdPerMillion + (candidates + thoughts) * profile.outputUsdPerMillion) / 1_000_000;
}

export function maximumRunCost(policy, workflow) {
  const budget = WORKFLOW_BUDGETS[workflow];
  if (!budget) throw new AiPolicyError('INVALID_WORKFLOW', 'Unsupported AI workflow.', 400);
  return estimateCost(policy.profile, PROPOSAL_BUDGET.input + budget.input,
    PROPOSAL_BUDGET.output + budget.output, 0) + 2 * policy.profile.countRequestUsd;
}
