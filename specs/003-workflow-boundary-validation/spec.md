# Feature specification: workflow boundaries and adversarial verification

Feature: 003

Date: 2026-10-29

Branch: `feature/003-workflow-boundary-validation` (planning baseline: `5a48e72`)

Status: Implemented with local deterministic verification on 2026-10-29; browser acceptance for T017 remains pending. See [execution evidence](evidence.md). The review remains the historical pre-implementation analysis.

Basis: [review.md](review.md), including current code references, baseline checks, and isolated probes at revision `742d31a`. Read the review before implementing this specification.

## Outcome

Ensure existing workflow inputs, allowed operations, factual evidence, and activity descriptions agree with the actual game and the player's selected task. Add adversarial regression coverage where the current suite has gaps. Reuse specs [001](../001-low-cost-ai/spec.md) and [002](../002-ai-tool-call-logging/spec.md); do not recreate their token budgets, ledger, observer framework, or exporter.

## Invariants and scope

- Do not change ten-week progression, delivery delay, demand generation, cost calculation, fulfillment rules, summary formulas, or actual order acceptance in `gameEngine.ts`/`gameConfig.ts`.
- Keep the existing local single-player trust model, four workflow handlers, two model-call flow, one allowed tool per run, deadlines, quotas, token/length caps, and no retry/fallback.
- Models remain unable to submit orders, change scenarios/rules, rewrite history, execute code, access arbitrary files/URLs, or mutate another game. The player still explicitly performs state changes.
- No new provider, classifier/supervisor agent, authentication/accounts, database, paid evaluation service, general schema library, distributed lock, or broad refactor.
- Canonical replay means consistency, not authenticated ownership or history provenance. Do not describe imported local logs as tamper-proof evidence.

## User stories

### US1 — The requested task is the task performed (P1)

When I request candidate quantity 9 or select growth/hard, the structured request keeps those values authoritative over conflicting goal prose or model output. A conflicting tool proposal/final is rejected rather than silently performing another valid task. Only the workflow's existing tool can run.

### US2 — Existing gameplay remains compatible with AI (P1)

After a legal actual order such as 2.5 or 51, my canonical game can still request assistance. The separate candidate/recommendation range remains integer 0–50. The coach sees actual recent submitted orders and the already visible current demand, with no hidden future demand.

### US3 — Facts and activity descriptions do not overstate evidence (P1)

Structured coach/candidate facts must match supplied deterministic facts. Imported malformed or contradictory records produce warnings/incomplete status rather than a crash or a false claim of completion. A previous-week recommendation must not remain actionable as current advice.

### US4 — Monitoring and test coverage are understandable (P2)

Use existing events to describe observed requests, workflow calls, tool attempts, outcomes, and known usage per anonymous session and selected workflow. Keep identity, missing data, actual order history, and hypothetical advice distinct. A deterministic adversarial suite shows which boundaries were tested without claiming it measured live model intelligence.

## Functional requirements

### FR-01 — Correct data projection and compatible replay

- Populate coach recent orders from recorded submitted `order`, preserving the existing recent-history window. Expose current demand distinctly from prior demand; do not substitute shipments for orders or expose the future sequence.
- Change API historical-order validation to match existing engine-legal finite nonnegative quantities. Preserve full canonical replay/deep comparison. Keep candidate tool and recommended-quantity 0–50 integer bounds.
- Document the existing custom-demand API boundary separately from gameplay; do not alter scenario generation or add an unrequested extreme-number policy. Tests must distinguish a malformed snapshot from legal gameplay rejected by a mismatched adapter.

### FR-02 — Explicit task parameters and strict dispatch

- Add narrowly typed `taskInput` to the existing request contract: candidate `{orderQuantity}`; scenario `{scenario,difficulty}`. Require those fields for those two workflows, reject extras/wrong types, and allow omission/empty input only for coach/analyst. Update current UI/client/test fixtures together; missing required task input fails clearly, never guesses from prose.
- Validate task input before any provider request. Do not derive authorization, numeric quantity, or selected enum by decoding a goal, matching keywords, or calling another agent.
- Compare the candidate proposal's quantity to validated task input before tool execution; reject conflicts without executing a substituted quantity. Compare the scenario final's enums to the validated selection before display/start eligibility. Preserve exact candidate-tool-result matching.
- Use own-property registry membership before descriptor lookup. Known cross-workflow, unknown, inherited/prototype, and write-tool names execute zero tools and receive an explicit rejection.

