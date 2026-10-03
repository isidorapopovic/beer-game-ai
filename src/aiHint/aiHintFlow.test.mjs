import assert from "node:assert/strict";
import test from "node:test";
import { AI_HINT_CALLER, HintFlowError } from "./contracts.ts";
import { FakeHintModelClient } from "./fakeHintModelClient.ts";
import { projectGameStateSnapshot } from "./getGameStateTool.ts";
import { requestAIHint } from "./hintService.ts";
import { createGameState, submitOrder } from "../game/gameEngine.ts";

const VALID_TOOL_PROPOSAL = {
  name: "get_game_state",
  arguments: { detail: "summary" },
};

function makeCompletedState() {
  let state = createGameState();
  for (let week = 0; week < 10; week += 1) {
    state = submitOrder(state, week === 0 ? 5 : 0);
  }
  return state;
}

function makeHarness({
  state = createGameState(),
  caller = AI_HINT_CALLER,
  modelClient = new FakeHintModelClient(),
  readGameState,
  timeoutMs = 100,
  signal,
} = {}) {
  const calls = [];
  const options = {
    state,
    caller,
    modelClient,
    timeoutMs,
    signal,
    requestIdFactory: () => "req_hint_test_004",
    readGameState:
      readGameState ??
      ((proposal, request) => {
        calls.push({ proposal, requestId: request.requestId });
        return projectGameStateSnapshot(state, proposal.arguments);
      }),
  };

  return { options, calls, state, modelClient };
}

test("T1/M1: valid pre-game request uses Luna and one sanitized tool call", async () => {
  const harness = makeHarness();
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.modelCalls, 1);
  assert.deepEqual(result.models, ["gpt-6-luna"]);
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.requestId, "req_hint_test_004");
  assert.deepEqual(harness.calls, [
    {
      proposal: VALID_TOOL_PROPOSAL,
      requestId: "req_hint_test_004",
    },
  ]);
  assert.equal(result.response.phase, "pre_game");
  assert.equal(result.response.suggestedAction, "review_pipeline");
  assert.equal(
    harness.modelClient.requests[0].requestId,
    "req_hint_test_004",
  );
  assert.equal(harness.modelClient.requests[0].reasoningEffort, "low");
  assert.equal(harness.modelClient.requests[0].maxOutputTokens, 220);
  assert.equal(result.telemetry.operation, "game.hint.state");
  assert.equal(result.telemetry.requestId, result.requestId);
  assert.deepEqual(Object.keys(result.telemetry).sort(), [
    "attempts",
    "latencyMs",
    "operation",
    "requestId",
    "status",
  ]);
  assert.ok(Number.isFinite(result.telemetry.latencyMs));
});

test("T9: repeated tool proposal is rejected after one execution", async () => {
  let toolExecutions = 0;
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": async ({ invokeTool }) => {
      const snapshot = await invokeTool(VALID_TOOL_PROPOSAL);
      await assert.rejects(
        invokeTool(VALID_TOOL_PROPOSAL),
        (error) => error.status === "UNSUPPORTED_TOOL",
      );
      return {
        phase: snapshot.phase,
        hint: "The snapshot is available.",
        suggestedAction: "review_pipeline",
        urgency: "low",
      };
    },
  });
  const harness = makeHarness({
    modelClient,
    readGameState: (proposal, request) => {
      toolExecutions += 1;
      return projectGameStateSnapshot(harness.state, proposal.arguments);
    },
  });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.attempts, 1);
  assert.equal(toolExecutions, 1);
});

test("T2: invalid arguments are rejected before the tool client", async () => {
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": ({ invokeTool }) =>
      invokeTool({
        name: "get_game_state",
        arguments: { detail: "everything" },
      }),
  });
  const harness = makeHarness({ modelClient });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "INVALID_INPUT");
  assert.equal(result.toolCallCount, 0);
  assert.equal(result.attempts, 0);
  assert.equal(result.modelCalls, 1);
  assert.equal(result.message, "AI hint is currently unavailable. Please continue using the visible game information.");
  assert.equal(JSON.stringify(result.telemetry).includes("everything"), false);
  assert.equal(harness.calls.length, 0);
  assert.deepEqual(modelClient.calls, ["gpt-6-luna"]);
});

