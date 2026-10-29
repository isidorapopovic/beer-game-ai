# Beer Distribution Game — Week 05 Agentic Workflows Overview

## Purpose

Extend the existing Beer Distribution Game MVP with bounded, stateful, backend-controlled AI workflows.

Current project assumptions:
- React + Vite application
- Retailer role is implemented
- 10-week simulation
- 2-week shipping delay
- inventory tracking
- backorder tracking
- customer demand handling
- order handling
- cost calculation
- completed game state after Week 10
- Week 04 already introduced an AI/provider integration boundary that should be reused

The Week 05 goal is NOT to create a general autonomous agent.

The model may propose a next step, but the application owns:
- real game state
- available tools
- tool allowlist
- tool argument validation
- tool execution
- step and tool-call limits
- deadlines
- final result validation
- stop conditions
- user-visible output

Core Week 05 pattern:

```text
user goal
  -> create bounded run
  -> AI step 1
  -> validate structured proposal
  -> execute allowlisted read-only/deterministic tool
  -> validate tool result
  -> AI step 2
  -> validate structured final result
  -> complete / stop / fail with explicit reason
```

Successful agentic paths must contain at least:

```text
2 model steps + 1 validated tool execution
```

---

# Workflow 1 — AI Decision Coach for the Retailer

## User goal

During an active week the Retailer asks:

> How much should I order this week and why?

## Flow

```text
User goal
  -> AI call #1
  -> tool request: getCurrentGameState
  -> backend validates proposal
  -> getCurrentGameState()
  -> backend validates tool result
  -> AI call #2
  -> structured recommendation
  -> backend validates final result
  -> UI displays recommendation + evidence
```

## Tool

```text
getCurrentGameState
```

Mode: read-only.

Expected normalized output:

```json
{
  "week": 6,
  "inventory": 4,
  "backorder": 7,
  "incomingShipments": [3, 5],
  "recentDemand": [4, 5, 8],
  "recentOrders": [4, 6, 8],
  "totalCost": 23
}
```

## Final result

```json
{
  "summary": "Demand increased over the last three weeks while backorders are accumulating.",
  "recommendation": "Order 9 units.",
  "recommendedOrderQuantity": 9,
  "evidence": [
    {
      "source": "game_state",
      "fact": "Current backorder is 7 units."
    },
    {
      "source": "game_state",
      "fact": "Recent demand is 4, 5, and 8 units."
    }
  ],
  "confidence": "medium",
  "completed": true
}
```

Important: the AI recommends an order but does NOT submit it.

---

# Workflow 2 — simulateCandidateOrder

## User goal

The user asks:

> What should I order?

The model proposes a candidate quantity. The backend validates the quantity and simulates it using deterministic game logic without modifying the real game.

## Flow

```text
User
  -> AI call #1
  -> tool request: simulateCandidateOrder({ orderQuantity })
  -> backend validates arguments
  -> deterministic non-mutating simulation
  -> backend validates simulation result
  -> AI call #2
  -> structured recommendation + explanation
```

## Tool

```text
simulateCandidateOrder
```

Mode: deterministic, non-mutating.

Input rule:

```text
orderQuantity must be an integer
0 <= orderQuantity <= 50
```

Example tool output:

```json
{
  "orderQuantity": 9,
  "estimatedInventoryNextWeek": 3,
  "estimatedBackorderNextWeek": 1,
  "estimatedIncrementalCost": 5
}
```

Important:
- reuse the real game engine/rules where possible
- never maintain a second contradictory game engine
- simulation must not place the real order
- simulation must not advance the week
- simulation must not change inventory, backorder, cost or shipment queues

---

# Workflow 3 — AI Game Analyst after Week 10

## User action

After completion the user clicks:

> Analyze my game

## Flow

```text
User
  -> AI call #1
  -> tool request: getGameHistory
  -> backend validates game is completed
  -> getGameHistory()
  -> backend validates history
  -> AI call #2
  -> structured post-game analysis
```

## Tool

```text
getGameHistory
```

Mode: read-only.

Example normalized result:

```json
{
  "weeks": [
    {
      "week": 1,
      "demand": 4,
      "order": 4,
      "inventory": 8,
      "backorder": 0,
      "cost": 4
    }
  ]
}
```

The analysis may discuss:
- where ordering became unstable
- possible bullwhip behavior
- overreaction
- under-ordering
- over-ordering
- effect of the 2-week shipping delay
- cost drivers
- what to change in the next game

Important:
- claims must be grounded in verified history
- the model must not invent missing game events
- exact quantitative bullwhip metrics should only be claimed if a deterministic backend metric actually exists

---

# Workflow 4 — AI Scenario Generator before the game

## User goal

Before starting a game the user can choose manually or write:

> I want a difficult scenario with increasing demand.

## Flow

```text
User
  -> AI call #1
  -> tool request: getAllowedScenarioTypes
  -> backend validates tool request
  -> backend returns approved scenario catalog
  -> AI call #2
  -> structured scenario selection
  -> backend validates enum values
  -> deterministic game engine generates the real demand sequence
```

## Tool

```text
getAllowedScenarioTypes
```

Allowed scenarios:

```text
stable
growth
seasonal
volatile
```

Recommended difficulty enum:

```text
easy
medium
hard
```

Example final AI result:

