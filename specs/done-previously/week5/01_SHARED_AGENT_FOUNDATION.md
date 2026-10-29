# Spec 01 — Shared Bounded Agent Foundation

## Objective

Create the shared Week 05 agent infrastructure that all later workflows reuse.

Do NOT implement the complete Decision Coach, candidate simulation, post-game analyst, or scenario generator yet.

This step establishes:
- explicit run state
- bounded orchestrator/state machine
- provider-neutral model boundary
- tool registry / allowlist
- runtime validation
- stop reasons
- limits
- repeated-action detection
- fake-model testing
- safe run evidence

---

# 1. Inspect the repository before coding

Find and document:
1. current game-state model
2. function(s) that advance a week
3. location of inventory, backorder, demand, shipment, order and cost state
4. Week 04 provider adapter/gateway
5. existing runtime-schema library, if any
6. existing test framework
7. frontend/backend or API/service boundary

Reuse existing architecture.

Do not duplicate a provider adapter if one already exists.

Adapt names/paths to the real repository.

---

# 2. Bounded orchestrator

Implement a shared orchestrator that can support:

```text
create run
  -> model step
  -> validate proposal
  -> execute validated tool
  -> validate tool result
  -> model step
  -> validate final result
  -> finish with explicit reason
```

The model never directly executes tools.

The backend/application remains authoritative.

---

# 3. Shared state

Create or adapt equivalents of:

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

Follow repository naming conventions if they differ.

---

# 4. Limits

Centralize explicit limits.

Recommended initial defaults:

```ts
const AGENT_LIMITS = {
  maxSteps: 4,
  maxToolCalls: 2,
  maxRetriesPerStep: 1,
  totalDeadlineMs: 20_000,
  maxToolResultBytes: 50_000
};
```

Requirements:
- no unbounded loop
- retry does not reset total deadline
- fallback does not reset total deadline
- every model step consumes step budget
- every successful tool execution consumes tool-call budget
- stop before new execution once a limit is exceeded

---

# 5. Provider-neutral model boundary

Reuse Week 04 provider integration.

The orchestrator depends on an internal interface, not on provider SDK code.

Conceptual contract:

```ts
type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: unknown;
};

type ModelStepRequest = {
  workflow: WorkflowId;
  systemInstruction: string;
  userInput: string;
  state: unknown;
  availableTools: ToolDescriptor[];
  outputSchema: unknown;
  deadlineAt: string;
};

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

Existing Week 04 types may be extended rather than replaced.

---

# 6. Tool registry

Create a backend-owned tool registry.

Each tool should describe:
- name
- description
- argument schema
- result schema
- execute function
- allowed workflows
- mode: read-only or deterministic/non-mutating

The model cannot create or register tools.

At this stage fake tools are sufficient for orchestration tests.

---

# 7. Runtime validation

Implement validation for:

## Model proposal
- parse success
- known `kind`
- required fields
- known tool
- tool allowed for workflow
- valid arguments
- valid current run state
- remaining budgets

## Tool result
- runtime schema
- required fields
- maximum size
- basic domain sanity

## Final result
- workflow-provided final schema
- completed flag
- evidence presence where required

Do not treat parseable JSON as automatically trusted.

---

# 8. Preflight validation

Before the first provider call validate:
- non-empty goal
- goal length limit
- known workflow
- required game context exists
- current game phase is compatible
- deadline can be established

Preflight failures must not call the provider.

---

# 9. Repeated-action detection

Create a canonical key similar to:

```text
toolName + normalizedArguments + stateVersion
```

JSON key ordering must not produce a different key.

If there is no explicit state version, derive a stable game snapshot/version identifier.

If the same action repeats without meaningful state progress, stop with:

```text
repeated_action
```

---

# 10. Error classification

At minimum classify:

```text
preflight_rejected
invalid_model_proposal
unknown_tool
invalid_tool_arguments
invalid_tool_result
tool_failed
provider_failed
step_limit
tool_call_limit
deadline
repeated_action
cancelled
```

Do not expose secrets or raw provider stack traces to end users.

---

# 11. FakeModelAdapter

Implement a deterministic fake model adapter or equivalent.

Tests must be able to configure sequences such as:

```text
step 1 -> request fake tool
step 2 -> return final result
```

and:

```text
request unknown tool
return malformed final
repeat same tool request
```

Core tests must not require live provider credentials.

---

# 12. Safe run evidence

Create a safe evidence structure similar to:

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

Do not log hidden reasoning or secrets.

---

# 13. Tests required

Using fake model/tool infrastructure add:

1. success: tool request -> tool -> final
2. unknown tool rejected before execution
3. invalid arguments rejected before execution
4. malformed/invalid structured model response
5. invalid tool result not returned to second model step
6. tool failure classification
7. step limit
8. tool-call limit
9. deadline
10. repeated action

Verify tool execution counts.

---

# 14. Non-goals

Do NOT add:
- multiplayer
- RAG
- shell tools
- arbitrary filesystem access
- arbitrary URLs
- arbitrary SQL
- write-capable AI tools
- chain-of-thought logging
- open-ended autonomous loops

---

# 15. Acceptance criteria

Complete when:
- shared bounded orchestrator exists
- run state and stop reason are explicit
- limits are centralized
- provider boundary from Week 04 is reused
- tool allowlist is backend-owned
- validation boundaries exist
- repeated actions are bounded
- fake tests pass
- existing Beer Game build/tests still pass

At the end, report:
1. files changed
2. architecture reused
3. tests added
4. commands run
5. acceptance criteria status
6. repository-specific deviations
