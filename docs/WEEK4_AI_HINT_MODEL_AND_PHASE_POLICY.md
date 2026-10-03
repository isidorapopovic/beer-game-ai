# WEEK4_AI_HINT_MODEL_AND_PHASE_POLICY.md

# Week 4 — AI Hint: model strategy, expected failures and game-phase behavior

## 1. Purpose

This document extends the Week 4 `AI Hint` implementation with three additional requirements:

1. use at least two AI models with a cost-conscious fallback strategy;
2. define the expected error/failure cases explicitly;
3. make the hint aware of the current game phase:
   - before the game;
   - during the game;
   - after the game.

The AI remains advisory only.

It must never mutate the game state, submit an order, change configuration, or bypass the read-only tool boundary.

---

# 2. Model strategy

Use two models:

```text
PRIMARY_MODEL = gpt-6-luna
FALLBACK_MODEL = gpt-6.1-sol
```

## Primary model

```text
gpt-6-luna
```

Use it for the normal AI Hint flow because the task is narrow and structured.

Use low or medium reasoning effort.

Recommended default:

```text
reasoning.effort = low
```

Escalate to:

```text
reasoning.effort = medium
```

only when the current state is more complex, for example:

- several weeks of growing backorders;
- inventory and incoming shipments point in different directions;
- end-of-game analysis requires a concise explanation of the whole game.

Do not default to high reasoning effort.

---

# 3. Fallback model

Fallback model:

```text
gpt-6.1-sol
```

Use the fallback only when the primary model cannot produce a usable response.

Allowed fallback reasons:

```text
PROVIDER_UNAVAILABLE
TIMEOUT after the primary model budget is exhausted
MALFORMED_FINAL_OUTPUT
STRUCTURED_OUTPUT_VALIDATION_FAILED
```

The fallback model must not be used for:

```text
INVALID_INPUT
FORBIDDEN
UNSUPPORTED_TOOL
MALFORMED_TOOL_OUTPUT
CANCELLED
```

Those failures must be handled locally without spending a second AI call.

---

# 4. AI call budget

The AI Hint flow must be intentionally bounded.

For a single user action:

```text
normal path:
1 model call

fallback path:
maximum 2 model calls total
```

Example:

```text
Attempt 1:
gpt-6-luna

If and only if eligible fallback condition occurs:
Attempt 2:
gpt-6.1-sol

Then stop.
```

Never perform:

```text
Luna -> Luna -> Sol -> Sol -> another model
```

Do not create an open-ended model router.

Do not keep trying models until one succeeds.

---

# 5. Output token budget

Hints should be short and actionable.

Recommended maximum output:

## Before game

```text
150–250 output tokens
```

## During game

```text
150–300 output tokens
```

## End-of-game analysis

```text
300–600 output tokens
```

The purpose is to keep:

- cost low;
- latency low;
- advice concise;
- UI readable.

Do not request large outputs for a simple hint.

---

# 6. Input context budget

Do not send the full repository, full chat history, raw logs, or unrelated game data to the model.

The normal AI Hint request should contain only:

```text
stable AI Hint instruction
validated GameStateSnapshot
small allowed history summary if needed
required HintResponse schema
```

For the normal in-game hint, prefer the current state over the full 10-week history.

Only the end-of-game analysis may receive a compact sanitized summary of the completed game.

---

# 7. Game phase contract

The AI Hint flow must know the phase of the simulation.

Use an explicit phase:

```ts
type GamePhase =
  | "pre_game"
  | "in_game"
  | "completed";
```

The application determines this phase.

The model does not infer or overwrite it.

---

# 8. Extended read-only snapshot

Extend the sanitised snapshot with the phase.

Example:

```ts
type GameStateSnapshot = {
  phase: "pre_game" | "in_game" | "completed";

  week: number;
  totalWeeks: 10;

  customerDemand: number;
  inventory: number;
  backorders: number;
  incomingShipment: number;
  previousOrder: number;

  weeklyCost: number;
  totalCost: number;
};
```

For completed-game analysis, an additional sanitized summary may be supplied:

```ts
type CompletedGameSummary = {
  totalCost: number;
  averageWeeklyInventory: number;
  totalBackorderedUnits: number;
  maximumBackorder: number;
  totalCustomerDemand: number;
  totalUnitsSold: number;
  serviceLevel: number;
};
```

