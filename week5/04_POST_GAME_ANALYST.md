# Spec 04 — Post-Game AI Analyst

## Objective

Add a bounded educational analysis workflow after Week 10.

User clicks:

> Analyze my game

The analysis must use the actual completed game history.

---

# 1. Prerequisites

Specs 01–03 are complete.

Reuse shared agent infrastructure.

---

# 2. Workflow ID

```text
game_analyst
```

---

# 3. Preflight

Allowed only when:
- a game exists
- game status is completed
- required history exists

If game is still active:
- reject before provider call
- classify as preflight rejection

---

# 4. Tool: getGameHistory

Register:

```text
getGameHistory
```

Mode:

```text
read-only
```

Normalized shape:

```ts
type GameHistoryWeek = {
  week: number;
  demand: number;
  order: number;
  inventory: number;
  backorder: number;
  cost: number;
  incomingShipment?: number;
};

type GameHistoryResult = {
  totalWeeks: number;
  totalCost: number;
  weeks: GameHistoryWeek[];
};
```

Use actual repository state as source of truth.

---

# 5. Tool validation

Validate:
- history belongs to completed game
- coherent week numbering
- bounded length
- finite numeric values
- valid total cost
- result size below limit

Do not expose unrelated application state.

---

# 6. AI call #1

Expected:

```json
{
  "kind": "tool_request",
  "toolRequest": {
    "name": "getGameHistory",
    "arguments": {}
  }
}
```

---

# 7. AI call #2 final schema

Use something equivalent to:

```ts
type GameAnalysisFinding = {
  type:
    | "bullwhip_signal"
    | "overreaction"
    | "under_ordering"
    | "over_ordering"
    | "shipping_delay_effect"
    | "cost_driver"
    | "good_decision"
    | "lesson";
  title: string;
  explanation: string;
  weeks: number[];
  evidence: Array<{
    source: "game_history";
    fact: string;
  }>;
};

type PostGameAnalysisResult = {
  summary: string;
  findings: GameAnalysisFinding[];
  nextGameAdvice: string[];
  confidence: "low" | "medium" | "high";
  completed: true;
};
```

Bound findings, e.g. max 6.

---

# 8. Bullwhip rule

Do not allow the model to claim an exact mathematical bullwhip metric unless the backend actually calculates one.

Allowed:
- qualitative bullwhip signal/pattern
- order volatility compared with demand
- week-specific examples

Required:
- claims grounded in actual history
- references to real week numbers
- no invented demand/orders/shipments/costs

---

# 9. Shipping-delay context

The system instruction may state the verified game rule:

```text
the current Beer Game uses a 2-week shipping delay
```

The model may explain delayed effects using this rule and verified history.

---

# 10. UI

On completion show:

```text
[ Analyze my game ]
```

Display:
- summary
- findings
- relevant weeks
- evidence
- lessons for next game
- confidence

Do not show raw provider internals.

---

# 11. Tests

Required:
1. completed game happy path
2. active game -> no provider call
3. invalid history -> no model step 2
4. final references nonexistent week -> reject/sanitize according to validation strategy
5. too many findings -> bounded validation
6. unknown tool rejected
7. no evidence -> final rejected
8. limits still enforced

Use deterministic fake history.

Do not unit-test model intelligence; unit-test orchestration and validation.

---

# 12. Acceptance criteria

Complete when:
- completed game has Analyze action
- active game cannot use it
- successful path is AI -> getGameHistory -> AI
- tool is read-only
- structured findings reference real history
- fake-first tests pass
- no gameplay mutation occurs
- completion flow remains intact

At completion report:
- normalized history contract
- final analysis schema
- UI entry point
- tests added
