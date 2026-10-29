# Feature 001 execution evidence — Low-cost AI

Status: **IMPLEMENTED; local verification PASS; full live/browser acceptance pending**

Updated: 2026-10-29 (Europe/Budapest)

Specification: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

This record stays in the feature folder. It describes implementation verification, not the feature 002 participant activity log. The initial NOT RUN template existed at `87c1031`; this session replaces its placeholders with observed results, preserving failures below.

## Execution record

| Field | Actual observation |
|---|---|
| Date / reporting timezone | 2026-10-29 / Europe/Budapest (UTC+01:00) |
| Session start | Not captured; live artifacts contain exact UTC request timestamps |
| Final local verification | 2026-10-29; Node v24.21.0, Windows PowerShell |
| Branch | `feature/001-low-cost-ai`, created from `87c1031` |
| Tested runtime revision | `6dfc5b9` (runtime, UI, tests, and smoke harness) |
| Provider modes | Deterministic mock HTTP tests plus real Gemini attempts; no mock fallback in production |
| Model / profile | `gemini-3.1-flash-lite`; MINIMAL; temperature 0.2; one JSON candidate |
| Private configuration | Existing `.env` preserved; its model configuration checked as supported; key never printed |
| Outcome | Local controls verified; live coach/candidate success; analyst/scenario acceptance unresolved |
| Git boundary | No push, merge, or change to `main` |

## Changed files and implementation decisions

Runtime commit `6dfc5b9` contains these 24 files:

- `.env.example`, `.gitignore`, `package.json`: explicit default model/configuration, ignored local state, test commands.
- `server/aiPolicy.mjs`: one supported price/model profile, budgets, safe errors, and maximum-cost calculation.
- `server/aiUsageLedger.mjs`: atomic persisted admission/reservations, concurrency/rate/day checks, conservative reconciliation.
- `server/gemini.mjs`: exact count-before-generate requests, bounded response reads, deadlines, per-call caps, sanitized usage/failure metadata.
- `server/index.mjs`, `server/workflows.mjs`: validated requests, ledger admission before dispatch, compact prompts, safe result/evidence aggregation and deadline reasons.
- `src/agent/aiLimits.ts`: shared Unicode goal/text/item policy.
- `src/agent/decisionCoach.ts`, `candidateOrderSimulation.ts`, `gameAnalyst.ts`, `scenarioGenerator.ts`: concise final contracts; candidate output now matches the actual executed simulation.
- `src/agent/boundedAgent.ts`: two model steps, one tool, zero retries; second-step deadline classified as deadline.
- `src/agent/agentClient.ts`, `src/agent/AiUsageEvidence.tsx`, `src/App.tsx`: typed usage, small costs, partial/unknown values, readable failures and cleared stale evidence.
- `server/integration.test.mjs`, `server/lowCostAi.test.mjs`, `server/testFixtures.mjs`, `src/agent/boundedAgent.test.mjs`, `src/agent/gameAnalyst.test.mjs`: integration, boundaries, crash/restart, budget, and regression checks.
- `server/liveSmoke.mjs`, `server/uiSmoke.mjs`: bounded live endpoint smoke and rendered-component smoke.

The game engine was not changed. Historical Week 4 fake-hint routing remains separate from the current Gemini endpoint; its regression tests do not imply that the new Gemini path uses a fallback.

Two additional correctness fixes were necessary: the old candidate final validator could verify a different recomputed quantity instead of the executed tool result, and a final-model timeout could appear as malformed output. Both now have regression coverage.

## Actual limits and accounting