test("T3: malicious extra argument is rejected before tool execution", async () => {
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": ({ invokeTool }) =>
      invokeTool({
        name: "get_game_state",
        arguments: { detail: "summary", executeCode: "not executed" },
      }),
  });
  const harness = makeHarness({ modelClient });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "INVALID_INPUT");
  assert.equal(result.toolCallCount, 0);
  assert.equal(result.message, "AI hint is currently unavailable. Please continue using the visible game information.");
  assert.equal(JSON.stringify(result.telemetry).includes("executeCode"), false);
  assert.equal(harness.calls.length, 0);
});

test("T4/M5: forbidden caller makes no model or tool call", async () => {
  const harness = makeHarness({ caller: "order_form" });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "FORBIDDEN");
  assert.equal(result.modelCalls, 0);
  assert.equal(result.toolCallCount, 0);
  assert.equal(result.attempts, 0);
  assert.equal(harness.calls.length, 0);
  assert.equal(result.message, "AI hint is currently unavailable. Please continue using the visible game information.");
});

test("T5: unsupported tool is rejected without dispatch", async () => {
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": ({ invokeTool }) =>
      invokeTool({ name: "place_order", arguments: { quantity: 99 } }),
  });
  const harness = makeHarness({ modelClient });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "UNSUPPORTED_TOOL");
  assert.equal(result.toolCallCount, 0);
  assert.equal(result.message, "AI hint is currently unavailable. Please continue using the visible game information.");
  assert.equal(harness.calls.length, 0);
});

test("T6: not-found tool failure is not retried", async () => {
  let attempts = 0;
  const harness = makeHarness({
    readGameState: () => {
      attempts += 1;
      throw new HintFlowError("NOT_FOUND", "Snapshot unavailable.");
    },
  });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "NOT_FOUND");
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.attempts, 1);
  assert.equal(attempts, 1);
  assert.deepEqual(harness.modelClient.calls, ["gpt-6-luna"]);
});

test("T7: retryable tool failure succeeds on the second bounded attempt", async () => {
  let attempts = 0;
  const requestIds = [];
  const state = createGameState();
  const harness = makeHarness({
    state,
    readGameState: (proposal, request) => {
      attempts += 1;
      requestIds.push(request.requestId);
      if (attempts === 1) {
        throw new HintFlowError("UPSTREAM_UNAVAILABLE", "Temporary failure.");
      }
      return projectGameStateSnapshot(state, proposal.arguments);
    },
  });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.attempts, 2);
  assert.equal(result.toolCallCount, 1);
  assert.equal(attempts, 2);
  assert.deepEqual(requestIds, ["req_hint_test_004", "req_hint_test_004"]);
  assert.equal(result.modelCalls, 1);
});

test("T8: retryable tool failure stops after two attempts without model fallback", async () => {
  let attempts = 0;
  const harness = makeHarness({
    readGameState: () => {
      attempts += 1;
      throw new HintFlowError("UPSTREAM_UNAVAILABLE", "Still unavailable.");
    },
  });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "UPSTREAM_UNAVAILABLE");
  assert.equal(result.attempts, 2);
  assert.equal(attempts, 2);
  assert.equal(result.modelCalls, 1);
  assert.deepEqual(harness.modelClient.calls, ["gpt-6-luna"]);
});

test("T9: tool timeout is bounded to two attempts", async () => {
  let attempts = 0;
  const harness = makeHarness({
    timeoutMs: 5,
    readGameState: () => {
      attempts += 1;
      return new Promise(() => {});
    },
  });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "TIMEOUT");
  assert.equal(result.attempts, 2);
  assert.equal(attempts, 2);
  assert.equal(result.modelCalls, 1);
});

test("T10: malformed tool output is rejected with no false success", async () => {
  const harness = makeHarness({
    readGameState: () => ({ week: "five", inventory: -20 }),
  });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "MALFORMED_OUTPUT");
  assert.equal(result.attempts, 1);
  assert.equal(result.response, null);
  assert.deepEqual(harness.modelClient.calls, ["gpt-6-luna"]);
});

