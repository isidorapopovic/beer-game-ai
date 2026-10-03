import { getGameSummary, type GameState } from "../game/gameEngine.ts";
import type {
  GamePhase,
  GameStateSnapshot,
  GetGameStateInput,
  PipelineSummary,
} from "./contracts.ts";

export function getGamePhase(state: GameState): GamePhase {
  if (state.isComplete) {
    return "completed";
  }

  if (state.currentWeek === 1 && state.history.length === 0) {
    return "pre_game";
  }

  return "in_game";
}

function getPipelineSummary(state: GameState): PipelineSummary {
  const nextShipment = state.shipments
    .slice()
    .sort((first, second) => first.arrivalWeek - second.arrivalWeek)[0];

  return {
    shipmentsInTransit: state.shipments.length,
    nextArrivalWeek: nextShipment?.arrivalWeek ?? null,
    nextArrivalQuantity: nextShipment?.quantity ?? 0,
  };
}

function getOrderForWeek(state: GameState, week: number): number {
  if (week === 10) {
    return state.previousOrder;
  }

  const arrivalWeek = week + state.config.shippingDelayWeeks;
  const recordedArrival = state.history.find(
    (result) => result.week === arrivalWeek,
  );

  if (recordedArrival) {
    return recordedArrival.incomingShipment;
  }

  return state.shipments
    .filter((shipment) => shipment.arrivalWeek === arrivalWeek)
    .reduce((quantity, shipment) => quantity + shipment.quantity, 0);
}

function getCompletedHistory(state: GameState) {
  return state.history.map((result) => ({
    week: result.week,
    demand: result.demand,
    endingInventory: result.inventory,
    endingBackorders: result.backorders,
    incomingShipment: result.incomingShipment,
    orderPlaced: getOrderForWeek(state, result.week),
    inTransitAtOrder:
      result.week === 1 ? 0 : getOrderForWeek(state, result.week - 1),
    weeklyCost: result.weeklyCost,
  }));
}

export function projectGameStateSnapshot(
  state: GameState,
  input: GetGameStateInput,
): GameStateSnapshot {
  const summary = getGameSummary(state);
  const phase = getGamePhase(state);

  return {
    phase,
    week: state.currentWeek,
    totalWeeks: 10,
    customerDemand: state.customerDemand,
    inventory: state.inventory,
    backorders: state.backorders,
    incomingShipment: state.incomingShipment,
    previousOrder: state.previousOrder,
    weeklyCost: summary.weeklyCost,
    totalCost: summary.totalCost,
    ...(phase === "completed"
      ? {
          completedSummary: {
            totalCost: summary.totalCost,
            averageWeeklyInventory: summary.averageWeeklyInventory,
            totalBackorderedUnits: summary.totalBackorderedUnits,
            maximumBackorder: summary.maximumBackorder,
            totalCustomerDemand: summary.totalCustomerDemand,
            totalUnitsSold: summary.totalUnitsSold,
            serviceLevel: summary.serviceLevel,
          },
          completedHistory: getCompletedHistory(state),
        }
      : {}),
    ...(input.detail === "tactical" && phase !== "completed"
      ? { pipelineSummary: getPipelineSummary(state) }
      : {}),
  };
}