# Week 4 / Session 004 Evidence

## Run Record

```text
Date: 2026-10-01
Task: One controlled read-only AI Hint flow
Game role: Retailer only
Game duration: exactly 10 weeks
Provider mode: fake/mock only; live provider not tested
Tool Contract source: docs/TOOL_CONTRACT.md
```

## Changed Files

- `package.json`
- `src/App.tsx`
- `src/aiHint/contracts.ts`
- `src/aiHint/fakeHintModelClient.ts`
- `src/aiHint/getGameStateTool.ts`
- `src/aiHint/hintService.ts`
- `src/aiHint/aiHintFlow.test.mjs`
- `docs/EVIDENCE_004.md`
- `docs/AI_USAGE_LOG.md`

No game-engine implementation was modified.

## Success Flow Observed

A deterministic Node smoke call and the browser Week 1 flow used the fake model client. The captured success record was:

```text
Tool: get_game_state
Arguments: { "detail": "summary" }
requestId: req_hint_evidence_004
status: SUCCESS
models: ["gpt-6-luna"]
modelCalls: 1
toolCallCount: 1
tool attempts: 1
```

Validated response:

```json
{
  "phase": "pre_game",
  "hint": "Balance inventory holding cost against backorder cost. Orders take two weeks to arrive, so use the visible inventory, demand, and shipment information without assuming future demand.",
  "suggestedAction": "review_pipeline",
  "urgency": "low"
}
```

Observed sanitized telemetry:

```json
{
  "operation": "game.hint.state",
  "status": "SUCCESS",
  "requestId": "req_hint_evidence_004",
  "attempts": 1,
  "latencyMs": 4
}
```

The telemetry test asserts that these are the only event fields and that `latencyMs` is finite.

## Week 4 Test Matrix

All listed results below were observed in `npm test` (30 tests passed).

| ID | Observed result | Status |
|---|---|---|
| T1 | Valid summary arguments; one Luna call, one tool call, one attempt; response and request ID validated | PASS |
| T2 | `detail: "everything"` rejected; tool client not called; no model fallback | PASS |
| T3 | Extra `executeCode` argument rejected; tool client not called | PASS |
| T4 | Non-AI-Hint caller rejected before model/tool execution | PASS |
| T5 | `place_order` rejected as unsupported; tool client not called | PASS |
| T6 | `NOT_FOUND` returned after one attempt; no retry | PASS |
| T7 | First `UPSTREAM_UNAVAILABLE`, second attempt succeeded; attempts = 2 | PASS |
| T8 | Two `UPSTREAM_UNAVAILABLE` attempts stopped at 2; no model fallback without a valid snapshot | PASS |
| T9 | Tool timeout stopped after 2 bounded attempts; status `TIMEOUT` | PASS |
| T10 | Malformed snapshot rejected as `MALFORMED_OUTPUT`; no success response or fallback | PASS |
| T11 | Malformed Luna response used one Sol fallback; final response validated | PASS |
| T12 | Before/after game-state deep equality held through a successful hint flow | PASS |
| T13 | Cancellation during an active Luna call returned `CANCELLED`; no tool call or fallback | PASS |

### Model Routing

| Case | Observed result | Status |
|---|---|---|
| M1 | Luna success: one model call, model list `[gpt-6-luna]` | PASS |
| M2 | Malformed Luna response then valid Sol response: exactly two model calls | PASS |
| M3 | Luna provider failure then Sol success: exactly two model calls | PASS |
| M3 | Luna timeout then Sol success: exactly two model calls; fallback reason `TIMEOUT` | PASS |
| M4 | Both providers fail, and malformed primary/fallback outputs: safe fallback; never more than two calls | PASS |
| M5 | Forbidden caller makes zero model and tool calls; invalid tool args make zero tool-client calls | PASS |
| M6 | Malformed tool data does not trigger a second model or become success | PASS |

### Phase Cases

| Case | Observed result | Status |
|---|---|---|
| P1 | Initial Week 1 maps to `pre_game`; hint explains cost tradeoff and delay without forecasting demand | PASS |
| P2 | Active Week 2 state receives phase-valid in-game advice | PASS |
| P3 | Shortage hint mentions backorders and delayed replenishment | PASS |
| P4 | Hint identifies 5 units scheduled for Week 3 and recommends reviewing the pipeline | PASS |
| P5 | Completed game returns `review_results`, analyzes sanitized weekly patterns, and leaves state unchanged | PASS |

## Browser Smoke

Observed on the local Vite app at `http://127.0.0.1:5175/` using the fake provider:

