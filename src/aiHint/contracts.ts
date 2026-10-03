export const AI_HINT_CALLER = "ai_hint" as const;

export const ALLOWED_AI_TOOLS = ["get_game_state"] as const;

export const SAFE_HINT_FALLBACK =
  "AI hint is currently unavailable. Please continue using the visible game information.";

export type GamePhase = "pre_game" | "in_game" | "completed";
export type ModelName = "gpt-6-luna" | "gpt-6.1-sol";
export type HintAction =
  | "order_more"
  | "order_less"
  | "keep_order_stable"
  | "review_pipeline"
  | "wait"
  | "review_results";
export type HintUrgency = "low" | "medium" | "high";

export type HintStatus =
  | "SUCCESS"
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "UNSUPPORTED_TOOL"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "MALFORMED_OUTPUT"
  | "MALFORMED_FINAL_OUTPUT"
  | "STRUCTURED_OUTPUT_VALIDATION_FAILED"
  | "CANCELLED"
  | "AI_UNAVAILABLE";

export type GetGameStateInput = {
  detail: "summary" | "tactical";
};

export type CompletedGameSummary = {
  totalCost: number;
  averageWeeklyInventory: number;
  totalBackorderedUnits: number;
  maximumBackorder: number;
  totalCustomerDemand: number;
  totalUnitsSold: number;
  serviceLevel: number;
};

export type CompletedWeeklySummary = {
  week: number;
  demand: number;
  endingInventory: number;
  endingBackorders: number;
  incomingShipment: number;
  orderPlaced: number;
  inTransitAtOrder: number;
  weeklyCost: number;
};

export type PipelineSummary = {
  shipmentsInTransit: number;
  nextArrivalWeek: number | null;
  nextArrivalQuantity: number;
};

export type GameStateSnapshot = {
  phase: GamePhase;
  week: number;
  totalWeeks: 10;
  customerDemand: number;
  inventory: number;
  backorders: number;
  incomingShipment: number;
  previousOrder: number;
  weeklyCost: number;
  totalCost: number;
  completedSummary?: CompletedGameSummary;
  completedHistory?: CompletedWeeklySummary[];
  pipelineSummary?: PipelineSummary;
};

export type HintResponse = {
  phase: GamePhase;
  hint: string;
  suggestedAction: HintAction;
  urgency: HintUrgency;
};

export type ToolProposal = {
  name: "get_game_state";
  arguments: GetGameStateInput;
};

export class HintFlowError extends Error {
  readonly status: HintStatus;

  constructor(status: HintStatus, message: string) {
    super(message);
    this.status = status;
    this.name = "HintFlowError";
  }
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  input: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(input);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.hasOwn(input, key))
  );
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function validateGetGameStateInput(input: unknown): GetGameStateInput {
  if (!isPlainObject(input) || !hasExactKeys(input, ["detail"])) {
    throw new HintFlowError(
      "INVALID_INPUT",
      "Tool arguments must contain only the detail property.",
    );
  }

  if (input.detail !== "summary" && input.detail !== "tactical") {
    throw new HintFlowError(
      "INVALID_INPUT",
      "Tool detail must be summary or tactical.",
    );
  }

  return { detail: input.detail };
}

export function validateToolProposal(input: unknown): ToolProposal {
  if (!isPlainObject(input) || !hasExactKeys(input, ["name", "arguments"])) {
    throw new HintFlowError(
      "INVALID_INPUT",
      "Tool proposal has an invalid shape.",
    );
  }

  if (typeof input.name !== "string" || !ALLOWED_AI_TOOLS.includes(input.name as "get_game_state")) {
    throw new HintFlowError("UNSUPPORTED_TOOL", "Tool is not allowlisted.");
  }

  return {
    name: "get_game_state",
    arguments: validateGetGameStateInput(input.arguments),
  };
}

