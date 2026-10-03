import {
  AGENT_LIMITS,
  BoundedAgentOrchestrator,
  type AgentRunState,
  type RunExecutionResult,
  type ToolDescriptor,
} from "./boundedAgent.ts";
import type { GameState } from "../game/gameEngine.ts";

export type ScenarioType = "stable" | "growth" | "seasonal" | "volatile";
export type ScenarioDifficulty = "easy" | "medium" | "hard";

export type AllowedScenarioDefinition = {
  id: ScenarioType;
  label: string;
  description: string;
};

export type AllowedScenarioTypesResult = {
  scenarios: AllowedScenarioDefinition[];
  difficulties: ScenarioDifficulty[];
};

export type ScenarioSelectionEvidence = {
  source: "allowed_scenarios";
  fact: string;
};

export type ScenarioSelectionResult = {
  summary?: string;
  scenario: ScenarioType;
  difficulty: ScenarioDifficulty;
  explanation: string;
  evidence: ScenarioSelectionEvidence[];
  confidence: "low" | "medium" | "high";
  completed: true;
};

export const ALLOWED_SCENARIOS: AllowedScenarioDefinition[] = [
  { id: "stable", label: "Stable", description: "Steady demand with little change from week to week." },
  { id: "growth", label: "Growth", description: "Demand gradually rises over the full game." },
  { id: "seasonal", label: "Seasonal", description: "Demand follows a repeating cycle with moderate swings." },
  { id: "volatile", label: "Volatile", description: "Demand swings sharply and is more difficult to predict." },
];

export const ALLOWED_DIFFICULTIES: ScenarioDifficulty[] = ["easy", "medium", "hard"];

const ALLOWED_FACTS = new Set<string>([
  ...ALLOWED_SCENARIOS.flatMap((scenario) => [scenario.id, scenario.label, scenario.description]),
  ...ALLOWED_DIFFICULTIES,
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getAllowedScenarioTypesTool(): AllowedScenarioTypesResult {
  return {
    scenarios: ALLOWED_SCENARIOS.map((scenario) => ({ ...scenario })),
    difficulties: [...ALLOWED_DIFFICULTIES],
  };
}

export function generateScenarioDemand({
  scenario,
  difficulty,
  seed = 0,
}: {
  scenario: ScenarioType;
  difficulty: ScenarioDifficulty;
  seed?: number;
}): number[] {
  const overdrive = difficulty === "easy" ? 0.85 : difficulty === "medium" ? 1 : 1.2;
  const seedOffset = Math.abs(seed % 3);

  const basePatterns: Record<ScenarioType, number[]> = {
    stable: [4, 4, 5, 4, 5, 4, 5, 4, 5, 4],
    growth: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    seasonal: [5, 4, 7, 5, 8, 5, 7, 4, 6, 8],
    volatile: [3, 8, 4, 9, 5, 11, 4, 8, 7, 10],
  };

  return basePatterns[scenario].map((value, index) => {
    const ripple = ((index + seedOffset + 1) % 3) * (difficulty === "hard" ? 1 : 0);
    const adjusted = Math.round(value * overdrive + ripple);
    return Math.max(0, adjusted);
  });
}

export function normalizeScenarioSelectionResult(input: unknown): ScenarioSelectionResult {
  if (!isPlainObject(input)) {
    throw new Error("Scenario selection result must be an object.");
  }

  const { summary, scenario, difficulty, explanation, evidence, confidence, completed } = input;

  if (scenario !== "stable" && scenario !== "growth" && scenario !== "seasonal" && scenario !== "volatile") {
    throw new Error("Scenario selection scenario must be a valid approved scenario.");
  }

  if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
    throw new Error("Scenario selection difficulty must be easy, medium, or hard.");
  }

  if (typeof explanation !== "string" || explanation.trim().length === 0) {
    throw new Error("Scenario selection explanation is required.");
  }

  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error("Scenario selection evidence must be a non-empty array.");
  }

  const normalizedEvidence = evidence.map((item) => {
    if (!isPlainObject(item) || item.source !== "allowed_scenarios" || typeof item.fact !== "string") {
      throw new Error("Scenario evidence must contain allowed_scenarios facts.");
    }

    if (!ALLOWED_FACTS.has(item.fact)) {
      throw new Error("Scenario evidence fact must match an approved scenario fact.");
    }

    return { source: "allowed_scenarios" as const, fact: item.fact };
  });

  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") {
    throw new Error("Scenario confidence must be low, medium, or high.");
  }

  if (completed !== true) {
    throw new Error("Scenario selection must be marked completed.");
  }

  return {
    summary: typeof summary === "string" && summary.trim().length > 0 ? summary : "Scenario selection is valid and approved.",
    scenario,
    difficulty,
    explanation,
    evidence: normalizedEvidence,
    confidence,
    completed: true,
  };
}

function buildScenarioGeneratorRegistry(): Record<string, ToolDescriptor> {
  return {
    getAllowedScenarioTypes: {
      name: "getAllowedScenarioTypes",
      description: "Return the trusted, approved scenario catalogue and difficulty options for a new game.",
      allowedWorkflows: ["scenario_generator"],
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
          scenarios: { type: "array" },
          difficulties: { type: "array" },
        },
        required: ["scenarios", "difficulties"],
        additionalProperties: false,
      },
      execute: () => getAllowedScenarioTypesTool(),
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

export async function executeScenarioGenerator({
  state,
  goal,
  modelStep,
  modelStep2,
}: {
  state: GameState;
  goal: string;
  modelStep: (state: AgentRunState) => Promise<unknown>;
  modelStep2: (state: AgentRunState, toolResult?: unknown) => Promise<unknown>;
}): Promise<RunExecutionResult & { finalOutput?: ScenarioSelectionResult }> {
  const orchestrator = new BoundedAgentOrchestrator({
    registry: buildScenarioGeneratorRegistry(),
    workflow: "scenario_generator",
    limits: AGENT_LIMITS,
  });

  const run = orchestrator.createRun({
    goal,
    deadlineAt: new Date(Date.now() + AGENT_LIMITS.totalDeadlineMs).toISOString(),
  });

  if (state.isComplete || state.currentWeek !== 1 || state.history.length > 0) {
    return stoppedPreflightResult(run) as RunExecutionResult & { finalOutput?: ScenarioSelectionResult };
  }

  const result = await orchestrator.executeRun({ run, modelStep, modelStep2 });
  if (!result.finalOutput) {
    return result as RunExecutionResult & { finalOutput?: ScenarioSelectionResult };
  }

  try {
    return {
      ...result,
      finalOutput: normalizeScenarioSelectionResult(result.finalOutput),
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