- Week 1 `Ask AI for Hint` displayed the structured pre-game response; the game-state column was unchanged.
- Week 2 `Ask AI for Hint` displayed a pipeline hint for 5 units due in Week 3; the game-state column was unchanged.
- After one 5-unit order in Week 1 followed by nine zero-quantity orders, Week 10 showed `Simulation Complete` and the required summary.
- The completed-game hint used `review_results`; the game-state column remained unchanged and no order-submit button was present.
- In this smoke run, the player ordered 5 units in Week 1 and 0 thereafter. Summary observed: total cost `$155.00`, average inventory `3.4`, total backordered units `43`, maximum backorder `43`, total demand `64`, units sold `21`, service level `32.8%`.
- Completed hint text observed after the case 18 fix: `Based on the observed game history, ending inventory was above that week's demand in 4 of 10 weeks and below it in 6 weeks; backorders were present in 6 weeks. Among weeks with a recorded arrival demand, orders were below that demand in 7 weeks and above it in 1 week. No new order was placed while a shipment was already in transit. The pattern suggests both inventory and backorder outcomes contributed to the observed total cost of $155.00 and 32.8% service level, though these figures alone do not establish causation. One possible improvement would be to compare the observed arrival schedule and backlog before adjusting later orders.`
- P5 browser assertions observed `phase=completed`, `suggestedAction=review_results`, unchanged game-state column, and zero Submit Order buttons. The fixed test asserts exact history-derived counts, same request ID across result/model/tool, and state immutability.
- Browser output does not expose model/tool counters or the generated request ID; those are instrumented in the deterministic test harness instead.

## Commands

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — 30 tests, 0 failures |
| `npm run build` | PASS — TypeScript and Vite production build completed |
| `npm run dev -- --host 127.0.0.1` | PASS — Vite served the app on port 5175 because 5173 and 5174 were occupied |
| `npm run lint` | NOT RUN — no lint script is defined in `package.json` |

## Boundaries and Limitations

- The only tool is `get_game_state`; it projects a sanitized read-only snapshot. There are no write tools, automatic orders, or autonomous loops.
- Tool name, exact arguments, allowlist, and AI Hint caller scope are checked before client execution.
- Tool output and phase-aware `HintResponse` are runtime validated.
- Tool calls retry only `TIMEOUT` and `UPSTREAM_UNAVAILABLE`, with at most two attempts. Invalid input, forbidden scope, unsupported tools, malformed output, and cancellation do not retry.
- Model routing uses Luna first and Sol only for eligible provider/final-output failures, with a maximum of two logical `complete()` calls per request and no parallel calls.
- For Core, the fake provider invokes the validated tool callback inside one logical `complete()` turn. No live provider SDK/client exists in this repository; actual connectivity to either named model is NOT TESTED.
- `pre_game` is derived as Week 1 with no completed history; the existing game engine creates the initial Week 1 state directly.
- The fake provider is used by the UI smoke flow and tests; its output is not a live model response.
- No contribution attribution for two team members was provided, so none is inferred.

## Strict 18-Case Verification

The deterministic test harness injects `req_hint_test_004` for every case. The T1 smoke capture separately observed `req_hint_evidence_004`; the same ID was passed to model, tool, and telemetry in that run. Model/tool counts below are fake-client invocation counts. `toolCallCount` is one logical accepted tool proposal; retryable read attempts are shown separately. For browser cases, counters are inferred from the same tested fake flow because the UI does not display them.

