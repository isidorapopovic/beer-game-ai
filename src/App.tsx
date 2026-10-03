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
import {
  executeCandidateOrderSimulation,
} from "./agent/candidateOrderSimulation";
import type {
  CandidateOrderAdviceResult,
  CandidateOrderSimulationResult,
} from "./agent/candidateOrderSimulation";
import {
  executeDecisionCoach,
  type DecisionCoachResult,
} from "./agent/decisionCoach";
import {
  executeGameAnalyst,
  formatGameHistoryFact,
} from "./agent/gameAnalyst";
import type {
  GameHistoryResult,
  PostGameAnalysisResult,
} from "./agent/gameAnalyst";
import {
  executeScenarioGenerator,
  generateScenarioDemand,
  type ScenarioDifficulty,
  type ScenarioType,
  type ScenarioSelectionResult,
} from "./agent/scenarioGenerator";

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
  const [candidateAdvice, setCandidateAdvice] = useState<CandidateOrderAdviceResult | null>(null);
  const [candidateError, setCandidateError] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [decisionCoachResult, setDecisionCoachResult] = useState<DecisionCoachResult | null>(null);
  const [decisionCoachError, setDecisionCoachError] = useState("");
  const [decisionCoachLoading, setDecisionCoachLoading] = useState(false);
  const [postGameAnalysis, setPostGameAnalysis] = useState<PostGameAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [scenarioSelection, setScenarioSelection] = useState<ScenarioSelectionResult | null>(null);
  const [scenarioError, setScenarioError] = useState("");
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("growth");
  const [selectedDifficulty, setSelectedDifficulty] = useState<ScenarioDifficulty>("medium");

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

  async function handleSimulateCandidateOrder() {
    if (candidateLoading || !gameState || gameState.isComplete) {
      return;
    }

    const requestedState = gameState;
    setCandidateLoading(true);
    setCandidateAdvice(null);
    setCandidateError("");

    try {
      const result = await executeCandidateOrderSimulation({
        state: requestedState,
        goal: "What should I order?",
        modelStep: async () => ({
          kind: "tool_request",
          toolRequest: {
            name: "simulateCandidateOrder",
            arguments: { orderQuantity: requestedState.previousOrder },
          },
        }),
        modelStep2: async (_run, toolResult) => {
          const simulation = toolResult as CandidateOrderSimulationResult;
          return {
            kind: "final",
            final: {
              summary: "The demo model checked the candidate against the current shipment pipeline.",
              recommendation: `Candidate order: ${simulation.orderQuantity} units.`,
              recommendedOrderQuantity: simulation.orderQuantity,
              simulation,
              evidence: [
                {
                  source: "candidate_order_simulation",
                  fact: simulation.candidateShipmentArrivalWeek === undefined
                    ? "The game ends before a new order could arrive."
                    : `The candidate order is scheduled to arrive in week ${simulation.candidateShipmentArrivalWeek}.`,
                },
              ],
              confidence: "medium",
              completed: true,
            },
          };
        },
      });

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error("The candidate simulation could not be completed.");
      }
      setCandidateAdvice(result.finalOutput);
    } catch (error) {
      setCandidateError(error instanceof Error ? error.message : "The candidate simulation failed.");
    } finally {
      setCandidateLoading(false);
    }
  }

  async function handleAskForDecisionCoach() {
    if (decisionCoachLoading || !gameState || gameState.isComplete) {
      return;
    }

    const requestedState = gameState;
    setDecisionCoachLoading(true);
    setDecisionCoachResult(null);
    setDecisionCoachError("");

    try {
      const result = await executeDecisionCoach({
        state: requestedState,
        goal: "How much should I order this week and why?",
        modelStep: async () => ({
          kind: "tool_request",
          toolRequest: { name: "getCurrentGameState", arguments: {} },
        }),
        modelStep2: async (_run, toolResult) => {
          const snapshot = toolResult as {
            week: number;
            inventory: number;
            backorder: number;
            incomingShipments: number[];
            recentDemand: number[];
            recentOrders: number[];
            totalCost: number;
          };
          const latestDemand = snapshot.recentDemand[snapshot.recentDemand.length - 1] ?? 0;
          const recommendedOrderQuantity = Math.max(
            0,
            Math.min(50, latestDemand + snapshot.backorder - snapshot.inventory),
          );

          return {
            kind: "final",
            final: {
              summary: "The current pipeline suggests a modest increase when backlog and recent demand are both elevated.",
              recommendation: `Order ${recommendedOrderQuantity} units.`,
              recommendedOrderQuantity,
              evidence: [
                {
                  source: "game_state",
                  fact: `Inventory is ${snapshot.inventory} units while backorders total ${snapshot.backorder}.`,
                },
                {
                  source: "game_state",
                  fact: `Recent demand is ${snapshot.recentDemand.join(", ")} and incoming shipments are ${snapshot.incomingShipments.join(", ") || "none"}.`,
                },
              ],
              confidence: "medium",
              completed: true,
            },
          };
        },
      });

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error("The decision coach could not complete a valid recommendation.");
      }
      setDecisionCoachResult(result.finalOutput);
    } catch (error) {
      setDecisionCoachError(error instanceof Error ? error.message : "The decision coach failed.");
    } finally {
      setDecisionCoachLoading(false);
    }
  }

  async function handleGenerateScenario() {
    setScenarioLoading(true);
    setScenarioSelection(null);
    setScenarioError("");

    try {
      const baseState = createGameState();
      const result = await executeScenarioGenerator({
        state: baseState,
        goal: `Create a ${selectedScenario} ${selectedDifficulty} pre-game scenario for a new run.`,
        modelStep: async () => ({
          kind: "tool_request",
          toolRequest: { name: "getAllowedScenarioTypes", arguments: {} },
        }),
        modelStep2: async () => ({
          kind: "final",
          final: {
            summary: `The selected ${selectedScenario} scenario uses ${selectedDifficulty} difficulty and is approved for a new game start.`,
            scenario: selectedScenario,
            difficulty: selectedDifficulty,
            explanation: `The ${selectedScenario} scenario is appropriate because it follows the trusted approved catalog and uses ${selectedDifficulty} intensification for a new game run.`,
            evidence: [
              { source: "allowed_scenarios", fact: selectedScenario },
              { source: "allowed_scenarios", fact: selectedDifficulty },
            ],
            confidence: "medium",
            completed: true,
          },
        }),
      });

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error("The scenario generator could not select a valid profile.");
      }

      const demandSequence = generateScenarioDemand({
        scenario: result.finalOutput.scenario,
        difficulty: result.finalOutput.difficulty,
        seed: Date.now() % 17,
      });
      const nextGame = createGameState(undefined, demandSequence);

      setGameState(nextGame);
      setOrderInput("");
      setActionError("");
      setHintResult(null);
      setHintDisplayError("");
      setCandidateAdvice(null);
      setCandidateError("");
      setDecisionCoachResult(null);
      setDecisionCoachError("");
      setScenarioSelection(result.finalOutput);
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : "The scenario generator failed.");
    } finally {
      setScenarioLoading(false);
    }
  }

  async function handleAnalyzeGame() {
    if (analysisLoading || !gameState || !gameState.isComplete) {
      return;
    }

    const completedState = gameState;
    setAnalysisLoading(true);
    setPostGameAnalysis(null);
    setAnalysisError("");

    try {
      const result = await executeGameAnalyst({
        state: completedState,
        goal: "Analyze my completed Beer Game and give evidence-based lessons.",
        modelStep: async () => ({
          kind: "tool_request",
          toolRequest: { name: "getGameHistory", arguments: {} },
        }),
        modelStep2: async (_run, toolResult) => {
          const history = toolResult as GameHistoryResult;
          const highestCostWeek = history.weeks.reduce((highest, week) => (
            week.cost > highest.cost ? week : highest
          ));
          const costFact = formatGameHistoryFact(highestCostWeek, "cost");
          return {
            kind: "final",
            final: {
              summary: `The game finished with ${currency.format(history.totalCost)} in total cost across ${history.totalWeeks} weeks.`,
              findings: [{
                type: "cost_driver",
                title: `Highest weekly cost: Week ${highestCostWeek.week}`,
                explanation: `${costFact} Review the inventory and backorder pattern from this week when planning your next game.`,
                weeks: [highestCostWeek.week],
                evidence: [{ source: "game_history", fact: costFact }],
              }],
              nextGameAdvice: [
                "Account for the verified two-week shipping delay before reacting to a shortage.",
                "Compare each order with the demand and shipment history before making a large adjustment.",
              ],
              confidence: "medium",
              completed: true,
            },
          };
        },
      });

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error("The game analysis could not be completed.");
      }
      setPostGameAnalysis(result.finalOutput);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The game analysis failed.");
    } finally {
      setAnalysisLoading(false);
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
      setCandidateAdvice(null);
      setCandidateError("");
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
              <button
                className="hint-trigger analyze-trigger"
                type="button"
                onClick={handleAnalyzeGame}
                disabled={analysisLoading}
              >
                {analysisLoading ? "Analyzing game..." : "Analyze my game"}
              </button>
              {analysisError && <p className="inline-error" role="alert">{analysisError}</p>}
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
              <button
                className="hint-trigger"
                type="button"
                onClick={handleSimulateCandidateOrder}
                disabled={candidateLoading || isComplete}
              >
                {candidateLoading ? "Simulating candidate..." : "Simulate candidate order"}
              </button>
            </>
          )}
          <button
            className="hint-trigger"
            type="button"
            onClick={handleAskForDecisionCoach}
            disabled={decisionCoachLoading || isComplete}
          >
            {decisionCoachLoading ? "Consulting decision coach..." : "AI Decision Coach"}
          </button>
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
          {(decisionCoachResult || decisionCoachError) && (
            <section className="decision-coach" aria-live="polite" role="status">
              <p className="eyebrow">Decision coach · bounded flow</p>
              {decisionCoachError ? (
                <p className="inline-error">{decisionCoachError}</p>
              ) : decisionCoachResult ? (
                <>
                  <p className="candidate-recommendation">
                    Recommendation: <strong>{decisionCoachResult.recommendation}</strong>
                  </p>
                  <p>{decisionCoachResult.summary}</p>
                  <ul className="coach-evidence">
                    {decisionCoachResult.evidence.map((item, index) => (
                      <li key={`${item.fact}-${index}`}>{item.fact}</li>
                    ))}
                  </ul>
                  <button
                    className="use-candidate"
                    type="button"
                    onClick={() => setOrderInput(String(decisionCoachResult.recommendedOrderQuantity))}
                  >
                    Use recommendation in order field
                  </button>
                </>
              ) : null}
            </section>
          )}
          {(candidateAdvice || candidateError) && (
            <section className="candidate-simulation" aria-live="polite" role="status">
              <p className="eyebrow">Candidate simulation · demo model</p>
              {candidateError ? (
                <p className="inline-error">{candidateError}</p>
              ) : candidateAdvice ? (
                <>
                  <p className="candidate-recommendation">
                    Candidate order: <strong>{candidateAdvice.recommendedOrderQuantity} units</strong>
                  </p>
                  {candidateAdvice.simulation.candidateShipmentArrivalWeek !== undefined && (
                    <p>Candidate shipment arrival: week {candidateAdvice.simulation.candidateShipmentArrivalWeek}</p>
                  )}
                  {candidateAdvice.simulation.knownIncomingShipmentNextWeek !== undefined && (
                    <p>Known inbound next week: {candidateAdvice.simulation.knownIncomingShipmentNextWeek} units</p>
                  )}
                  <p className="simulation-limit">Next-week inventory, backorders, and cost are not projected.</p>
                  <button
                    className="use-candidate"
                    type="button"
                    onClick={() => setOrderInput(String(candidateAdvice.recommendedOrderQuantity))}
                  >
                    Use recommendation in order field
                  </button>
                </>
              ) : null}
            </section>
          )}
        </aside>
      </section>

      <section className="scenario-panel" aria-labelledby="scenario-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pre-game setup</p>
            <h2 id="scenario-heading">Scenario generator</h2>
          </div>
        </div>

        <div className="scenario-controls">
          <label>
            Scenario
            <select
              value={selectedScenario}
              onChange={(event) => setSelectedScenario(event.target.value as ScenarioType)}
            >
              <option value="stable">Stable</option>
              <option value="growth">Growth</option>
              <option value="seasonal">Seasonal</option>
              <option value="volatile">Volatile</option>
            </select>
          </label>
          <label>
            Difficulty
            <select
              value={selectedDifficulty}
              onChange={(event) => setSelectedDifficulty(event.target.value as ScenarioDifficulty)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>

        <button className="scenario-button" type="button" onClick={handleGenerateScenario} disabled={scenarioLoading}>
          {scenarioLoading ? "Generating scenario..." : "Start new game from selected scenario"}
        </button>

        {scenarioError && <p className="inline-error" role="alert">{scenarioError}</p>}
        {scenarioSelection && (
          <div className="scenario-status" aria-live="polite">
            <p>
              <strong>{scenarioSelection.scenario}</strong> / <strong>{scenarioSelection.difficulty}</strong>
            </p>
            <p>{scenarioSelection.summary}</p>
            <p className="scenario-note">{scenarioSelection.explanation}</p>
          </div>
        )}
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

      {postGameAnalysis && (
        <section className="analysis-section" aria-labelledby="analysis-heading" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Post-game analysis · demo model</p>
              <h2 id="analysis-heading">What the history shows</h2>
            </div>
            <span className="analysis-confidence">Confidence: {postGameAnalysis.confidence}</span>
          </div>
          <p className="analysis-summary">{postGameAnalysis.summary}</p>
          <div className="analysis-findings">
            {postGameAnalysis.findings.map((finding, index) => (
              <article className="analysis-finding" key={`${finding.type}-${finding.weeks.join("-")}-${index}`}>
                <p className="eyebrow">{finding.type.replaceAll("_", " ")} · Week{finding.weeks.length === 1 ? "" : "s"} {finding.weeks.join(", ")}</p>
                <h3>{finding.title}</h3>
                <p>{finding.explanation}</p>
                <ul>
                  {finding.evidence.map((evidence, evidenceIndex) => (
                    <li key={`${evidence.fact}-${evidenceIndex}`}>{evidence.fact}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="next-game-advice">
            <h3>For your next game</h3>
            <ul>
              {postGameAnalysis.nextGameAdvice.map((advice) => <li key={advice}>{advice}</li>)}
            </ul>
          </div>
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