Do not send raw internal state unless it is required by the contract.

---

# 9. Pre-game AI Hint

The user may request help before the first playable week has been processed.

Example UI:

```text
Ask AI for Hint
```

Phase:

```text
pre_game
```

The AI should explain:

- the objective of the game;
- the balance between inventory cost and backorder cost;
- that orders have a 2-week shipping delay;
- that the user should look at inventory, demand and incoming shipments before placing an order;
- that over-ordering creates holding cost;
- that under-ordering may create backorders.

The AI should not invent future customer demand.

The AI should not claim to know future demand unless such information is explicitly part of the game state.

Example valid advice:

```text
You currently have available inventory and no historical trend yet.
Remember that orders arrive after two weeks, so avoid reacting as if new stock were immediate.
Use the visible demand, inventory and incoming shipment information when choosing the first order.
```

---

# 10. In-game AI Hint

Phase:

```text
in_game
```

The AI should analyse the current validated state.

At minimum it should reason about:

```text
current inventory
customer demand
current backorders
incoming shipment
previous order
shipping delay
weekly cost
total cost
current week
```

The advice should answer practical questions such as:

- Is current inventory sufficient for visible demand?
- Are backorders increasing?
- Is a shipment already on the way?
- Is the player waiting for inventory that is already in the pipeline?
- Is the player carrying too much inventory?
- Is the previous order likely to contribute to excess inventory?
- Is there a shortage risk?
- Should the player consider ordering more, less, keeping the order stable, or reviewing the pipeline?

The AI must use cautious language.

It should not state:

```text
"You must order exactly 17."
```

unless exact-order recommendations are explicitly added to the Game Spec later.

Prefer:

```text
"Consider increasing the next order because backorders are present and the incoming shipment is small."
```

The user remains responsible for the final Order Quantity.

---

# 11. Completed-game AI analysis

Phase:

```text
completed
```

The user may request:

```text
Analyze My Game
```

or reuse:

```text
Ask AI for Hint
```

with completed-game behavior.

The AI may receive:

- final sanitized game summary;
- optionally a compact per-week history containing only allowed public metrics.

It may analyse:

- whether inventory was consistently too high;
- whether backorders were frequent;
- whether the user reacted too aggressively to demand;
- whether the user repeatedly ordered while shipments were already in transit;
- whether there were periods of waiting for incoming stock;
- total cost;
- service level;
- maximum backorder;
- average inventory;
- relation between ordering behavior and observed outcomes.

The AI should explain:

```text
what happened
why it likely happened based on the observed game data
what the user could try differently in another run
```

The AI must not claim causal certainty when the data only supports an observation.

Use phrasing such as:

```text
"The pattern suggests..."
"Based on the visible game history..."
"One possible improvement would be..."
```

---

# 12. Optional sanitized history for final analysis

If the end-of-game analysis needs history, use a compact structure.

Example:

```ts
type WeeklyGameSummary = {
  week: number;
  demand: number;
  endingInventory: number;
  endingBackorders: number;
  incomingShipment: number;
  orderPlaced: number;
  weeklyCost: number;
};
```

Maximum:

```text
10 records
```

because the game lasts exactly 10 weeks.

Do not send:

- component state;
- internal functions;
- secrets;
- source code;
- raw logs;
- unrelated UI state.

---

# 13. Phase-aware HintResponse

Use a structured response.

```ts
type HintResponse = {
  phase: "pre_game" | "in_game" | "completed";
  hint: string;
  suggestedAction:
    | "order_more"
    | "order_less"
    | "keep_order_stable"
    | "review_pipeline"
    | "wait"
    | "review_results";
  urgency: "low" | "medium" | "high";
};
```

Rules:

## pre_game

Allowed actions:

```text
keep_order_stable
review_pipeline
wait
```

The implementation may allow `order_more` or `order_less` only if the initial state genuinely supports such advice.

## in_game

Allowed actions:

```text
order_more
order_less
keep_order_stable
review_pipeline
wait
```

## completed

Preferred action:

```text
review_results
```

No order-related action may cause any state mutation.

---

# 14. Expected failures

The system must explicitly expect and handle the following failures.

