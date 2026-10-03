import assert from "node:assert/strict";
import test from "node:test";
import { createGameState, submitOrder } from "../game/gameEngine.ts";
import {
  createDecisionCoachRun,
  executeDecisionCoach,
  getCurrentGameStateTool,
  normalizeDecisionCoachResult,
} from "./decisionCoach.ts";

function makeModel(passedSnapshot) {
  return {
    step1: async () => ({
      kind: "tool_request",
      toolRequest: {
        name: "getCurrentGameState",
        arguments: {},
      },
    }),
    step2: async () => ({
      kind: "final",
      final: {
        summary: "Inventory is low while backorders remain active.",
        recommendation: "Order 9 units.",
        recommendedOrderQuantity: 9,
        evidence: [
          { source: "game_state", fact: `Current backorder is ${passedSnapshot.backorder}.` },
          { source: "game_state", fact: `Current inventory is ${passedSnapshot.inventory}.` },
        ],
        confidence: "medium",
        completed: true,
      },
    }),
  };
}

test("getCurrentGameState tool reads active retail state without mutating it", () => {
  let state = createGameState();
  state = submitOrder(state, 5);
  const snapshot = getCurrentGameStateTool(state);

  assert.equal(snapshot.week, 2);
  assert.equal(snapshot.inventory, state.inventory);
  assert.equal(snapshot.backorder, state.backorders);
  assert.ok(Array.isArray(snapshot.incomingShipments));
  assert.ok(Array.isArray(snapshot.recentDemand));
  assert.ok(Array.isArray(snapshot.recentOrders));
  assert.equal(state.currentWeek, 2);
});

test("decision coach accepts a valid active-week recommendation", async () => {
  let state = createGameState();
  state = submitOrder(state, 5);
  const snapshot = getCurrentGameStateTool(state);
  const model = makeModel(snapshot);

  const result = await executeDecisionCoach({
    state,
    goal: "How much should I order this week?",
    modelStep: model.step1,
    modelStep2: model.step2,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.finalOutput.recommendedOrderQuantity, 9);
  assert.equal(result.finalOutput.recommendation, "Order 9 units.");
  assert.equal(result.toolCallCount, 1);
});

test("decision coach rejects a completed game before provider call", async () => {
  let state = createGameState();
  for (let week = 0; week < 10; week += 1) {
    state = submitOrder(state, 0);
  }

  const result = await executeDecisionCoach({
    state,
    goal: "How much should I order?",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "getCurrentGameState", arguments: {} },
    }),
    modelStep2: async () => ({
      kind: "final",
      final: {
        summary: "No recommendation should be produced.",
        recommendation: "Order 0 units.",
        recommendedOrderQuantity: 0,
        evidence: [{ source: "game_state", fact: "Completed game." }],
        confidence: "low",
        completed: true,
      },
    }),
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "preflight_rejected");
  assert.equal(result.toolCallCount, 0);
});

test("decision coach final result must match schema and quantity bounds", async () => {
  let state = createGameState();
  state = submitOrder(state, 6);

  const result = await executeDecisionCoach({
    state,
    goal: "I need a recommendation",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "getCurrentGameState", arguments: {} },
    }),
    modelStep2: async () => ({
      kind: "final",
      final: {
        summary: "Fine",
        recommendation: "Order 99 units.",
        recommendedOrderQuantity: 99,
        evidence: [{ source: "game_state", fact: "bad" }],
        confidence: "medium",
        completed: true,
      },
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stopReason, "invalid_final_result");
});

test("normalized decision coach result keeps only valid data", () => {
  const normalized = normalizeDecisionCoachResult({
    summary: "Shortage is growing.",
    recommendation: "Order 7 units.",
    recommendedOrderQuantity: 7,
    evidence: [{ source: "game_state", fact: "Demand is rising." }],
    confidence: "high",
    completed: true,
  });

  assert.equal(normalized.summary, "Shortage is growing.");
  assert.equal(normalized.recommendedOrderQuantity, 7);
  assert.equal(normalized.confidence, "high");
  assert.equal(normalized.evidence.length, 1);
});
