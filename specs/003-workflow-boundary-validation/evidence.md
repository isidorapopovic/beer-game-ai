# Feature 003 execution evidence

Date: 2026-10-29, Europe/Budapest. Base/planning commit: `5a48e72` (reviewed runtime
base `742d31a`). Implementation branch: `feature/003-workflow-boundary-validation`.
This execution is separate from the documentation-only planning session described
in [review.md](review.md); that review remains an unchanged historical record.

**Local implementation and deterministic checks pass. Browser acceptance is
pending.** Eighteen tasks are complete; T017's source change is implemented but its
required browser interaction is unverified. The original verification session made
no commit or merge. A subsequent user-authorized commit and local-main merge are
recorded below, along with the later user-authorized GitHub publication. No live
AI API call, private configuration edit, or production-state/ledger change was made.

## What changed

- [Coach](../../src/agent/decisionCoach.ts) reads submitted `history.order`, keeps
  the five-week past window, and exposes current visible demand separately. Empty
  history produces empty past arrays. No future demand sequence is projected.
- [Request validation](../../server/workflows.mjs) accepts finite nonnegative
  actual orders (including 2.5 and 51), then still replays/deep-compares the entire
  canonical state. The existing API custom-demand limit of 100 remains distinct
  from the engine's broader custom-demand acceptance. Extreme numerical overflow
  policy is unchanged and outside this feature.
- [Shared task input](../../src/agent/taskInput.ts), [client](../../src/agent/agentClient.ts)
  and [UI](../../src/App.tsx) serialize and validate candidate `{orderQuantity}` or
  scenario `{scenario,difficulty}`. Required selections are never inferred from
  prose. Invalid selections fail before provider dispatch. Candidate arguments are
  pinned through the existing argument validator; scenario finals must match the
  explicit selection. Coach/analyst accept omitted or empty task input only.
- [Dispatch](../../src/agent/boundedAgent.ts) checks own registry properties.
  Unknown/prototype/write/cross-workflow names receive `unknown_tool` with no tool
  execution. Candidate simulation still uses isolated engine state; no write tool
  or automatic scenario start/order submission was added.
- Coach/candidate facts use shared deterministic formatters supplied to both the
  model prompt and final validator. Scenario facts belong to the selected catalog
  entry/difficulty. Exact candidate result checks also reject extra simulation
  fields. Advisory prose is not semantically certified by fact membership.
- [Activity validation and summaries](../../server/activitySummary.mjs) validate
  v1 metadata and consumed payload shapes, preserve append order, check sequence,
  run/context/lifecycle consistency, and derive request/workflow/unverified-session
  summaries. [Export](../../server/exportAiToolCallLog.mjs) bounds imported lines,
  skips malformed neighbors with warnings, and renders summaries without repairing
  files. Source-wide parse/truncation warnings conservatively mark exported request
  completeness unknown/incomplete; valid neighboring events remain visible.
- [Admission observation](../../server/index.mjs) emits `request_admitted` only
  after durable quota reservation. Existing `request_accepted` still means protocol
  valid. No second ledger or per-person enforcement was introduced.
- Successful manual order progression clears coach/candidate results/errors and
  week-scoped usage/logging display. Invalid submission throws before those clears.
  Persisted activity files are unaffected. This final UI behavior needs browser
  acceptance; source inspection is not counted as an interaction pass.

Game engine/configuration and package/dependency files have no diff. Existing
ten-week progression, two-week delivery, demand/cost/fulfillment/summary rules,
0–50 integer AI candidate/recommendation bounds, call ceilings, token budgets,
deadline, no-retry behavior and global quotas are retained.

## Executed checks and observed failures

The machine-readable [verification record](verification.json) and [coverage table](coverage.md)
are companions to this report. Routine source reads/searches and Git inspection
were read-only; no private `.env` or production record was opened.

