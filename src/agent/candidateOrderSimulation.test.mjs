import assert from "node:assert/strict";
import test from "node:test";
import { createGameState, submitOrder } from "../game/gameEngine.ts";
import {
  executeCandidateOrderSimulation,
  normalizeCandidateOrderAdvice,
  simulateCandidateOrder,
} from "./candidateOrderSimulation.ts";

function activeWeekTwo() {
  return submitOrder(createGameState(), 5);
}

function validAdvice(simulation) {
  return {
    summary: "The candidate order will arrive after the two-week delay.",
    recommendation: `Order ${simulation.orderQuantity} units.`,
    recommendedOrderQuantity: simulation.orderQuantity,
    simulation,
    evidence: [
      { source: "candidate_order_simulation", fact: `The candidate order arrives in week ${simulation.candidateShipmentArrivalWeek}.` },
    ],
    confidence: "medium",
    completed: true,
  };
}

test("valid candidate uses engine timing and leaves canonical state unchanged", () => {
  const state = activeWeekTwo();
  const before = structuredClone(state);
  const result = simulateCandidateOrder(state, { orderQuantity: 9 });

  assert.equal(result.orderQuantity, 9);
  assert.equal(result.candidateShipmentArrivalWeek, 4);
  assert.equal(result.knownIncomingShipmentNextWeek, 5);
  assert.equal(state.currentWeek, before.currentWeek);
  assert.deepEqual(state, before);
  assert.ok(result.assumptions.some((assumption) => assumption.includes("not mutated")));
});

test("candidate quantity boundaries zero and fifty are accepted", () => {
  const state = activeWeekTwo();
  assert.equal(simulateCandidateOrder(state, { orderQuantity: 0 }).orderQuantity, 0);
  assert.equal(simulateCandidateOrder(state, { orderQuantity: 50 }).orderQuantity, 50);
});

test("candidate quantity rejects negatives, values over fifty, strings, non-finite values, and fractions", () => {
  const state = activeWeekTwo();
  for (const orderQuantity of [-1, 51, "9", Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
    assert.throws(() => simulateCandidateOrder(state, { orderQuantity }));
  }
});

test("candidate arguments reject extra properties", () => {
  assert.throws(() => simulateCandidateOrder(activeWeekTwo(), { orderQuantity: 9, extra: true }));
});

test("final active week does not claim a future shipment or next-week inbound", () => {
  let state = createGameState();
  for (let week = 1; week < 10; week += 1) {
    state = submitOrder(state, 0);
  }

  const result = simulateCandidateOrder(state, { orderQuantity: 9 });
  assert.equal(result.candidateShipmentArrivalWeek, undefined);
  assert.equal(result.knownIncomingShipmentNextWeek, undefined);
  assert.ok(result.assumptions.some((assumption) => assumption.includes("game ends")));
});

test("final advice must match the verified simulation", () => {
  const simulation = simulateCandidateOrder(activeWeekTwo(), { orderQuantity: 9 });
  assert.equal(normalizeCandidateOrderAdvice(validAdvice(simulation), simulation).recommendedOrderQuantity, 9);
  assert.throws(() => normalizeCandidateOrderAdvice({
    ...validAdvice(simulation),
    recommendedOrderQuantity: 8,
  }, simulation));
});

test("candidate order workflow completes with validated tool output", async () => {
  const state = activeWeekTwo();
  let receivedSimulation;
  const result = await executeCandidateOrderSimulation({
    state,
    goal: "What should I order?",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "simulateCandidateOrder", arguments: { orderQuantity: 9 } },
    }),
    modelStep2: async (_run, toolResult) => {
      receivedSimulation = toolResult;
      return { kind: "final", final: validAdvice(toolResult) };
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.finalOutput.recommendedOrderQuantity, 9);
  assert.deepEqual(result.finalOutput.simulation, receivedSimulation);
});

test("invalid model quantity is rejected before simulation", async () => {
  let secondStepCalled = false;
  const result = await executeCandidateOrderSimulation({
    state: activeWeekTwo(),
    goal: "What should I order?",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "simulateCandidateOrder", arguments: { orderQuantity: "9" } },
    }),
    modelStep2: async () => {
      secondStepCalled = true;
      return { kind: "refusal" };
    },
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "invalid_tool_arguments");
  assert.equal(result.toolCallCount, 0);
  assert.equal(secondStepCalled, false);
});

test("invalid final quantity or simulation is rejected", async () => {
  const result = await executeCandidateOrderSimulation({
    state: activeWeekTwo(),
    goal: "What should I order?",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "simulateCandidateOrder", arguments: { orderQuantity: 9 } },
    }),
    modelStep2: async () => ({
      kind: "final",
      final: { ...validAdvice({ orderQuantity: 8 }), recommendedOrderQuantity: 8 },
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stopReason, "invalid_final_result");
});

test("unknown tool is rejected without executing a simulation", async () => {
  const result = await executeCandidateOrderSimulation({
    state: activeWeekTwo(),
    goal: "What should I order?",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "unknownTool", arguments: {} },
    }),
    modelStep2: async () => ({ kind: "refusal" }),
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "unknown_tool");
  assert.equal(result.toolCallCount, 0);
});