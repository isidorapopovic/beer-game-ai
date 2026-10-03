# Spec 05 — AI Scenario Generator

## Objective

Add a bounded pre-game workflow that converts a natural-language preference into one approved scenario type and difficulty.

Example user request:

> I want a difficult scenario with increasing demand.

The AI selects an approved category.

The game engine generates the actual 10-week demand sequence.

The AI must never directly author arbitrary week-by-week demand values.

---

# 1. Prerequisites

Specs 01–04 are complete.

Reuse shared agent infrastructure.

---

# 2. Workflow ID

```text
scenario_generator
```

---

# 3. Allowed game phase

Available only before a game starts / while configuring a new game.

Do not let AI silently replace an active game's scenario/history.

Reset/new-game remains an explicit user-controlled flow.

---

# 4. Tool: getAllowedScenarioTypes

Register:

```text
getAllowedScenarioTypes
```

Mode:

```text
read-only / deterministic
```

Trusted result:

```ts
type ScenarioType =
  | "stable"
  | "growth"
  | "seasonal"
  | "volatile";

type ScenarioDifficulty =
  | "easy"
  | "medium"
  | "hard";

type AllowedScenarioTypesResult = {
  scenarios: Array<{
    id: ScenarioType;
    label: string;
    description: string;
  }>;
  difficulties: ScenarioDifficulty[];
};
```

Store allowed scenario definitions in trusted app/backend configuration.

---

# 5. AI call #1

Expected:

```json
{
  "kind": "tool_request",
  "toolRequest": {
    "name": "getAllowedScenarioTypes",
    "arguments": {}
  }
}
```

The model cannot invent new scenario types.

---

# 6. AI call #2

Require:

```ts
type ScenarioSelectionResult = {
  scenario:
    | "stable"
    | "growth"
    | "seasonal"
    | "volatile";
  difficulty:
    | "easy"
    | "medium"
    | "hard";
  explanation: string;
  evidence: Array<{
    source: "allowed_scenarios";
    fact: string;
  }>;
  confidence: "low" | "medium" | "high";
  completed: true;
};
```

Backend validates exact enum membership.

---

# 7. Deterministic scenario generation

After valid AI selection, application code generates actual demand values.

Required boundary:

```text
AI:
natural language -> scenario + difficulty

Game engine:
scenario + difficulty + optional seed -> actual demand sequence
```

The deterministic generator should:
- produce exactly the number of weeks expected by the game
- obey domain limits
- support a seed for reproducible tests
- preserve existing default behavior if no scenario is chosen

Conceptual scenario behavior:

### stable
Demand remains around a stable baseline.

### growth
Demand trends upward.

### seasonal
Demand follows a preconfigured rise/fall pattern.

### volatile
Demand changes more strongly.

Adapt exact numbers to current game design.

---

# 8. Existing hard-coded demand

If the game currently has a fixed demand sequence:
- refactor the smallest boundary needed to inject a generated sequence
- preserve current sequence as default scenario
- do not rewrite the whole game engine

---

# 9. UI

Before start provide:
1. manual scenario selection
2. optional AI-assisted text selection

Example:

```text
Describe the game you want:
[ I want a hard market with steadily increasing demand ]

[ Ask AI to choose scenario ]
```

Show result:

```text
Selected:
Growth / Hard

Reason:
...

[ Start game ]
```

Starting the game is still an explicit user action.

---

# 10. Tests

Required:
1. fake "increasing demand" -> growth
2. invalid model scenario rejected
3. invalid difficulty rejected
4. tool result schema validates
5. deterministic generator returns 10 weeks
6. same seed + config -> same sequence
7. generated values are domain-valid
8. active game is not silently overwritten
9. AI selection alone does not start game
10. limits remain enforced

---

# 11. Acceptance criteria

Complete when:
- pre-game natural-language scenario request exists
- AI first retrieves approved options
- final selection is validated
- backend generates actual demand values
- AI cannot inject arbitrary 10-week values
- user explicitly starts game
- default existing game remains playable
- tests pass

At completion report:
- scenario config location
- generator behavior
- game compatibility changes
- tests run
