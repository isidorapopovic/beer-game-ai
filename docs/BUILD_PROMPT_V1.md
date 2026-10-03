# BUILD_PROMPT_V1

Before implementation:

1. Summarize your understanding of the task.
2. Provide a short implementation plan in several steps.
3. List any ambiguities, conflicts, or assumptions you identify.
4. Do not expand the scope without an explicit reason and approval.
5. If the Game Spec conflicts with this prompt, stop and clearly identify the conflict before making a product-level decision.

---

# 1. Your Role

You are the coding agent responsible for implementing the first playable MVP of the **Beer Distribution Game**.

Your job is to:

- read the existing **Game Spec** carefully;
- inspect the existing repository and relevant project files;
- implement only the functionality required for the current MVP;
- create a minimal but usable visual interface;
- make the game actually playable from start to finish;
- keep the implementation simple, maintainable, and aligned with the existing project structure.

This version is **frontend-only**.

There is **no backend in this phase**. Backend services, databases, authentication, APIs, multiplayer functionality, persistence, accounts, cloud services, analytics pipelines, or server-side logic will be added later and are explicitly outside the scope of this build.

The Game Spec is the primary product specification. Do not invent game mechanics, screens, roles, features, or rules that are not defined there.

---

# 2. Goal and Expected Result

Build a minimal playable version of the **Beer Distribution Game — Retailer MVP**.

The expected result is a working web application where the user can:

- start at Week 1;
- play as the Retailer;
- see the current game state;
- see weekly customer demand;
- see current inventory;
- see current backorders;
- see incoming shipments;
- see the previous order;
- enter an Order Quantity;
- confirm the order;
- advance the simulation week by week;
- experience the defined shipping delay;
- see inventory and backorders update correctly;
- see weekly and total costs;
- reach the end of the simulation;
- see a final simulation summary.

The visual design should be **minimal, clear, functional, and readable**.

Do not spend significant time on visual polish, animation, branding, advanced graphics, or decorative UI. The priority is correct gameplay and a usable interface.

A simple dashboard-like layout is sufficient.

---

# 3. Scope Boundaries and Prohibited Additions

Stay strictly within the Game Spec and this prompt.

## Do not add:

- backend services;
- databases;
- authentication;
- user accounts;
- login or registration;
- APIs;
- server-side persistence;
- cloud infrastructure;
- multiplayer;
- networking;
- WebSockets;
- AI opponents;
- additional supply-chain roles controlled by the player;
- Factory gameplay;
- Distributor gameplay;
- Wholesaler gameplay;
- advanced charts unless explicitly required by the Game Spec;
- leaderboards;
- achievements;
- difficulty modes;
- tutorials not defined in the Game Spec;
- sound effects;
- music;
- unnecessary animations;
- complex state-management libraries unless the existing project already requires them;
- new frameworks unless necessary;
- speculative features;
- mechanics that are not defined in the Game Spec.

Do not redesign or reinterpret the game beyond what is specified.

Do not make product decisions that resolve unclear requirements silently.

If a requirement is ambiguous or contradictory, list it before implementation and use the existing Game Spec as the first source of truth. If the conflict cannot be resolved from the repository or Game Spec, explicitly flag it instead of inventing a rule.

---

# 4. Technical Context and Relevant Files

Before changing code:

1. Inspect the repository structure.
2. Locate and read the Game Spec.
3. Locate the frontend application entry point.
4. Inspect `package.json`.
5. Identify the frontend framework and current build tooling.
6. Identify existing TypeScript configuration.
7. Identify existing styling approach.
8. Reuse the current project structure whenever possible.

Relevant files may include, depending on the repository:

- `GAME_SPEC.md`
- `README.md`
- `package.json`
- `package-lock.json`
- `vite.config.*`
- `tsconfig.json`
- `src/`
- `src/main.*`
- `src/App.*`
- existing components;
- existing stylesheets;
- existing tests.

Do not create an alternative application architecture if the repository already has a reasonable frontend structure.

