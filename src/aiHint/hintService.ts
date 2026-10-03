import type { GameState } from "../game/gameEngine.ts";
import {
  AI_HINT_CALLER,
  ALLOWED_AI_TOOLS,
  HintFlowError,
  SAFE_HINT_FALLBACK,
  validateGameStateSnapshot,
  validateHintResponse,
  validateToolProposal,
} from "./contracts.ts";
import type {
  GamePhase,
  GameStateSnapshot,
  HintResponse,
  HintStatus,
  ModelName,
  ToolProposal,
} from "./contracts.ts";
import { getGamePhase, projectGameStateSnapshot } from "./getGameStateTool.ts";

export const PRIMARY_MODEL: ModelName = "gpt-6-luna";
export const FALLBACK_MODEL: ModelName = "gpt-6.1-sol";
export const HINT_TIMEOUT_MS = 4_000;
export const MAX_TOOL_ATTEMPTS = 2;
export const MAX_MODEL_CALLS = 2;

export type ToolClientRequest = {
  requestId: string;
  signal: AbortSignal;
};

export type HintModelRequest = {
  model: ModelName;
  phase: GamePhase;
  reasoningEffort: "low" | "medium";
  maxOutputTokens: number;
  requestId: string;
  snapshot?: GameStateSnapshot;
  invokeTool: (proposal: unknown) => Promise<GameStateSnapshot>;
  signal: AbortSignal;
};

export interface HintModelClient {
  complete(request: HintModelRequest): Promise<unknown>;
}

export type HintTelemetry = {
  operation: "game.hint.state";
  status: HintStatus;
  requestId: string;
  attempts: number;
  latencyMs: number;
};

export type HintFlowResult = {
  requestId: string;
  status: HintStatus;
  response: HintResponse | null;
  message: string;
  modelCalls: number;
  models: ModelName[];
  toolCallCount: number;
  attempts: number;
  fallbackReason?: HintStatus;
  telemetry: HintTelemetry;
};

export type RequestHintOptions = {
  state: GameState;
  caller: unknown;
  modelClient: HintModelClient;
  readGameState: (
    proposal: ToolProposal,
    request: ToolClientRequest,
  ) => unknown | Promise<unknown>;
  timeoutMs?: number;
  signal?: AbortSignal;
  requestIdFactory?: () => string;
};

function makeRequestId(): string {
  return `req_hint_${globalThis.crypto.randomUUID()}`;
}

function errorStatus(error: unknown, fallback: HintStatus): HintStatus {
  return error instanceof HintFlowError ? error.status : fallback;
}

function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  if (parentSignal?.aborted) {
    return Promise.reject(new HintFlowError("CANCELLED", "Request cancelled."));
  }

  const controller = new AbortController();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", onParentAbort);
      callback();
    };
    const onParentAbort = () => {
      controller.abort();
      finish(() => reject(new HintFlowError("CANCELLED", "Request cancelled.")));
    };
    const timeout = setTimeout(() => {
      controller.abort();
      finish(() => reject(new HintFlowError("TIMEOUT", "Request timed out.")));
    }, timeoutMs);

    parentSignal?.addEventListener("abort", onParentAbort, { once: true });
    Promise.resolve()
      .then(() => operation(controller.signal))
      .then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error)),
      );
  });
}

function isRetryable(status: HintStatus): boolean {
  return status === "TIMEOUT" || status === "UPSTREAM_UNAVAILABLE";
}

function isLocalOrToolFailure(status: HintStatus): boolean {
  return [
    "INVALID_INPUT",
    "FORBIDDEN",
    "UNSUPPORTED_TOOL",
    "NOT_FOUND",
    "MALFORMED_OUTPUT",
    "CANCELLED",
  ].includes(status);
}

