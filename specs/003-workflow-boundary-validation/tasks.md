# Tasks: workflow boundaries and adversarial verification

Status: Implemented and locally verified on 2026-10-29, except T017 browser acceptance. Eighteen tasks complete; T017 source change is implemented but actual interaction remains pending. See [evidence](evidence.md) and [coverage](coverage.md). Game mechanics and production data are unchanged.

## Regression foundations

- [x] T001 Turn review R1–R5/P01–P11 into focused failing regressions using existing engine/mock/temporary-record fixtures. Separate current failures from boundary cases already passing.
- [x] T002 Define the state/input catalogs, stable matrix case IDs, expected rejections/counters, and a bounded pairwise coverage table from [plan.md](plan.md). Reuse existing limit/privacy tests instead of duplicating them.

## Correct task context and replay

- [x] T003 Correct coach recent-order projection; expose current demand separately; assert exact submitted orders versus arrivals, past-window semantics, and no future demand exposure.
- [x] T004 Align API history-order validation with existing finite nonnegative engine orders, including 2.5 and 51; keep canonical replay, AI candidate/recommendation bounds, and all game-engine/config behavior unchanged.
- [x] T005 Add own-property registry lookup and the 16-pair M1 routing matrix plus write/unknown/prototype names; prove explicit rejection and zero unauthorized tool executions.

## Explicit intent and facts

- [x] T006 Define shared narrow task-input types/validation for candidate quantity and scenario/difficulty; reject missing/extra/wrong-type fields before provider dispatch; retain goal/model/limit validation.
- [x] T007 Update client/UI serialization and current fixtures together; pin candidate tool arguments and scenario finals to those explicit inputs. Test conflicting/encoded/nested goal instructions without parsing them as authority.
- [x] T008 Generate and verify coach/candidate factual evidence using the existing analyst-style approach; bind scenario facts to the selected catalog entries. Add false inventory/timing/week cases and retain exact actual-tool-result matching.
- [x] T009 Verify new fact context remains within existing token/length budgets. Keep free prose advisory and no second evaluator/model call, cap increase, retry, or hidden-history truncation.

## Activity record integrity and monitoring

- [x] T010 Add reusable explicit v1 record/payload validation and imported per-line size checks; malformed metadata/date/payload rows become safe diagnostics while valid neighboring records remain exportable.
- [x] T011 Validate original per-request append order, sequence continuity, run/context consistency, and terminal/execution relationships. Test gaps, duplicates, reorder, conflicting completion, valid early failure, cancellation, and late provider observations; never repair source logs or hide disorder by sorting.
- [x] T012 Derive reusable structured request/activity summaries from validated events and use them in Markdown export. Include observed model/count/tool starts/outcomes, known usage, completeness/issues, and unverified identity provenance.
- [x] T013 Add an explicit quota-admission observation after existing reservation, then derive request/workflow/anonymous-session totals. Keep old v1 admission unknown, accepted distinct from admitted, partial counts labelled observed, and global enforcement unchanged.

## State, time, and interaction coverage

- [x] T014 Implement M2/M3 phase and manipulation cases across all four workflows with legitimate and hostile scripted controls: encodings, repeated/contradictory/nested commands, malformed data, and multi-step scope/progression bypass attempts. Assert rejection stage, calls, and state equality.
- [x] T015 Implement M5 temporal/state cases: unavailable past, impossible weeks, corrupted/changed history/config/status/pipeline, last-week/horizon timing, and valid alternate canonical snapshots. Document consistency versus provenance and add no archive/ownership claims.
- [x] T016 Implement M6 concurrency/duplicate/session cases and A/B state/prompt isolation. Reuse the existing ledger/observer tests; no deduplication policy, per-user hard quota, or new state service without separate need.
- [ ] T017 Invalidate stale week-scoped coach advice/evidence on successful progression; preserve current results on invalid submission and persisted activity history. Verify through an actual local mocked UI interaction; leave browser acceptance open if tooling is unavailable.

## Verification and feature-local evidence

- [x] T018 Run all existing and new tests, typecheck, rendered UI, production build, and mock logging/export smoke; record actual commands/counts, matrix coverage and remaining live/browser limits. Verify unchanged mechanics and zero extra provider calls for logging/monitoring.
- [x] T019 Create/finalize `evidence.md` in this folder with per-task links, observed before/after cases, failures, commits, monitoring semantics, safe artifacts, and scoped acceptance. Update guides/indexes only as needed; keep spec 001 T022 separate and no source/runtime files from this planning session represented as implemented work.

T017 remains open because browser-host discovery failed and native Chrome app approval timed out. No SSR result is substituted for actual browser acceptance.