Prefer the smallest number of files and abstractions necessary to implement the MVP cleanly.

The game state may remain entirely in frontend memory for this version.

No persistence is required unless explicitly stated in the Game Spec.

---

# 5. Gameplay Rules

## 5.1 Game Description

The **Beer Distribution Game** is a supply-chain simulation in which the player attempts to satisfy customer demand while minimizing total inventory and backorder costs.

In the complete Beer Game, the supply chain contains four stages:

**Retailer → Wholesaler → Distributor → Factory**

In this first version, the player controls **only the Retailer**.

Each week, the Retailer:

1. receives any shipment scheduled to arrive that week;
2. receives customer demand;
3. attempts to fulfill customer demand and existing backorders using available inventory;
4. carries any unfulfilled demand forward as backorders;
5. observes the current game state;
6. chooses how many new units of beer to order;
7. submits the order;
8. pays the relevant inventory and/or backorder cost;
9. advances to the next week.

Orders and shipments do not arrive immediately.

The game includes a shipping delay, which requires the player to plan ahead.

---

## 5.2 Player Role

The player is the:

### Retailer

The Retailer is the final supply-chain stage before the customer.

The Retailer must:

- monitor current inventory;
- monitor customer demand;
- monitor backorders;
- monitor shipments currently in transit;
- decide how many units to order;
- fulfill as much customer demand as possible;
- minimize total cost.

The player does **not** control any other supply-chain stage in this version.

---

## 5.3 Main Objective

The main objective is:

> Satisfy as much customer demand as possible while minimizing the combined cost of inventory and backorders.

The player must balance two competing situations.

### Excess Inventory

If the Retailer holds inventory, there is a weekly inventory holding cost.

Use:

```text
Inventory Cost = $0.50 per inventory unit per week
```

### Insufficient Inventory

If the Retailer cannot satisfy demand, the missing units become backorders.

Use:

```text
Backorder Cost = $1.00 per backordered unit per week
```

Backorders are therefore more expensive per unit than inventory.

---

## 5.4 Ordering

The player must have an input for:

```text
Order Quantity
```

Rules:

- the order quantity must not be negative;
- use a non-negative numeric value;
- invalid input must not advance the simulation;
- the submitted order becomes the Previous Order shown in the next relevant game state;
- submitting an order advances the game according to the simulation flow defined in the Game Spec.

Do not add ordering constraints that are not specified.

---

## 5.5 Shipping Delay

Shipping must not be instantaneous.

Use:

```text
Shipping Delay = 2 weeks
```

An order placed by the player must enter the shipment pipeline and arrive only after the defined delay.

The UI must clearly show the shipment currently expected to arrive according to the Game Spec.

The implementation must preserve the order pipeline correctly from week to week.

---

## 5.6 Inventory and Backorders

The simulation must correctly update:

- inventory;
- backorders;
- units sold / fulfilled demand;
- incoming shipment;
- previous order.

When inventory becomes available, outstanding backorders must be fulfilled.

Do not discard unfulfilled demand.

Any demand that cannot be fulfilled must remain as a backorder until sufficient inventory is available.

Inventory and backorders must not both represent the same units at the same time.

---

## 5.7 Costs

Calculate weekly costs using:

```text
Inventory Cost = ending inventory × $0.50
Backorder Cost = ending backorders × $1.00
Weekly Cost = Inventory Cost + Backorder Cost
```

Track:

```text
Total Cost = sum of all Weekly Cost values
```

All calculations must be deterministic and based on the current simulation state.

Do not introduce additional cost categories.

---

# 6. Minimal UI Requirements

Create a minimal visual representation of the game.

The current screen must clearly display:

- Current Week;
- Customer Demand;
- Inventory;
- Backorders;
- Incoming Shipment;
- Previous Order;
- Order Quantity input;
- button to confirm / place the order;
- Weekly Cost;
- Total Cost.

The UI should make the current game state understandable without opening developer tools.

A minimal layout such as cards, panels, rows, or a simple dashboard is acceptable.