| Command / stage | Actual observation |
|---|---|
| `npm.cmd test`, unchanged baseline | 137 pass, 0 fail |
| `node --test server/workflowBoundaries.test.mjs`, before fixes | 14 fail, reproducing R1–R5/R7 |
| Same focused command, after initial fixes | 14 pass, 0 fail |
| `npm.cmd run typecheck`, first implementation attempt | Failed: optional `WeekResult.order` type; documented the submitted-history invariant and used non-null assertion for historical orders only |
| `npm.cmd test`, first integrated attempt | 149 pass / 2 fail; an editing script had re-encoded Unicode test literals; restored original UTF-8 content and retained the exact Unicode assertions |
| `npm.cmd test`, corrected integration | 151 pass, 0 fail |
| `npm.cmd test`, first expanded matrix | 397 pass / 4 fail; the “tampered” fixture assigned order 9 where order 9 already existed; changed the isolated tamper to 10 |
| `npm.cmd test`, corrected matrix | 401 pass, 0 fail |
| `npm.cmd test`, later verification | 442 pass / 1 fail: existing daily-quota test reported LEDGER_UNAVAILABLE during temporary-file save; no runtime ledger code changed |
| `node --test --test-name-pattern='daily 100-action' server/lowCostAi.test.mjs` | Targeted recheck: 1 pass, 0 fail |
| `npm.cmd test`, full recheck | 443 pass, 0 fail |
| `npm.cmd test`, final after client serialization and activity-consistency assertions | **446 pass, 0 fail, 0 skipped** |
| `npm.cmd run typecheck` | PASS after correction |
| `npm.cmd run test:ui` | PASS: rendered initial game, participant, usage, recording statuses; no browser behavior claim |
| `npm.cmd run build`, sandbox attempt | Failed resolving Vite/esbuild project files because of filesystem access restrictions |
| `npm.cmd run build`, approved execution outside filesystem sandbox | PASS: Vite 7.3.6, 40 modules, JS 246.23 kB / gzip 76.13 kB |
| `npm.cmd run test:logging` | PASS: four synthetic workflows, actual capture/export CLI, 76 events, 0 warnings, unchanged snapshots, four mock provider HTTP requests per workflow |
| `git diff --check` | PASS; line-ending conversion notices only |
| `git diff --name-only -- src/game/gameEngine.ts src/game/gameConfig.ts package.json package-lock.json` | Empty: mechanics and dependencies unchanged |
| `node server/browserSmoke.mjs`, sandbox attempt | Vite dependency resolution denied |
| Same browser fixture, approved execution outside filesystem sandbox | Isolated mocked service started at localhost:5179; no `.env`, live fetch, or production ledger; subsequently stopped |
| Browser discovery | Browser access host unavailable |
| Native Chrome selection | Computer Use app approval timed out; no interaction assertion or screenshot captured |

The ledger failure above was not conclusively diagnosed. A temporary filesystem
issue is possible, but is not established. Both its isolated recheck and the full
rerun passed without changing quota tests or adding retries. The failure is kept
in this report rather than erased by the successful rerun.

Private run output is under ignored `.local/spec003/`: baseline-tests,
regressions-before, regressions-after-first, tests-first, tests-second,
tests-matrix-first, tests-matrix-second, tests-final, daily-quota-recheck,
tests-final-recheck, tests-delivery, typecheck, ui, build, logging and logging-final
text files. These are machine-local diagnostics, not required portable evidence.
Only sanitized aggregate/test-case results are versioned.

## Task-to-evidence mapping

