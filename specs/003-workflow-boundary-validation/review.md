# Project review: workflow boundaries and adversarial verification

Date: 2026-10-29. Reviewed runtime revision: `742d31a` (spec 002 completed on top of spec 001). Planning branch: `docs/003-boundary-validation-plan`.

This is an analysis record. No runtime, game-rule, production-state, credential, or quota-ledger changes were made. Baseline tests used their isolated temporary fixtures. Additional probes used newly created in-memory games, scripted model callbacks, and a disposable `.local/` record fixture; the fixture was removed. No live model calls or real participant records were used.

## Current status and architecture

- Spec 001 is implemented with local verification. Its [T022](../001-low-cost-ai/tasks.md) is still open: earlier analyst/scenario live results and interactive browser verification were incomplete. This review does not turn those failures into passes.
- Spec 002 is implemented and accepted for its stated local mock capture/export configuration. [Its evidence](../002-ai-tool-call-logging/evidence.md) explicitly excludes live-player and interactive-browser acceptance. Recording is opt-in.
- Current checks rerun for this review: `npm.cmd test` **137 passed, 0 failed, 0 skipped**; `npm.cmd run typecheck` **PASS**. Build/UI/live smoke were not rerun for this analysis-only change.
- The application is a local, single-player React game. The browser owns game state. The Node service validates a submitted snapshot, then runs one of four bounded workflows. It does not store authoritative player games or expose a gameplay mutation endpoint. See [App.tsx](../../src/App.tsx), [index.mjs](../../server/index.mjs), and [workflows.mjs](../../server/workflows.mjs).

The term **agent** here means one selected workflow handler with a restricted tool registry, sharing a model adapter. There is no separate supervisor, agent marketplace, or autonomous multi-agent network to add permission infrastructure to.

## Already implemented: reuse and retain

| Area | Actual protection / behavior | Code and existing verification |
|---|---|---|
| Input length | Trimmed goals: 500 Unicode code points; participant labels: 80; HTTP body: 20,000 bytes | [aiLimits.ts](../../src/agent/aiLimits.ts) lines 2–8; [participantContext.ts](../../src/agent/participantContext.ts) lines 8–24; [index.mjs](../../server/index.mjs) body reader; Unicode/body tests in [lowCostAi.test.mjs](../../server/lowCostAi.test.mjs) |
| Model budgets | Exact full-prompt counting; proposal 768/128 input/output; finals coach 1024/512, candidate 1024/640, analyst 3072/1024, scenario 1024/384 | [aiPolicy.mjs](../../server/aiPolicy.mjs) lines 9–21; [gemini.mjs](../../server/gemini.mjs) lines 38–140; cap/cap+1 tests |
| Output length | 64,000-byte provider body, 12,000-byte JSON; bounded final strings and collection sizes | [gemini.mjs](../../server/gemini.mjs) bounded reader; four final validators; [lowCostAi.test.mjs](../../server/lowCostAi.test.mjs) |
| Calls/retries | At most two generation requests, two token-count requests, one local tool; 20-second deadline; no retry or expensive fallback on this endpoint | [gemini.mjs](../../server/gemini.mjs) lines 37–140; [boundedAgent.ts](../../src/agent/boundedAgent.ts) limits and execution path |
| Aggregate limits | One active action, six admitted/minute, 100/day; durable spending reservations and conservative unknown usage | [aiPolicy.mjs](../../server/aiPolicy.mjs); [aiUsageLedger.mjs](../../server/aiUsageLedger.mjs); concurrency/restart/UTC/crash tests |
| Workflow selection | Fixed workflow map; one tool registry per handler; name, allowed workflow, exact arguments and phase checks | [workflows.mjs](../../server/workflows.mjs) lines 11–36; [boundedAgent.ts](../../src/agent/boundedAgent.ts) dispatch; existing wrong-tool tests |
| State consistency | Reject non-canonical config/state/history by replaying engine rules and deep comparison; AI tools are read-only or isolated simulations | [workflows.mjs](../../server/workflows.mjs) lines 21–35; [candidateOrderSimulation.ts](../../src/agent/candidateOrderSimulation.ts) lines 39–75 |
| Game mechanics | Ten weeks, two-week delay, fixed rates; existing tests cover shipping, backlog, costs, completion, invalid numeric input | [gameConfig.ts](../../src/game/gameConfig.ts) lines 24–72; [gameEngine.test.mjs](../../src/game/gameEngine.test.mjs) |
| Past/future | Analyst receives completed, sequential game history; exact history evidence and referenced weeks validated. Candidate tool projects known shipment timing, not unknown future costs/demand | [gameAnalyst.ts](../../src/agent/gameAnalyst.ts) lines 75–149 and 153–250; [candidateOrderSimulation.ts](../../src/agent/candidateOrderSimulation.ts) |
| Activity records | Request/run/session correlation; model/count/tool stages; safe final output; redaction/omission markers; 64,000-byte events and 10-MB local JSONL; local Markdown export | [aiToolCallLog.mjs](../../server/aiToolCallLog.mjs), [exportAiToolCallLog.mjs](../../server/exportAiToolCallLog.mjs), [toolCallLogging.test.mjs](../../server/toolCallLogging.test.mjs) |