The interface must remain usable on a normal desktop browser.

Do not make visual polish more important than gameplay correctness.

---

# 7. Game Completion Screen

At the end of the simulation:

- prevent any further order submission;
- clearly display:

```text
Simulation Complete
```

Also display:

- Final Total Cost;
- Average Weekly Inventory;
- Total Backordered Units;
- Maximum Backorder;
- Total Customer Demand;
- Total Units Sold;
- Service Level.

Use a clear and consistent service-level calculation based on fulfilled customer demand versus total customer demand, unless the Game Spec defines the formula more specifically.

Do not add additional scoring systems unless the Game Spec defines them.

---

# 8. Game Duration — Final Rule

The game duration is now explicitly defined and must not be treated as ambiguous.

```text
The simulation lasts exactly 10 weeks.
```

Required behavior:

```text
Simulation starts at Week 1.
Simulation ends after Week 10.
No orders can be submitted after Week 10.
```

The current `GAME_SPEC.md` and `BUILD_PROMPT_V1.md` are expected to define the same 10-week rule.

Any older reference to a 30-week simulation is stale and must not influence the implementation.

Do not:

- implement a 30-week mode;
- create multiple duration modes;
- infer a different duration from old chats, examples, or stale documentation.

If another active project source contradicts the 10-week rule, report that source as a new conflict rather than silently changing the duration.

---


# 9. Structured Game Contract and Runtime Validation

At least one important part of the game must be represented by a structured contract.

For this MVP, use a `GameConfig` contract or an equivalent structure with the same meaning.

Expected TypeScript shape:

```ts
type GameConfig = {
  totalWeeks: 10;
  shippingDelayWeeks: 2;
  inventoryCostPerUnit: number;
  backorderCostPerUnit: number;
};
```

The implementation must preserve the following fixed game rules:

```text
totalWeeks = 10
shippingDelayWeeks = 2
inventoryCostPerUnit = 0.50
backorderCostPerUnit = 1.00
```

## Valid Example

```ts
const validConfig: GameConfig = {
  totalWeeks: 10,
  shippingDelayWeeks: 2,
  inventoryCostPerUnit: 0.5,
  backorderCostPerUnit: 1.0,
};
```

## Invalid Example

```ts
const invalidConfig = {
  totalWeeks: 30,
  shippingDelayWeeks: -1,
  inventoryCostPerUnit: "0.5",
  backorderCostPerUnit: null,
};
```

The invalid example must fail validation because:

- `totalWeeks` is not exactly `10`;
- `shippingDelayWeeks` is not exactly `2`;
- `inventoryCostPerUnit` is not a valid number;
- `backorderCostPerUnit` is not a valid number.

## Runtime Validation Requirement

A TypeScript type alone is **not** sufficient evidence of validation.

The application must perform a runtime check or equivalent validation before using configuration values.

A valid approach may be:

```ts
function validateGameConfig(input: unknown): GameConfig {
  // Perform runtime checks.
  // Return the validated config only when all required rules are satisfied.
  // Otherwise throw or return a clearly handled validation error.
}
```

A schema-validation library may be used only if it is already present or clearly justified. Do not add a large dependency only for this small contract when a simple runtime validator is sufficient.

The runtime validation must verify at least:

```text
totalWeeks === 10
shippingDelayWeeks === 2
inventoryCostPerUnit === 0.5
backorderCostPerUnit === 1.0
all required properties are present
all numeric values are finite numbers
```

## Behavior on Invalid Configuration

If the configuration is invalid:

- do not start the simulation with invalid values;
- do not silently coerce incorrect values;
- do not silently replace a 30-week value with 10;
- do not continue with partially valid configuration.

The application must fail safely and clearly.

Acceptable behavior for this MVP is:

```text
1. validation fails;
2. the simulation is not initialized;
3. a clear configuration error is surfaced in development/runtime output or the UI;
4. the invalid configuration is not used.
```

If the project already has an established error-handling pattern, follow that pattern.

## Required Verification for the Structured Contract

The agent must demonstrate or test:

1. one valid configuration that passes;
2. one invalid configuration that fails;
3. runtime validation, not only compile-time typing;
4. predictable behavior after validation failure.

Do not claim that the structured contract is validated merely because TypeScript compiles.

---

# 10. Definition of Done

The Retailer MVP is complete only when all applicable requirements below are satisfied.

## Application

- [ ] The project installs without errors.
- [ ] `npm run dev` starts the application successfully.
- [ ] The application is accessible through localhost.
- [ ] `npm run build` completes successfully.
- [ ] There are no TypeScript errors.

## Gameplay

- [ ] The simulation starts at Week 1.
- [ ] The simulation lasts exactly 10 weeks.
- [ ] The player plays only as the Retailer.
- [ ] Customer Demand is displayed every week.
- [ ] Inventory updates correctly.
- [ ] Backorders update correctly.
- [ ] The player can enter an Order Quantity.
- [ ] Order Quantity cannot be negative.
- [ ] Invalid order input does not corrupt or advance the simulation.
- [ ] An order does not arrive immediately.
- [ ] The 2-week shipping delay works correctly.
- [ ] Incoming Shipment is displayed correctly.
- [ ] Backorders are fulfilled when inventory becomes available.

## Costs

- [ ] Inventory Cost is calculated correctly.
- [ ] Backorder Cost is calculated correctly.
- [ ] Weekly Cost is calculated correctly.
- [ ] Total Cost is the sum of all Weekly Cost values.


## Structured Contract

- [ ] A structured `GameConfig` contract or equivalent exists.
- [ ] The contract defines exactly 10 weeks.
- [ ] The contract defines a 2-week shipping delay.
- [ ] The contract defines `$0.50` inventory cost per unit per week.
- [ ] The contract defines `$1.00` backorder cost per unit per week.
- [ ] A valid configuration example is documented or tested.
- [ ] An invalid configuration example is documented or tested.
- [ ] Runtime validation exists.
- [ ] TypeScript typing is not used as the only validation mechanism.
- [ ] Invalid configuration prevents the simulation from starting.
- [ ] Invalid values are not silently coerced or ignored.

## UI

- [ ] Current Week is clearly displayed.
- [ ] Customer Demand is clearly displayed.
- [ ] Inventory is clearly displayed.
- [ ] Backorders are clearly displayed.
- [ ] Incoming Shipment is clearly displayed.
- [ ] Previous Order is displayed.
- [ ] There is an Order Quantity input.
- [ ] There is a button to confirm the order.
- [ ] Weekly Cost is displayed.
- [ ] Total Cost is displayed.
- [ ] The application is visually minimal but usable.
- [ ] The game can be played without relying on the browser console.

## Game Completion

- [ ] The simulation ends after Week 10.
- [ ] No additional orders can be entered after completion.
- [ ] `Simulation Complete` is displayed.
- [ ] Final Total Cost is displayed.
- [ ] Average Weekly Inventory is displayed.
- [ ] Total Backordered Units is displayed.
- [ ] Maximum Backorder is displayed.
- [ ] Total Customer Demand is displayed.
- [ ] Total Units Sold is displayed.
- [ ] Service Level is displayed.

---

# 11. Allowed Files and Areas of Modification

Modify only the files required to implement the frontend Retailer MVP.

Allowed areas are generally:

- the existing frontend source directory;
- frontend components;
- frontend styles;
- local frontend game-state logic;
- frontend utility functions directly related to the simulation;
- frontend tests related to this MVP;
- package configuration only when necessary for the existing frontend application.

Examples:

```text
src/**
package.json
package-lock.json
frontend test files
existing frontend config files when strictly necessary
```

Do not modify unrelated areas.

Do not create or modify:

- backend directories;
- server code;
- database migrations;
- infrastructure;
- Docker/cloud configuration unless already required to run the existing frontend;
- deployment configuration;
- authentication systems;
- unrelated documentation;
- unrelated application features.

If an exact allowlist of files exists in the repository or Game Spec, follow that allowlist instead.

