# Spec 02 — Retailer AI Decision Coach

## Objective

Implement the first concrete Week 05 workflow.

During an active Retailer week the user can ask:

> How much should I order this week and why?

The AI may recommend an order, but it MUST NOT submit it or mutate the game.

---

# 1. Prerequisite

Spec 01 is complete.

Reuse:
- AgentOrchestrator
- ModelGateway / Week 04 adapter
- ToolRegistry
- run state
- limits
- stop reasons
- validation
- fake model infrastructure

Do not build a second agent loop.

---

# 2. Inspect real game state first

Identify canonical sources for:
- current week
- inventory
- backorder
- incoming shipments/shipping pipeline
- recent demand
- recent orders
- total/current cost
- active/completed state

Reuse current selectors/calculations.

Do not copy game calculations into the AI layer.

---

# 3. Workflow ID

```text
decision_coach
```

---

# 4. Preflight

Allowed only when:
- game exists
- game is active
- current week accepts a Retailer order
- required game data exists
- goal is non-empty

If the game is completed, reject before provider call.

---

# 5. Tool: getCurrentGameState

Register:

```text
getCurrentGameState
```

Mode:

```text
read-only
```

Prefer no model-controlled game identifier if backend/session state already identifies the current game.

Normalized output:

```ts
type CurrentGameStateToolResult = {
  week: number;
  inventory: number;
  backorder: number;
  incomingShipments: number[];
  recentDemand: number[];
  recentOrders: number[];
  totalCost: number;
};
```

Limit historical arrays to a small useful window, preferably 3–5 weeks.

---

# 6. Tool result validation

Validate:
- valid week range
- finite numeric values
- bounded arrays
- domain-valid quantities
- result size below shared limit

Send only necessary data to the model.

---

# 7. AI call #1

The model must first request verified game state.

Expected successful proposal:

```json
{
  "kind": "tool_request",
  "toolRequest": {
    "name": "getCurrentGameState",
    "arguments": {}
  }
}
```

The backend still validates the proposal before executing.

For this workflow expose only the minimum allowed tool set.

---

# 8. AI call #2

After validated tool output, require a structured final response:

```ts
type DecisionCoachResult = {
  summary: string;
  recommendation: string;
  recommendedOrderQuantity: number;
  evidence: Array<{
    source: "game_state";
    fact: string;
  }>;
  confidence: "low" | "medium" | "high";
  completed: true;
};
```

Validation:

```text
recommendedOrderQuantity is integer
0 <= recommendedOrderQuantity <= 50
```

The recommendation is advice only.

---

# 9. Evidence grounding

Evidence may reference:
- current inventory
- current backorder
- recent demand
- recent orders
- known incoming shipments
- total cost

Reject or stop on clearly fabricated/nonexistent evidence where semantic validation can verify it.

Do not require chain-of-thought.

---

# 10. UI

During an active week add a small Decision Coach entry point.

Suggested UX:

```text
AI Decision Coach
[ Ask for recommendation ]
```

Success UI should show:
- recommended quantity
- summary
- evidence
- confidence

Also display that AI advice does not automatically place the order.

Stopped/failed runs show a safe classified reason.

Do not display raw provider payloads.

---

# 11. Fake-first tests

Required:
1. happy path: 2 model steps + 1 tool
2. unknown tool -> no tool execution
3. invalid recommendation quantity -> final rejected
4. completed game -> preflight rejection and zero provider calls
5. invalid tool result -> not passed to model step 2
6. repeated tool request -> safe stop

Also verify that the canonical game state before and after asking the coach is unchanged.

---

# 12. Non-goals

Do NOT:
- submit order
- advance week
- modify inventory
- modify backorder
- modify shipping pipeline
- generate demand
- add multiplayer

---

# 13. Acceptance criteria

Complete when:
- active Retailer can request advice
- successful path is AI -> getCurrentGameState -> AI
- tool is validated and read-only
- final result is structured and validated
- recommendation cannot mutate game state
- fake tests pass
- existing game behavior still works

At completion report:
- files changed
- tool contract
- final schema
- tests run
- proof of non-mutation