## F1 — Invalid tool arguments

Example:

```json
{
  "detail": "everything"
}
```

Expected:

```text
INVALID_INPUT
toolCallCount = 0
model fallback = NO
```

---

## F2 — Malicious additional field

Example:

```json
{
  "detail": "summary",
  "executeCode": "..."
}
```

Expected:

```text
INVALID_INPUT
toolCallCount = 0
model fallback = NO
```

---

## F3 — Unsupported tool

Example:

```text
place_order
```

Expected:

```text
UNSUPPORTED_TOOL
toolCallCount = 0
model fallback = NO
```

---

## F4 — Forbidden scope

Valid tool and valid arguments but invalid caller/scope.

Expected:

```text
FORBIDDEN
toolCallCount = 0
model fallback = NO
```

---

## F5 — Tool timeout

Expected:

```text
TIMEOUT
bounded retry according to adapter policy
no gameplay mutation
```

If the tool path itself ultimately fails:

```text
do not call the fallback model with fabricated state
```

Return safe fallback.

---

## F6 — Upstream unavailable

Expected:

```text
UPSTREAM_UNAVAILABLE
maximum 2 adapter attempts if retryable
```

If no valid snapshot exists after the bounded attempts:

```text
no model hint is generated
```

---

## F7 — Malformed tool output

Example:

```json
{
  "week": "five",
  "inventory": -12
}
```

Expected:

```text
MALFORMED_OUTPUT
no model fallback
no false success
```

Do not send malformed state to another model.

---

## F8 — Primary model timeout/provider failure

Primary:

```text
gpt-6-luna
```

fails due to provider/transport failure.

Expected:

```text
one fallback attempt with gpt-6.1-sol
```

Then stop.

---

## F9 — Primary model returns malformed HintResponse

Example:

```json
{
  "hint": 123,
  "suggestedAction": "delete_game",
  "urgency": "extreme"
}
```

Expected:

```text
primary structured-output validation FAIL
one fallback attempt with gpt-6.1-sol
```

If fallback is also invalid:

```text
safe fallback
```

No third model call.

---

## F10 — Both models fail

Expected:

```text
AI hint is currently unavailable. Please continue using the visible game information.
```

No game-state mutation.

---

## F11 — Cancellation

Expected:

```text
CANCELLED
no additional model call
no retry after cancellation
```

---

## F12 — Completed game receives order-like recommendation

If completed-game response suggests:

```text
order_more
```

the final semantic validator should either:

- reject it; or
- normalize the flow to a safe completed-game response only if such normalization is explicitly implemented and tested.

Preferred Core behavior:

```text
reject invalid phase/action combination
show safe fallback or perform one eligible model fallback
```

---

# 15. Model fallback decision table

| Failure | Luna used? | Sol fallback? | Expected result |
|---|---:|---:|---|
| valid request | Yes | No | valid hint |
| INVALID_INPUT | No/stop before model where possible | No | local error |
| FORBIDDEN | No/stop | No | local error |
| UNSUPPORTED_TOOL | No/stop | No | local error |
| MALFORMED_TOOL_OUTPUT | No final model call | No | safe fallback |
| tool timeout with no snapshot | No final model call | No | safe fallback |
| Luna provider failure | Yes | Yes, once | hint or fallback |
| Luna malformed HintResponse | Yes | Yes, once | hint or fallback |
| Sol malformed/failure | Yes | Yes | stop, safe fallback |
| cancellation | stop | No | CANCELLED |

---

# 16. Model use by phase

## Pre-game

Default:

```text
gpt-6-luna
reasoning = low
```

No fallback unless provider or structured-output failure occurs.

---

## In-game

Default:

```text
gpt-6-luna
reasoning = low
```

Use medium reasoning only when the orchestration layer explicitly classifies the state as requiring a more complex explanation.

Do not use Sol just because the game has backorders.

Fallback only on failure.

---

## Completed game

Default:

```text
gpt-6-luna
reasoning = medium
```

because this request may analyse the 10-week summary.

If Luna fails validation or provider execution:

```text
gpt-6.1-sol
reasoning = low or medium
```

once.

Do not default to Sol for every completed game unless later eval evidence shows Luna quality is insufficient.

---

# 17. Cost-conscious design rules

