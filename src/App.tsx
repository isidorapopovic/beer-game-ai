import { useState, type FormEvent } from "react";
import {
  createGameState,
  getGameSummary,
  submitOrder,
} from "./game/gameEngine";
import type { GameState } from "./game/gameEngine";
import type { CandidateOrderAdviceResult } from "./agent/candidateOrderSimulation";
import type { DecisionCoachResult } from "./agent/decisionCoach";
import type { PostGameAnalysisResult } from "./agent/gameAnalyst";
import { generateScenarioDemand, type ScenarioDifficulty, type ScenarioType, type ScenarioSelectionResult } from "./agent/scenarioGenerator";
import { requestAgent, type AgentEvidence } from "./agent/agentClient";

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
  const [agentEvidence, setAgentEvidence] = useState<AgentEvidence | null>(null);
  const [orderInput, setOrderInput] = useState("");
  const [actionError, setActionError] = useState("");
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
  const aiBusy = candidateLoading || decisionCoachLoading || analysisLoading || scenarioLoading;

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

  async function handleSimulateCandidateOrder() {
    if (candidateLoading || !gameState || gameState.isComplete) {
      return;
    }

    const requestedState = gameState;
    setCandidateLoading(true);
    setCandidateAdvice(null);
    setCandidateError("");

    try {
      const result = await requestAgent<CandidateOrderAdviceResult>("candidate_order_simulation", requestedState, `Simulate my candidate order: ${orderInput.trim() || requestedState.previousOrder} units. Use that exact quantity.`);
      setAgentEvidence(result.evidence);

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error(`AI workflow ${result.status}: ${result.stopReason}.`);
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
      const result = await requestAgent<DecisionCoachResult>("decision_coach", requestedState, `How much should I order this week and why?`);
      setAgentEvidence(result.evidence);

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error(`AI workflow ${result.status}: ${result.stopReason}.`);
      }
      setDecisionCoachResult(result.finalOutput);
    } catch (error) {
      setDecisionCoachError(error instanceof Error ? error.message : "The decision coach failed.");
    } finally {
      setDecisionCoachLoading(false);
    }
  }

  async function handleGenerateScenario() {
    if (scenarioLoading || (!gameState?.isComplete && gameState?.history.length)) return;
    setScenarioLoading(true);
    setScenarioSelection(null);
    setScenarioError("");

    try {
      const baseState = createGameState();
      const result = await requestAgent<ScenarioSelectionResult>("scenario_generator", baseState, `Create a ${selectedScenario} ${selectedDifficulty} pre-game scenario for a new run.`);
      setAgentEvidence(result.evidence);

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error(`AI workflow ${result.status}: ${result.stopReason}.`);
      }

      setScenarioSelection(result.finalOutput);
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : "The scenario generator failed.");
    } finally {
      setScenarioLoading(false);
    }
  }

  function handleStartSelectedScenario() {
    if (!scenarioSelection || (!gameState?.isComplete && gameState?.history.length)) return;
    const demandSequence = generateScenarioDemand({
      scenario: scenarioSelection.scenario, difficulty: scenarioSelection.difficulty, seed: 5,
    });
    setGameState(createGameState(undefined, demandSequence));
    setOrderInput(""); setActionError("");
    setCandidateAdvice(null); setCandidateError(""); setDecisionCoachResult(null);
    setDecisionCoachError(""); setPostGameAnalysis(null); setAnalysisError("");
    setScenarioSelection(null); setAgentEvidence(null);
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
      const result = await requestAgent<PostGameAnalysisResult>("game_analyst", completedState, `Analyze my completed Beer Game and give evidence-based lessons.`);
      setAgentEvidence(result.evidence);

      if (result.status !== "completed" || !result.finalOutput) {
        throw new Error(`AI workflow ${result.status}: ${result.stopReason}.`);
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

    if (!gameState || gameState.isComplete || aiBusy) {
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
                disabled={aiBusy}
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
                    disabled={isComplete || aiBusy}
                  />
                  <span>units</span>
                </div>
                {actionError && (
                  <p className="inline-error" id="order-error" role="alert">
                    {actionError}
                  </p>
                )}
                <button type="submit" disabled={isComplete || aiBusy}>
                  Submit order <span aria-hidden="true">→</span>
                </button>
              </form>
              <button
                className="hint-trigger"
                type="button"
                onClick={handleSimulateCandidateOrder}
                disabled={aiBusy || isComplete}
              >
                {candidateLoading ? "Simulating candidate..." : "Simulate candidate order"}
              </button>
            </>
          )}
          <button
            className="hint-trigger"
            type="button"
            onClick={handleAskForDecisionCoach}
            disabled={aiBusy || isComplete}
          >
            {decisionCoachLoading ? "Consulting decision coach..." : "AI Decision Coach"}
          </button>
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
              <p className="eyebrow">Candidate simulation · Gemini</p>
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

        <button className="scenario-button" type="button" onClick={handleGenerateScenario} disabled={aiBusy || (!isComplete && gameState.history.length > 0)}>
          {scenarioLoading ? "Generating scenario..." : "Ask AI for selected scenario"}
        </button>

        {scenarioError && <p className="inline-error" role="alert">{scenarioError}</p>}
        {scenarioSelection && (
          <div className="scenario-status" aria-live="polite">
            <p>
              <strong>{scenarioSelection.scenario}</strong> / <strong>{scenarioSelection.difficulty}</strong>
            </p>
            <p>{scenarioSelection.summary}</p>
            <p className="scenario-note">{scenarioSelection.explanation}</p>
            <p>The game engine will generate ten weeks of demand. Starting requires your action.</p>
            <button type="button" onClick={handleStartSelectedScenario} disabled={aiBusy || (!isComplete && gameState.history.length > 0)}>Start this scenario</button>
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
              <p className="eyebrow">Post-game analysis · Gemini</p>
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

      {agentEvidence && (
        <section aria-live="polite" className="scenario-panel">
          <p>AI status: {agentEvidence.status} · {agentEvidence.stopReason}</p>
          <p>Provider: {agentEvidence.provider} · Model calls: {agentEvidence.modelCalls} · Tool calls: {agentEvidence.toolCallCount} · Steps: {agentEvidence.stepCount}</p>
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
