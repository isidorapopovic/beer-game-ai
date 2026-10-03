import type { GameStateSnapshot, HintResponse, ModelName } from "./contracts.ts";
import type { HintModelClient, HintModelRequest } from "./hintService.ts";

export type FakeModelBehavior = (
  request: HintModelRequest,
) => unknown | Promise<unknown>;

export class FakeHintModelClient implements HintModelClient {
  readonly calls: ModelName[] = [];
  readonly requests: Array<
    Pick<
      HintModelRequest,
      "model" | "phase" | "reasoningEffort" | "maxOutputTokens" | "requestId"
    >
  > = [];
  private readonly behaviors: Partial<Record<ModelName, FakeModelBehavior>>;

  constructor(
    behaviors: Partial<Record<ModelName, FakeModelBehavior>> = {},
  ) {
    this.behaviors = behaviors;
  }

  async complete(request: HintModelRequest): Promise<unknown> {
    this.calls.push(request.model);
    this.requests.push({
      model: request.model,
      phase: request.phase,
      reasoningEffort: request.reasoningEffort,
      maxOutputTokens: request.maxOutputTokens,
      requestId: request.requestId,
    });

    const behavior = this.behaviors[request.model];
    if (behavior) {
      return behavior(request);
    }

    const snapshot =
      request.snapshot ??
      (await request.invokeTool({
        name: "get_game_state",
        arguments: {
          detail: request.phase === "in_game" ? "tactical" : "summary",
        },
      }));

    return makeFakeHint(snapshot);
  }
}

function makeFakeHint(snapshot: GameStateSnapshot): HintResponse {
  const common = { phase: snapshot.phase, urgency: "low" as const };

  if (snapshot.phase === "pre_game") {
    return {
      ...common,
      hint: "Balance inventory holding cost against backorder cost. Orders take two weeks to arrive, so use the visible inventory, demand, and shipment information without assuming future demand.",
      suggestedAction: "review_pipeline",
    };
  }

  if (snapshot.phase === "completed") {
    const summary = snapshot.completedSummary!;
    const history = snapshot.completedHistory!;
    const formatWeeks = (count: number) => `${count} ${count === 1 ? "week" : "weeks"}`;
    const inventoryAboveDemandWeeks = history.filter(
      (week) => week.endingInventory > week.demand,
    ).length;
    const inventoryBelowDemandWeeks = history.filter(
      (week) => week.endingInventory < week.demand,
    ).length;
    const weeksWithBackorders = history.filter(
      (week) => week.endingBackorders > 0,
    ).length;
    const ordersWithShipmentInTransit = history.filter(
      (week) => week.orderPlaced > 0 && week.inTransitAtOrder > 0,
    );
    const ordersLargerThanInTransit = ordersWithShipmentInTransit.filter(
      (week) => week.orderPlaced > week.inTransitAtOrder,
    ).length;
    const comparableOrders = history.flatMap((week) => {
      const arrivalDemand = history.find(
        (laterWeek) => laterWeek.week === week.week + 2,
      )?.demand;
      return arrivalDemand === undefined
        ? []
        : [{ order: week.orderPlaced, arrivalDemand }];
    });
    const ordersBelowArrivalDemand = comparableOrders.filter(
      (week) => week.order < week.arrivalDemand,
    ).length;
    const ordersAboveArrivalDemand = comparableOrders.filter(
      (week) => week.order > week.arrivalDemand,
    ).length;
    const shipmentPattern =
      ordersWithShipmentInTransit.length === 0
        ? "No new order was placed while a shipment was already in transit."
        : `New orders were placed while shipments were already in transit in ${ordersWithShipmentInTransit.length} weeks; the new order exceeded the pending shipment quantity in ${ordersLargerThanInTransit} of those weeks.`;

    return {
      ...common,
      hint: `Based on the observed game history, ending inventory was above that week's demand in ${inventoryAboveDemandWeeks} of 10 weeks and below it in ${formatWeeks(inventoryBelowDemandWeeks)}; backorders were present in ${formatWeeks(weeksWithBackorders)}. Among weeks with a recorded arrival demand, orders were below that demand in ${formatWeeks(ordersBelowArrivalDemand)} and above it in ${formatWeeks(ordersAboveArrivalDemand)}. ${shipmentPattern} The pattern suggests both inventory and backorder outcomes contributed to the observed total cost of $${summary.totalCost.toFixed(2)} and ${summary.serviceLevel.toFixed(1)}% service level, though these figures alone do not establish causation. One possible improvement would be to compare the observed arrival schedule and backlog before adjusting later orders.`,
      suggestedAction: "review_results",
    };
  }

  if (snapshot.backorders > 0) {
    return {
      ...common,
      hint: `There are ${snapshot.backorders} backordered units against demand of ${snapshot.customerDemand}. Incoming shipments are delayed, so a new order will not resolve the current shortage immediately.`,
      suggestedAction: "order_more",
    };
  }

  if (
    snapshot.pipelineSummary &&
    snapshot.pipelineSummary.shipmentsInTransit > 0 &&
    snapshot.pipelineSummary.nextArrivalWeek !== null &&
    snapshot.pipelineSummary.nextArrivalQuantity > 0
  ) {
    return {
      ...common,
      hint: `There are ${snapshot.pipelineSummary.nextArrivalQuantity} units already scheduled to arrive in Week ${snapshot.pipelineSummary.nextArrivalWeek}. Review that pipeline before increasing the next order.`,
      suggestedAction: "review_pipeline",
    };
  }

  if (snapshot.inventory > snapshot.customerDemand + snapshot.incomingShipment) {
    return {
      ...common,
      hint: "Inventory is above this week's demand, and holding stock adds cost. Review the shipment pipeline before increasing the next order.",
      suggestedAction: "review_pipeline",
    };
  }

  return {
    ...common,
    hint: "Use the visible demand, inventory, and incoming shipment together when choosing your next order. The two-week delay means today's order affects a later week.",
    suggestedAction: "keep_order_stable",
  };
}