export async function requestAIHint(
  options: RequestHintOptions,
): Promise<HintFlowResult> {
  const startedAt = Date.now();
  const requestId = (options.requestIdFactory ?? makeRequestId)();
  const timeoutMs = options.timeoutMs ?? HINT_TIMEOUT_MS;
  const phase = getGamePhase(options.state);
  const models: ModelName[] = [];
  let toolCallCount = 0;
  let attempts = 0;
  let snapshot: GameStateSnapshot | undefined;
  let proposalConsumed = false;
  let toolFailure = false;
  let fallbackReason: HintStatus | undefined;

  const makeResult = (
    status: HintStatus,
    response: HintResponse | null = null,
  ): HintFlowResult => ({
    requestId,
    status,
    response,
    message: response?.hint ?? SAFE_HINT_FALLBACK,
    modelCalls: models.length,
    models: [...models],
    toolCallCount,
    attempts,
    ...(fallbackReason ? { fallbackReason } : {}),
    telemetry: {
      operation: "game.hint.state",
      status,
      requestId,
      attempts,
      latencyMs: Math.max(0, Date.now() - startedAt),
    },
  });

  if (options.signal?.aborted) {
    return makeResult("CANCELLED");
  }

  if (options.caller !== AI_HINT_CALLER) {
    return makeResult("FORBIDDEN");
  }

  const invokeTool = async (rawProposal: unknown): Promise<GameStateSnapshot> => {
    let proposal: ToolProposal;
    try {
      proposal = validateToolProposal(rawProposal);
    } catch (error) {
      throw error;
    }

    if (!ALLOWED_AI_TOOLS.includes(proposal.name)) {
      throw new HintFlowError("UNSUPPORTED_TOOL", "Tool is not allowlisted.");
    }

    if (options.caller !== AI_HINT_CALLER) {
      throw new HintFlowError("FORBIDDEN", "Tool scope is not authorized.");
    }

    if (proposalConsumed) {
      throw new HintFlowError(
        "UNSUPPORTED_TOOL",
        "Only one game-state tool call is permitted per hint request.",
      );
    }

    proposalConsumed = true;
    toolCallCount += 1;

    for (let attempt = 1; attempt <= MAX_TOOL_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const rawSnapshot = await withTimeout(
          (signal) =>
            Promise.resolve(
              options.readGameState(proposal, { requestId, signal }),
            ),
          timeoutMs,
          options.signal,
        );
        snapshot = validateGameStateSnapshot(rawSnapshot);

        if (snapshot.phase !== phase) {
          throw new HintFlowError(
            "MALFORMED_OUTPUT",
            "Tool output phase does not match the active game phase.",
          );
        }

        return snapshot;
      } catch (error) {
        const status = errorStatus(error, "UPSTREAM_UNAVAILABLE");
        if (status === "CANCELLED" || !isRetryable(status) || attempt === MAX_TOOL_ATTEMPTS) {
          toolFailure = true;
          throw error instanceof HintFlowError
            ? error
            : new HintFlowError(status, "Game state could not be read.");
        }
      }
    }

    toolFailure = true;
    throw new HintFlowError("UPSTREAM_UNAVAILABLE", "Game state is unavailable.");
  };

  const callModel = async (
    model: ModelName,
    knownSnapshot?: GameStateSnapshot,
  ): Promise<unknown> => {
    if (models.length >= MAX_MODEL_CALLS) {
      throw new HintFlowError("AI_UNAVAILABLE", "Model call budget exhausted.");
    }

    models.push(model);
    return withTimeout(
      (signal) =>
        options.modelClient.complete({
          model,
          phase,
          reasoningEffort: phase === "completed" ? "medium" : "low",
          maxOutputTokens:
            phase === "pre_game" ? 220 : phase === "in_game" ? 260 : 500,
          requestId,
          ...(knownSnapshot ? { snapshot: knownSnapshot } : {}),
          invokeTool,
          signal,
        }),
      knownSnapshot
        ? timeoutMs
        : timeoutMs * (MAX_TOOL_ATTEMPTS + 1) + 1_000,
      options.signal,
    );
  };

  try {
    const rawResponse = await callModel(PRIMARY_MODEL);
    if (!snapshot) {
      throw new HintFlowError(
        "MALFORMED_FINAL_OUTPUT",
        "Model did not obtain a validated game-state snapshot.",
      );
    }

    const response = validateHintResponse(rawResponse, phase);
    return makeResult("SUCCESS", response);
  } catch (error) {
    const status = errorStatus(error, "PROVIDER_UNAVAILABLE");
    if (toolFailure || isLocalOrToolFailure(status) || status === "FORBIDDEN") {
      return makeResult(status);
    }

    if (
      !["PROVIDER_UNAVAILABLE", "TIMEOUT", "MALFORMED_FINAL_OUTPUT", "STRUCTURED_OUTPUT_VALIDATION_FAILED"].includes(status) ||
      models.length >= MAX_MODEL_CALLS ||
      options.signal?.aborted
    ) {
      return makeResult(options.signal?.aborted ? "CANCELLED" : "AI_UNAVAILABLE");
    }

    fallbackReason = status;
  }

  try {
    const rawResponse = await callModel(FALLBACK_MODEL, snapshot);
    if (!snapshot) {
      throw new HintFlowError(
        "MALFORMED_FINAL_OUTPUT",
        "Fallback model did not obtain a validated game-state snapshot.",
      );
    }

    const response = validateHintResponse(rawResponse, phase);
    return makeResult("SUCCESS", response);
  } catch (error) {
    if (options.signal?.aborted || errorStatus(error, "AI_UNAVAILABLE") === "CANCELLED") {
      return makeResult("CANCELLED");
    }
    return makeResult("AI_UNAVAILABLE");
  }
}

export function createSnapshotReader(state: GameState) {
  return (
    proposal: ToolProposal,
  ): GameStateSnapshot => projectGameStateSnapshot(state, proposal.arguments);
}