| Task | Status | Evidence |
|---|---|---|
| T001 | PASS | Fourteen review regressions first failed, then passed; tests prefixed R1–R5/R7 |
| T002 | PASS | [State/encoding catalogs and pairwise/full matrices](coverage.md), stable M1–M8 IDs |
| T003 | PASS | R1/P01 exact orders versus arrivals, five-week window, current demand, empty history/no future sequence |
| T004 | PASS | R2/P02 orders 2.5 and 51, M5 canonical/tamper/API-demand boundaries, unchanged engine/config diff |
| T005 | PASS | M1 16 pairs plus 24 forbidden-name cases; explicit unknown_tool and zero unauthorized tools |
| T006 | PASS | Shared types/validator; M4 invalid fields before model; HTTP/client missing-selection rejection |
| T007 | PASS | Client serialization, quantity 0/9/50, selected 9 versus proposed 4, all 12 scenario pairs; hostile/encoded goals |
| T008 | PASS | R4 and M4 false facts; 40 hostile finals; selected catalog membership and exact simulation checks |
| T009 | PASS, mock scope | Actual prompts include approved facts; supplied count fixtures exercise existing caps; inherited cap/cap+1 checks and provider body/JSON edges pass; no real Gemini tokenization measured |
| T010 | PASS | M7 fifteen malformed field cases and 63999/64000/64001-byte imported line checks; valid neighbors/source preserved |
| T011 | PASS | M7 fourteen corrupted lifecycle cases, valid early failure/cancellation/late observations and UTC correction |
| T012 | PASS | Reusable summaries consumed by exporter; observed starts/outcomes, nullable usage/cost, issues, unverified identity |
| T013 | PASS | Explicit post-reservation admission; per-workflow/session totals; old admission unknown; denied protocol-valid request distinguished |
| T014 | PASS | M2 24 phase cells; M3 ten forms × four workflows × control/hostile proposal/hostile final; exact calls/state assertions |
| T015 | PASS | M5 44 tamper cases, canonical A/B histories, absent archive/impossible-week goals, horizon weeks 9/10, unchanged mechanics |
| T016 | PASS | M6 HTTP repeat/change-label/global quota, concurrent A/B isolation, cancel/reissue and failed/phase admissions; inherited restart/daily tests retained |
| T017 | **PARTIAL / OPEN** | Source clears stale advice after successful progression; invalid submission preserves it by code path. Actual mocked browser interaction blocked by browser host/app approval availability |
| T018 | PASS, stated limit | 446 tests, typecheck, rendered UI, build, logging/export; pending browser and live limits explicitly recorded |
| T019 | PASS | This report, docs entry, coverage, verification JSON, smoke result, checklist and indexes; implementation commit `f887018`; local-main delivery recorded below |

## Monitoring semantics and four-workflow smoke

The final [smoke result](smoke-results.json) records four complete requests and four
observed admissions, with one anonymous mock session per workflow. Each action
emits 19 events (the prior 18-event success trace plus admission), performs two
generations/two token counts/one local tool, and leaves input snapshots unchanged.
The exporter does not require a fixed 19-event trace: early failures and late
observations after cancellation are covered separately.

The final smoke timestamp is 2026-10-29T21:51:35.013Z, or 2026-10-29T22:51:35.013+01:00 in
Budapest. The actual JSONL and Markdown export stay in the ignored directory named
in the result file. They contain synthetic data only and are not committed.

Counters mean observed local stages: receipt, protocol validity, explicit quota
admission, dispatch, completion/rejection and incompleteness. Older logs without
admission retain `unknown`; a received/accepted event is not converted to admitted.
Wrong-phase but protocol-valid HTTP requests currently consume an admitted quota
slot before preflight rejects them, with zero provider requests. Failed admitted
requests consume their reserved slots too. Distinct repeated requests are not
deduplicated. Labels/session IDs remain caller-supplied/unverified; changing a label
does not create another enforcement tier or bypass the global allowance.

Missing/disabled/partial capture supports only observed/lower-bound counts. Usage
and full estimated cost stay unknown where not justified; known portions are
labelled lower bounds. Records do not prove the player applied a recommendation.
Actual gameplay order/outcome history remains the unchanged engine's `WeekResult`
history. No archive lookup, account identity, signed save or immutable log exists.

## Remaining browser acceptance

