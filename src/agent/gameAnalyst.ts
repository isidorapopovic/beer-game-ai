import {
  AGENT_LIMITS,
  BoundedAgentOrchestrator,
  type AgentRunState,
  type RunExecutionResult,
  type ToolDescriptor,
} from "./boundedAgent.ts";
import { getGameSummary } from "../game/gameEngine.ts";
import type { GameState } from "../game/gameEngine.ts";

export type GameHistoryWeek = {
  week: number;
  demand: number;
  order: number;
  inventory: number;
  backorder: number;
  cost: number;
  incomingShipment?: number;
};

export type GameHistoryResult = {
  totalWeeks: number;
  totalCost: number;
  weeks: GameHistoryWeek[];
};

export type GameAnalysisFindingType =
  | "bullwhip_signal"
  | "overreaction"
  | "under_ordering"
  | "over_ordering"
  | "shipping_delay_effect"
  | "cost_driver"
  | "good_decision"
  | "lesson";

export type GameAnalysisEvidence = {
  source: "game_history";
  fact: string;
};

export type GameAnalysisFinding = {
  type: GameAnalysisFindingType;
  title: string;
  explanation: string;
  weeks: number[];
  evidence: GameAnalysisEvidence[];
};

export type PostGameAnalysisResult = {
  summary: string;
  findings: GameAnalysisFinding[];
  nextGameAdvice: string[];
  confidence: "low" | "medium" | "high";
  completed: true;
};

const FINDING_TYPES = new Set<GameAnalysisFindingType>([
  "bullwhip_signal",
  "overreaction",
  "under_ordering",
  "over_ordering",
  "shipping_delay_effect",
  "cost_driver",
  "good_decision",
  "lesson",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getGameHistoryTool(state: GameState): GameHistoryResult {
  if (!state || !state.isComplete) {
    throw new Error("Game history is available only after the game is complete.");
  }

  const totalWeeks = state.config?.totalWeeks;
  if (!Number.isInteger(totalWeeks) || totalWeeks < 1 || totalWeeks > 20
    || state.currentWeek !== totalWeeks
    || !Array.isArray(state.history)
    || state.history.length !== totalWeeks) {
    throw new Error("Completed game history has an invalid length or week count.");
  }

  const weeks = state.history.map((entry, index): GameHistoryWeek => {
    if (!isPlainObject(entry) || entry.week !== index + 1) {
      throw new Error("Game history weeks must be sequential and complete.");
    }

    const values = {
      demand: entry.demand,
      order: entry.order,
      inventory: entry.inventory,
      backorder: entry.backorders,
      cost: entry.weeklyCost,
      incomingShipment: entry.incomingShipment,
    };

    for (const [name, value] of Object.entries(values)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(`Game history ${name} must be a finite non-negative number.`);
      }
    }

    return {
      week: entry.week as number,
      demand: values.demand as number,
      order: values.order as number,
      inventory: values.inventory as number,
      backorder: values.backorder as number,
      cost: values.cost as number,
      incomingShipment: values.incomingShipment as number,
    };
  });

  const totalCost = getGameSummary(state).totalCost;
  const historyCost = weeks.reduce((total, week) => total + week.cost, 0);
  if (!Number.isFinite(totalCost) || totalCost < 0 || Math.abs(totalCost - historyCost) > 1e-8) {
    throw new Error("Completed game total cost does not match its history.");
  }

  const result = { totalWeeks, totalCost, weeks };
  const resultBytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
  if (resultBytes > AGENT_LIMITS.maxToolResultBytes) {
    throw new Error("Game history exceeds the tool result size limit.");
  }

  return result;
}

export function formatGameHistoryFact(week: GameHistoryWeek, field: keyof GameHistoryWeek): string {
  switch (field) {
    case "demand":
      return `Week ${week.week} demand was ${week.demand} units.`;
    case "order":
      return `Week ${week.week} retailer order was ${week.order} units.`;
    case "inventory":
      return `Week ${week.week} ending inventory was ${week.inventory} units.`;
    case "backorder":
      return `Week ${week.week} ending backorder was ${week.backorder} units.`;
    case "cost":
      return `Week ${week.week} cost was ${week.cost}.`;
    case "incomingShipment":
      return `Week ${week.week} incoming shipment was ${week.incomingShipment} units.`;
    default:
      throw new Error("Unsupported game-history evidence field.");
  }
}

export function normalizePostGameAnalysis(
  input: unknown,
  history: GameHistoryResult,
): PostGameAnalysisResult {
  if (!isPlainObject(input)) {
    throw new Error("Post-game analysis must be an object.");
  }
  if (typeof input.summary !== "string" || input.summary.trim().length === 0) {
    throw new Error("Post-game summary is required.");
  }
  if (!Array.isArray(input.findings) || input.findings.length === 0 || input.findings.length > 6) {
    throw new Error("Post-game analysis must contain between one and six findings.");
  }

  const weekByNumber = new Map(history.weeks.map((week) => [week.week, week]));
  const allFacts = new Set(history.weeks.flatMap((week) => [
    formatGameHistoryFact(week, "demand"),
    formatGameHistoryFact(week, "order"),
    formatGameHistoryFact(week, "inventory"),
    formatGameHistoryFact(week, "backorder"),
    formatGameHistoryFact(week, "cost"),
    formatGameHistoryFact(week, "incomingShipment"),
  ]));

  const findings = input.findings.map((entry): GameAnalysisFinding => {
    if (!isPlainObject(entry)
      || typeof entry.type !== "string"
      || !FINDING_TYPES.has(entry.type as GameAnalysisFindingType)
      || typeof entry.title !== "string"
      || entry.title.trim().length === 0
      || typeof entry.explanation !== "string"
      || entry.explanation.trim().length === 0) {
      throw new Error("Each finding must have a valid type, title, and explanation.");
    }

    if (/bullwhip\s+(ratio|coefficient|metric|index)/i.test(`${entry.title} ${entry.explanation}`)) {
      throw new Error("Bullwhip findings cannot claim an uncalculated mathematical metric.");
    }

    if (!Array.isArray(entry.weeks) || entry.weeks.length === 0
      || entry.weeks.some((week) => !Number.isInteger(week) || !weekByNumber.has(week as number))) {
      throw new Error("Finding weeks must reference weeks in the completed game.");
    }
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
      throw new Error("Each finding requires verified game-history evidence.");
    }

    const weeks = [...new Set(entry.weeks as number[])];
    const evidence = entry.evidence.map((item): GameAnalysisEvidence => {
      if (!isPlainObject(item)
        || item.source !== "game_history"
        || typeof item.fact !== "string"
        || !allFacts.has(item.fact)) {
        throw new Error("Finding evidence must match an exact fact from game history.");
      }
      const factWeek = Number(item.fact.match(/^Week (\d+)/)?.[1]);
      if (!weeks.includes(factWeek)) {
        throw new Error("Evidence week must be listed in the finding.");
      }
      return { source: "game_history", fact: item.fact };
    });

    return {
      type: entry.type as GameAnalysisFindingType,
      title: entry.title,
      explanation: entry.explanation,
      weeks,
      evidence,
    };
  });

  if (!Array.isArray(input.nextGameAdvice) || input.nextGameAdvice.length === 0 || input.nextGameAdvice.length > 4
    || input.nextGameAdvice.some((advice) => typeof advice !== "string" || advice.trim().length === 0)) {
    throw new Error("Next-game advice must contain one to four non-empty items.");
  }
  if (input.confidence !== "low" && input.confidence !== "medium" && input.confidence !== "high") {
    throw new Error("Post-game confidence must be low, medium, or high.");
  }
  if (input.completed !== true) {
    throw new Error("Post-game analysis must be marked completed.");
  }

  return {
    summary: input.summary,
    findings,
    nextGameAdvice: input.nextGameAdvice as string[],
    confidence: input.confidence,
    completed: true,
  };
}