### FR-03 — Deterministic factual evidence

- Reuse the analyst's format-and-verify approach for coach and candidate facts, grounded only in their actual read-only tool result. Provide the same approved facts to the model and final validator.
- Reject fabricated inventory, arrival, cost, week, or other structured facts. Scenario evidence must refer to the selected scenario/difficulty or their matching approved catalog descriptions, not an unrelated approved option.
- Retain free-form advice as advisory text. Do not claim that schema/fact membership proves every sentence semantically correct. Do not introduce a second model to review the first.
- Keep new fact context inside existing token budgets; verify the measured/fixture counts. Do not raise caps or drop mandatory history to hide failures.

### FR-04 — Conservative activity-record interpretation

- Add a small explicit validator for existing version-1 event envelopes and the event payload fields consumed by export/summary. Reuse event types and identity/size conventions; no generic validation dependency.
- Validate metadata types, canonical UTC dates, sequence/duration fields, participant provenance, run IDs, and exact/redacted/omitted payload shapes. Initial unknown identity and later validated context must remain supported.
- Bound imported line sizes as well as total file size before parsing. Invalid records become safe line/request warnings; valid neighbors remain exportable. Preserve truncation warnings and no-overwrite/private-path protections.
- Check observed append order before any display sorting. Detect duplicates/gaps/out-of-order events, conflicting terminal outcomes, run/context inconsistencies, and impossible new execution after terminal outcome. Mark affected records incomplete/invalid instead of fabricating a normal lifecycle.
- Permit legitimate early rejection, cancelled/failed requests, omitted payloads, wall-clock adjustment, and late provider observations after timeout/cancellation. Do not require a fixed number of success events or infer completion from a terminal marker alone. Do not repair the source file.

### FR-05 — Reusable structured activity summaries

- Derive one summary per request from validated existing events: request/run ID, workflow, unverified session/label source, observed model/count/tool starts and outcomes, final status, known usage/cost, and completeness/issues. Use it in the current Markdown exporter; do not create another authoritative log.
- Add grouped totals for anonymous session and workflow/task (the responsible handler). These are descriptive local counts, not authenticated per-user quotas or another enforcement system.
- Distinguish received, protocol-valid, admitted, dispatched, completed, and rejected actions. Add one explicit `request_admitted` event immediately after existing quota reservation if admitted totals are reported. Older logs without it must report admission as unknown; `request_accepted` cannot be reinterpreted as admitted.
- Missing/disabled/partial capture must remain unknown or explicitly observed/lower-bound counts. Never deduplicate repeated legitimate requests, infer recommendation application, or describe an order from an AI suggestion. Actual order/outcome descriptions continue to come from the existing game history.
- No new history-search agent or archive database. Queries about unavailable sessions/weeks must not invent records or scan unrelated files; any later filtering stays within the selected local record set.

### FR-06 — Invalidate stale weekly advice

On successful order progression, clear or invalidate the previous week's coach result and week-scoped usage/action controls alongside the already-cleared candidate result. Preserve persisted logs and explicit scenario-start guards. Failure to submit an invalid order must not advance the game or discard otherwise-current state.

## Verification requirements

Follow the bounded many-to-many strategy in [plan.md](plan.md). Include normal controls, mixed encodings, malformed input/output, all cross-workflow tool pairs, invalid state/config/history, duplicate/concurrent actions, past/future requests, and corrupted activity records. Assert actual counters and state equality; distinguish dispatch rejection from prose quality.

The implementation must retain the current 137-test baseline, add targeted regressions, pass typecheck/build/rendered UI/local logging smoke, and verify the stale-advice interaction using an actual UI interaction when available. Do not mark an SSR render as proof of stateful browser behavior.

Live provider verification is a separate optional, explicitly recorded activity. Do not claim injection robustness or repeat/complete spec 001 T022 from mocked tests. No live calls are required for this planning task.

## Acceptance and evidence

During later execution, create/update `evidence.md` in this folder with task mappings, exact commands/results, matrix case IDs, observed rejections/counts/state checks, UI status, failures, commits, and limitations. Do not mark any implementation task complete from this review alone.

Acceptance requires the reproduced R1–R5 defects fixed with regression evidence, R6 actually verified or explicitly left pending, explicit registry rejection for R7, truthful summaries for R8, unchanged mechanics, and no claim of authenticated ownership, archived history, or live model resistance that the architecture/tests cannot support.
