import assert from "node:assert/strict";
import test from "node:test";
import { createGameState, submitOrder } from "../game/gameEngine.ts";
import {
  executeGameAnalyst,
  formatGameHistoryFact,
  getGameHistoryTool,
} from "./gameAnalyst.ts";

function completedGame() {
  let state = createGameState();
  for (let week = 1; week <= 10; week += 1) {
    state = submitOrder(state, week * 2);
  }
  return state;
}

function validAnalysis(history) {
  const week = history.weeks[2];
  return {
    summary: `The completed game cost ${history.totalCost} in total.`,
    findings: [{
      type: "cost_driver",
      title: "Week 3 cost",
      explanation: "Week 3 contributes to the total game cost.",
      weeks: [3],
      evidence: [{ source: "game_history", fact: formatGameHistoryFact(week, "cost") }],
    }],
    nextGameAdvice: ["Compare order changes with the two-week shipping delay."],
    confidence: "medium",
    completed: true,
  };
}

function modelCallbacks(finalFactory = validAnalysis) {
  let receivedHistory;
  return {
    get receivedHistory() { return receivedHistory; },
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "getGameHistory", arguments: {} },
    }),
    modelStep2: async (_run, toolResult) => {
      receivedHistory = toolResult;
      return { kind: "final", final: finalFactory(toolResult) };
    },
  };
}

test("game history tool returns actual completed orders and weekly outcomes", () => {
  const state = completedGame();
  const before = structuredClone(state);
  const history = getGameHistoryTool(state);

  assert.equal(history.totalWeeks, 10);
  assert.equal(history.weeks.length, 10);
  assert.equal(history.weeks[0].order, 2);
  assert.equal(history.weeks[9].order, 20);
  assert.equal(history.totalCost, state.history.reduce((total, week) => total + week.weeklyCost, 0));
  assert.deepEqual(state, before);
});

test("completed game completes the bounded analyst flow with verified evidence", async () => {
  const state = completedGame();
  const model = modelCallbacks();
  const result = await executeGameAnalyst({
    state,
    goal: "Analyze my game",
    modelStep: model.modelStep,
    modelStep2: model.modelStep2,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.stopReason, "completed");
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.finalOutput.findings[0].evidence[0].source, "game_history");
  assert.equal(model.receivedHistory.weeks[0].order, 2);
  assert.deepEqual(state, completedGame());
});

test("active game is rejected before either model call", async () => {
  let firstStepCalled = false;
  let secondStepCalled = false;
  const result = await executeGameAnalyst({
    state: createGameState(),
    goal: "Analyze my game",
    modelStep: async () => {
      firstStepCalled = true;
      return { kind: "refusal" };
    },
    modelStep2: async () => {
      secondStepCalled = true;
      return { kind: "refusal" };
    },
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "preflight_rejected");
  assert.equal(firstStepCalled, false);
  assert.equal(secondStepCalled, false);
});

test("invalid completed history is rejected before the second model call", async () => {
  const state = completedGame();
  state.history[2].week = 8;
  let secondStepCalled = false;
  const result = await executeGameAnalyst({
    state,
    goal: "Analyze my game",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "getGameHistory", arguments: {} },
    }),
    modelStep2: async () => {
      secondStepCalled = true;
      return { kind: "refusal" };
    },
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "preflight_rejected");
  assert.equal(secondStepCalled, false);
});

test("finding that references a nonexistent week is rejected", async () => {
  const model = modelCallbacks((history) => ({
    ...validAnalysis(history),
    findings: [{
      ...validAnalysis(history).findings[0],
      weeks: [11],
    }],
  }));
  const result = await executeGameAnalyst({
    state: completedGame(),
    goal: "Analyze my game",
    modelStep: model.modelStep,
    modelStep2: model.modelStep2,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stopReason, "invalid_final_result");
});

test("analysis rejects more than six findings", async () => {
  const model = modelCallbacks((history) => ({
    ...validAnalysis(history),
    findings: Array(7).fill(validAnalysis(history).findings[0]),
  }));
  const result = await executeGameAnalyst({
    state: completedGame(),
    goal: "Analyze my game",
    modelStep: model.modelStep,
    modelStep2: model.modelStep2,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stopReason, "invalid_final_result");
});

test("analysis rejects an uncalculated bullwhip metric claim", async () => {
  const model = modelCallbacks((history) => ({
    ...validAnalysis(history),
    findings: [{
      ...validAnalysis(history).findings[0],
      explanation: "The bullwhip ratio was 2.4.",
    }],
  }));
  const result = await executeGameAnalyst({
    state: completedGame(),
    goal: "Analyze my game",
    modelStep: model.modelStep,
    modelStep2: model.modelStep2,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stopReason, "invalid_final_result");
});

test("analysis without evidence is rejected", async () => {
  const model = modelCallbacks((history) => ({
    ...validAnalysis(history),
    findings: [{ ...validAnalysis(history).findings[0], evidence: [] }],
  }));
  const result = await executeGameAnalyst({
    state: completedGame(),
    goal: "Analyze my game",
    modelStep: model.modelStep,
    modelStep2: model.modelStep2,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stopReason, "invalid_final_result");
});

test("unknown tool is rejected without a second model call", async () => {
  let secondStepCalled = false;
  const result = await executeGameAnalyst({
    state: completedGame(),
    goal: "Analyze my game",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "readEverything", arguments: {} },
    }),
    modelStep2: async () => {
      secondStepCalled = true;
      return { kind: "refusal" };
    },
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "unknown_tool");
  assert.equal(secondStepCalled, false);
});

test("analyst cannot loop into another tool request", async () => {
  const result = await executeGameAnalyst({
    state: completedGame(),
    goal: "Analyze my game",
    modelStep: async () => ({
      kind: "tool_request",
      toolRequest: { name: "getGameHistory", arguments: {} },
    }),
    modelStep2: async () => ({
      kind: "tool_request",
      toolRequest: { name: "getGameHistory", arguments: {} },
    }),
  });

  assert.equal(result.status, "stopped");
  assert.equal(result.stopReason, "step_limit");
  assert.equal(result.toolCallCount, 1);
});