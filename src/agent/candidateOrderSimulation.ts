import {
  AGENT_LIMITS,
  BoundedAgentOrchestrator,
  type AgentRunState,
  type RunExecutionResult,
  type ToolDescriptor,
} from "./boundedAgent.ts";
import { getOrderArrivalWeek, submitOrder } from "../game/gameEngine.ts";
import type { GameState } from "../game/gameEngine.ts";

export type CandidateOrderSimulationResult = {
  orderQuantity: number;
  candidateShipmentArrivalWeek?: number;
  knownIncomingShipmentNextWeek?: number;
  assumptions: string[];
};

export type CandidateOrderEvidence = {
  source: "candidate_order_simulation";
  fact: string;
};

export type CandidateOrderAdviceResult = {
  summary: string;
  recommendation: string;
  recommendedOrderQuantity: number;
  simulation: CandidateOrderSimulationResult;
  evidence: CandidateOrderEvidence[];
  confidence: "low" | "medium" | "high";
  completed: true;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function simulateCandidateOrder(
  state: GameState,
  args: unknown,
): CandidateOrderSimulationResult {
  if (!isPlainObject(args) || Object.keys(args).length !== 1 || !Object.hasOwn(args, "orderQuantity")) {
    throw new Error("Candidate order arguments must contain only orderQuantity.");
  }

  const orderQuantity = args.orderQuantity;
  if (typeof orderQuantity !== "number" || !Number.isInteger(orderQuantity) || !Number.isFinite(orderQuantity)) {
    throw new Error("Candidate order quantity must be a finite integer.");
  }
  if (orderQuantity < 0 || orderQuantity > 50) {
    throw new Error("Candidate order quantity must be between 0 and 50.");
  }
  if (!state || typeof state !== "object" || state.isComplete || state.currentWeek > state.config.totalWeeks) {
    throw new Error("Candidate order simulation requires an active game.");
  }

  const hasNextWeek = state.currentWeek < state.config.totalWeeks;
  const isolatedNextState = submitOrder(structuredClone(state), orderQuantity);

  return {
    orderQuantity,
    ...(hasNextWeek
      ? {
          candidateShipmentArrivalWeek: getOrderArrivalWeek(state.currentWeek, state.config),
          knownIncomingShipmentNextWeek: isolatedNextState.currentWeekResult.incomingShipment,
        }
      : {}),
    assumptions: [
      "The real game state was not mutated.",
      "The existing order submission and shipping-delay rules were used.",
      "Inventory, backorders, and cost are not projected because future demand is not part of this simulation result.",
      ...(hasNextWeek ? [] : ["The game ends after this order, so the candidate shipment will not arrive during the game."]),
    ],
  };
}

function buildCandidateOrderRegistry(state: GameState): Record<string, ToolDescriptor> {
  return {
    simulateCandidateOrder: {
      name: "simulateCandidateOrder",
      description: "Validate a candidate order and return deterministic shipment consequences without changing the game.",
      allowedWorkflows: ["candidate_order_simulation"],
      mode: "deterministic_non_mutating",
      argsSchema: {
        type: "object",
        properties: { orderQuantity: { type: "integer", minimum: 0, maximum: 50 } },
        required: ["orderQuantity"],
        additionalProperties: false,
      },
      resultSchema: {
        type: "object",
        properties: {
          orderQuantity: { type: "number" },
          candidateShipmentArrivalWeek: { type: "number" },
          knownIncomingShipmentNextWeek: { type: "number" },
          assumptions: { type: "array" },
        },
        required: ["orderQuantity", "assumptions"],
        additionalProperties: false,
      },
      execute: (args: unknown) => simulateCandidateOrder(state, args),
    },
  };
}

export function normalizeCandidateOrderAdvice(
  input: unknown,
  verifiedSimulation: CandidateOrderSimulationResult,
): CandidateOrderAdviceResult {
  if (!isPlainObject(input)) {
    throw new Error("Candidate order advice must be an object.");
  }

  if (typeof input.summary !== "string" || input.summary.trim().length === 0) {
    throw new Error("Candidate order summary is required.");
  }
  if (typeof input.recommendation !== "string" || input.recommendation.trim().length === 0) {
    throw new Error("Candidate order recommendation is required.");
  }
  if (input.recommendedOrderQuantity !== verifiedSimulation.orderQuantity) {
    throw new Error("Recommendation quantity must match the simulated candidate order.");
  }

  const simulation = input.simulation;
  if (!isPlainObject(simulation)
    || simulation.orderQuantity !== verifiedSimulation.orderQuantity
    || simulation.candidateShipmentArrivalWeek !== verifiedSimulation.candidateShipmentArrivalWeek
    || simulation.knownIncomingShipmentNextWeek !== verifiedSimulation.knownIncomingShipmentNextWeek
    || JSON.stringify(simulation.assumptions) !== JSON.stringify(verifiedSimulation.assumptions)) {
    throw new Error("Final simulation must match the verified candidate-order result.");
  }

  if (!Array.isArray(input.evidence)) {
    throw new Error("Candidate order evidence must be an array.");
  }
  const evidence = input.evidence.map((entry) => {
    if (!isPlainObject(entry)
      || entry.source !== "candidate_order_simulation"
      || typeof entry.fact !== "string"
      || entry.fact.trim().length === 0) {
      throw new Error("Candidate order evidence must contain simulation facts.");
    }
    return { source: "candidate_order_simulation" as const, fact: entry.fact };
  });

  if (input.confidence !== "low" && input.confidence !== "medium" && input.confidence !== "high") {
    throw new Error("Candidate order confidence must be low, medium, or high.");
  }
  if (input.completed !== true) {
    throw new Error("Candidate order advice must be marked completed.");
  }

  return {
    summary: input.summary,
    recommendation: input.recommendation,
    recommendedOrderQuantity: verifiedSimulation.orderQuantity,
    simulation: verifiedSimulation,
    evidence,
    confidence: input.confidence,
    completed: true,
  };
}

export async function executeCandidateOrderSimulation({
  state,
  goal,
  modelStep,
  modelStep2,
}: {
  state: GameState;
  goal: string;
  modelStep: (state: AgentRunState) => Promise<unknown>;
  modelStep2: (state: AgentRunState, toolResult?: unknown) => Promise<unknown>;
}): Promise<RunExecutionResult & { finalOutput?: CandidateOrderAdviceResult }> {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: buildCandidateOrderRegistry(state),
    workflow: "candidate_order_simulation",
    limits: AGENT_LIMITS,
  });
  const run = orchestrator.createRun({
    goal,
    deadlineAt: new Date(Date.now() + AGENT_LIMITS.totalDeadlineMs).toISOString(),
  });

  if (state.isComplete) {
    const stoppedRun = { ...run, status: "stopped" as const, stopReason: "preflight_rejected" as const };
    return {
      runId: run.runId,
      workflow: run.workflow,
      status: "stopped",
      stopReason: "preflight_rejected",
      stepCount: 0,
      toolCallCount: 0,
      run: stoppedRun,
    };
  }

  const result = await orchestrator.executeRun({
    run,
    modelStep,
    modelStep2,
  });

  if (!result.finalOutput) {
    return result as RunExecutionResult & { finalOutput?: CandidateOrderAdviceResult };
  }

  try {
    const verifiedSimulation = simulateCandidateOrder(state, {
      orderQuantity: result.finalOutput.recommendedOrderQuantity,
    });
    return {
      ...result,
      finalOutput: normalizeCandidateOrderAdvice(result.finalOutput, verifiedSimulation),
    };
  } catch {
    return {
      ...result,
      status: "failed",
      stopReason: "invalid_final_result",
      finalOutput: undefined,
      run: { ...result.run, status: "failed", stopReason: "invalid_final_result" },
    };
  }
}