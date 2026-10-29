# Documentation reorganization report

Date: 2026-10-29

Branch: `docs/cheap-ai-model-spec`

Commit subject: `docs: organize historical tasks and project references`. The resulting hash is available in `git log` and the delivery message.

## Request and result

Reorganized documentation so task-like Markdown files live under `specs/done-previously/`, while contracts, game rules, evidence, and the context manifest stay at the top of `docs/`. Added navigation indexes and kept reports, logs, and setup guidance in descriptive `docs/` subfolders.

## Moves

| Previous path | New path |
|---|---|
| `docs/BUILD_PROMPT_V1.md` | `specs/done-previously/week3/BUILD_PROMPT_V1.md` |
| `docs/EVALS.md` | `specs/done-previously/week3/EVALS.md` |
| `docs/BUILD_PROMPT_WEEK4_TOOL_INTEGRATION.md` | `specs/done-previously/week4/BUILD_PROMPT_WEEK4_TOOL_INTEGRATION.md` |
| `docs/WEEK4_AI_HINT_MODEL_AND_PHASE_POLICY.md` | `specs/done-previously/week4/WEEK4_AI_HINT_MODEL_AND_PHASE_POLICY.md` |
| Root `week5/*.md` (10 files) | `specs/done-previously/week5/` with original filenames |
| `docs/WEEK_3_REPORT.md` | `docs/reports/WEEK_3_REPORT.md` |
| `docs/LOW_COST_AI_SPEC_REPORT.md` | `docs/reports/LOW_COST_AI_SPEC_REPORT.md` |
| `docs/AI_USAGE_LOG.md` | `docs/logs/AI_USAGE_LOG.md` |
| `docs/WEEK5_GEMINI_INTEGRATION.md` | `docs/guides/WEEK5_GEMINI_INTEGRATION.md` |

18 existing Markdown files moved. The documentation bodies are preserved except for updated path references and relative links. Existing feature 001/002 packages remain in place; their affected links now point to the organized docs paths. The archive index states that moving old tasks does not certify full completion or live acceptance.

## Commit description

This single reorganization commit moves the historical instructions and supporting records, adds `docs/README.md`, `specs/README.md`, `specs/done-previously/README.md`, and this report, and updates affected links/references. It changes no application code, credentials, game rules, or task acceptance results.

## Verification

- Checked local Markdown links across `docs/` and `specs/`, excluding code examples and external URLs.
- Checked staged whitespace and rename/file coverage against the pre-move inventory.
- Confirmed the five core documents remain at the root of `docs/`.
- Application tests/build were not rerun for Markdown-only organization; no new runtime result is claimed.
- No push or merge to `main` performed.