T017 stays unchecked until these steps can actually be observed in a browser:

1. Run `node server/browserSmoke.mjs` and open its localhost URL (mock service only).
2. Ask the coach in week 1. Observe advice, recommendation control and usage.
3. Submit an invalid order (blank or negative). Verify week 1 and current advice/
   usage remain, with a validation error.
4. Submit a valid order. Verify week 2, no previous-week coach/candidate result,
   recommendation control or old usage/logging display. Verify captured activity
   remains in the fixture's JSONL file.
5. Request candidate quantity 9 and scenario choices in their eligible phase;
   verify exact structured selections and separate manual start/submit controls.
6. Stop the fixture. Do not enable logging or touch the real service configuration.

The fixture is provided in [browserSmoke.mjs](../../server/browserSmoke.mjs) without
new dependencies. It uses ephemeral service port, localhost Vite port 5179, fresh
private test paths and an injected mock fetch. It never calls a real provider.

## Scope and delivery

These tests demonstrate deterministic boundaries under scripted hostile proposals
and finals, not a real model's likelihood of obeying injections or correctness of
every advisory sentence. Exact live token counts remain unmeasured. The local
single-player client owns game history; canonical replay proves consistency, not
authenticated ownership, historical provenance or multiplayer authorization.

Spec 001 T022 and prior live analyst/scenario acceptance remain untouched. No live
model call was used to fill an evidence gap. No agent, account, provider, dependency,
dashboard, database, billing change or new gameplay rule was added.

The initial implementation was left uncommitted on its feature branch. The
initial branch-creation attempt was blocked by the filesystem sandbox; the approved
local branch operation then succeeded. No automatic-approval rejection remains
unresolved.

## User-authorized commit and local-main delivery - 2026-10-29

The user subsequently requested committing and merging to `main`.

| Commit | Contents |
|---|---|
| `f887018` | Spec 003 implementation, tests, coverage and execution evidence; 32 files |
| `fd26a7d` | Four supplied W08 course documents under `specs/004-secure-game`; content preserved, no W08 implementation |
| Delivery-documentation commit | Updated this report, docs evidence and verification metadata after the successful merge; exact hash is in Git history |

Executed `git add` with explicit project paths, inspected the staged file lists,
and created the two commits above. `.env` and `.local/` remained ignored and were
not staged. Existing two-space Markdown line breaks in supplied W08 materials
were preserved; Git's whitespace check reports those five original lines.

Executed `git switch main`, then
`git merge --ff-only feature/003-workflow-boundary-validation`. It succeeded without
conflicts, moving local main from `e69ece4` to `fd26a7d`. This also brought the older
completed commits already on the feature ancestry into main. No history was
rewritten and no remote push was requested or performed.

The final delivery-documentation commit contains no runtime changes. Prior
verification remains 446 passing tests plus typecheck, rendered UI, production
build and mock logging/export; these were not rerun solely for the Git pointer and
documentation changes. T017 browser acceptance and spec 001 T022 remain open.


## User-authorized GitHub publication - 2026-10-29

After the user requested synchronization and publication, executed
`git fetch --prune origin`. The refreshed main comparison was 32 local-only commits
and zero remote-only commits. `origin/main` was an ancestor of local main, so no
pull, conflict resolution or additional merge was needed.

Executed `git push origin main` successfully, without force. GitHub acknowledged
`e69ece4..e4f9f3a main -> main` for
`https://github.com/isidorapopovic/beer-game-ai.git`. This publishes the completed
workflow work, specs 001-003 and supplied W08 materials on the remote main branch.
W08 remains course material only; browser T017 and spec 001 T022 remain open.

The publication-documentation commit updates this evidence and is pushed to the
same branch separately. No runtime changes or live AI requests are involved.

Public web retrieval of the repository page returned a cache-miss error in the
available web tool. Remote Git verification is used to confirm branch identity;
no interactive GitHub web-page inspection is claimed.
