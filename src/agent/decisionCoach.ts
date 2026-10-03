import { BoundedAgentOrchestrator, AGENT_LIMITS, type AgentRunState, type RunExecutionResult, type StopReason, type ToolDescriptor, type WorkflowId } from "./boundedAgent.ts";
import type { GameState } from "../game/gameEngine.ts";

export type DecisionCoachEvidence = {
  source: "game_state";
  fact: string;
};

export type DecisionCoachResult = {
  summary: string;
  recommendation: string;
  recommendedOrderQuantity: number;
  evidence: DecisionCoachEvidence[];
  confidence: "low" | "medium" | "high";
  completed: true;
};

export type CurrentGameStateToolResult = {
  week: number;
  inventory: number;
  backorder: number;
  incomingShipments: number[];
  recentDemand: number[];
  recentOrders: number[];
  totalCost: number;
};

export function getCurrentGameStateTool(state: GameState): CurrentGameStateToolResult {
  const history = state.history.slice(-5);
  const recentDemand = history.map((entry) => entry.demand);
  const recentOrders = history.map((entry) => entry.incomingShipment);

  return {
    week: state.currentWeek,
    inventory: state.inventory,
    backorder: state.backorders,
    incomingShipments: state.shipments
      .slice()
      .sort((first, second) => first.arrivalWeek - second.arrivalWeek)
      .map((shipment) => shipment.quantity),
    recentDemand: recentDemand.length > 0 ? recentDemand : [state.customerDemand],
    recentOrders: recentOrders.length > 0 ? recentOrders : [state.previousOrder],
    totalCost: state.history.reduce((total, entry) => total + entry.weeklyCost, 0) + state.currentWeekResult.weeklyCost,
  };
}

export function normalizeDecisionCoachResult(input: unknown): DecisionCoachResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Decision coach result must be an object.");
  }

  const result = input as Record<string, unknown>;

  if (typeof result.summary !== "string" || result.summary.trim().length === 0) {
    throw new Error("Decision coach summary is required.");
  }

  if (typeof result.recommendation !== "string" || result.recommendation.trim().length === 0) {
    throw new Error("Decision coach recommendation is required.");
  }

  if (typeof result.recommendedOrderQuantity !== "number" || !Number.isInteger(result.recommendedOrderQuantity)) {
    throw new Error("Decision coach recommendedOrderQuantity must be an integer.");
  }

  if (result.recommendedOrderQuantity < 0 || result.recommendedOrderQuantity > 50) {
    throw new Error("Decision coach recommendedOrderQuantity must be between 0 and 50.");
  }

  if (!Array.isArray(result.evidence)) {
    throw new Error("Decision coach evidence must be an array.");
  }

  const evidence = result.evidence.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("Each evidence item must be an object.");
    }

    const item = entry as Record<string, unknown>;

    if (item.source !== "game_state" || typeof item.fact !== "string") {
      throw new Error("Each evidence item must have a valid game_state fact.");
    }

    return { source: "game_state" as const, fact: item.fact };
  });

  const confidence = result.confidence;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") {
    throw new Error("Decision coach confidence must be low, medium, or high.");
  }

  if (result.completed !== true) {
    throw new Error("Decision coach final result must be marked completed.");
  }

  return {
    summary: result.summary as string,
    recommendation: result.recommendation as string,
    recommendedOrderQuantity: result.recommendedOrderQuantity as number,
    evidence,
    confidence,
    completed: true,
  };
}

