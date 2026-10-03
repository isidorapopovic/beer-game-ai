import {
  CUSTOMER_DEMAND,
  GAME_CONFIG_INPUT,
  INITIAL_GAME_VALUES,
  validateGameConfig,
} from "./gameConfig.ts";
import type { GameConfig } from "./gameConfig.ts";

export type Shipment = {
  arrivalWeek: number;
  quantity: number;
};

export type WeekResult = {
  week: number;
  demand: number;
  incomingShipment: number;
  inventory: number;
  backorders: number;
  unitsFulfilled: number;
  newlyBackorderedUnits: number;
  weeklyCost: number;
};

export type GameState = {
  config: GameConfig;
  currentWeek: number;
  inventory: number;
  backorders: number;
  incomingShipment: number;
  customerDemand: number;
  previousOrder: number;
  shipments: Shipment[];
  history: WeekResult[];
  currentWeekResult: WeekResult;
  isComplete: boolean;
};

type ResolveWeekInput = {
  week: number;
  openingInventory: number;
  openingBackorders: number;
  shipments: Shipment[];
  customerDemand: number;
  config: GameConfig;
};

export function resolveWeek(input: ResolveWeekInput): WeekResult & {
  remainingShipments: Shipment[];
} {
  const arrivingShipments = input.shipments.filter(
    (shipment) => shipment.arrivalWeek === input.week,
  );
  const remainingShipments = input.shipments.filter(
    (shipment) => shipment.arrivalWeek > input.week,
  );
  const incomingShipment = arrivingShipments.reduce(
    (total, shipment) => total + shipment.quantity,
    0,
  );
  let availableInventory = input.openingInventory + incomingShipment;
  const fulfilledBackorders = Math.min(
    input.openingBackorders,
    availableInventory,
  );
  availableInventory -= fulfilledBackorders;

  const fulfilledCurrentDemand = Math.min(
    input.customerDemand,
    availableInventory,
  );
  availableInventory -= fulfilledCurrentDemand;

  const backorders =
    input.openingBackorders -
    fulfilledBackorders +
    input.customerDemand -
    fulfilledCurrentDemand;
  const weeklyCost =
    availableInventory * input.config.inventoryCostPerUnit +
    backorders * input.config.backorderCostPerUnit;

  return {
    week: input.week,
    demand: input.customerDemand,
    incomingShipment,
    inventory: availableInventory,
    backorders,
    unitsFulfilled: fulfilledBackorders + fulfilledCurrentDemand,
    newlyBackorderedUnits: input.customerDemand - fulfilledCurrentDemand,
    weeklyCost,
    remainingShipments,
  };
}

function openWeek(
  config: GameConfig,
  week: number,
  inventory: number,
  backorders: number,
  shipments: Shipment[],
  previousOrder: number,
  history: WeekResult[],
): GameState {
  const customerDemand = CUSTOMER_DEMAND[week - 1];

  if (customerDemand === undefined) {
    throw new Error(`No customer demand is configured for week ${week}.`);
  }

  const currentWeekResult = resolveWeek({
    week,
    openingInventory: inventory,
    openingBackorders: backorders,
    shipments,
    customerDemand,
    config,
  });

  return {
    config,
    currentWeek: week,
    inventory: currentWeekResult.inventory,
    backorders: currentWeekResult.backorders,
    incomingShipment: currentWeekResult.incomingShipment,
    customerDemand,
    previousOrder,
    shipments: currentWeekResult.remainingShipments,
    history,
    currentWeekResult,
    isComplete: false,
  };
}

export function createGameState(
  configInput: unknown = GAME_CONFIG_INPUT,
): GameState {
  const config = validateGameConfig(configInput);

  if (CUSTOMER_DEMAND.length !== config.totalWeeks) {
    throw new Error("Customer demand must define exactly one value per week.");
  }

  return openWeek(
    config,
    1,
    INITIAL_GAME_VALUES.inventory,
    INITIAL_GAME_VALUES.backorders,
    [
      {
        arrivalWeek: 1,
        quantity: INITIAL_GAME_VALUES.incomingShipment,
      },
    ],
    INITIAL_GAME_VALUES.previousOrder,
    [],
  );
}

export function submitOrder(state: GameState, quantity: number): GameState {
  if (state.isComplete) {
    return state;
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Order quantity must be a finite, non-negative number.");
  }

  const history = [...state.history, state.currentWeekResult];

  if (state.currentWeek === state.config.totalWeeks) {
    return {
      ...state,
      previousOrder: quantity,
      history,
      isComplete: true,
    };
  }

  const nextWeek = state.currentWeek + 1;
  const shipments = [
    ...state.shipments,
    {
      arrivalWeek: state.currentWeek + state.config.shippingDelayWeeks,
      quantity,
    },
  ];

  return openWeek(
    state.config,
    nextWeek,
    state.inventory,
    state.backorders,
    shipments,
    quantity,
    history,
  );
}

export function getGameSummary(state: GameState) {
  const weeks = state.isComplete
    ? state.history
    : [...state.history, state.currentWeekResult];
  const totalDemand = weeks.reduce((total, week) => total + week.demand, 0);
  const totalUnitsSold = weeks.reduce(
    (total, week) => total + week.unitsFulfilled,
    0,
  );
  const totalBackorderedUnits = weeks.reduce(
    (total, week) => total + week.newlyBackorderedUnits,
    0,
  );

  return {
    weeklyCost: state.currentWeekResult.weeklyCost,
    totalCost: weeks.reduce((total, week) => total + week.weeklyCost, 0),
    averageWeeklyInventory:
      weeks.length === 0
        ? 0
        : weeks.reduce((total, week) => total + week.inventory, 0) / weeks.length,
    totalBackorderedUnits,
    maximumBackorder: weeks.reduce(
      (maximum, week) => Math.max(maximum, week.backorders),
      0,
    ),
    totalCustomerDemand: totalDemand,
    totalUnitsSold,
    serviceLevel: totalDemand === 0 ? 0 : (totalUnitsSold / totalDemand) * 100,
  };
}