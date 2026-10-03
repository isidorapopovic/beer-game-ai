export const AGENT_LIMITS = {
  maxSteps: 4,
  maxToolCalls: 2,
  maxRetriesPerStep: 1,
  totalDeadlineMs: 20_000,
  maxToolResultBytes: 50_000,
} as const;

export type WorkflowId =
  | "decision_coach"
  | "candidate_order_simulation"
  | "game_analyst"
  | "scenario_generator";

export type RunStatus = "created" | "running" | "completed" | "stopped" | "failed";

export type StopReason =
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
  | "cancelled"
  | "invalid_final_result";

export type ToolMode = "read_only" | "deterministic_non_mutating";

export type ToolDescriptor = {
  name: string;
  description: string;
  allowedWorkflows: WorkflowId[];
  mode: ToolMode;
  argsSchema: unknown;
  resultSchema: unknown;
  execute: (args: unknown) => unknown | Promise<unknown>;
};

export type AgentRunState = {
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

export type StepKind =
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

export type RunExecutionResult = {
  runId: string;
  workflow: WorkflowId;
  status: RunStatus;
  stopReason?: StopReason;
  stepCount: number;
  toolCallCount: number;
  finalOutput?: Record<string, unknown>;
  run: AgentRunState;
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnknownToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownToolError";
  }
}