function buildGameAnalystRegistry(state: GameState): Record<string, ToolDescriptor> {
  return {
    getGameHistory: {
      name: "getGameHistory",
      description: "Read the verified, completed retailer game history for analysis.",
      allowedWorkflows: ["game_analyst"],
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
          totalWeeks: { type: "number" },
          totalCost: { type: "number" },
          weeks: { type: "array" },
        },
        required: ["totalWeeks", "totalCost", "weeks"],
        additionalProperties: false,
      },
      execute: () => getGameHistoryTool(state),
    },
  };
}

function stoppedPreflightResult(run: AgentRunState): RunExecutionResult {
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

export async function executeGameAnalyst({
  state,
  goal,
  modelStep,
  modelStep2,
}: {
  state: GameState;
  goal: string;
  modelStep: (state: AgentRunState) => Promise<unknown>;
  modelStep2: (state: AgentRunState, toolResult?: unknown) => Promise<unknown>;
}): Promise<RunExecutionResult & { finalOutput?: PostGameAnalysisResult }> {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: buildGameAnalystRegistry(state),
    workflow: "game_analyst",
    limits: AGENT_LIMITS,
  });
  const run = orchestrator.createRun({
    goal,
    deadlineAt: new Date(Date.now() + AGENT_LIMITS.totalDeadlineMs).toISOString(),
  });

  let history: GameHistoryResult;
  try {
    history = getGameHistoryTool(state);
  } catch {
    return stoppedPreflightResult(run) as RunExecutionResult & { finalOutput?: PostGameAnalysisResult };
  }

  const result = await orchestrator.executeRun({ run, modelStep, modelStep2 });
  if (!result.finalOutput) {
    return result as RunExecutionResult & { finalOutput?: PostGameAnalysisResult };
  }

  try {
    return {
      ...result,
      finalOutput: normalizePostGameAnalysis(result.finalOutput, history),
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