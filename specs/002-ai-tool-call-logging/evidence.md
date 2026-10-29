# Feature 002 execution evidence — AI tool-call logging

Status: **IMPLEMENTED — accepted for the tested local mock capture/export configuration**

Updated: 2026-10-29 (Europe/Budapest)

Specification: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md) · Reference format: [log-template.md](log-template.md)

This is execution evidence, not a participant transcript. The initial NOT RUN template was present at `00a5607`; its placeholders are replaced with actual observations. No past user activity was reconstructed.

## Run record

| Field | Actual observation |
|---|---|
| Date / reporting timezone | 2026-10-29 / Europe/Budapest (UTC+01:00) |
| Session start | Not captured |
| Runtime / OS | Node v24.21.0 / Windows PowerShell |
| Starting revision | `00a5607`, feature 001 runtime and evidence |
| Branch / tested implementation | `feature/002-ai-tool-call-logging` / `2d5907d` |
| Scope | Feature 002 only; feature 001's earlier live acceptance remains separate |
| Provider mode | Mock HTTP fixtures; zero live Gemini requests in this session |
| Operator/participants | Not captured; smoke labels Mock-1…Mock-4 are explicit synthetic fixture labels |
| Private configuration | Existing `.env` preserved; logging defaults off unless explicitly enabled |
| Outcome | All 20 implementation tasks complete for the local configuration; production/browser/live limitations below |

## Implementation and exact files changed

Runtime commit `2d5907d` contains 20 files:

- `.env.example`, `package.json`: explicit server-only logging flags and local export/smoke commands.
- `server/aiToolCallLog.mjs`: event schema/types, sanitization, 64,000-byte event bound, 10-MB append-only JSONL cap, per-request sequencing, independent status, private-path controls.
- `server/exportAiToolCallLog.mjs`: bounded reading, invalid/truncated-line warnings, Budapest timestamps, escaped metadata/indented JSON, local Markdown index/details, no overwrite.
- `server/index.mjs`: request IDs before parsing, validated identity/workflow context, safe pre-run failures, terminal events, independent logging status, client-disconnect cancellation.
- `server/gemini.mjs`: separate count/generation lifecycle events, visible prompt data, actual model/usage, safe failures, no raw provider bodies or thought parts, external cancellation signal.
- `server/workflows.mjs`: participant validation, optional observer plumbing, workflow result/final-validation status, explicit cancelled outcome.
- `src/agent/agentEvents.ts`, `src/agent/boundedAgent.ts`: optional safe observers at actual proposal/validation/execution boundaries.
- `src/agent/decisionCoach.ts`, `candidateOrderSimulation.ts`, `gameAnalyst.ts`, `scenarioGenerator.ts`: pass server-owned observers without importing filesystem code.
- `src/agent/participantContext.ts`: anonymous session storage with fallback, optional nickname, 80-code-point/control-character checks and unverified provenance.
- `src/agent/agentClient.ts`, `src/agent/AiActivityLogging.tsx`, `src/App.tsx`: participant input, request context, logging metadata on HTTP errors, recorded/partial/off UI independent from AI success.
- `server/toolCallLogging.test.mjs`, `server/uiSmoke.mjs`, `server/loggingSmoke.mjs`: new deterministic coverage, rendered UI checks, and the real local capture/export CLI smoke.

No game-engine code, private credentials, or model price/token budgets changed. The inherited `.local/` ignore rule covers runtime transcripts, exports, and ledgers.

The five proposed implementation commits were consolidated into one compatible runtime commit, followed by the setup/evidence commit. No general transcript logger for this coding chat was introduced.

## Commands and results