The historical Week 4 fake-hint fallback tests are not the current Gemini endpoint's retry policy. Reuse existing limit, failure, logging, and game regression tests rather than implementing equivalent systems again.

## Confirmed gaps and priorities

Line references below refer to the reviewed revision; they may shift during later implementation. Priorities express practical impact in this local demo, not a claim of remote exploit severity.

### R1 — Coach input contains the wrong recent-order data (P1)

[decisionCoach.ts](../../src/agent/decisionCoach.ts) lines 30–45 maps `recentOrders` from `history.incomingShipment`, not `history.order`. Probe P01 submitted order 9: recorded orders were `[9]`, recorded arrivals `[4]`, and tool `recentOrders` was `[4]`. Existing [coach tests](../../src/agent/decisionCoach.test.mjs) lines 37–47 check array shape, not these values.

The same projection omits an explicit current-demand field. Probe P01b at week 5 saw current demand 8, while the supplied recent demand was `[4,4,4,4]`. That history is correctly past data, but it must not be represented as the current demand. Correct the order projection and expose the already visible current demand separately; keep future demand hidden.

### R2 — Legal gameplay can make later AI requests fail (P1)

[gameEngine.ts](../../src/game/gameEngine.ts) lines 177–214 accepts finite nonnegative real order quantities. The UI explicitly uses `step="any"` and has no upper bound ([App.tsx](../../src/App.tsx), order form). [workflows.mjs](../../server/workflows.mjs) lines 29–32 instead requires historical orders to be integers in 0–50.

Probe P02: orders **2.5** and **51** both advanced an isolated game successfully, then the unchanged canonical snapshot was rejected by AI request validation. Fix the API replay contract to accept legal existing gameplay; do not impose the candidate tool's 0–50 restriction on actual orders or modify the engine to make this test pass. Candidate simulation/recommendation bounds remain separate and unchanged.

The API also has a demand-sequence upper bound of 100, whereas the engine's custom sequence validator does not. That is not reachable from the current approved scenario UI. Document/test the existing AI input boundary; do not automatically broaden scenarios or change economic rules. Extreme floating-point overflow needs a separate engine policy decision, not a hidden new cap in this feature.

### R3 — Valid model choices are not bound to the requested task parameters (P1)

[App.tsx](../../src/App.tsx) lines 88 and 143 puts the candidate quantity and scenario controls only into a natural-language goal. [workflows.mjs](../../server/workflows.mjs) accepts no structured task parameters. Final validators check valid values and tool consistency, not the player's original selected values.

- Probe P03: goal “Simulate exactly 9 units”; scripted model requested 4; final copied that actual tool result; workflow completed with **4**.
- Probe P11: goal “Select a hard growth scenario”; scripted final selected **stable/easy**; workflow completed.
- Probe P05: a stable/easy selection accepted a `growth` catalog fact. Catalog membership alone does not bind evidence to the selected option ([scenarioGenerator.ts](../../src/agent/scenarioGenerator.ts) lines 92–145).

Add narrowly typed task parameters for those two existing UI controls, validate before model dispatch, and reject conflicting proposals/finals. Preserve separate explicit order submission and scenario start. No semantic intent classifier or extra agent call is needed.

### R4 — Some structured evidence facts can be fabricated (P1)

[decisionCoach.ts](../../src/agent/decisionCoach.ts) lines 79–91 checks the evidence source tag and text shape, not correspondence to state. [candidateOrderSimulation.ts](../../src/agent/candidateOrderSimulation.ts) lines 140–148 similarly accepts arbitrary simulation fact text.

Probe P04 accepted coach fact **“Inventory is 999 units.”** and candidate fact **“This shipment arrives immediately.”** despite a valid unchanged simulation with the normal delay. The analyst already demonstrates the appropriate pattern: deterministic fact formatting and membership checking. Reuse that approach for coach/candidate factual evidence, without claiming it proves every sentence of free-form advice true.

### R5 — Imported activity records are insufficiently validated (P1)

[exportAiToolCallLog.mjs](../../server/exportAiToolCallLog.mjs) lines 14–33 checks only a small part of the envelope. It does not validate participant field types, run metadata, or payload data shape before rendering.

- Probe P10b wrote one disposable valid-JSON record with object-valued `participant.label`. `readEventLog` accepted **1 event / 0 warnings**, then the renderer threw. Valid neighboring records should remain exportable with an explicit malformed-record warning.
- Probe P08 supplied file order **2,1,3**. Lines 43–50 sort before checking sequence, hiding the disorder and reporting the record complete.
- Probe P09 supplied **action_completed → tool_execution_started**. The renderer still reported “completed / observed stages recorded.” A terminal marker alone is insufficient evidence of a consistent lifecycle.

