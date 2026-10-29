# Implementation plan: workflow boundaries and adversarial verification

Status: Executed on `feature/003-workflow-boundary-validation`; local implementation/checks pass, T017 browser acceptance remains pending. See [evidence](evidence.md) and [coverage](coverage.md). The dependency/matrix design below is retained as the execution plan.

Inputs: [review](review.md), [spec](spec.md), [tasks](tasks.md). Baseline: `742d31a`, 137 tests and typecheck passing.

## Reuse and changes

| Work | Existing owner | Minimal change |
|---|---|---|
| Legal-history replay | `server/workflows.mjs` | Align historical-order guard with existing engine acceptance; keep replay/deep equality |
| Coach context | `src/agent/decisionCoach.ts` | Correct order projection and expose current demand; add value assertions to existing tests |
| Explicit task selection | `src/agent/agentClient.ts`, `src/App.tsx`, `server/workflows.mjs`, candidate/scenario handlers | Shared small task-input validator/types where needed; bind proposal/final to explicit controls |
| Dispatch | `src/agent/boundedAgent.ts` | Own-property guard; retain existing registry and scope validation |
| Verified facts | Existing four workflow modules + `server/workflows.mjs` | Reuse analyst-style fact formatting; extend coach/candidate checks and selected catalog facts |
| Record interpretation | `server/aiToolCallLog.mjs`, `server/exportAiToolCallLog.mjs` | Reusable explicit v1 validation, order/lifecycle issues, derived summary; add admission event in `server/index.mjs` |
| Stale results | `src/App.tsx` | Follow existing candidate invalidation after successful progression |
| Verification | Existing `*.test.mjs`, fixtures, `server/uiSmoke.mjs`, `server/loggingSmoke.mjs` | Extend, do not replace, current regression checks and mock fetch/clock/private temporary paths |

Use Node's existing test runner and built-in modules. Introduce a tiny shared helper only when the client/server need the same contract; avoid an agent framework, generic policy engine, or wholesale module refactor.

## Dependency order

1. Convert the review's confirmed probes into failing regression cases with explicit expected behavior and state/counter assertions.
2. Fix projection/replay and prototype dispatch; keep engine/config files unchanged.
3. Add structured task-input validation and UI serialization together; pin candidate/scenario choices; update old fixtures rather than preserving a silent prose-parser fallback.
4. Tighten evidence using shared deterministic facts; verify budgets still hold.
5. Validate imported events and lifecycle diagnostics; build summaries on validated events and add the explicit admission observation without rewriting older logs.
6. Invalidate stale advice; perform genuine UI interaction verification separately from SSR.
7. Run the complete local checks, record limitations, and write feature-local implementation evidence before marking tasks complete.

## Bounded N-to-N strategy

N-to-N here means many controlled inputs mapped to multiple workflows, task parameters, and game states with explicit outcome oracles. It does not mean more agents or an unbounded Cartesian product.

### State catalog

| ID | Synthetic state | Relevant expectations |
|---|---|---|
| S0 | Fresh week 1 | Coach/candidate/scenario eligible; analyst ineligible |
| S1 | Active game with shipments in transit | Coach/candidate eligible; others ineligible; exact pipeline facts |
| S2 | Active shortage/backlog | Coach/candidate eligible; inventory/backlog facts and non-mutation |
| S3 | Week 9 with pending arrival beyond horizon | Timing can be week 11; no actual week 11 progression or demand/cost forecast |
| S4 | Week 10 awaiting final order | Existing last-week simulation semantics retained; game not complete yet |
| S5 | Completed ten-week game | Analyst eligible; other three ineligible for that snapshot |
| S6 | Tampered config, status/week, history/order, cost or shipments | Reject non-canonical snapshot before model/tool dispatch |
| S7 | Separate canonical histories A and B / legal decimal or >50 actual orders | Each legal history is valid; A never mutates B; no authenticated-provenance claim |

Build each by existing engine functions; mutate only isolated copies for negative tests. Do not read/edit production state or existing private ledgers.

### Required matrix blocks