| Command/check | Exit code | Actual result |
|---|---|---|
| `npm.cmd test` — final run | 0 | **137 passed, 0 failed, 0 skipped** (110 previous + 27 logging tests) |
| `node --test server/toolCallLogging.test.mjs` | 0 | 27 logging-specific checks passed |
| `npm.cmd run typecheck` | 0 | PASS |
| `npm.cmd run test:ui` | 0 | PASS: participant label, usage, recorded/partial/disabled recording status |
| `npm.cmd run build` | 0 | PASS outside required filesystem sandbox; Vite 7.3.6, 39 modules, JS 245.63 kB / gzip 76.02 kB |
| `npm.cmd run test:logging` — initial smoke | 0 | 4 synthetic workflows; 72 events; 0 export warnings |
| `npm.cmd run test:logging` — final smoke | 0 | 4 synthetic workflows; 72 events; 0 export warnings; unchanged snapshots; actual CLI export succeeded |
| Real/live provider verification | Not run | Not required for local logging acceptance; no live player-recording claim |
| Interactive browser | Not run | Rendered components verified; click-through behavior not certified |

Smoke summaries were saved with `AI_LOGGING_SMOKE_EVIDENCE_PATH`. The actual JSONL and Markdown stayed in ignored local directories; only sanitized mock result summaries are versioned:

- [Initial smoke result](smoke-results.json), 2026-10-29T18:56:17.231Z.
- [Final smoke result](smoke-results-final.json), 2026-10-29T19:01:35.486Z (20:01:35+01:00 in Budapest).

## Task-to-evidence matrix

| Task | Status | Actual evidence |
|---|---|---|
| T001 | PASS | AgentEvent/ActivityLoggingStatus types; schemaVersion 1; event type whitelist and record fields |
| T002 | PASS | Stable supplied-storage session, storage-disabled fallback, unknown/server identity, unverified labels and forged-field rejection tests |
| T003 | PASS | Four workflow tests: same request ID, linked real run ID, contiguous per-request sequence |
| T004 | PASS | UTC/monotonic checks; winter +01:00 and summer +02:00 Budapest assertions |
| T005 | PASS | Safe pre-run configuration/identity failure tests; request ID exists before run; no provider call |
| T006 | PASS | Exact safe model instructions/input and actual model metadata captured in all four workflows; no thoughts/raw errors |
| T007 | PASS | Proposed/rejected/executed/completed/failed tool events; invalid names/arguments never claim execution |
| T008 | PASS | Exact accepted final equals HTTP final; rejected finals record null final + safe failure; no application-of-advice inference |
| T009 | PASS | Feature 001 usage reused; missing usage null/unknown; exactly four mock provider requests per successful action |
| T010 | PASS | Before-persistence known-secret, credential, email/contact/private-field/URL redaction; explicit capture representation |
| T011 | PASS | Whole event ≤64,000 bytes; oversized Unicode original bytes retained; exact 10,000,000-byte cap prevents further appends |
| T012 | PASS | Unavailable/partial/disabled logger independent from AI success; write failure and truncated restart tests |
| T013 | PASS | Explicit opt-in flags, private-path restrictions, ignored local files, [setup guide](../../docs/guides/AI_TOOL_CALL_LOGGING.md) |
| T014 | PASS | Actual CLI smoke + safe rendering, no-overwrite, source/template destination rejection, incomplete-tail warnings |
| T015 | PASS | Four success/four invalid-final paths; unsupported/malformed proposals, invalid args, timeout, cancellation, upstream and tool failure tests |
| T016 | PASS | Interleaved sessions, restart, unknown metadata, pre-validation unknown identity, file/full-tail failures |
| T017 | PASS | Known-secret filtering; multibyte event limit; capacity; hostile labels, backticks/HTML/links; omission labels |
| T018 | PASS | All four snapshots unchanged; no extra mock calls; observer throw/rejected promise and tool failure cannot cause retries |
| T019 | PASS | 137 tests + typecheck + rendered UI + production build + local log/export smoke |
| T020 | PASS | This evidence, task updates, source/configuration guide, template status and actual commit report |

All completed task checkboxes correspond to observations above. Acceptance is scoped to the tested local, single-process, explicitly enabled mock configuration.

