import { useState, type FormEvent } from "react";
import {
  AI_HINT_CALLER,
  SAFE_HINT_FALLBACK,
} from "./aiHint/contracts";
import type { HintFlowResult } from "./aiHint/hintService";
import { FakeHintModelClient } from "./aiHint/fakeHintModelClient";
import { createSnapshotReader } from "./aiHint/hintService";
import {
  createGameState,
  getGameSummary,
  submitOrder,
} from "./game/gameEngine";
import type { GameState } from "./game/gameEngine";
import { requestAIHint } from "./aiHint/hintService";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function App() {
  const [initialization] = useState(() => {
    try {
      return { state: createGameState(), error: null };
    } catch (error) {
      return {
        state: null,
        error:
          error instanceof Error
            ? error.message
            : "The game configuration could not be validated.",
      };
    }
  });
  const [gameState, setGameState] = useState<GameState | null>(
    initialization.state,
  );
  const [orderInput, setOrderInput] = useState("");
  const [actionError, setActionError] = useState("");
  const [hintResult, setHintResult] = useState<HintFlowResult | null>(null);
  const [hintDisplayError, setHintDisplayError] = useState("");
  const [hintLoading, setHintLoading] = useState(false);

  if (!gameState) {
    return (
      <main className="app-shell config-failure" role="alert">
        <p className="eyebrow">Retailer simulation unavailable</p>
        <h1>Game configuration error</h1>
        <p>{initialization.error}</p>
      </main>
    );
  }

  const summary = getGameSummary(gameState);
  const isComplete = gameState.isComplete;

  async function handleAskForHint() {
    if (hintLoading || !gameState) {
      return;
    }

    const requestedState = gameState;
    setHintLoading(true);
    setHintResult(null);
    setHintDisplayError("");

    try {
      const result = await requestAIHint({
        state: requestedState,
        caller: AI_HINT_CALLER,
        modelClient: new FakeHintModelClient(),
        readGameState: createSnapshotReader(requestedState),
      });
      setHintResult(result);
    } catch {
      setHintDisplayError(SAFE_HINT_FALLBACK);
    } finally {
      setHintLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!gameState || gameState.isComplete) {
      return;
    }

    if (orderInput.trim() === "") {
      setActionError("Enter an order quantity of zero or more.");
      return;
    }

    const quantity = Number(orderInput);

    try {
      setGameState(submitOrder(gameState, quantity));
      setOrderInput("");
      setActionError("");
      setHintResult(null);
      setHintDisplayError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The order was not accepted.",
      );
    }
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            BD
          </span>
          <div>
            <p className="eyebrow">Supply chain simulation</p>
            <h1>Beer Distribution Game</h1>
          </div>
        </div>
        <span className="role-label">Retailer</span>
      </header>

      <section className="week-banner" aria-labelledby="week-heading">
        <div>
          <p className="eyebrow">Retail operations</p>
          <h2 id="week-heading">
            Week <span>{gameState.currentWeek}</span>
            <span className="week-total"> / {gameState.config.totalWeeks}</span>
          </h2>
        </div>
        <div
          className="week-progress"
          role="progressbar"
          aria-label="Simulation progress"
          aria-valuemin={0}
          aria-valuemax={gameState.config.totalWeeks}
          aria-valuenow={gameState.currentWeek}
        >
          <span
            style={{
              width: `${(gameState.currentWeek / gameState.config.totalWeeks) * 100}%`,
            }}
          />
        </div>
        <span className="week-status">
          {isComplete ? "Complete" : "In progress"}
        </span>
      </section>

      <section className="dashboard-grid" aria-label="Current game state">
        <div className="state-column">
          <dl className="metrics-grid">
            <div className="metric metric-demand">
              <dt>Customer demand</dt>
              <dd>{gameState.customerDemand}</dd>
              <span>units this week</span>
            </div>
            <div className="metric metric-inventory">
              <dt>Current inventory</dt>
              <dd>{gameState.inventory}</dd>
              <span>units available after demand</span>
            </div>
            <div className="metric metric-backorders">
              <dt>Backorders</dt>
              <dd>{gameState.backorders}</dd>
              <span>units still unfulfilled</span>
            </div>
            <div className="metric metric-incoming">
              <dt>Incoming shipment</dt>
              <dd>{gameState.incomingShipment}</dd>
              <span>units received this week</span>
            </div>
          </dl>

          <div className="secondary-metrics">
            <div>
              <span className="eyebrow">Previous order</span>
              <strong>{gameState.previousOrder} units</strong>
            </div>
            <div>
              <span className="eyebrow">Weekly cost</span>
              <strong>{currency.format(summary.weeklyCost)}</strong>
            </div>
            <div>
              <span className="eyebrow">Total cost</span>
              <strong className="total-cost">
                {currency.format(summary.totalCost)}
              </strong>
            </div>
          </div>

          <section className="pipeline" aria-labelledby="pipeline-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Shipment pipeline</p>
                <h3 id="pipeline-heading">On the way</h3>
              </div>
              <span className="pipeline-delay">2-week delay</span>
            </div>
            {gameState.shipments.length === 0 ? (
              <p className="empty-pipeline">No shipments in transit</p>
            ) : (
              <ul className="shipment-list">
                {gameState.shipments
                  .slice()
                  .sort((first, second) => first.arrivalWeek - second.arrivalWeek)
                  .map((shipment, index) => (
                    <li key={`${shipment.arrivalWeek}-${index}`}>
                      <span className="shipment-marker" aria-hidden="true" />
                      <span>Week {shipment.arrivalWeek}</span>
                      <strong>{shipment.quantity} units</strong>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="order-panel" aria-labelledby="order-heading">
          {isComplete ? (
            <div className="completion-state">
              <p className="eyebrow">Week 10 closed</p>
              <h2 id="order-heading">Simulation Complete</h2>
              <p>Final total cost</p>
              <strong>{currency.format(summary.totalCost)}</strong>
            </div>
          ) : (
            <>
              <div className="section-heading order-heading">
                <div>
                  <p className="eyebrow">Retailer decision</p>
                  <h2 id="order-heading">Place an order</h2>
                </div>
                <span className="previous-order">Last: {gameState.previousOrder}</span>
              </div>
              <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="order-quantity">Order quantity</label>
                <div className="input-row">
                  <input
                    id="order-quantity"
                    name="orderQuantity"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={orderInput}
                    onChange={(event) => {
                      setOrderInput(event.target.value);
                      setActionError("");
                    }}
                    aria-invalid={actionError !== ""}
                    aria-describedby={actionError ? "order-error" : undefined}
                    disabled={isComplete}
                  />
                  <span>units</span>
                </div>
                {actionError && (
                  <p className="inline-error" id="order-error" role="alert">
                    {actionError}
                  </p>
                )}
                <button type="submit" disabled={isComplete}>
                  Submit order <span aria-hidden="true">→</span>
                </button>
              </form>
            </>
          )}
          <button
            className="hint-trigger"
            type="button"
            onClick={handleAskForHint}
            disabled={hintLoading}
          >
            {hintLoading ? "Requesting hint..." : "Ask AI for Hint"}
          </button>
          {(hintResult || hintDisplayError) && (
            <section
              className="hint-response"
              aria-live="polite"
              role="status"
            >
              <p className="eyebrow">AI hint</p>
              <p>{hintResult?.message ?? hintDisplayError}</p>
              {hintResult?.response && (
                <div className="hint-details">
                  <span>
                    Suggested action: {hintResult.response.suggestedAction.replaceAll("_", " ")}
                  </span>
                  <span>Urgency: {hintResult.response.urgency}</span>
                </div>
              )}
            </section>
          )}
        </aside>
      </section>

      {isComplete && (
        <section className="summary-section" aria-labelledby="summary-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ten-week result</p>
              <h2 id="summary-heading">Simulation summary</h2>
            </div>
          </div>
          <dl className="summary-grid">
            <div>
              <dt>Average weekly inventory</dt>
              <dd>{summary.averageWeeklyInventory.toFixed(1)} units</dd>
            </div>
            <div>
              <dt>Total backordered units</dt>
              <dd>{summary.totalBackorderedUnits}</dd>
            </div>
            <div>
              <dt>Maximum backorder</dt>
              <dd>{summary.maximumBackorder}</dd>
            </div>
            <div>
              <dt>Total customer demand</dt>
              <dd>{summary.totalCustomerDemand}</dd>
            </div>
            <div>
              <dt>Total units sold</dt>
              <dd>{summary.totalUnitsSold}</dd>
            </div>
            <div>
              <dt>Service level</dt>
              <dd>{summary.serviceLevel.toFixed(1)}%</dd>
            </div>
          </dl>
        </section>
      )}

      <footer className="footer-line">
        <span>Retailer</span>
        <span>Week {gameState.currentWeek} of {gameState.config.totalWeeks}</span>
      </footer>
    </main>
  );
}

export default App;