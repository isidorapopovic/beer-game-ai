# Tasks: Low-cost AI

All checkboxes describe future implementation. None is marked complete by the specification-only change.

Required execution record: [evidence.md](evidence.md) in this folder. After each session, record actual outcomes and link each completed task to its evidence. Do not mark completion from plans or baseline tests alone.

## Policy and configuration

- [ ] T001 Implement FR-01 model profiles and validated prices/defaults in server-only configuration.
- [ ] T002 Add per-step input/output budgets and request/field limits from FR-02–04.
- [ ] T003 Update `.env.example` and setup instructions; preserve private `.env` unchanged.
- [ ] T004 Test invalid profiles, unsafe overrides, missing keys, and unavailable model errors without fallback.

## Provider and usage

- [ ] T005 Count the exact full prompt before each generation; stop over-budget inputs before generation.
- [ ] T006 Apply workflow-specific `maxOutputTokens`, one candidate, JSON mode, and the minimal-thinking profile.
- [ ] T007 Bound provider response streaming before JSON parsing; preserve cancellation and deadline behavior.
- [ ] T008 Capture usage before content validation; expose known/partial/unknown values and versioned estimated cost.
- [ ] T009 Test exact-cap/cap+1 prompts, multibyte text, MAX_TOKENS, malformed JSON, missing usage, thought filtering, and timeouts.

## Workflows and contracts

- [ ] T010 Compact prompts while retaining canonical tool data and exact history evidence.
- [ ] T011 Enforce text/evidence/finding/advice limits in all four final validators.
- [ ] T012 Enforce two generation requests, two count requests, one executed local tool, zero retries, and no fallback.
- [ ] T013 Extend tests for the four success paths and all new limits; preserve non-mutation and phase checks.

## Quotas and spending

- [ ] T014 Implement atomic global single-process admission with one active run, six actions/minute, and 100/day.
- [ ] T015 Persist a $1/day estimate allowance and conservative cost reservations before provider dispatch.
- [ ] T016 Reconcile complete usage, retain unknown reservations, ignore the ledger in Git, and fail safely on corruption.
- [ ] T017 Test simultaneous admission, rolling windows, UTC reset, restart, partial failure, and crash reservations.

## UI and acceptance

- [ ] T018 Extend evidence types/UI for model, generation/count requests, tokens, completeness, and precise estimated USD.
- [ ] T019 Add readable rate/budget errors and consistent 500-code-point goal validation.
- [ ] T020 Run `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`; record actual commands, exit codes, test counts, and failures in [evidence.md](evidence.md).
- [ ] T021 Recheck model availability, prices, thinking configuration, and count-token pricing against official docs.
- [ ] T022 When separately configured/authorized, run one live smoke per workflow; record actual usage and validate proposed budgets.
- [ ] T023 Finalize this folder's [evidence.md](evidence.md): task mapping, changed files/commits, workflow observations, limits/usage, browser/live status, failures, and acceptance conclusion; update setup docs. Keep feature work off `main`; do not push without instruction.