Use a small validator and conservative per-request diagnostics around the existing event schema. Preserve original order and detect duplicates, gaps, conflicting terminal outcomes, and impossible new execution after termination. Permit legitimate early failures, missing/omitted data, and late provider observations after cancellation/timeouts; do not require every run to have the 18-event success trace. Wall-clock corrections must not be confused with game time travel.

### R6 — Previous-week coach advice remains actionable (P2, static finding)

[App.tsx](../../src/App.tsx) lines 201–223 clears candidate advice after an order, but does not clear `decisionCoachResult` or the old usage evidence. The coach's “Use recommendation” control remains rendered later in that component. Clear or invalidate week-scoped results on successful progression, following the existing candidate pattern. Do not erase persisted activity history or claim an old suggestion was applied.

This was established by code inspection, not an interactive browser reproduction. SSR smoke does not exercise this state transition; the later implementation needs a genuine interaction check.

### R7 — Prototype property names are misclassified at dispatch (P2)

[boundedAgent.ts](../../src/agent/boundedAgent.ts) lines 557–590 reads `this.registry[toolName]` without an own-property guard. Probe P06 used `constructor`, `__proto__`, and `toString`: all executed zero tools, but failed as `provider_failed` after inherited-property lookup. Ordinary unknown/cross-workflow names correctly returned `unknown_tool`.

Add an own-property check and regression cases. This is a rejection/diagnostic defect; the probes did **not** demonstrate unauthorized execution.

### R8 — Monitoring dimensions and admission semantics need explicit summaries (P2)

The quota is intentionally global to the local service. There is no per-person/per-session hard rate limit. Labels and IDs are unverified ([participantContext.ts](../../src/agent/participantContext.ts) lines 16–24). Do not key a security guarantee to a caller-controlled label.

The exporter already lists per-request counters, but lacks a reusable validated activity summary grouped by request/workflow/anonymous session. Also, `request_accepted` is emitted **before** configuration and quota admission ([index.mjs](../../server/index.mjs) lines 62–66); it is not proof that an action consumed an admitted quota slot. Add only a small derived summary and an explicit admission observation if reporting admitted totals. Retain “unknown” for older logs that lack that observation. No dashboard, second ledger, persistent user database, or new enforcement tier is warranted.

## Threat-model limits: document rather than overbuild

- Canonical replay checks internal consistency, not provenance. Probe P07 accepted a newly recomputed canonical order history. The service cannot prove it is the same history submitted earlier or belongs to an authenticated person: no server-owned game record exists.
- There is no cross-player game read/write endpoint to authorize. Tests should show state A's operations do not mutate state B and no other request's data enters a model prompt. This is not proof of authenticated multiplayer isolation.
- A browser owner can edit their local JavaScript/state. Adding accounts, signed saves, server-authoritative games, or a tamper-proof log would be a different product scope, not a prompt-injection patch.
- Game history records actual orders/outcomes in memory; AI JSONL records assistance events. Neither proves the player used a recommendation. New scenario/reload history retention and persistent gameplay audit events are outside this plan.
- Distant past/future goals are text. The game has weeks 1–10, no calendar scheduler, no saved archive lookup, and no future-demand forecast tool. Missing records must remain unavailable; hypothetical timing must not become actual progression.
- Logging defaults off; disabled/partial capture cannot support complete user-activity totals. Redaction is pattern-based. Do not claim every kind of personal information or encoded secret is recognized.

## Additional probes of working boundaries

These probes were executed against the unchanged code using scripted callbacks, not a live model:

| Probe | Inputs | Observed result | What it proves |
|---|---|---|---|
| P12 format sweep | 10 forms × 4 valid workflows = 40 cases; plain text, JSON, Markdown/code fences, Unicode/bidi, base64, percent encoding, HTML/special characters, nested instructions, repeated and contradictory commands; scripted `place_order` proposal | **40/40 rejected**, zero tools executed; all snapshots unchanged; zero live calls | Deterministic dispatch safety with those payloads; not real-model injection resistance |
| P13 routing matrix | 4 workflows × 4 existing tool names = 16 pairs | **4 responsible tools accepted; 12 cross-workflow choices rejected** | Existing workflow-specific allowlists work; no additional router is justified |
| P06 forbidden write | Coach scripted `place_order` | unknown_tool; zero tool execution | No AI order-write tool |

The baseline and probes do not cover a full many-to-many adversarial suite. Proposed additional coverage is in [plan.md](plan.md); its tests/tasks have **not** been implemented during this review.

## Decision

A focused [spec 003](spec.md) is justified by R1–R8. It preserves rules and the existing architecture, fixes mismatched contracts/projections, strengthens imported-record interpretation, and adds a bounded deterministic test matrix. Unresolved spec 001 live acceptance remains with spec 001. No new dependencies or runtime changes are part of this planning delivery.