```json
{
  "scenario": "growth",
  "difficulty": "hard",
  "explanation": "The request asks for increasing demand and high difficulty.",
  "evidence": [
    {
      "source": "allowed_scenarios",
      "fact": "growth is an approved scenario type."
    }
  ],
  "confidence": "high",
  "completed": true
}
```

Important:
- AI chooses category + difficulty
- AI does NOT invent the 10-week demand sequence
- the deterministic game engine generates the actual numbers
- starting a game remains an explicit user action

---

# Shared Week 05 architecture

All workflows must use shared infrastructure.

Conceptually:

```text
Frontend
  |
  v
Agent API/service
  |
  v
Agent Orchestrator / State Machine
  |         |             |
  |         |             +--> run limits and stop policy
  |         +----------------> tool registry and validators
  +--------------------------> provider-neutral ModelGateway
                                  |
                                  +--> Week 04 provider adapter(s)
```

Do not put provider SDK code inside workflow components.

Recommended conceptual modules:

```text
agent/
  AgentOrchestrator
  AgentRunState
  AgentLimits
  StopReason
  ToolRegistry
  schemas/
  tools/

ai/
  ModelGateway
  existing Week 04 provider adapters
  FakeModelAdapter

tests/
  agent/
```

Codex must inspect the repository and reuse equivalent modules instead of blindly creating duplicates.

---

# Shared run state

Conceptual minimum:

```ts
type RunStatus =
  | "created"
  | "running"
  | "completed"
  | "stopped"
  | "failed";

type WorkflowId =
  | "decision_coach"
  | "candidate_order_simulation"
  | "game_analyst"
  | "scenario_generator";

type StopReason =
  | "completed"
  | "preflight_rejected"
  | "invalid_model_proposal"
  | "unknown_tool"
  | "invalid_tool_arguments"
  | "invalid_tool_result"
  | "tool_failed"
  | "provider_failed"
  | "step_limit"
  | "tool_call_limit"
  | "deadline"
  | "repeated_action"
  | "cancelled";

type AgentRunState = {
  runId: string;
  workflow: WorkflowId;
  status: RunStatus;
  goal: string;
  stepCount: number;
  toolCallCount: number;
  startedAt: string;
  deadlineAt: string;
  recentActions: string[];
  lastToolResult?: unknown;
  stopReason?: StopReason;
};
```

---

# Shared limits

Use explicit limits.

Recommended defaults:

```ts
const AGENT_LIMITS = {
  maxSteps: 4,
  maxToolCalls: 2,
  maxRetriesPerStep: 1,
  totalDeadlineMs: 20_000,
  maxToolResultBytes: 50_000
};
```

No unbounded loops.

---

# Tool allowlist

Required Week 05 tools:

```text
getCurrentGameState
simulateCandidateOrder
getGameHistory
getAllowedScenarioTypes
```

The model must never be allowed to define:
- new tools
- shell commands
- filesystem paths
- arbitrary URLs
- arbitrary SQL
- direct game-state mutation operations

---

# Shared model boundary

The provider-neutral layer should normalize provider output to a common shape such as:

```ts
type ModelStepResponse =
  | {
      kind: "tool_request";
      toolRequest: {
        name: string;
        arguments: unknown;
      };
    }
  | {
      kind: "final";
      final: unknown;
    }
  | {
      kind: "refusal";
    };
```

Every response is untrusted until runtime validation succeeds.

---

# Validation layers

Before any tool execution:

1. parse model response
2. validate model response schema
3. validate `kind`
4. verify tool exists
5. verify tool is allowed for this workflow
6. validate arguments
7. validate current game/run context
8. validate remaining budgets/deadline
9. detect repeated action

After tool execution:

1. validate tool result schema
2. validate result size
3. validate basic domain sanity
4. only then return the result to the model

Before returning final output:

1. validate final schema
2. validate evidence is grounded
3. validate workflow-specific semantics
4. accept `completed: true` only after backend validation

---

# Fake-first testing

Before relying on a live provider, implement deterministic fake model flows.

Required categories:

- success: 2 model steps + 1 tool
- unknown tool
- invalid tool arguments
- invalid model structured response
- invalid tool result
- tool failure
- provider failure
- step limit
- tool-call limit
- deadline
- repeated action
- prompt-injection attempt

Live provider testing is a smoke test, not the main correctness mechanism.

---

# Safe evidence

A run should produce safe structured evidence similar to:

```ts
type RunEvidence = {
  runId: string;
  workflow: WorkflowId;
  status: "completed" | "stopped" | "failed";
  stepCount: number;
  toolCallCount: number;
  providersAttempted: string[];
  toolsAttempted: string[];
  validationResults: string[];
  stopReason: string;
  elapsedMs: number;
};
```

Do not log:
- API keys
- secrets
- hidden chain-of-thought
- unrestricted raw prompts
- unnecessary private data

---

# Codex implementation order

Run Codex against these files ONE BY ONE:

```text
01_SHARED_AGENT_FOUNDATION.md
02_AI_DECISION_COACH.md
03_SIMULATE_CANDIDATE_ORDER.md
04_POST_GAME_ANALYST.md
05_AI_SCENARIO_GENERATOR.md
06_HARDENING_TESTS_AND_EVIDENCE.md
07_FINAL_INTEGRATION_AND_DEMO.md
```

Do not ask Codex to implement the entire overview in one pass.