## Feature acceptance matrix

| Requirement | Status | Observed verification / limit |
|---|---|---|
| Attribution/correlation | PASS | Anonymous/supplied IDs and labels marked unverified; IDs are not authentication |
| Time and ordering | PASS | UTC at capture, monotonic elapsed duration, correct date-specific Budapest offset |
| Input/output capture | PASS | Shareable user/model/tool/final content is separate and explicitly represented |
| Rejected versus executed | PASS | Unknown tool/invalid args/malformed proposals: proposed + rejected, no execution |
| Usage integration | PASS | Existing counters/nullable tokens reused without additional requests |
| Sanitization | PASS for tested rules | Known secrets/private fields/contact patterns/URLs/thoughts filtered; not a universal personal-data classifier |
| Bounded persistence | PASS | Append-only, event/storage caps, ignored/private path, no silent record deletion |
| Failures/restart | PASS | AI result survives unavailable logger; truncated final line preserved and reported |
| Markdown export | PASS | Index, per-action model/tool/final sections, observed counts/usage, safe data formatting |
| Regression and smoke | PASS | Full 137-test suite, typecheck, build, rendered components and actual export CLI |
| Live-user recording/browser interaction | NOT RUN | Not claimed; synthetic fixtures are explicitly mock-test |

## Four-workflow smoke observations

Each action emitted 18 events. Each made 2 generation + 2 count-token requests to a mocked fetch implementation, 1 local tool execution, and zero live provider calls.

| Workflow | Request ID (final smoke) | Tool input | Observed outcome | Status |
|---|---|---|---|---|
| decision_coach | `req_ba7e3f97-14d2-4985-8287-7497bc0b4baf` | `getCurrentGameState({})` | Safe model input, actual tool result, validated recommendation and usage captured; state unchanged | PASS / mock |
| candidate_order_simulation | `req_ddbeee2b-ae99-4450-b990-abadfd4a0b49` | `simulateCandidateOrder({"orderQuantity":4})` | Actual arguments and exact verified simulation recorded separately from final advice; state unchanged | PASS / mock |
| game_analyst | `req_0e584aea-c641-4bb3-af84-ffdae57fc5a7` | `getGameHistory({})` | Completed synthetic history, model input and accepted findings recorded; state unchanged | PASS / mock |
| scenario_generator | `req_42a9dbce-00a4-49b6-8197-c3fba5dbcd01` | `getAllowedScenarioTypes({})` | Catalog/tool/final selection captured; no inferred game start; state unchanged | PASS / mock |

The final summary contains linked agent run IDs. Synthetic participant labels were Mock-1…Mock-4. These are not evidence of four real learners or live provider quality.

## Observed event trace and export

The successful-action event sequence observed in the smoke was:

1. request_received (identity unknown until validation), request_accepted, run_started.
2. count_tokens_request_started/completed; model_request_started/completed; model_output_validated (JSON only).
3. tool_proposed; tool_execution_started/completed.
4. count_tokens_request_started/completed; model_request_started/completed; model_output_validated (JSON only).
5. workflow_finished (actual final-validation outcome), action_completed (validated response and usage).

Tool events are emitted around actual dispatch, never reconstructed from the model's final text. JSON validity does not claim final schema validity: the final workflow validation is recorded separately. Failed executions explicitly distinguish result availability from a null/no-result sentinel.

The final actual local export was generated at:

`.local/spec002-smoke-OnZC0p/AI_TOOL_CALL_LOG.md`

Its source is `.local/spec002-smoke-OnZC0p/calls.jsonl`. These machine-local files remain ignored and are not part of the commit. The CLI returned success, the report contained four mock-labelled records, and the source had 72 valid events and zero warnings. Earlier smoke output is preserved separately at the directory recorded in its summary.

## Failure and recovery evidence