export function validateGameStateSnapshot(
  input: unknown,
): GameStateSnapshot {
  if (!isPlainObject(input)) {
    throw new HintFlowError("MALFORMED_OUTPUT", "Tool output must be an object.");
  }

  const baseKeys = [
    "phase",
    "week",
    "totalWeeks",
    "customerDemand",
    "inventory",
    "backorders",
    "incomingShipment",
    "previousOrder",
    "weeklyCost",
    "totalCost",
  ];
  const allowedKeys = [
    ...baseKeys,
    "completedSummary",
    "completedHistory",
    "pipelineSummary",
  ];

  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    throw new HintFlowError(
      "MALFORMED_OUTPUT",
      "Tool output contains fields outside the public snapshot contract.",
    );
  }

  if (
    input.phase !== "pre_game" &&
    input.phase !== "in_game" &&
    input.phase !== "completed"
  ) {
    throw new HintFlowError("MALFORMED_OUTPUT", "Tool phase is invalid.");
  }

  if (
    !Number.isInteger(input.week) ||
    (input.week as number) < 1 ||
    (input.week as number) > 10 ||
    input.totalWeeks !== 10 ||
    (input.phase === "pre_game" && input.week !== 1) ||
    (input.phase === "completed" && input.week !== 10)
  ) {
    throw new HintFlowError(
      "MALFORMED_OUTPUT",
      "Tool week values do not match the game phase.",
    );
  }

  for (const property of [
    "customerDemand",
    "inventory",
    "backorders",
    "incomingShipment",
    "previousOrder",
    "weeklyCost",
    "totalCost",
  ]) {
    if (!isFiniteNonNegative(input[property])) {
      throw new HintFlowError(
        "MALFORMED_OUTPUT",
        `Tool output field ${property} must be a finite non-negative number.`,
      );
    }
  }

  let completedSummary: CompletedGameSummary | undefined;
  if (input.completedSummary !== undefined) {
    if (
      input.phase !== "completed" ||
      !isPlainObject(input.completedSummary) ||
      !hasExactKeys(input.completedSummary, [
        "totalCost",
        "averageWeeklyInventory",
        "totalBackorderedUnits",
        "maximumBackorder",
        "totalCustomerDemand",
        "totalUnitsSold",
        "serviceLevel",
      ])
    ) {
      throw new HintFlowError(
        "MALFORMED_OUTPUT",
        "Completed game summary is invalid.",
      );
    }

    for (const property of Object.keys(input.completedSummary)) {
      if (!isFiniteNonNegative(input.completedSummary[property])) {
        throw new HintFlowError(
          "MALFORMED_OUTPUT",
          `Completed summary field ${property} must be a finite non-negative number.`,
        );
      }
    }

    completedSummary = input.completedSummary as CompletedGameSummary;
  }

  if (input.phase === "completed" && !completedSummary) {
    throw new HintFlowError(
      "MALFORMED_OUTPUT",
      "Completed snapshots require a sanitized summary.",
    );
  }

  let completedHistory: CompletedWeeklySummary[] | undefined;
  if (input.completedHistory !== undefined) {
    if (
      input.phase !== "completed" ||
      !Array.isArray(input.completedHistory) ||
      input.completedHistory.length !== 10
    ) {
      throw new HintFlowError(
        "MALFORMED_OUTPUT",
        "Completed game history must contain exactly 10 sanitized weeks.",
      );
    }

    completedHistory = input.completedHistory.map((record, index) => {
      const properties = [
        "week",
        "demand",
        "endingInventory",
        "endingBackorders",
        "incomingShipment",
        "orderPlaced",
        "inTransitAtOrder",
        "weeklyCost",
      ] as const;

      if (
        !isPlainObject(record) ||
        !hasExactKeys(record, properties) ||
        record.week !== index + 1 ||
        !Number.isInteger(record.week) ||
        properties.slice(1).some((property) => !isFiniteNonNegative(record[property]))
      ) {
        throw new HintFlowError(
          "MALFORMED_OUTPUT",
          `Completed game history record ${index + 1} is invalid.`,
        );
      }

      return {
        week: record.week as number,
        demand: record.demand as number,
        endingInventory: record.endingInventory as number,
        endingBackorders: record.endingBackorders as number,
        incomingShipment: record.incomingShipment as number,
        orderPlaced: record.orderPlaced as number,
        inTransitAtOrder: record.inTransitAtOrder as number,
        weeklyCost: record.weeklyCost as number,
      };
    });
  }

  if (input.phase === "completed" && !completedHistory) {
    throw new HintFlowError(
      "MALFORMED_OUTPUT",
      "Completed snapshots require sanitized weekly history.",
    );
  }

  let pipelineSummary: PipelineSummary | undefined;
  if (input.pipelineSummary !== undefined) {
    const pipeline = input.pipelineSummary;
    const shipmentsInTransit = isPlainObject(pipeline)
      ? pipeline.shipmentsInTransit
      : undefined;
    const nextArrivalWeek = isPlainObject(pipeline)
      ? pipeline.nextArrivalWeek
      : undefined;
    const nextArrivalQuantity = isPlainObject(pipeline)
      ? pipeline.nextArrivalQuantity
      : undefined;
    const week = input.week as number;

    if (
      !isPlainObject(pipeline) ||
      !hasExactKeys(pipeline, [
        "shipmentsInTransit",
        "nextArrivalWeek",
        "nextArrivalQuantity",
      ]) ||
      !Number.isInteger(shipmentsInTransit) ||
      !isFiniteNonNegative(shipmentsInTransit) ||
      !isFiniteNonNegative(nextArrivalQuantity) ||
      (nextArrivalWeek !== null &&
        (typeof nextArrivalWeek !== "number" ||
          !Number.isInteger(nextArrivalWeek) ||
          nextArrivalWeek <= week ||
          nextArrivalWeek > 12))
    ) {
      throw new HintFlowError(
        "MALFORMED_OUTPUT",
        "Pipeline summary is invalid.",
      );
    }

    pipelineSummary = {
      shipmentsInTransit,
      nextArrivalWeek,
      nextArrivalQuantity,
    } as PipelineSummary;
  }

  return {
    phase: input.phase,
    week: input.week as number,
    totalWeeks: 10,
    customerDemand: input.customerDemand as number,
    inventory: input.inventory as number,
    backorders: input.backorders as number,
    incomingShipment: input.incomingShipment as number,
    previousOrder: input.previousOrder as number,
    weeklyCost: input.weeklyCost as number,
    totalCost: input.totalCost as number,
    ...(completedSummary ? { completedSummary } : {}),
    ...(completedHistory ? { completedHistory } : {}),
    ...(pipelineSummary ? { pipelineSummary } : {}),
  };
}

