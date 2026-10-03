import assert from "node:assert/strict";
import test from "node:test";
import { createGameState } from "../game/gameEngine.ts";
import {
  executeScenarioGenerator,
  generateScenarioDemand,
  getAllowedScenarioTypesTool,
  normalizeScenarioSelectionResult,
} from "./scenarioGenerator.ts";

test("allowed scenarios exposes a trusted catalog and difficulty list", () => {
  const catalogue = getAllowedScenarioTypesTool();

  assert.deepEqual(catalogue.scenarios.map((item) => item.id), ["stable", "growth", "seasonal", "volatile"]);
  assert.deepEqual(catalogue.difficulties, ["easy", "medium", "hard"]);
});

test("generated demand remains deterministic for the same scenario and difficulty", () => {
  const fromStable = generateScenarioDemand({ scenario: "stable", difficulty: "easy", seed: 7 });
  const repeatedStable = generateScenarioDemand({ scenario: "stable", difficulty: "easy", seed: 7 });
  const growth = generateScenarioDemand({ scenario: "growth", difficulty: "hard", seed: 3 });

  assert.equal(fromStable.length, 10);
  assert.deepEqual(fromStable, repeatedStable);
  assert.equal(growth.length, 10);
  assert.ok(growth.every((week) => Number.isInteger(week) && week >= 0));
  assert.ok(growth[0] < growth[growth.length - 1]);
});

test("scenario generator completes a valid selection without mutating the real game state", async () => {
  const state = createGameState();
  const before = structuredClone(state);

  const result = await executeScenarioGenerator({
    state,
    goal: "I want a difficult scenario with increasing demand.",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "getAllowedScenarioTypes", arguments: {} },
    }),
    modelStep2: async () => ({
      kind: "final",
      final: {
        summary: "This growth scenario matches the requested increasing-demand profile.",
        scenario: "growth",
        difficulty: "hard",
        explanation: "Demand increases steadily over the order cycle.",
        evidence: [{ source: "allowed_scenarios", fact: "growth" }],
        confidence: "medium",
        completed: true,
      },
    }),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.finalOutput.scenario, "growth");
  assert.equal(result.finalOutput.difficulty, "hard");
  assert.deepEqual(state, before);
});

test("scenario selection rejects invalid enum values and fabricated evidence", () => {
  assert.throws(() =>
    normalizeScenarioSelectionResult({
      summary: "Bad selection",
      scenario: "extreme",
      difficulty: "hard",
      explanation: "Bad choice",
      evidence: [{ source: "allowed_scenarios", fact: "not-real" }],
      confidence: "medium",
      completed: true,
    }), /scenario/i);
});

test("game engine can build a real demand sequence from a generated scenario", () => {
  const generated = generateScenarioDemand({ scenario: "seasonal", difficulty: "medium", seed: 4 });
  const state = createGameState(undefined, generated);

  assert.equal(state.history.length, 0);
  assert.equal(state.config.totalWeeks, 10);
  assert.equal(state.customerDemand, generated[0]);
  assert.deepEqual(state.history, []);
});
