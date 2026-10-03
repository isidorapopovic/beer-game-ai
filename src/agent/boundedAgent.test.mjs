import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_LIMITS,
  BoundedAgentOrchestrator,
  createAgentRun,
  UnknownToolError,
  ValidationError,
} from "./boundedAgent.ts";

const toolRegistry = {
  getCurrentGameState: {
    name: "getCurrentGameState",
    description: "Read current game state",
    allowedWorkflows: ["decision_coach"],
    mode: "read_only",
    argsSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    resultSchema: {
      type: "object",
      properties: {
        week: { type: "number" },
        inventory: { type: "number" },
        backorder: { type: "number" },
      },
      required: ["week", "inventory", "backorder"],
      additionalProperties: false,
    },
    execute: async () => ({
      week: 3,
      inventory: 6,
      backorder: 2,
    }),
  },
};

test("empty goal is rejected before any provider call", () => {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: toolRegistry,
    workflow: "decision_coach",
  });

  assert.throws(
    () =>
      orchestrator.createRun({
        goal: "",
        deadlineAt: new Date(Date.now() + 10_000).toISOString(),
      }),
    (error) => error instanceof ValidationError,
  );
});

test("valid tool execution creates a completed run with explicit reason", async () => {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: toolRegistry,
    workflow: "decision_coach",
  });

  const run = orchestrator.createRun({
    goal: "figure out this week's order recommendation",
    deadlineAt: new Date(Date.now() + 10_000).toISOString(),
  });

  const result = await orchestrator.executeRun({
    run,
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: {
        name: "getCurrentGameState",
        arguments: {},
      },
    }),
    modelStep2: async () => ({
      kind: "final",
      final: {
        summary: "Inventory is low while backorder remains active.",
        recommendation: "Order 9 units.",
        evidence: ["Current backorder is 2.", "Current inventory is 6."],
        confidence: "medium",
        completed: true,
      },
    }),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.stepCount, 2);
  assert.equal(result.finalOutput.completed, true);
  assert.equal(result.finalOutput.recommendation, "Order 9 units.");
  assert.equal(result.runId, run.runId);
});

test("unknown tool is rejected before execution", async () => {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: toolRegistry,
    workflow: "decision_coach",
  });

  const run = orchestrator.createRun({
    goal: "figure out the next move",
    deadlineAt: new Date(Date.now() + 10_000).toISOString(),
  });

  const result = await orchestrator.executeRun({
    run,
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: {
        name: "notAllowedTool",
        arguments: {},
      },
    }),
    modelStep2: async () => ({
      kind: "final",
      final: {
        summary: "Should not reach here",
        evidence: [],
        completed: true,
      },
    }),
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "unknown_tool");
  assert.equal(result.toolCallCount, 0);
});

test("tool call limit blocks additional execution", async () => {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: toolRegistry,
    workflow: "decision_coach",
    limits: {
      ...AGENT_LIMITS,
      maxToolCalls: 1,
    },
  });

  const run = orchestrator.createRun({
    goal: "test the tool budget",
    deadlineAt: new Date(Date.now() + 10_000).toISOString(),
  });

  const result = await orchestrator.executeRun({
    run,
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: {
        name: "getCurrentGameState",
        arguments: {},
      },
    }),
    modelStep2: async () => ({
      kind: "tool_request",
      toolRequest: {
        name: "getCurrentGameState",
        arguments: {},
      },
    }),
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "tool_call_limit");
  assert.equal(result.toolCallCount, 1);
});

test("final result validation rejects invalid schema", async () => {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: toolRegistry,
    workflow: "decision_coach",
  });

  const run = orchestrator.createRun({
    goal: "goal",
    deadlineAt: new Date(Date.now() + 10_000).toISOString(),
  });

  const result = await orchestrator.executeRun({
    run,
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: {
        name: "getCurrentGameState",
        arguments: {},
      },
    }),
    modelStep2: async () => ({
      kind: "final",
      final: {
        summary: "Missing required fields",
        recommendation: "too low",
        evidence: "not-an-array",
      },
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stopReason, "invalid_final_result");
});

test("createAgentRun produces a normalized initial state", () => {
  const run = createAgentRun({
    workflow: "decision_coach",
    goal: "recommend the next order",
    deadlineAt: new Date(Date.now() + 5_000).toISOString(),
  });

  assert.equal(run.workflow, "decision_coach");
  assert.equal(run.status, "created");
  assert.equal(run.goal, "recommend the next order");
  assert.equal(run.stepCount, 0);
  assert.equal(run.toolCallCount, 0);
  assert.ok(Array.isArray(run.recentActions));
});