Before modifying a file outside the obvious frontend implementation area, explain why it is necessary.

---

# 12. Required Verification

After implementation, verify the application rather than only writing code.

At minimum, run the relevant available commands:

```bash
npm install
npm run build
```

Also run, when present in `package.json`:

```bash
npm run typecheck
npm run lint
npm test
```

Start the development application with:

```bash
npm run dev
```

Verify that the application loads locally.

Manually verify the core simulation behavior, including at least:

1. simulation starts at Week 1;
2. demand is visible;
3. a valid order can be entered;
4. a negative order is rejected;
5. an order does not arrive immediately;
6. the 2-week shipment delay behaves correctly;
7. inventory decreases when demand is fulfilled;
8. shortages create backorders;
9. later inventory can fulfill existing backorders;
10. inventory cost uses `$0.50` per unit per week;
11. backorder cost uses `$1.00` per unit per week;
12. Weekly Cost is correct;
13. Total Cost accumulates correctly;
14. the simulation reaches its defined final week;
15. ordering is disabled after completion;
16. the completion summary is shown;
17. the required final statistics are displayed;
18. a valid `GameConfig` passes runtime validation;
19. an invalid `GameConfig` fails runtime validation;
20. the simulation does not start with invalid configuration.

If tests already exist, update or add only the tests needed for this scope.

Do not claim that a check passed unless you actually ran it successfully.

If a check cannot be run, say exactly which check was not run and why.

---

# 13. Implementation Guidance

Keep the solution simple.

Prefer:

- straightforward TypeScript;
- small React/frontend components if React is already used;
- local state for simulation state;
- pure helper functions for calculations where useful;
- deterministic game logic;
- readable naming;
- minimal dependencies;
- reusable logic only where it improves clarity.

Avoid unnecessary abstraction.

Do not over-engineer the MVP.

A reasonable internal state may include concepts such as:

```text
currentWeek
inventory
backorders
customerDemand
incomingShipments
previousOrder
weeklyCost
totalCost
inventoryHistory
backorderHistory
totalDemand
totalUnitsSold
```

This is implementation guidance only. Adapt it to the existing repository and Game Spec rather than forcing a new architecture.

---

# 14. Required Agent Behavior Before Coding

Before making code changes, respond with these sections:

## Understanding

Summarize:

- what game is being built;
- who the player controls;
- the core weekly loop;
- the cost model;
- the shipping delay;
- the required UI;
- the explicit frontend-only scope.

## Plan

Provide a concise implementation plan.

For example:

1. inspect the Game Spec and current frontend;
2. identify the existing application architecture;
3. define the minimal simulation state and weekly transition logic;
4. implement the Retailer gameplay;
5. implement the minimal UI;
6. implement the completion state and metrics;
7. run build/type/test checks;
8. manually verify the core gameplay flow.

Do not begin by proposing new features.

## Ambiguities / Assumptions

List every material ambiguity you found.

Confirm that the active Game Spec and implementation requirements use the final rule:

```text
Game duration = exactly 10 weeks
```

Treat any 30-week reference as stale unless the project owner explicitly changes the current specification.

Do not silently resolve any new ambiguous product requirements.

## Scope Confirmation

State that you will:

- implement only the Retailer MVP;
- keep the application frontend-only;
- use the Game Spec as the product source of truth;
- avoid adding functionality outside the Game Spec;
- avoid expanding scope without approval.

---

# 15. Final Response After Implementation

When implementation is complete, provide a concise summary containing:

1. what was implemented;
2. which files were changed;
3. the final gameplay duration used and why;
4. verification commands executed;
5. whether each verification passed;
6. any unresolved ambiguity;
7. any known limitation that is within the current MVP scope.

Do not present future backend work as part of the completed implementation.

Do not claim completion if the Definition of Done is not satisfied.

---

# Core Principle

**Build the smallest correct, playable Retailer version of the Beer Distribution Game defined by the Game Spec.**

Correct gameplay and scope discipline are more important than adding features.
