# Implementation plan: Low-cost AI

Specification: [spec.md](spec.md)

Status: Planned, not implemented

Starting code: `46341d6` on `feature/week5-bounded-agent-workflows`

## Approach

Extend the current Gemini REST adapter and bounded workflows. Keep two generation calls because Week 5 requires a model proposal, a validated tool execution, and a model final. A one-call redesign could save tokens but changes that architecture and is outside this feature.

Use a single explicit model profile, compact prompts, token preflight, short output schemas, and a small local usage ledger. Avoid new SDK dependencies unless current REST endpoints cannot satisfy the specification.

## Proposed code changes

| Area | Files | Work |
|---|---|---|
| Policy/configuration | New `server/aiPolicy.mjs`, `.env.example` | Model allowlist, per-step budgets, prices, quota defaults, startup validation |
| Provider boundary | `server/gemini.mjs` | Exact prompt counting, bounded body reads, per-call output cap, minimal thinking profile, usage extraction, cancellation |
| Workflow orchestration | `server/workflows.mjs`, `src/agent/boundedAgent.ts` | Two-generation/one-tool enforcement, compact prompts, safe usage aggregation, explicit stop reasons |
| Result contracts | Four workflow modules in `src/agent/` | Field-length and evidence/finding/advice bounds without weakening factual validation |
| Admission/persistence | New `server/aiUsageLedger.mjs`, `server/index.mjs`, `.gitignore` | Atomic reservations, rolling-minute/day limits, concurrency guard, persistent reconciliation |
| UI evidence | `src/agent/agentClient.ts`, `src/App.tsx` | Typed usage metadata, concise limits/errors, model and token/cost evidence |
| Verification/setup | Existing server/agent tests, `server/liveSmoke.mjs`, integration docs | Boundary/failure tests and opt-in live evidence |

These are proposed paths; create new modules only when they keep policy separate from transport.

## Dependency order and proposed future commits

1. `feat(ai): define low-cost model policy and workflow budgets`
   - Central validated configuration and explicit price profiles; document defaults without editing `.env` or credentials.
2. `feat(ai): bound Gemini prompts and capture token usage`
   - Counting and generation share a deadline; enforce per-step caps; preserve usage even when content is rejected. Add adapter tests with mocked HTTP responses.
3. `feat(ai): enforce concise workflow outputs and request ceilings`
   - Compact prompts, runtime text bounds, one tool and two generation calls, typed safe errors. Add adversarial and boundary tests.
4. `feat(ai): enforce persistent quotas and spending reservations`
   - Atomic admission and restart-safe ledger, unknown-usage reservations, 429 handling. Test races, midnight, corrupt ledger, crashes, and reconciliation with an injected clock and temporary files.
5. `feat(ui): show AI usage and budget-limit messages`
   - Model, actual/partial tokens, count/generation requests, estimated cost, and readable quota messages. No internal prompts or secrets in product UI.
6. `docs(ai): record low-cost workflow verification and setup`
   - Run regression checks and opt-in live smoke when authorized/configured. Record actual results, failures, and any measured budget revision. Do not claim live success if not run.

These are future implementation commits, not commits already made on the documentation branch. [tasks.md](tasks.md) is the execution checklist.

## Test strategy

Extend the existing Node tests; do not use provider credentials in deterministic tests. Inject fetch, clock, and ledger path for boundary coverage. Assert zero generation requests for invalid input, exhausted admission, oversized prompts, and unavailable configuration. Distinguish token-count HTTP traffic from generation calls.

Run the existing 79-test baseline after implementation along with new policy tests, typecheck, and production build. Use `npm.cmd run test:live` only in the later implementation verification, with configured credentials and clear paid-usage authorization. No paid API call is needed to review these documents.

## Rollout and rollback

Develop the runtime implementation on another feature branch based on this reviewed specification. Keep local changes and commits off `main`; no push or merge is part of this task. If new policy fails verification, keep ordinary gameplay available and return a clear AI error. Roll back the relevant feature commits if needed; never bypass validation or silently route to a stronger model.