| Control | Implemented value |
|---|---|
| Goal / HTTP JSON body | 500 Unicode code points after trimming / 20,000 bytes |
| Proposal input/output | 768 / 128 tokens |
| Coach final input/output | 1,024 / 512 |
| Candidate final input/output | 1,024 / 640 |
| Analyst final input/output | 3,072 / 1,024 |
| Scenario final input/output | 1,024 / 384 |
| Model/count/local tool ceiling | 2 generation + 2 count HTTP requests + 1 local tool |
| Deadline | 20 seconds, shared by counting and generation |
| Response limits | 64,000-byte provider body before parse; 12,000-byte extracted JSON |
| Admission | 1 active action, 6 admitted/minute, 100 admitted/UTC day |
| Default local spending allowance | $1/day, configurable downward only |
| Reservations by workflow | Coach $0.001408; candidate $0.001600; analyst $0.002688; scenario $0.001216 |
| Billing reconciliation | Disabled by default; complete metadata plus explicit verified flag required |
| Missing usage | Nullable; partial known totals/lower-bound cost retained; unknown remainder is not zero |

Observed live Gemini responses omitted `thoughtsTokenCount`. It remains null. Full estimated cost stays unknown, known components may be shown as a lower bound, and the ledger retains its reservation. MINIMAL is not treated as a guarantee of zero thinking. No live accounting sample certified reconciliation; leave `AI_COST_RECONCILIATION_VERIFIED=false`.

## Commands and actual results

| Command/check | Exit code | Observed result |
|---|---|---|
| `npm.cmd test` — final run | 0 | **110 passed, 0 failed, 0 skipped** |
| `npm.cmd run typecheck` | 0 | PASS |
| `npm.cmd run test:ui` — final run | 0 | PASS: initial game and known/partial/unavailable usage components rendered |
| `npm.cmd run build` — outside filesystem sandbox | 0 | PASS: Vite 7.3.6, 36 modules; JS 242.99 kB, gzip 75.15 kB |
| Initial sandbox production build | 1 | Environment failure: esbuild denied parent-directory/config access; successful retest above |
| Initial rendered smoke | 1 for the UI command | Assertions ran, but background dependency optimization failed under sandbox; disabled unneeded discovery and retested successfully |
| Browser automation | Not run | Tool reported “The browser access host is unavailable”; no interactive browser success claimed |
| Real `test:live` runs | 1 | Partial success plus provider/validation failures; details and original artifacts below |

Earlier interim automated runs passed 79, 107, and 109 tests while coverage was being added. The final count is 110. Mock token-count fixtures verify exact payload wiring and enforced decisions; they do not measure a real tokenizer. The live artifacts supply actual tokenizer observations.

## Task-to-evidence matrix

| Task | Status | Actual evidence |
|---|---|---|
| T001 | PASS | `aiPolicy.mjs`; policy/default/unsafe override test |
| T002 | PASS | Policy constants, Unicode checks, all 8 workflow/stage exact-cap/cap+1 tests |
| T003 | PASS | `.env.example`, [setup guide](../../docs/guides/LOW_COST_AI.md); private `.env` preserved |
| T004 | PASS | Missing key, unsupported model, HTTP configuration failure, no fallback tests |
| T005 | PASS | Integration asserts counted generateContentRequest equals actual generated body |
| T006 | PASS | All stages assert configured caps, one candidate, MINIMAL; real coach/candidate requests accepted |
| T007 | PASS | Body/JSON size and aborted streaming-read tests; shared deadline tests |
| T008 | PASS | Complete/partial/inconsistent/omitted metadata tests; rejected finals retain usage |
| T009 | PASS | Unicode, malformed JSON/count, MAX_TOKENS, 429/503, hidden-thought filtering and timeout tests |
| T010 | PASS | Compact prompts; analysis fixture retains all 10 weeks and all 60 verified facts |
| T011 | PASS | All four validators enforce concise fields; tests cover limits and unchanged factual checks |
| T012 | PASS | Third model call denied before dispatch; 4 HTTP calls maximum; one-tool default; no retry/fallback |
| T013 | PASS | Four mock HTTP workflows pass with unchanged snapshots; candidate-substitution regression |
| T014 | PASS | Shared active-path guard, HTTP concurrent one-winner, rolling-minute and 100/day tests |
| T015 | PASS | Reservations persisted before dispatch; under-budget admission rejected with zero provider calls |
| T016 | PASS | Partial/unknown retained, complete opt-in reconciliation, ignored local ledger, corruption failure tests |
| T017 | PASS | Restart, UTC rollover, simulated crash in child process, profile change, file failure tests |
| T018 | PASS | Typed UI evidence plus rendered known/partial/unavailable cases and precise small USD values |
| T019 | PASS | Shared 500-code-point validation; safe rate/budget messages and Retry-After tests |
| T020 | PASS | 110 tests, typecheck and production build commands above |
| T021 | PASS | Official sources rechecked; live model access and MINIMAL accepted; source notes below |
| T022 | FAIL / pending acceptance | Four workflows attempted; coach/candidate successes; analyst/scenario not yet both successful |
| T023 | PASS | This record, task mapping, commits, setup guide and limitations completed honestly |