test("T11/M2: malformed Luna response uses Sol once and validates its response", async () => {
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": async (request) => {
      await request.invokeTool(VALID_TOOL_PROPOSAL);
      return {
        phase: "pre_game",
        hint: 123,
        suggestedAction: "delete_game",
        urgency: "extreme",
      };
    },
  });
  const harness = makeHarness({ modelClient });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(modelClient.calls, ["gpt-6-luna", "gpt-6.1-sol"]);
  assert.equal(result.modelCalls, 2);
  assert.equal(result.fallbackReason, "MALFORMED_FINAL_OUTPUT");
  assert.equal(result.toolCallCount, 1);
  assert.deepEqual(modelClient.requests.map((request) => request.requestId), [
    "req_hint_test_004",
    "req_hint_test_004",
  ]);
  assert.equal(result.response.phase, "pre_game");
  assert.equal(result.response.suggestedAction, "review_pipeline");
});

test("M3: primary provider failure falls back once to Sol", async () => {
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": () => {
      throw new HintFlowError("PROVIDER_UNAVAILABLE", "Primary unavailable.");
    },
  });
  const harness = makeHarness({ modelClient });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(modelClient.calls, ["gpt-6-luna", "gpt-6.1-sol"]);
  assert.equal(result.modelCalls, 2);
  assert.equal(result.fallbackReason, "PROVIDER_UNAVAILABLE");
  assert.equal(result.toolCallCount, 1);
  assert.deepEqual(modelClient.requests.map((request) => request.requestId), [
    "req_hint_test_004",
    "req_hint_test_004",
  ]);
});

test("M3: primary model timeout falls back once to Sol", async () => {
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": () => new Promise(() => {}),
  });
  const harness = makeHarness({ modelClient, timeoutMs: 20 });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(modelClient.calls, ["gpt-6-luna", "gpt-6.1-sol"]);
  assert.equal(result.modelCalls, 2);
  assert.equal(result.fallbackReason, "TIMEOUT");
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.attempts, 1);
  assert.deepEqual(modelClient.requests.map((request) => request.requestId), [
    "req_hint_test_004",
    "req_hint_test_004",
  ]);
});

test("M4: two model failures stop at budget and return safe fallback", async () => {
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": () => {
      throw new HintFlowError("PROVIDER_UNAVAILABLE", "Primary unavailable.");
    },
    "gpt-6.1-sol": () => {
      throw new HintFlowError("PROVIDER_UNAVAILABLE", "Fallback unavailable.");
    },
  });
  const harness = makeHarness({ modelClient });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "AI_UNAVAILABLE");
  assert.equal(result.message, "AI hint is currently unavailable. Please continue using the visible game information.");
  assert.deepEqual(modelClient.calls, ["gpt-6-luna", "gpt-6.1-sol"]);
  assert.equal(result.modelCalls, 2);
  assert.equal(result.toolCallCount, 0);
});

test("M4: malformed primary and fallback responses stop at two model calls", async () => {
  const invalidResponse = {
    phase: "pre_game",
    hint: 123,
    suggestedAction: "delete_game",
    urgency: "extreme",
  };
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": async (request) => {
      await request.invokeTool(VALID_TOOL_PROPOSAL);
      return invalidResponse;
    },
    "gpt-6.1-sol": () => invalidResponse,
  });
  const harness = makeHarness({ modelClient });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "AI_UNAVAILABLE");
  assert.equal(result.message, "AI hint is currently unavailable. Please continue using the visible game information.");
  assert.deepEqual(modelClient.calls, ["gpt-6-luna", "gpt-6.1-sol"]);
  assert.equal(result.modelCalls, 2);
  assert.equal(result.toolCallCount, 1);
});

test("T12: hint flow leaves gameplay state unchanged", async () => {
  const state = createGameState();
  const before = structuredClone(state);
  const result = await requestAIHint(makeHarness({ state }).options);

  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(state, before);
});

