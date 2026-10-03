# Spec 03 — simulateCandidateOrder

## Objective

Add a deterministic, non-mutating tool workflow where the model proposes a candidate Retailer order, the backend validates it, simulates it using real game rules, and sends the verified result back to the model.

User asks:

> What should I order?

---

# 1. Prerequisites

Specs 01 and 02 are complete.

Reuse:
- shared orchestrator
- model gateway
- tool registry
- run state
- limits
- validators
- fake model support

Do not create another orchestration loop.

---

# 2. Workflow ID

```text
candidate_order_simulation
```

---

# 3. Preflight

Allowed only when:
- game exists
- game is active
- Retailer is currently allowed to make an order decision
- required state is available

The workflow itself must never advance the real game.

---

# 4. Tool: simulateCandidateOrder

Register:

```text
simulateCandidateOrder
```

Mode:

```text
deterministic / non-mutating
```

Arguments:

```ts
type SimulateCandidateOrderArgs = {
  orderQuantity: number;
};
```

Validate:

```text
integer
0 <= orderQuantity <= 50
```

Reject:
- negatives
- values above 50
- strings
- NaN/Infinity
- floats if game orders are integer-only

---

# 5. Reuse game engine

Critical rule:

The simulation must reuse the existing Beer Game rules where possible.

Preferred process:

1. get canonical current state
2. clone/create isolated simulation snapshot
3. apply candidate order using existing pure helpers or extracted minimal pure helpers
4. calculate only the next relevant deterministic consequences
5. discard snapshot

Do not build a second inconsistent Beer Game engine.

If future demand is not yet known in real game semantics, do not fabricate exact future inventory/backorder.

Represent only what can honestly be calculated.

---

# 6. Tool result

Preferred normalized shape:

```ts
type CandidateOrderSimulationResult = {
  orderQuantity: number;
  estimatedInventoryNextWeek?: number;
  estimatedBackorderNextWeek?: number;
  estimatedIncrementalCost?: number;
  knownIncomingShipmentNextWeek?: number;
  assumptions: string[];
};
```

Example:

```json
{
  "orderQuantity": 9,
  "estimatedInventoryNextWeek": 3,
  "estimatedBackorderNextWeek": 1,
  "estimatedIncrementalCost": 5,
  "knownIncomingShipmentNextWeek": 4,
  "assumptions": [
    "The real game state was not mutated.",
    "The existing two-week shipping-delay rules were used."
  ]
}
```

If exact next-week projections are impossible from known state, adapt the schema to distinguish guaranteed versus projected values rather than inventing numbers.

---

# 7. AI call #1

Expected tool proposal:

```json
{
  "kind": "tool_request",
  "toolRequest": {
    "name": "simulateCandidateOrder",
    "arguments": {
      "orderQuantity": 9
    }
  }
}
```

Backend validates before execution.

---

# 8. AI call #2

Require a structured result such as:

```ts
type CandidateOrderAdviceResult = {
  summary: string;
  recommendation: string;
  recommendedOrderQuantity: number;
  simulation: {
    estimatedInventoryNextWeek?: number;
    estimatedBackorderNextWeek?: number;
    estimatedIncrementalCost?: number;
  };
  evidence: Array<{
    source: "candidate_order_simulation";
    fact: string;
  }>;
  confidence: "low" | "medium" | "high";
  completed: true;
};
```

The final answer must remain consistent with the validated simulation result.

---

# 9. Mandatory non-mutation test

Capture real canonical state before and after tool execution:

```text
snapshotBefore
simulateCandidateOrder(...)
snapshotAfter
```

Assert game fields are unchanged.

Simulation must not:
- place real order
- advance week
- consume shipments
- change inventory
- change backorder
- change cost
- change demand/order history

---

# 10. Tests

Required:
1. valid candidate
2. boundary 0
3. boundary 50
4. negative rejected
5. >50 rejected
6. non-integer rejected if required
7. invalid result schema rejected
8. real game state unchanged
9. unknown tool rejected
10. limits/deadline still enforced

---

# 11. UI integration

Present simulation separately from real order submission.

Example:

```text
AI recommendation: 9 units

Simulation
- inventory impact: ...
- backorder impact: ...
- cost impact: ...

[Use 9 as my order]
```

If `Use 9 as my order` is added, it must be an explicit ordinary user action outside the agent workflow.

The agent itself must never submit it.

---

# 12. Acceptance criteria

Complete when:
- model can propose candidate quantity
- backend validates it
- deterministic simulation runs
- real state remains unchanged
- second AI step interprets verified result
- final output is structured and validated
- tests pass
- existing game still works

At completion report exactly which existing game-engine functions were reused.