const actionsByPhase: Record<GamePhase, readonly HintAction[]> = {
  pre_game: ["keep_order_stable", "review_pipeline", "wait"],
  in_game: [
    "order_more",
    "order_less",
    "keep_order_stable",
    "review_pipeline",
    "wait",
  ],
  completed: ["review_results"],
};

export function validateHintResponse(
  input: unknown,
  expectedPhase: GamePhase,
): HintResponse {
  if (
    !isPlainObject(input) ||
    !hasExactKeys(input, ["phase", "hint", "suggestedAction", "urgency"])
  ) {
    throw new HintFlowError(
      "MALFORMED_FINAL_OUTPUT",
      "Hint response has an invalid shape.",
    );
  }

  if (
    input.phase !== expectedPhase ||
    typeof input.hint !== "string" ||
    input.hint.trim().length === 0 ||
    input.hint.length > 1600 ||
    typeof input.suggestedAction !== "string" ||
    !actionsByPhase[expectedPhase].includes(input.suggestedAction as HintAction) ||
    (input.urgency !== "low" &&
      input.urgency !== "medium" &&
      input.urgency !== "high")
  ) {
    throw new HintFlowError(
      "MALFORMED_FINAL_OUTPUT",
      "Hint response does not match the active phase contract.",
    );
  }

  return {
    phase: expectedPhase,
    hint: input.hint,
    suggestedAction: input.suggestedAction as HintAction,
    urgency: input.urgency,
  };
}