T022 remains unchecked in [tasks.md](tasks.md). Full acceptance is not claimed from successful local tests alone.

## Acceptance matrix

| Requirement | Status | Evidence / practical limit |
|---|---|---|
| Selected low-cost profile, no upgrade | PASS | Supported profile and negative configuration tests; actual returned modelVersion |
| Exact prompt budgets | PASS | Mock boundaries plus real proposal/final counts below |
| Response and field limits | PASS locally | Validator tests; invalid live analysis was rejected instead of displayed |
| Request/deadline ceilings | PASS | Test counters; live failures stopped at the configured deadline with no in-request retry |
| Token/cost completeness handling | PASS locally | Missing thinking remains null; reservation retained; full live accounting not certified |
| Admission, persistence and spending reservations | PASS | Concurrency, restart/crash, UTC and corruption tests |
| UI rendering/core game regression | PASS locally | Rendered smoke and game regression; interactive browser remains unverified |
| Four mock workflows | PASS | `server/integration.test.mjs` |
| Four successful live workflows | **FAIL / pending** | Analyst/scenario have no accepted success record in this session |
| Browser interaction smoke | **NOT RUN** | Browser access host unavailable |

## Four-workflow observed traces

| Workflow | Mock | Best actual live observation | Actual tokens: input/candidate/thinking/total | Status |
|---|---|---|---|---|
| Coach | PASS | `run_fea7ba12-2187-4baa-9955-037f68d3a62d`, order 8; 2 generations/2 counts/1 tool, 3,361 ms | 278 / 239 / unknown / 517 | Live response PASS; usage partial |
| Candidate | PASS | `run_e4b749de-1700-4c06-9efc-e50005beab73`, exact 9 units, arrival week 3, inbound next week 0; 3,873 ms | 345 / 302 / unknown / 647 | Live response PASS; usage partial |
| Analyst | PASS | `run_1056c0f6-ac64-4a8f-baf8-e17c3e585cc0`, both calls returned but final rejected; 4,426 ms | 1,302 / 444 / unknown / 1,746 | FAIL: invalid_final_result |
| Scenario | PASS | Latest `run_c7aacc1b-aa4e-40d6-9e03-ed50a0ac0340`: proposal/tool succeeded; final hit deadline, 20,012 ms | Only first-call usage known: 85 / 40 / unknown / 125 | FAIL: deadline |

Coach visible output recommended 8 units with two short evidence facts. Candidate output matched the real tool response, including its assumptions. Snapshots stayed unchanged in successful live smoke assertions and all four mock integrations.

The analyst's returned final was rejected before safe validation-reason instrumentation existed; its precise field failure was not captured. Later attempts ended at deadline or upstream 503 before a new final could be diagnosed. Do not invent a field-level cause. A mocked rejected analysis now demonstrates the fixed safe reason `Summary must contain 1 to 240 characters.` without exposing rejected text.

## Original live artifacts and failure history

All timestamps inside these sanitized files are UTC. Public fixture goals and accepted final outputs contain no credentials or private participant data.

