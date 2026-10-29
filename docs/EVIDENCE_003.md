# Feature 003 evidence: workflow boundary validation

Date: 2026-10-29. This is feature 003, separate from the historical Week 4/5
evidence files in this directory.

Implemented on local branch `feature/003-workflow-boundary-validation`, based on
`5a48e72`. No push or merge; `main` is unchanged. Runtime changes are in the working
tree; no new implementation commit has been created.

The implementation fixes coach order/demand projection, legal-order replay,
explicit candidate/scenario selection, deterministic structured facts, prototype
dispatch rejection, imported activity validation, and activity/admission summaries.
Successful progression clears previous-week coach/candidate advice and usage UI.
Game engine/configuration, mechanics, dependencies, budgets and quotas are unchanged.

The detailed record documents commands, failed attempts, task mappings and limits:

- [Implementation evidence](../specs/003-workflow-boundary-validation/evidence.md)
- [Matrix IDs, catalogs and coverage](../specs/003-workflow-boundary-validation/coverage.md)
- [Machine-readable verification record](../specs/003-workflow-boundary-validation/verification.json)
- [Four-workflow mock logging/export result](../specs/003-workflow-boundary-validation/smoke-results.json)
- [Remaining task checklist](../specs/003-workflow-boundary-validation/tasks.md)

Final local checks: **446 tests pass**, TypeScript checking, rendered UI, production
build, and mock capture/export. The original baseline was 137 passing tests; 14
focused regressions first failed and then passed. Four mock workflows emitted 76
events with four observed admissions, four complete records and no export warnings;
each used two generations, two token counts and one local tool. Zero live provider
calls were made.

**Browser acceptance remains pending (T017).** The implementation is present, but
native Chrome access timed out waiting for app approval after browser-host discovery
failed. Rendered UI is not an interaction test. Spec 001's outstanding live
acceptance remains open. Deterministic dispatch/evidence checks do not establish
live-model injection resistance, authenticated ownership or tamper-proof logs.
