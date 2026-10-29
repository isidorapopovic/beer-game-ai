# Spec 07 — Final Integration and Week 05 Demo

## Objective

Perform the final integration pass for all Week 05 workflows and prepare a clear demo/evidence package.

Do not introduce major new architecture here.

---

# 1. Required visible workflows

## Active Retailer game

### AI Decision Coach

```text
AI
 -> getCurrentGameState
 -> AI
 -> structured recommendation
```

AI does not place the order.

### Candidate Order Simulation

```text
AI
 -> simulateCandidateOrder
 -> AI
 -> structured explanation
```

Simulation does not mutate the game.

---

## Completed game

### Analyze My Game

```text
AI
 -> getGameHistory
 -> AI
 -> structured analysis
```

Analysis does not rewrite history.

---

## Pre-game

### AI Scenario Generator

```text
AI
 -> getAllowedScenarioTypes
 -> AI
 -> validated scenario + difficulty
 -> deterministic demand generation
```

AI does not author arbitrary weekly demand values.

User explicitly starts the game.

---

# 2. Consistent UI statuses

Use consistent states such as:

```text
idle
running
completed
stopped
failed
```

Show:
- current action
- structured result
- safe reason if stopped/failed

Do not show:
- API keys
- stack traces
- raw internal provider diagnostics
- chain-of-thought

---

# 3. Explain boundaries in UI

Make these distinctions clear:

## Recommendation
AI suggests an order.
It does not submit it.

## Simulation
Candidate order is simulated.
Real state is unchanged.

## Post-game analysis
AI reads completed game history.
It cannot rewrite it.

## Scenario generation
AI selects an approved category/difficulty.
Game engine generates demand.

---

# 4. Deterministic demo path

Prepare one demo:

1. Start default/seeded game.
2. During an active week run Decision Coach.
3. Run candidate order simulation.
4. Explicitly place an order through normal game UI.
5. Complete game.
6. Run Post-Game Analyst.
7. Return to new-game setup.
8. Ask AI for a hard growth scenario.
9. Show validated scenario selection.
10. Show deterministic demand sequence is created by game engine.

---

# 5. Failure demo

Prepare at least one evidence trace:

```text
model requests unknown tool
 -> backend rejects
 -> tool not executed
 -> safe stop reason
```

Second useful trace:

```text
model requests simulateCandidateOrder({ orderQuantity: 1000 })
 -> argument validation rejects
 -> tool not executed
```

---

# 6. Final Week 05 documentation

Create/update a project Week 05 document containing:

## Architecture

```text
Frontend
 -> agent service/endpoint
 -> orchestrator
 -> model gateway
 -> validated tool
 -> model gateway
 -> validated final result
```

## Workflows
Document all four.

## Tools
For each document:
- name
- purpose
- mode
- input
- bounds
- output
- validation
- prohibited behavior

## Limits
Document actual values.

## Tests
List fake-first tests and live smoke status.

## Provider boundary
Explain that Week 04 integration is reused.

## Security
Explain:
- server-side secrets
- allowlisted tools
- no shell/filesystem/arbitrary URL/SQL
- no chain-of-thought storage
- no automatic AI mutation of gameplay

---

# 7. Final acceptance checklist

Verify:

- [ ] Week 03/04 code remains the base
- [ ] backend/orchestrator owns workflow
- [ ] four required tools are registered
- [ ] successful flows have >=2 model steps and >=1 tool
- [ ] proposals are validated
- [ ] tool arguments are validated
- [ ] tool results are validated
- [ ] final results are validated
- [ ] step limit exists
- [ ] tool-call limit exists
- [ ] deadline exists
- [ ] repeated-action protection exists
- [ ] stop reasons are explicit
- [ ] fake success tests exist
- [ ] fake failure tests exist
- [ ] live smoke test is optional/config-gated
- [ ] evidence excludes secrets and chain-of-thought
- [ ] AI does not directly mutate real game
- [ ] production build passes
- [ ] original game loop still works

---

# 8. Completion report

When complete, report:
1. exact files changed
2. exact workflows implemented
3. exact tools implemented
4. actual limits
5. test/build commands run
6. pass/fail status
7. known limitations
8. repository-specific deviations from the specs

Do not claim completion while required tests/build are failing.