| Block | Coverage | Oracle |
|---|---|---|
| M1 Dispatch | Full 4 workflows × 4 known tools = 16 pairs at valid phases, plus each workflow against write/unknown/prototype names | Four legitimate pairs can execute; every wrong pair executes zero tools; explicit reason |
| M2 Phases | Full 4 workflows × S0–S5 = 24 eligibility pairs | Ineligible phase has zero model/provider/tool requests; no unintended workflow fallback; admitted-slot policy documented |
| M3 Manipulation | At least 10 input forms × 4 workflows at valid phases; use normal and malicious scripted model controls | Goal remains data; forbidden model proposals cannot change task/scope/state; no decoding/eval/retry |
| M4 Task binding/facts | Quantity 0/50/9 vs conflicting 4; invalid/string/fraction/out-of-range; every approved scenario/difficulty and wrong selections; fabricated facts | Invalid task fields reject before provider; conflicting proposal/final rejected; facts match actual tool context |
| M5 State/temporal | S6 tampering and S7 legal/isolated histories across applicable workflows; unavailable history, weeks -100000/0/11/100000, missing/reordered history | Canonical consistency/fixed rules retained; unavailable past not invented; future timing never advances state |
| M6 Repetition/concurrency | Same-session repeat after completion, concurrent A/B, cancel/reissue, failed admitted request, changed/spoofed label | Distinct valid requests consume documented slots; one active action; no extra retries, cross-request state or prompt leakage |
| M7 Activity records | Correct, missing, malformed, oversized, redacted/omitted, duplicate/gapped/reordered, conflicting terminal, mismatched run/context, late provider response | Safe structured warnings and incomplete status; valid neighbors export; no source repair or fabricated outcomes |
| M8 Monitoring | Logging on/off/full/partial; complete and missing usage; old v1 logs; admission denial; unknown session/changed label | Observed counts per request/workflow/unverified session; unknown remains unknown; accepted ≠ admitted; no extra provider calls |

For M3 use plain text; JSON as goal text and malformed/wrong-type protocol JSON separately; Markdown/code fences; Unicode/combining/confusable/bidi characters; base64 and percent-encoded instructions; special characters including NUL/HTML; nested instructions; repeated commands; contradictions. Include mixed multi-step sequences asking to change rules, reset/finish the game, impersonate another participant, rewrite past results, or use another workflow's tool.

Do not make all state × encoding × tool combinations mandatory. Use the full matrices where small and security-relevant (M1/M2), then a documented pairwise covering table for the remaining dimensions. Every encoding must reach all four workflows at least once and appear in a malicious-response test. Every important state must have both a legitimate control and an invalid operation. Give each row a stable case ID and list uncovered combinations explicitly.

### Boundaries to retain and extend

- Goals: empty/1/499/500/501 Unicode code points; multibyte and long repeated inputs. Labels: 0/80/81 and control characters.
- HTTP body: 19,999/20,000/20,001 bytes with valid JSON where applicable; raw wrong-type/missing/extra fields. Test duplicate JSON keys under the existing parser's semantics rather than introducing a custom parser automatically.
- Proposal/final token caps: cap and cap+1 for each existing budget; extracted JSON 11,999/12,000/12,001 bytes; provider body 63,999/64,000/64,001. Reuse existing coverage and add missing exact edges only.
- Events: 63,999/64,000/64,001 serialized bytes; 10-MB storage; imported per-line bound; canonical UTC versus invalid dates; sequence versus wall-clock adjustments. Keep existing privacy/capacity/no-overwrite tests.
- Counts: at most two generations/two count requests/one tool; zero provider retries; 6/minute and 100/day; restart/conservative reservations. Do not multiply quota tests by every attack format if existing focused tests prove the same property.

### What the tests can and cannot prove

Use mock provider HTTP and scripted proposals to measure actual call counts, arguments, accepted fields, captured facts, and unchanged before/after snapshots. Store only sanitized fixture evidence in the feature folder; runtime JSONL/export stays ignored.

These tests prove deterministic boundaries, not a live model's likelihood of following an injection or the truth of all prose. Use hostile scripted finals as well as hostile goals so the backend is exercised even if a future model obeys the attack. Optional live evaluation requires a separate, bounded, explicitly recorded run; it is not a completion dependency for this planning task and does not replace spec 001's open acceptance.

The existing rendered UI smoke can check labels/markup, not click ordering or stale-result invalidation. Use the available browser tooling with a local mocked endpoint for that interaction; if unavailable, leave that acceptance check pending rather than adding browser dependencies or declaring it passed from SSR.

## Excluded/deferred work

No new hard per-user quota, identity verification, saved-game ownership, immutable historical archive, automatic order/scenario execution, persistent manual gameplay event stream, new history agent, automatic payload decoding, live model benchmarking service, billing changes, or game numeric policy changes. Actual order descriptions come from `WeekResult` history; AI records must not claim the player applied advice.

## Planned verification and commits (execution recorded in evidence)

Suggested commits: focused regressions; projection/replay/dispatch fixes; typed task input and verified facts; validated activity summaries/export; stale-advice interaction; final verification/evidence. Each implementation commit must be described in this feature's later `evidence.md` with actual test coverage.

Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run test:ui`, `npm.cmd run build`, and `npm.cmd run test:logging` after relevant changes. Preserve source review and failed cases. Keep future implementation on a feature branch; no push/merge to `main` is authorized by this planning task.