| # | Expected behavior | Actual observed behavior | Status | Tool calls | Model calls / models | Tool retry attempts | Request ID / evidence |
|---:|---|---|---|---:|---|---:|---|
| 1. Valid AI Hint request | One allowlisted read; valid structured response | T1 returned validated `pre_game` response; one Luna call and one read | PASS | 1 | 1: `gpt-6-luna` | 1 | `req_hint_test_004`; T1 exact args/response assertions |
| 2. Invalid arguments | Reject before tool execution; no model fallback | `detail: everything` returned `INVALID_INPUT`; generic safe message; no tool client call; no fallback | PASS | 0 | 1: `gpt-6-luna` proposed invalid args | 0 | `req_hint_test_004`; T2 asserts status, count, safe text |
| 3. Malicious extra arguments | Reject before tool execution; do not expose supplied field | `executeCode` caused `INVALID_INPUT`; zero tool calls; telemetry/public message excluded the field | PASS | 0 | 1: `gpt-6-luna` proposed invalid args | 0 | `req_hint_test_004`; T3 assertions |
| 4. Unsupported tool | Reject unsupported name; zero tool calls | `place_order` returned `UNSUPPORTED_TOOL`; no dispatch | PASS | 0 | 1: `gpt-6-luna` proposed tool | 0 | `req_hint_test_004`; T5 assertion |
| 5. Forbidden scope | Reject before model/tool execution | Caller `order_form` returned `FORBIDDEN`; zero model and tool calls | PASS | 0 | 0 | 0 | `req_hint_test_004`; T4 assertion |
| 6. Timeout | Bounded timeout/retry; no fallback without valid snapshot | Hung fake read returned `TIMEOUT` after the second bounded attempt; no Sol call | PASS | 1 logical dispatch | 1: `gpt-6-luna` | 2 | `req_hint_test_004`; T9 timeout test |
| 7. 503 → success | Retry upstream failure once; stop on success | Fake `UPSTREAM_UNAVAILABLE` then valid snapshot returned `SUCCESS` | PASS | 1 logical dispatch | 1: `gpt-6-luna` | 2 | `req_hint_test_004` asserted across both reads; T7 |
| 8. 503 → 503 | Stop after two upstream failures; no third attempt | Fake returned `UPSTREAM_UNAVAILABLE` twice; final status preserved, no model fallback | PASS | 1 logical dispatch | 1: `gpt-6-luna` | 2 | `req_hint_test_004`; T8 |
| 9. Malformed tool output | Reject snapshot; no false success or model repair | Invalid week/type and negative inventory returned `MALFORMED_OUTPUT`; no Sol call | PASS | 1 logical dispatch | 1: `gpt-6-luna` | 1 | `req_hint_test_004`; T10 |
| 10. Malformed final `HintResponse` | Reject Luna output, use one Sol fallback, validate final output | Luna response rejected; Sol returned valid structured response; status `SUCCESS`, fallback reason `MALFORMED_FINAL_OUTPUT` | PASS | 1 | 2: Luna, then Sol | 1 | Both model calls share `req_hint_test_004`; T11 |
| 11. Read-only gameplay-state integrity | State exactly unchanged | Deep equality before/after successful flow; browser state column also unchanged | PASS | 1 | 1: `gpt-6-luna` | 1 | `req_hint_test_004`; T12 and browser smoke |
| 12. Cancellation | `CANCELLED`; no retry/fallback | In-flight Luna call aborted; status `CANCELLED`, no tool call and no retry | PASS | 0 | 1: `gpt-6-luna` started | 0 | `req_hint_test_004`; T13 |
| 13. Luna success, no fallback | Luna only; one valid read/response | T1 and browser pre-game smoke succeeded with Luna fake; Sol not called | PASS | 1 | 1: `gpt-6-luna` | 1 | T1 ID correlation; browser-generated ID not surfaced |
| 14. Luna failure → Sol once | Exactly one eligible fallback; max two calls | Provider-failure and timeout tests both succeeded with exactly Luna then Sol; same ID asserted | PASS | 1 (fallback obtains snapshot) | 2: Luna, Sol | 1 | `req_hint_test_004`; M3 tests |
| 15. Luna + Sol both fail | Stop at two calls and show safe fallback | Both fake providers failed before proposing a tool; `AI_UNAVAILABLE` and exact safe fallback, no third call | PASS | 0 | 2: Luna, Sol | 0 | `req_hint_test_004`; M4 |
| 16. `pre_game` behavior | Explain objective/cost tradeoff/delay; no future-demand claims | Browser/test hint explained cost balance and two-week delay without inventing demand; state unchanged | PASS | 1 | 1: `gpt-6-luna` fake | 1 | Browser + P1/T1; UI does not expose ID |
| 17. `in_game` behavior | Use current state/pipeline cautiously; no mutation | Week 2 browser hint referenced 5 units due Week 3; state unchanged. P3 also verified shortage/delay wording | PASS | 1 | 1: `gpt-6-luna` fake | 1 | Browser + P2–P4; UI does not expose ID |
| 18. Completed-game analysis | Analyze observed summary/patterns; only `review_results`; no mutation | Hint reports 4/10 weeks inventory above demand, 6/10 below, 6 backorder weeks, 7/1 below/above orders relative to recorded arrival demand, and no order/transit overlap in this run; cost/service included. State unchanged; no Submit Order button | PASS | 1 | 1: `gpt-6-luna` fake | 1 | `req_hint_test_004` asserted in P5; browser smoke observed output and state |

### HTTP 503 Qualification

Cases 7 and 8 use injected `HintFlowError("UPSTREAM_UNAVAILABLE", ...)` in the fake read client, which represents the specified retryable 503 class. No real HTTP request or upstream 503 was issued; provider/tool networking is not present in this frontend-only repository.

### Security and Boundary Observations

- The allowlist is exactly `get_game_state`; tool proposal validation happens before dispatch.
- Invalid input, forbidden caller, and unsupported tool all have zero tool-client executions. Invalid/unsupported proposals originate inside a fake Luna call, so they do consume that one model call; no Sol fallback occurs.
- Telemetry tests assert only `operation`, `status`, `requestId`, `attempts`, and `latencyMs`. Invalid/malicious values are not included in telemetry or public fallback text.
- Completed responses are phase-validated to `review_results`; the UI renders the action as inert text. Browser smoke confirmed no game-state change and no order submission after completion.

## Strict Acceptance Conclusion

Week 4 Core acceptance is satisfied on the fake/mock path: all 30 tests, typecheck, build, smoke, phase, tool-boundary, retry, routing, validation, safe-output, and read-only checks pass. Completed-game analysis uses only the sanitized 10-week history and summary. Live provider connectivity is untested and is not required for Core; 503 behavior is fake-injected rather than an actual network response.
