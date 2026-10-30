# Implementation specifications

## New planned features

| Feature | Specification | Plan | Tasks | Execution evidence | Status |
|---|---|---|---|---|---|
| 001 — Low-cost AI | [spec](001-low-cost-ai/spec.md) | [plan](001-low-cost-ai/plan.md) | [tasks](001-low-cost-ai/tasks.md) | [evidence](001-low-cost-ai/evidence.md) | Implemented; local checks pass; live/browser acceptance pending |
| 002 — AI tool-call logging | [spec](002-ai-tool-call-logging/spec.md) | [plan](002-ai-tool-call-logging/plan.md) | [tasks](002-ai-tool-call-logging/tasks.md) | [evidence](002-ai-tool-call-logging/evidence.md) | Implemented; local mock capture/export verified; opt-in runtime recording |
| 003 — Workflow boundaries and adversarial verification | [spec](003-workflow-boundary-validation/spec.md) | [plan](003-workflow-boundary-validation/plan.md) | [tasks](003-workflow-boundary-validation/tasks.md) | [execution evidence](003-workflow-boundary-validation/evidence.md) | Implemented; local checks pass; T017 browser verified through W08 follow-up |
| 004 — Secure the Arcade / Decision Coach | [spec](004-secure-game/spec.md) | [plan](004-secure-game/plan.md) | [tasks](004-secure-game/tasks.md) | [execution evidence](004-secure-game/EVIDENCE_W08.md) | Implemented; 500 tests, automated Chrome DOM/CSP and combined T17 pass; actual demo rehearsal/individual defence not performed; personal contribution skipped by user |

Each feature keeps its execution evidence in its own folder. Populate the record after each implementation session and before marking related tasks complete. The initial evidence templates are NOT RUN, not proof of implementation.

Feature 003 retains its original [analysis review](003-workflow-boundary-validation/review.md) and now has separate execution evidence, coverage, sanitized verification and smoke results. The browser interaction was subsequently verified through feature 004; review probes alone were not used as implementation proof.

Feature 002 also contains the [manual log template](002-ai-tool-call-logging/log-template.md).

## Earlier work

[done-previously](done-previously/README.md) groups older build prompts, requirements, evaluation plans, and workflow tasks by week. The folder is a historical archive, not a claim that every original acceptance checkbox is complete. Evidence and actual limitations remain in [docs](../docs/README.md).
