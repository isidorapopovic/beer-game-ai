export type GameConfig = {
  totalWeeks: 10;
  shippingDelayWeeks: 2;
  inventoryCostPerUnit: number;
  backorderCostPerUnit: number;
};

export const GAME_CONFIG_INPUT: unknown = {
  totalWeeks: 10,
  shippingDelayWeeks: 2,
  inventoryCostPerUnit: 0.5,
  backorderCostPerUnit: 1,
};

export const CUSTOMER_DEMAND = [4, 4, 4, 4, 8, 8, 8, 8, 8, 8] as const;

export const INITIAL_GAME_VALUES = {
  inventory: 12,
  backorders: 0,
  incomingShipment: 4,
  previousOrder: 4,
} as const;

export function validateGameConfig(input: unknown): GameConfig {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Game configuration must be an object.");
  }

  const values = input as Record<string, unknown>;
  const requiredProperties = [
    "totalWeeks",
    "shippingDelayWeeks",
    "inventoryCostPerUnit",
    "backorderCostPerUnit",
  ] as const;
  const missing = requiredProperties.filter(
    (property) => !Object.hasOwn(values, property),
  );

  if (missing.length > 0) {
    throw new Error(`Game configuration is missing: ${missing.join(", ")}.`);
  }

  const nonFiniteOrNonNumeric = requiredProperties.filter(
    (property) =>
      typeof values[property] !== "number" ||
      !Number.isFinite(values[property]),
  );

  if (nonFiniteOrNonNumeric.length > 0) {
    throw new Error(
      `Game configuration values must be finite numbers: ${nonFiniteOrNonNumeric.join(", ")}.`,
    );
  }

  if (
    values.totalWeeks !== 10 ||
    values.shippingDelayWeeks !== 2 ||
    values.inventoryCostPerUnit !== 0.5 ||
    values.backorderCostPerUnit !== 1
  ) {
    throw new Error(
      "Game configuration must use 10 weeks, a 2-week shipping delay, inventory cost 0.5, and backorder cost 1.0.",
    );
  }

  return {
    totalWeeks: 10,
    shippingDelayWeeks: 2,
    inventoryCostPerUnit: 0.5,
    backorderCostPerUnit: 1,
  };
}