1. Use Luna first.
2. Keep prompts small.
3. Do not send repository context to runtime hint generation.
4. Limit historical data to at most 10 sanitized weekly records.
5. Limit output tokens.
6. Do not call both models in parallel.
7. Do not call Sol when Luna succeeds.
8. Do not use model fallback for local validation errors.
9. Do not retry malformed tool data with another model.
10. Cache only stable instructions if the chosen API/client supports it and if caching is later explicitly implemented.

---

# 18. Test cases for model routing

## M1 — Luna success

Expected:

```text
modelCalls = 1
models = ["gpt-6-luna"]
```

---

## M2 — Luna malformed response, Sol success

Expected:

```text
modelCalls = 2
models = ["gpt-6-luna", "gpt-6.1-sol"]
finalStatus = SUCCESS
```

---

## M3 — Luna provider failure, Sol success

Expected:

```text
modelCalls = 2
fallbackReason = PROVIDER_FAILURE
```

---

## M4 — Both fail

Expected:

```text
modelCalls = 2
finalStatus = AI_UNAVAILABLE
safe fallback shown
```

---

## M5 — Invalid input

Expected:

```text
modelCalls = 0
toolCalls = 0
```

where possible because the request can be rejected locally.

---

## M6 — Malformed tool output

Expected:

```text
no second model is used to "repair" game state
finalStatus = MALFORMED_OUTPUT
```

---

# 19. Test cases for game phases

## P1 — Pre-game

State:

```text
phase = pre_game
```

Expected:

- explanation of objective;
- explanation of inventory vs backorder tradeoff;
- mention of 2-week shipping delay;
- no invented demand;
- no game-state mutation.

---

## P2 — In-game with inventory available

Example:

```text
inventory = 20
demand = 8
backorders = 0
incomingShipment = 12
```

Expected:

AI notices there is inventory and additional stock is already coming.

It should avoid an unjustified aggressive `order_more` recommendation.

Exact wording is not fixed, but structured output must be valid.

---

## P3 — In-game with shortage

Example:

```text
inventory = 0
demand = 8
backorders = 10
incomingShipment = 2
```

Expected:

AI explains shortage/backorder risk and may suggest considering a larger next order.

It must mention that shipment delay means the decision does not solve the current shortage immediately.

---

## P4 — Waiting for shipment

Example:

```text
inventory = low
backorders = low or zero
incomingShipment = high
```

Expected:

AI recognises that inventory is already in transit and may recommend reviewing the pipeline before over-ordering.

---

## P5 — Completed game

Expected:

AI analyses:

- final cost;
- inventory pattern;
- backorder pattern;
- service level;
- order/incoming-shipment relationship.

No new order is submitted or executed.

---

# 20. Final acceptance criteria

The AI Hint extension is complete only when:

- [ ] `gpt-6-luna` is configured as primary;
- [ ] `gpt-6.1-sol` is configured as one-time fallback;
- [ ] models are not called in parallel;
- [ ] maximum 2 model calls per user request;
- [ ] local validation errors do not trigger model fallback;
- [ ] tool failures do not cause a model to invent missing game state;
- [ ] output-token limits are configured;
- [ ] phase is explicit;
- [ ] pre-game hint is supported;
- [ ] in-game hint is supported;
- [ ] completed-game analysis is supported;
- [ ] completed game can receive a sanitized 10-week summary;
- [ ] final output is structured;
- [ ] phase/action combination is validated;
- [ ] expected failure cases are tested;
- [ ] fake/mock tests prove model routing;
- [ ] evidence records actual models used;
- [ ] evidence records model call count;
- [ ] evidence records fallback reason;
- [ ] gameplay state remains read-only.

---

# 21. Critical reminder

```text
CHEAP MODEL FIRST.
ONE FALLBACK ONLY.

LOCAL VALIDATION ERRORS:
DO NOT SPEND ANOTHER MODEL CALL.

NO VALID GAME STATE:
DO NOT ASK A MODEL TO GUESS.

PRE-GAME:
TEACH.

IN-GAME:
ADVISE FROM CURRENT STATE.

COMPLETED:
ANALYZE THE OBSERVED GAME.

AI RECOMMENDS.
THE PLAYER DECIDES.
THE APPLICATION OWNS THE STATE.
```