test("T13: cancellation causes no tool call or retry", async () => {
  const controller = new AbortController();
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const modelClient = new FakeHintModelClient({
    "gpt-6-luna": ({ signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new HintFlowError("CANCELLED", "Cancelled in flight.")),
          { once: true },
        );
        markStarted();
      }),
  });
  const harness = makeHarness({ modelClient, signal: controller.signal });
  const pending = requestAIHint(harness.options);
  await started;
  controller.abort();
  const result = await pending;

  assert.equal(result.status, "CANCELLED");
  assert.equal(result.modelCalls, 1);
  assert.equal(result.toolCallCount, 0);
  assert.equal(result.attempts, 0);
  assert.deepEqual(modelClient.calls, ["gpt-6-luna"]);
  assert.equal(harness.calls.length, 0);
});

test("P2: in-game advice is phase-valid and remains advisory", async () => {
  const state = submitOrder(createGameState(), 5);
  const harness = makeHarness({ state });
  const result = await requestAIHint(harness.options);

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.response.phase, "in_game");
  assert.equal(harness.modelClient.requests[0].reasoningEffort, "low");
  assert.equal(harness.modelClient.requests[0].maxOutputTokens, 260);
  assert.ok(["order_more", "order_less", "keep_order_stable", "review_pipeline", "wait"].includes(result.response.suggestedAction));
});

test("P3: in-game shortage advice notes backorders and shipping delay", async () => {
  let state = createGameState();
  for (let week = 0; week < 4; week += 1) {
    state = submitOrder(state, 0);
  }
  const result = await requestAIHint(makeHarness({ state }).options);

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.response.phase, "in_game");
  assert.match(result.response.hint, /backordered units/);
  assert.match(result.response.hint, /delayed/);
  assert.equal(result.response.suggestedAction, "order_more");
});

test("P4: in-transit shipment is surfaced before recommending another order", async () => {
  const state = submitOrder(createGameState(), 5);
  const result = await requestAIHint(makeHarness({ state }).options);

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.response.phase, "in_game");
  assert.match(result.response.hint, /5 units already scheduled to arrive in Week 3/);
  assert.equal(result.response.suggestedAction, "review_pipeline");
});

test("P5: completed game receives results-only action and sanitized summary", async () => {
  const state = makeCompletedState();
  const before = structuredClone(state);
  const harness = makeHarness({ state });
  const result = await requestAIHint(harness.options);
  const completedProposal = harness.calls[0].proposal;
  const snapshot = projectGameStateSnapshot(state, completedProposal.arguments);

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.requestId, "req_hint_test_004");
  assert.equal(result.response.phase, "completed");
  assert.equal(result.response.suggestedAction, "review_results");
  assert.match(result.response.hint, /inventory was above that week's demand/);
  assert.match(result.response.hint, /backorders were present in/);
  assert.match(result.response.hint, /orders were below that demand/);
  assert.match(result.response.hint, /while a shipment was already in transit/);
  assert.match(result.response.hint, /One possible improvement would be/);
  assert.match(result.response.hint, /above that week's demand in 4 of 10 weeks and below it in 6/);
  assert.match(result.response.hint, /backorders were present in 6 weeks/);
  assert.match(result.response.hint, /orders were below that demand in 7 weeks and above it in 1 week/);
  assert.match(result.response.hint, /No new order was placed while a shipment was already in transit/);
  assert.equal(harness.modelClient.requests[0].reasoningEffort, "medium");
  assert.equal(harness.modelClient.requests[0].maxOutputTokens, 500);
  assert.equal(harness.modelClient.requests[0].requestId, result.requestId);
  assert.equal(harness.calls[0].requestId, result.requestId);
  assert.equal(snapshot.completedHistory.length, 10);
  assert.equal(snapshot.completedHistory[0].orderPlaced, 5);
  assert.equal(snapshot.completedHistory[1].inTransitAtOrder, 5);
  assert.equal(snapshot.completedSummary.totalCustomerDemand, 64);
  assert.equal("history" in snapshot, false);
  assert.deepEqual(state, before);
});