export function createAgentRun({
  workflow,
  goal,
  deadlineAt,
}: {
  workflow: WorkflowId;
  goal: string;
  deadlineAt: string;
}): AgentRunState {
  if (!goal || !goal.trim()) {
    throw new ValidationError("Agent goal cannot be empty.");
  }

  return {
    runId: `run_${globalThis.crypto.randomUUID()}`,
    workflow,
    status: "created",
    goal: goal.trim(),
    stepCount: 0,
    toolCallCount: 0,
    startedAt: new Date().toISOString(),
    deadlineAt,
    recentActions: ["created"],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateFinalResult(output: unknown): Record<string, unknown> {
  if (!isPlainObject(output)) {
    throw new ValidationError("Final result must be an object.");
  }

  const summary = output.summary;
  const evidence = output.evidence;
  const completed = output.completed;

  if (typeof summary !== "string" || summary.trim().length === 0) {
    throw new ValidationError("Final result summary must be a non-empty string.");
  }

  if (!Array.isArray(evidence)) {
    throw new ValidationError("Final result evidence must be an array.");
  }

  if (typeof completed !== "boolean") {
    throw new ValidationError("Final result completed flag must be boolean.");
  }

  if (output.confidence !== undefined && !["low", "medium", "high"].includes(String(output.confidence))) {
    throw new ValidationError("Final result confidence must be low, medium, or high.");
  }

  if (output.recommendation !== undefined && typeof output.recommendation !== "string") {
    throw new ValidationError("Final result recommendation must be a string when present.");
  }

  return output as Record<string, unknown>;
}

function validateToolProposal(proposal: unknown): StepKind {
  if (!isPlainObject(proposal)) {
    throw new ValidationError("Model proposal must be an object.");
  }

  if (proposal.kind === "tool_request") {
    if (!isPlainObject(proposal.toolRequest)) {
      throw new ValidationError("Tool request requires a toolRequest object.");
    }

    const name = proposal.toolRequest.name;
    const argumentsValue = proposal.toolRequest.arguments;

    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("Tool request name must be a non-empty string.");
    }

    return {
      kind: "tool_request",
      toolRequest: {
        name,
        arguments: argumentsValue,
      },
    };
  }

  if (proposal.kind === "final") {
    if (!isPlainObject(proposal.final)) {
      throw new ValidationError("Final result must be an object.");
    }

    return {
      kind: "final",
      final: proposal.final,
    };
  }

  if (proposal.kind === "refusal") {
    return { kind: "refusal" };
  }

  throw new ValidationError("Model proposal kind is unsupported.");
}

function validateToolResult(toolResult: unknown, resultSchema: unknown): unknown {
  if (resultSchema && typeof resultSchema === "object") {
    const schema = resultSchema as {
      type?: string;
      required?: string[];
      properties?: Record<string, { type?: string }>;
      additionalProperties?: boolean;
    };

    if (schema.type === "object" && !isPlainObject(toolResult)) {
      throw new ValidationError("Tool output did not match the expected object schema.");
    }

    if (schema.properties) {
      for (const [key, definition] of Object.entries(schema.properties)) {
        const value = isPlainObject(toolResult) ? (toolResult as Record<string, unknown>)[key] : undefined;

        if (schema.required?.includes(key) && value === undefined) {
          throw new ValidationError(`Tool output field ${key} is required.`);
        }

        const type = definition?.type;
        if (type === "number" && value !== undefined && !isFiniteNumber(value)) {
          throw new ValidationError(`Tool output field ${key} must be a finite number.`);
        }
        if (type === "string" && value !== undefined && typeof value !== "string") {
          throw new ValidationError(`Tool output field ${key} must be a string.`);
        }
      }
    }
  }

  return toolResult;
}

export class BoundedAgentOrchestrator {
  readonly registry: Record<string, ToolDescriptor>;
  readonly workflow: WorkflowId;
  readonly limits: typeof AGENT_LIMITS;

  constructor({
    registry,
    workflow,
    limits = AGENT_LIMITS,
  }: {
    registry: Record<string, ToolDescriptor>;
    workflow: WorkflowId;
    limits?: typeof AGENT_LIMITS;
  }) {
    this.registry = registry;
    this.workflow = workflow;
    this.limits = limits;
  }

  createRun({
    goal,
    deadlineAt,
  }: {
    goal: string;
    deadlineAt: string;
  }): AgentRunState {
    return createAgentRun({ workflow: this.workflow, goal, deadlineAt });
  }

  async executeRun({
    run,
    modelStep,
    modelStep2,
  }: {
    run: AgentRunState;
    modelStep: (state: AgentRunState) => Promise<unknown>;
    modelStep2: (state: AgentRunState, toolResult?: unknown) => Promise<unknown>;
  }): Promise<RunExecutionResult> {
    if (!run.goal || !run.goal.trim()) {
      return {
        runId: run.runId,
        workflow: run.workflow,
        status: "stopped",
        stopReason: "preflight_rejected",
        stepCount: run.stepCount,
        toolCallCount: run.toolCallCount,
        run: { ...run, status: "stopped", stopReason: "preflight_rejected" },
      };
    }

    const workingRun: AgentRunState = {
      ...run,
      status: "running",
      recentActions: [...run.recentActions, "run_started"],
    };

    try {
      const firstResponse = await modelStep(workingRun);
      const proposal = validateToolProposal(firstResponse);
      workingRun.stepCount += 1;

      if (proposal.kind === "refusal") {
        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "stopped",
          stopReason: "completed",
          stepCount: workingRun.stepCount,
          toolCallCount: workingRun.toolCallCount,
          run: { ...workingRun, status: "stopped", stopReason: "completed" },
        };
      }

      if (proposal.kind === "final") {
        const finalOutput = validateFinalResult(proposal.final);
        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "completed",
          stopReason: "completed",
          stepCount: workingRun.stepCount,
          toolCallCount: workingRun.toolCallCount,
          finalOutput,
          run: {
            ...workingRun,
            status: "completed",
            stopReason: "completed",
            recentActions: [...workingRun.recentActions, "final_result_validated"],
          },
        };
      }

      const toolName = proposal.toolRequest.name;
      const tool = this.registry[toolName];

      if (!tool) {
        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "stopped",
          stopReason: "unknown_tool",
          stepCount: workingRun.stepCount,
          toolCallCount: workingRun.toolCallCount,
          run: {
            ...workingRun,
            status: "stopped",
            stopReason: "unknown_tool",
            recentActions: [...workingRun.recentActions, `unknown_tool:${toolName}`],
          },
        };
      }

      if (!tool.allowedWorkflows.includes(this.workflow)) {
        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "stopped",
          stopReason: "unknown_tool",
          stepCount: workingRun.stepCount,
          toolCallCount: workingRun.toolCallCount,
          run: {
            ...workingRun,
            status: "stopped",
            stopReason: "unknown_tool",
            recentActions: [...workingRun.recentActions, `tool_not_allowed:${toolName}`],
          },
        };
      }

      if (workingRun.toolCallCount >= this.limits.maxToolCalls) {
        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "stopped",
          stopReason: "tool_call_limit",
          stepCount: workingRun.stepCount,
          toolCallCount: workingRun.toolCallCount,
          run: {
            ...workingRun,
            status: "stopped",
            stopReason: "tool_call_limit",
            recentActions: [...workingRun.recentActions, "tool_call_limit_reached"],
          },
        };
      }

      let validatedResult: unknown;
      try {
        const toolResult = await tool.execute(proposal.toolRequest.arguments);
        validatedResult = validateToolResult(toolResult, tool.resultSchema);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed.";
        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "failed",
          stopReason: "invalid_tool_result",
          stepCount: workingRun.stepCount,
          toolCallCount: workingRun.toolCallCount,
          run: {
            ...workingRun,
            status: "failed",
            stopReason: "invalid_tool_result",
            recentActions: [...workingRun.recentActions, `invalid_tool_result:${message}`],
          },
        };
      }

      workingRun.toolCallCount += 1;
      workingRun.lastToolResult = validatedResult;
      workingRun.recentActions = [...workingRun.recentActions, `tool_executed:${toolName}`];

      let secondProposal: StepKind;
      try {
        const secondResponse = await modelStep2(workingRun, validatedResult);
        secondProposal = validateToolProposal(secondResponse);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Model returned invalid second-step output.";
        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "failed",
          stopReason: "invalid_model_proposal",
          stepCount: workingRun.stepCount + 1,
          toolCallCount: workingRun.toolCallCount,
          run: {
            ...workingRun,
            status: "failed",
            stopReason: "invalid_model_proposal",
            recentActions: [...workingRun.recentActions, `second_step_invalid:${message}`],
          },
        };
      }

      workingRun.stepCount += 1;

      if (secondProposal.kind === "final") {
        try {
          const finalOutput = validateFinalResult(secondProposal.final);
          return {
            runId: workingRun.runId,
            workflow: workingRun.workflow,
            status: "completed",
            stopReason: "completed",
            stepCount: workingRun.stepCount,
            toolCallCount: workingRun.toolCallCount,
            finalOutput,
            run: {
              ...workingRun,
              status: "completed",
              stopReason: "completed",
              recentActions: [...workingRun.recentActions, "final_result_validated"],
            },
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Final result invalid.";
          return {
            runId: workingRun.runId,
            workflow: workingRun.workflow,
            status: "failed",
            stopReason: "invalid_final_result",
            stepCount: workingRun.stepCount,
            toolCallCount: workingRun.toolCallCount,
            run: {
              ...workingRun,
              status: "failed",
              stopReason: "invalid_final_result",
              recentActions: [...workingRun.recentActions, `invalid_final_result:${message}`],
            },
          };
        }
      }

      if (secondProposal.kind === "tool_request") {
        if (workingRun.toolCallCount >= this.limits.maxToolCalls) {
          return {
            runId: workingRun.runId,
            workflow: workingRun.workflow,
            status: "stopped",
            stopReason: "tool_call_limit",
            stepCount: workingRun.stepCount,
            toolCallCount: workingRun.toolCallCount,
            run: {
              ...workingRun,
              status: "stopped",
              stopReason: "tool_call_limit",
              recentActions: [...workingRun.recentActions, "tool_call_limit_reached"],
            },
          };
        }

        return {
          runId: workingRun.runId,
          workflow: workingRun.workflow,
          status: "stopped",
          stopReason: "step_limit",
          stepCount: workingRun.stepCount,
          toolCallCount: workingRun.toolCallCount,
          run: {
            ...workingRun,
            status: "stopped",
            stopReason: "step_limit",
            recentActions: [...workingRun.recentActions, "unexpected_second_tool_request"],
          },
        };
      }

      return {
        runId: workingRun.runId,
        workflow: workingRun.workflow,
        status: "failed",
        stopReason: "invalid_final_result",
        stepCount: workingRun.stepCount,
        toolCallCount: workingRun.toolCallCount,
        run: {
          ...workingRun,
          status: "failed",
          stopReason: "invalid_final_result",
          recentActions: [...workingRun.recentActions, "final_result_invalid"],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent run failed.";
      const status = error instanceof UnknownToolError ? "stopped" : "failed";
      const reason = error instanceof UnknownToolError
        ? "unknown_tool"
        : error instanceof ValidationError
          ? "invalid_model_proposal"
          : "provider_failed";

      return {
        runId: run.runId,
        workflow: run.workflow,
        status,
        stopReason: reason,
        stepCount: workingRun.stepCount,
        toolCallCount: workingRun.toolCallCount,
        run: {
          ...workingRun,
          status,
          stopReason: reason,
          recentActions: [...workingRun.recentActions, message],
        },
      };
    }
  }
}