1. [Sandbox attempt](live-smoke-sandbox.json): 4 actions; each failed before generation during the count request. This environment result does not demonstrate provider access.
2. [First network attempt](live-smoke-first-network.json): live coach succeeded; candidate received generation HTTP 503; remaining actions were rejected by the persisted six/minute quota. Initially the harness demanded all optional usage fields; it was corrected to verify total-token caps while leaving missing metadata null, as FR-05 requires.
3. [Four-workflow retest](live-smoke.json): candidate succeeded; coach/analyst/scenario encountered 20-second deadlines. Older second-step timeout reasons were misleadingly invalid_model_proposal; the final source fixes that classification, verified by a regression test.
4. [Follow-up](live-smoke-follow-up.json): analysis generated a final that failed validation; scenario received upstream 503. No unsafe final was displayed.
5. [Analysis diagnostic](live-smoke-analysis-diagnostic.json): final request hit the deadline; explicit public stop reason is deadline.
6. [Final committed-revision check](live-smoke-final-check.json): analyst proposal received upstream 503; scenario final hit the deadline. No model or cap was changed to hide these failures.

These were explicit separate verification runs, not automatic retries inside an action. Each request stayed under the generation/count ceilings. All admitted failures retain their quota slots and conservative reservations in the ignored ledger.

## Source verification

Rechecked on 2026-10-29:

- [Model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) and [thinking levels](https://ai.google.dev/gemini-api/docs/gemini-3/): selected model supports MINIMAL; accepted by observed live calls.
- [Standard text pricing](https://ai.google.dev/gemini-api/docs/pricing): profile uses $0.25/M input and $1.50/M output.
- [Availability schedule](https://ai.google.dev/gemini-api/docs/deprecations): earliest listed 3.1 Flash-Lite shutdown remains 2027-05-07; older 2.5 access restriction is why it is not the default.
- [Count request contract](https://ai.google.dev/api/tokens) and [billing FAQ](https://ai.google.dev/gemini-api/docs/billing): count the full generateContentRequest; token-counting is not billed.
- [Usage metadata definition](https://ai.google.dev/api/generate-content): prompt, candidate, thinking, and total accounting; raw missing fields are preserved, not invented.

## Browser/manual check and remaining limitations

The browser tool returned “The browser access host is unavailable.” The rendered-component smoke is explicitly not a substitute for click-through verification. No screenshot or interactive UI PASS is claimed.

Required follow-up: obtain successful live analyst/scenario results under the unchanged caps; diagnose any newly observed validator rejection using the safe validation issue; run interactive browser smoke when the host is available. Do not enable reconciliation without complete verified live accounting. No deployment or feature 002 automatic logging is included.

## Commit report

| Commit | Change | Verification |
|---|---|---|
| `6dfc5b9` — `feat(ai): implement low-cost Gemini budgets and usage controls` | Policy, adapter, ledger, endpoint, concise validators, UI, tests and smoke tools kept compatible in one runtime commit | 110 tests, typecheck, rendered UI smoke and production build PASS |
| Evidence/setup commit — `docs(ai): record spec 001 implementation and live limitations` | This evidence, original live artifacts, task checkboxes, current setup guide, plan/spec/index and development-log updates | Local links, task alignment, whitespace and secret-exclusion review; hash in Git history/delivery message |

The original six proposed implementation commits were consolidated into one coherent runtime commit, followed by this documentation/evidence commit. No remote changes were made.

## Acceptance conclusion

**PARTIAL — runtime implementation and local verification pass; spec 001 is NOT fully accepted yet.**

All 110 automated tests, typecheck, rendered UI smoke, and production build pass. Real coach/candidate results confirm the selected model and small token budgets work for those observed cases. Analyst/scenario successes and interactive browser acceptance remain outstanding. Provider failures are safely bounded, rejected outputs are not displayed, unknown usage remains unknown, and spending reservations stay conservative. T022 remains open.
