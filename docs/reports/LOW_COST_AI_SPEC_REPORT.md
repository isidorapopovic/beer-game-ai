# Low-cost AI specification: delivery and commit report

Date: 2026-10-29

## Delivered outcome

Prepared a Spec Kit-style feature specification recommending `gemini-3.1-flash-lite`, with an implementation plan and 23 unchecked implementation tasks. This delivery changes documentation only. It does not configure a model, edit credentials, deploy limits, or call a live provider.

Start with [the specification](../../specs/001-low-cost-ai/spec.md), then [the plan](../../specs/001-low-cost-ai/plan.md) and [tasks](../../specs/001-low-cost-ai/tasks.md).

## Git boundary

- New local branch: `docs/cheap-ai-model-spec`.
- Starting branch: `feature/week5-bounded-agent-workflows`.
- Starting commit: `46341d690d61d0a5f3c0cdf9e1434c30f6a925d5`.
- Existing `main` reference: `e69ece45c785fcac21214b20bb7c4571a69cc81f`.
- Work was based on the existing Week 5 feature branch to preserve its latest integration context.
- No push, merge, reset, or change to `main` was performed. Private `.env` was not edited or staged.

## Every commit in this delivery

### 1. `de7529a` — `docs(ai): specify low-cost model and usage controls`

Created three files:

- `specs/001-low-cost-ai/spec.md`: model decision, dated official sources, short-response budgets, exact input-token preflight, token usage/cost evidence, generation/count request ceilings, local quotas, persistent spending reservations, edge cases, and acceptance criteria.
- `specs/001-low-cost-ai/plan.md`: repository-specific code touchpoints, dependency order, verification, rollout, and six proposed future implementation commits.
- `specs/001-low-cost-ai/tasks.md`: 23 future tasks; all unchecked to avoid implying runtime implementation is complete.

Why: turn the request for simple, cheap AI into a concrete, reviewable implementation contract while preserving the Week 5 two-model-step/tool architecture.

### 2. Report commit — `docs(ai): record specification delivery and validation`

Adds this report and removes Markdown trailing spaces identified by `git diff --check` in the first commit. Its exact hash is available in `git log` and the delivery message; it cannot embed its own Git hash without changing that hash.

Why: describe the actual documentation commits, distinguish future work from delivered work, and record the checks and branch boundary.

The six commits listed in `plan.md` are proposed future runtime changes. They are not additional commits made in this delivery.

## Recommendation and proposed policy

Recommend the lightweight 3.1 Flash-Lite profile for the current Gemini server. Prices and suitability are researched recommendations, not an observed quality benchmark. The cheaper 2.5 profile has access restrictions for new users; the newer 3.5 profile costs more. See the specification's dated [pricing](https://ai.google.dev/gemini-api/docs/pricing), [availability](https://ai.google.dev/gemini-api/docs/deprecations), and [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) sources.

Proposed controls include 500-code-point goals, full-prompt token counting, a 128-token proposal, 384–1,024-token final caps, two generation calls plus at most two count-token calls, no retries/upgrades, a 20-second deadline, one active request, six admitted actions/minute, 100/day, and a $1/day application estimate allowance. The allowance must retain conservative reservations when provider usage is unknown. It is not a billing-account spending guarantee.

## Verification actually performed

| Check | Result |
|---|---|
| `npm.cmd test` | PASS: 79 passed, 0 failed, 0 skipped |
| `npm.cmd run typecheck` | PASS |
| Whitespace review | Initial commit had five Markdown hard-break trailing spaces; removed in report commit |
| Local Markdown links | Specification, plan, tasks, and report targets checked |
| Scope review | Only the four Markdown files in this delivery; no runtime source or environment changes |
| Live Gemini requests | NOT RUN; no live quality, thinking-config, or token-budget acceptance claimed |
| Production build | Not rerun for this documentation-only change; no new build result claimed |

The automated tests verify the unchanged application baseline. They do not prove that the proposed controls are implemented. The first commit's whitespace issue is corrected by the second; final branch whitespace/status checks are performed before delivery.

## Remaining implementation

All runtime work in the linked checklist remains open. First confirm model access and profile parameters, then implement and test policy, token counting/usage capture, concise contracts, admission/ledger, and UI evidence. Run the production build and authorized live smoke before calling the new policy accepted. Review the model migration schedule before 2027-05-07. Keep further work on a feature branch unless instructed otherwise.

## Follow-up delivery: AI tool-call log

User request: add a separate Markdown file recording when each user called an AI tool, the input/output, and the tool name.

Commit subject: `docs(ai): add participant tool-call log template` (the hash is available in `git log` and the delivery message).

- Added the [AI tool-call record template](../../specs/002-ai-tool-call-logging/log-template.md) (originally `docs/AI_TOOL_CALL_LOG.md`, later moved into feature 002) with a call index and detailed per-action template: participant/session/run IDs, timestamps, model requests, proposed versus executed tools, exact/redacted inputs and outputs, final response, usage, status, and evidence.
- Linked it from `AI_USAGE_LOG.md` and documented the absence of accounts and automatic persistence. No past activity was invented; no live calls or fabricated user records were added.
- This remains a documentation change on `docs/cheap-ai-model-spec`. Automatic capture requires later server work; this file does not claim otherwise.
- Verification: Markdown relative links and whitespace checked. Application tests were not rerun for this template-only addition; the 79-test baseline above remains the last observed test result. No push or merge performed.

## Follow-up delivery: feature 002 specification package

User request: move the tool-call log into a named `specs/002` feature and add specification, plan, and task Markdown files.

Commit subject: `docs(logging): organize tool-call tracking as feature 002` (exact hash available in `git log` and the delivery message).

- Moved the original manual log to `specs/002-ai-tool-call-logging/log-template.md`, preserving its record fields and updating relative links.
- Added [spec.md](../../specs/002-ai-tool-call-logging/spec.md), [plan.md](../../specs/002-ai-tool-call-logging/plan.md), and [tasks.md](../../specs/002-ai-tool-call-logging/tasks.md). They define future automatic event capture, pseudonymous attribution, sanitized persistence, Markdown export, and verification; all 20 runtime tasks remain unchecked.
- Updated the development log and this report to the new paths. Feature 001 remains the separate low-cost model specification.
- Validation: checked relative Markdown links and whitespace, confirmed the old log path is removed and the new package is present. No runtime code changes or live AI calls; application tests were not repeated for this documentation-only move.
- Kept the existing feature branch. Nothing pushed or merged; `main` remains untouched.

## Follow-up delivery: per-feature execution evidence

User request: give features 001 and 002 the same kind of evidence record as the existing Week 4/5 records, saved inside their own folders and completed after execution.

Commit subject: `docs: require execution evidence for features 001 and 002` (hash available in `git log` and the delivery message).

- Added [001 evidence](../../specs/001-low-cost-ai/evidence.md) and [002 evidence](../../specs/002-ai-tool-call-logging/evidence.md), with run history, changed files/decisions, command results, every task ID, feature-specific acceptance cases, four-workflow observations, sanitized input/output traces, browser checks, failures, commits, and acceptance conclusion.
- Updated both specifications, plans, task checklists, and the specs index to require evidence in the same folder after each implementation session and before marking tasks complete.
- All feature execution results remain NOT RUN. No runtime implementation, new test result, or live acceptance is claimed. Documentation links, task coverage, and whitespace were checked; application tests were not repeated for this documentation-only addition.
- Work remains on the existing local feature branch; no push or merge to `main`.
