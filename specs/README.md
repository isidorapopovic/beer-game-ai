# Implementation specifications

## New planned features

| Feature | Specification | Plan | Tasks | Execution evidence | Status |
|---|---|---|---|---|---|
| 001 — Low-cost AI | [spec](001-low-cost-ai/spec.md) | [plan](001-low-cost-ai/plan.md) | [tasks](001-low-cost-ai/tasks.md) | [evidence](001-low-cost-ai/evidence.md) | Implemented; local checks pass; live/browser acceptance pending |
| 002 — AI tool-call logging | [spec](002-ai-tool-call-logging/spec.md) | [plan](002-ai-tool-call-logging/plan.md) | [tasks](002-ai-tool-call-logging/tasks.md) | [evidence](002-ai-tool-call-logging/evidence.md) | Implemented; local mock capture/export verified; opt-in runtime recording |
| 003 — Workflow boundaries and adversarial verification | [spec](003-workflow-boundary-validation/spec.md) | [plan](003-workflow-boundary-validation/plan.md) | [tasks](003-workflow-boundary-validation/tasks.md) | [analysis review](003-workflow-boundary-validation/review.md) | Planning only; confirmed gaps; implementation not started |

Each feature keeps its execution evidence in its own folder. Populate the record after each implementation session and before marking related tasks complete. The initial evidence templates are NOT RUN, not proof of implementation.

Feature 003 currently contains review observations, not implementation evidence. Its later execution must create `evidence.md` in that folder without presenting the review's probes as completed implementation tasks.

Feature 002 also contains the [manual log template](002-ai-tool-call-logging/log-template.md).

## Earlier work

[done-previously](done-previously/README.md) groups older build prompts, requirements, evaluation plans, and workflow tasks by week. The folder is a historical archive, not a claim that every original acceptance checkbox is complete. Evidence and actual limitations remain in [docs](../docs/README.md).
