# How to Use This Speckit with Codex

Use the specs one by one.

Keep `00_WORKFLOWS_OVERVIEW.md` available as global context, but do not ask Codex to implement it all at once.

Run in this order:

```text
1. 01_SHARED_AGENT_FOUNDATION.md
2. 02_AI_DECISION_COACH.md
3. 03_SIMULATE_CANDIDATE_ORDER.md
4. 04_POST_GAME_ANALYST.md
5. 05_AI_SCENARIO_GENERATOR.md
6. 06_HARDENING_TESTS_AND_EVIDENCE.md
7. 07_FINAL_INTEGRATION_AND_DEMO.md
```

Recommended instruction to prepend to every Codex run:

```text
Implement the attached specification against the CURRENT repository.

Before changing code, inspect the repository and reuse the existing game logic, Week 04 provider/AI boundary, state management, runtime schemas, API conventions and test framework.

Do not blindly create the example folder structure if equivalent modules already exist.

Do not implement later specs early except for the smallest shared refactor that is genuinely required.

Preserve existing Beer Game behavior.

Run the repository's actual tests/build after the change.

At the end report:
- files changed
- design decisions
- reused existing modules
- tests/build commands run
- acceptance criteria status
- remaining limitations
```

Core principles:

```text
The model proposes.
The backend validates.
The backend executes.
The game engine owns game mechanics.
The user explicitly performs real state-changing actions.
```

AI workflows in this package must not directly mutate real game state.