function buildDecisionCoachRegistry(state: GameState): Record<string, ToolDescriptor> {
  return {
    getCurrentGameState: {
      name: "getCurrentGameState",
      description: "Read a verified snapshot of the current retailer game state.",
      allowedWorkflows: ["decision_coach"],
      mode: "read_only",
      argsSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
      resultSchema: {
        type: "object",
        properties: {
          week: { type: "number" },
          inventory: { type: "number" },
          backorder: { type: "number" },
          incomingShipments: { type: "array" },
          recentDemand: { type: "array" },
          recentOrders: { type: "array" },
          totalCost: { type: "number" },
        },
        required: ["week", "inventory", "backorder", "incomingShipments", "recentDemand", "recentOrders", "totalCost"],
        additionalProperties: false,
      },
      execute: (args: unknown) => {
        const providedState = args && typeof args === "object" && "state" in (args as Record<string, unknown>)
          ? (args as { state: GameState }).state
          : state;

        return getCurrentGameStateTool(providedState);
      },
    },
  };
}

export type DecisionCoachRunResult = {
  runId: string;
  workflow: WorkflowId;
  status: "completed" | "stopped" | "failed";
  stopReason?: StopReason;
  stepCount: number;
  toolCallCount: number;
  finalOutput: DecisionCoachResult;
  run: AgentRunState;
};

export function createDecisionCoachRun({
  state,
  goal,
}: {
  state: GameState;
  goal: string;
}) {
  if (state.isComplete) {
    throw new Error("Decision Coach is unavailable for a completed game.");
  }

  const orchestrator = new BoundedAgentOrchestrator({
    registry: buildDecisionCoachRegistry(state),
    workflow: "decision_coach",
    limits: AGENT_LIMITS,
  });

  return orchestrator.createRun({
    goal,
    deadlineAt: new Date(Date.now() + AGENT_LIMITS.totalDeadlineMs).toISOString(),
  });
}

export async function executeDecisionCoach({
  state,
  goal,
  modelStep,
  modelStep2,
}: {
  state: GameState;
  goal: string;
  modelStep: (state: AgentRunState) => Promise<unknown>;
  modelStep2: (state: AgentRunState, toolResult?: unknown) => Promise<unknown>;
}): Promise<RunExecutionResult & { finalOutput?: DecisionCoachResult }> {
  if (state.isComplete) {
    const run = { 
      runId: `run_${globalThis.crypto.randomUUID()}`,
      workflow: "decision_coach" as const,
      status: "stopped" as const,
      goal,
      stepCount: 0,
      toolCallCount: 0,
      startedAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + AGENT_LIMITS.totalDeadlineMs).toISOString(),
      recentActions: ["preflight_rejected"],
      stopReason: "preflight_rejected" as const,
    };

    return {
      runId: run.runId,
      workflow: run.workflow,
      status: run.status,
      stopReason: run.stopReason,
      stepCount: run.stepCount,
      toolCallCount: run.toolCallCount,
      run,
    };
  }

  const orchestrator = new BoundedAgentOrchestrator({
    registry: buildDecisionCoachRegistry(state),
    workflow: "decision_coach",
    limits: AGENT_LIMITS,
  });

  const run = orchestrator.createRun({
    goal,
    deadlineAt: new Date(Date.now() + AGENT_LIMITS.totalDeadlineMs).toISOString(),
  });

  const runResult = await orchestrator.executeRun({
    run,
    modelStep: async (currentRun) => {
      const result = await modelStep(currentRun);
      if (result && typeof result === "object" && "kind" in (result as Record<string, unknown>)) {
        return result;
      }
      return { kind: "tool_request", toolRequest: { name: "getCurrentGameState", arguments: { state } } };
    },
    modelStep2: async (currentRun, toolResult) => {
      return await modelStep2(currentRun, toolResult);
    },
  });

  if (runResult.finalOutput) {
    try {
      const normalized = normalizeDecisionCoachResult(runResult.finalOutput);
      return {
        ...runResult,
        finalOutput: normalized,
      };
    } catch {
      return {
        ...runResult,
        status: "failed",
        stopReason: "invalid_final_result",
        finalOutput: undefined,
        run: {
          ...runResult.run,
          status: "failed",
          stopReason: "invalid_final_result",
        },
      };
    }
  }

  return runResult as RunExecutionResult & { finalOutput?: DecisionCoachResult };
}