| Observation | Actual behavior / fix | Final status |
|---|---|---|
| Initial new test-file load | Node 24 strip-only loader rejected a TypeScript parameter property: initial full run was 110 pass, 1 failed file. Replaced it with an explicit property and used .ts runtime import paths. | PASS after retest |
| Unknown/malformed tool or invalid args | Proposed/rejected events; no execution-start event; no extra model call | PASS |
| Invalid final, all four workflows | Captured prior stages and finalValidation=not_accepted; no unsafe final displayed/logged as accepted | PASS |
| Provider 503 with private body | Safe HTTP status/reason logged; raw body/credential text absent | PASS |
| Count deadline | Safe deadline event; no generation or fabricated final | PASS |
| Client cancellation | Cancel request → aborted outstanding mock provider → action_cancelled; no completion invented | PASS |
| Tool error / throwing or async-failing observer | Exactly one actual attempt; no retry; private tool error not in event payload | PASS |
| Storage full / unwritable path | Independent unavailable recording status; successful AI result and four provider requests unchanged | PASS |
| Crash-truncated tail | No append repair/overwrite; valid earlier records exported with warnings; incomplete request stays incomplete | PASS |
| Oversized payload | Explicit omitted record with original byte length and partial status; no silent truncation | PASS |
| Existing export/unsafe destination | Refused; existing file/template unchanged | PASS |

No application tests remain failing. No provider API was called to fill a missing log field. No runtime event file or export was committed.

## Setup, limits, and operational scope

Recording is **off by default** and was not enabled in the user's private configuration or a running service. To enable future capture:

```powershell
$env:AI_TOOL_LOG_ENABLED = 'true'
npm.cmd run agent:dev
```

Default source: `.local/ai-tool-calls.jsonl`. Default mode: live (operator-labelled). Export explicitly:

```powershell
npm.cmd run logs:export -- --input .local/ai-tool-calls.jsonl --output .local/exports/new-report.md
```

The output must be a new private .md path; no overwrite or tracked-template writes. Details, failure handling, and recovery instructions are in [the guide](../../docs/guides/AI_TOOL_CALL_LOGGING.md).

## Limitations and checks not run

- No real player records or live AI calls were generated; the evidence is mock-only by design.
- Interactive browser clicks/storage behavior were not exercised; pure session-storage helpers and rendered UI were checked. No browser screenshot PASS is claimed.
- Participant labels/session IDs are unverified, may be shared, and are not a secure audit identity.
- Redaction covers the configured known secrets and tested patterns/fields; it cannot classify all personal information in arbitrary prose. Only shareable game data should be entered.
- Logging uses one Node process. It is not a distributed, authenticated, cryptographically tamper-proof audit trail.
- Capacity stops capture; no automatic deletion, rotation, retroactive repair, or public export exists.
- Feature 001's earlier analyst/scenario live-acceptance failures remain unresolved by this logging feature.

## Commit report

| Commit | Actual change | Verification |
|---|---|---|
| `2d5907d` — `feat(logging): capture and export correlated AI tool activity` | All runtime/session/observer/writer/export/UI integration and deterministic tests in one compatible commit | 137 tests; typecheck; UI rendering; build; 72-event mock CLI smoke |
| Evidence/setup commit — `docs(logging): record feature 002 verification and setup` | This evidence, mock summaries, completed checklist, current template/plan/spec/index status, setup guide, and project-report updates | Relative links, task alignment, whitespace, secret and runtime-file exclusion checks; exact hash in Git history/delivery message |

Branch: `feature/002-ai-tool-call-logging`. No push, merge, or modification of `main`.

## Acceptance conclusion

**Feature 002 is accepted for the tested local, single-process mock capture/export configuration.**

All 20 implementation tasks have supporting evidence. The 137-test suite, typecheck, rendered UI, production build, and four-workflow actual log/export smoke pass. Recording remains explicitly opt-in; no live player activity or interactive browser acceptance is claimed. Runtime data is private/ignored, logging adds zero provider calls, and logger failures do not replace game/AI results.
