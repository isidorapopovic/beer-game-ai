import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_DEMAND,
  GAME_CONFIG_INPUT,
  validateGameConfig,
} from "./gameConfig.ts";
import {
  createGameState,
  getGameSummary,
  resolveWeek,
  submitOrder,
} from "./gameEngine.ts";

test("valid game config is accepted and initial state starts at Week 1", () => {
  assert.equal(validateGameConfig(GAME_CONFIG_INPUT).totalWeeks, 10);
  const state = createGameState();
  assert.equal(state.currentWeek, 1);
  assert.equal(state.customerDemand, 4);
  assert.equal(state.inventory, 12);
  assert.equal(state.incomingShipment, 4);
  assert.equal(state.previousOrder, 4);
});

test("invalid or incomplete config is rejected before game initialization", () => {
  const invalidConfigs = [
    { ...GAME_CONFIG_INPUT, totalWeeks: 30 },
    { ...GAME_CONFIG_INPUT, shippingDelayWeeks: -1 },
    { ...GAME_CONFIG_INPUT, inventoryCostPerUnit: "0.5" },
    {
      totalWeeks: 10,
      shippingDelayWeeks: 2,
      inventoryCostPerUnit: 0.5,
    },
  ];

  for (const config of invalidConfigs) {
    assert.throws(() => createGameState(config));
  }
});

test("week 1 order arrives in week 3, not week 2", () => {
  const week2 = submitOrder(createGameState(), 5);
  assert.equal(week2.currentWeek, 2);
  assert.equal(week2.previousOrder, 5);
  assert.equal(week2.incomingShipment, 0);
  assert.deepEqual(week2.shipments, [{ arrivalWeek: 3, quantity: 5 }]);

  const week3 = submitOrder(week2, 0);
  assert.equal(week3.currentWeek, 3);
  assert.equal(week3.previousOrder, 0);
  assert.equal(week3.incomingShipment, 5);
});

test("shortage becomes backorder and later inventory fulfills it first", () => {
  const config = validateGameConfig(GAME_CONFIG_INPUT);
  const shortage = resolveWeek({
    week: 1,
    openingInventory: 3,
    openingBackorders: 0,
    shipments: [],
    customerDemand: 8,
    config,
  });
  assert.equal(shortage.inventory, 0);
  assert.equal(shortage.backorders, 5);

  const replenished = resolveWeek({
    week: 2,
    openingInventory: 0,
    openingBackorders: 5,
    shipments: [{ arrivalWeek: 2, quantity: 8 }],
    customerDemand: 4,
    config,
  });
  assert.equal(replenished.backorders, 1);
  assert.equal(replenished.inventory, 0);
});

test("inventory and backorder costs match the specified rates", () => {
  const config = validateGameConfig(GAME_CONFIG_INPUT);
  const inventoryCost = resolveWeek({
    week: 1,
    openingInventory: 8,
    openingBackorders: 0,
    shipments: [],
    customerDemand: 0,
    config,
  });
  assert.equal(inventoryCost.weeklyCost, 4);

  const backorderCost = resolveWeek({
    week: 1,
    openingInventory: 0,
    openingBackorders: 6,
    shipments: [],
    customerDemand: 0,
    config,
  });
  assert.equal(backorderCost.weeklyCost, 6);
});

test("total cost accumulates across weekly transitions", () => {
  const week2 = submitOrder(createGameState(), 0);
  const summary = getGameSummary(week2);
  assert.equal(summary.weeklyCost, 4);
  assert.equal(summary.totalCost, 10);
});

test("game ends after Week 10 and ignores any further order", () => {
  let state = createGameState();
  const totalDemand = CUSTOMER_DEMAND.reduce((total, demand) => total + demand, 0);

  for (let week = 1; week <= 10; week += 1) {
    state = submitOrder(state, 0);
  }

  assert.equal(state.currentWeek, 10);
  assert.equal(state.isComplete, true);
  assert.equal(getGameSummary(state).totalCustomerDemand, totalDemand);
  assert.equal(state.history.length, 10);
  assert.equal(getGameSummary(state).totalBackorderedUnits, 48);
  assert.equal(getGameSummary(state).maximumBackorder, 48);
  assert.equal(getGameSummary(state).averageWeeklyInventory, 2.4);
  assert.equal(getGameSummary(state).serviceLevel, 25);
  assert.strictEqual(submitOrder(state, 5), state);
});

test("negative and non-finite orders are rejected without advancing state", () => {
  const state = createGameState();
  assert.throws(() => submitOrder(state, -1));
  assert.throws(() => submitOrder(state, Number.NaN));
  assert.equal(state.currentWeek, 1);
});