# Feature specification: Low-cost AI for Beer Distribution Game

Date: 2026-10-29

Implementation branch: `feature/001-low-cost-ai`

Status: Implemented and verified locally; full live/browser acceptance pending. See [execution evidence](evidence.md).

Format: Spec Kit-style specification, plan, and tasks; the Spec Kit CLI is not installed by this change.

## Request and intended outcome

Use a simple, inexpensive model for short game advice. Explicitly control input, generated output, number of requests, response length, and estimated spending. Show actual token usage when the provider supplies it. Preserve the four existing workflows and the player's control of gameplay.

This specification extends the Week 5 AI integration only. Existing game rules, tool permissions, phase checks, canonical replay, and non-mutation guarantees remain requirements.

## Model decision

Recommend **`gemini-3.1-flash-lite`** as the default for this implementation. It is a stable lightweight model with structured-output support and fits the existing server-side Gemini adapter. Suitability for these exact prompts is an engineering recommendation, not a live benchmark result.

Official Standard text prices checked on 2026-10-29:

| Model | Input USD / 1M tokens | Output USD / 1M tokens | Decision |
|---|---:|---:|---|
| `gemini-3.1-flash-lite` | 0.25 | 1.50 | Recommended low-cost default |
| `gemini-2.5-flash-lite` | 0.10 | 0.40 | Cheaper, but access restricted to prior users; optional explicit legacy profile only |
| `gemini-3.5-flash-lite` | 0.30 | 2.50 | Newer migration option; do not upgrade automatically |

The deprecation page lists 2027-05-07 as the earliest shutdown date for 3.1 Flash-Lite. Review availability before deployment and before that date. Never silently switch to a larger or more expensive model. A missing/unavailable model produces a clear configuration/provider error. Free-tier eligibility and quotas are account-specific; estimates below use paid prices.

Example, not measured usage: 1,200 input tokens plus 400 billed output tokens across both model calls costs `(1200 * 0.25 + 400 * 1.50) / 1,000,000 = $0.0009` per action, or about **$0.90 per 1,000 actions**. This includes all instructions/tool context in the assumed input, and any thinking in assumed billed output. A short user message alone does not determine the bill.

## User scenarios and acceptance

### US1 — Short, inexpensive assistance (P1)

As a player, I receive concise advice without paying for unnecessary long generation.

- Given an active game, when I ask for coaching, then I receive the existing validated recommendation, evidence, and quantity with bounded text.
- Given any workflow, when the model fails or reaches its output cap, then the action stops safely without an automatic retry, continuation, or model upgrade.
- Given ordinary gameplay without configured AI, then the game remains playable.

### US2 — Visible usage (P1)

As the project owner, I can distinguish configured limits from actual usage.

- Given provider usage metadata, then show prompt, candidate, thinking, and total tokens separately, generation call count, count-token call count, model ID, and estimated USD cost.
- Given missing usage metadata or a network timeout, then show usage as unknown/partial, never zero or free by assumption.
- Given rejected generated output, then retain any valid usage metadata because generation may already have incurred cost.

### US3 — Repeated requests stay bounded (P1)

As the project owner, I can prevent repeated clicks or direct API requests from bypassing limits.

- Given a busy service, then reject a concurrent AI action before provider dispatch.
- Given a reached quota or budget, then return a safe actionable error and make no new provider request.
- Given a service restart, then persisted daily counters and spending reservations survive.

## Functional requirements

### FR-01: Explicit model and generation settings

- Default the server's `GEMINI_MODEL` to `gemini-3.1-flash-lite` in documented configuration. Validate it against explicit supported profiles; browser input cannot choose a model.
- Use text-only requests, JSON responses, one candidate, and low-cost thinking (`thinkingConfig.thinkingLevel: "MINIMAL"` for the 3.1 profile). Verify this parameter in the live smoke before acceptance; if unsupported, fail configuration and revise the profile explicitly. Do not claim minimal thinking means zero billed thinking tokens.
- Preserve the existing temperature initially; do not tune unrelated sampling settings in this change.
- Do not enable search, grounding, code execution, paid caching, file search, embeddings, conversation memory, or provider fallback.

### FR-02: Input budgets

- Limit the trimmed user goal to **500 Unicode code points**; reject over-limit input rather than truncating it silently. Keep UI and server checks consistent.
- Reject raw incoming HTTP bodies over **20,000 bytes** before parsing. Revalidate canonical game state as today.
- Build the complete provider prompt from compact instructions, the goal, and the current validated tool result only. Never send all repository files, chat history, or hidden future demand.
- Use `countTokens` on the exact system instructions and contents intended for generation, before each generation call. Count this as a separate provider HTTP request, not a generation. All calls share the existing deadline.
- First model proposal: at most **768 input tokens** for any workflow.
- Second model call: at most **1,024 input tokens** for coach, candidate simulation, and scenario selection; **3,072** for post-game analysis.
- Reject over-budget prompts before generation. Do not discard required evidence, trim canonical history arbitrarily, or claim bytes/characters are exact token counts.
- Keep full ten-week analysis history and verified facts when required by current contracts. Fit compact serialization under the analysis budget; if it cannot fit, fail explicitly and review the budget using measured fixtures.

### FR-03: Output budgets and concise fields

The limits below cover the complete generated JSON, not just visible prose. They are proposed starting budgets and must pass the fixtures and live smoke before being accepted.

| Model call | Maximum output tokens |
|---|---:|
| Tool proposal, all workflows | 128 |
| Coach final | 512 |
| Candidate simulation final | 640 |
| Post-game analysis final | 1,024 |
| Scenario selection final | 384 |

- Set `maxOutputTokens` per call, replacing the uniform 4,096 setting. Budget for thinking within the provider's output accounting; do not assume the entire cap is visible text.
- Enforce maximum Unicode code points: summary 240, recommendation 240, scenario explanation 240, evidence fact 160, finding title 80, finding explanation 240, advice item 160.
- Coach, candidate, and scenario outputs: 1–2 evidence items. Analysis: 1–3 findings, each with 1–2 exact verified facts, and 1–2 advice items. These tighten existing ranges while retaining current required fields.
- Preserve the candidate simulation's exact tool-result copy and analysis evidence matching. Reject overlong/malformed results; never clip JSON or exact evidence into an invalid result.
- Reject extracted JSON text over **12,000 bytes**. Bound reading the provider HTTP body to **64,000 bytes** before parsing; do not first buffer an unlimited response. Never expose thought text.
- `MAX_TOKENS`, refusal, missing candidate, invalid JSON, and non-STOP completion remain explicit safe failures. Do not retry merely to get a longer answer.

### FR-04: Request and time limits

- At most **two generation requests per action**: proposal, then final; one accepted allowlisted local tool execution. Enforce counters before dispatch, not only in telemetry.
- At most **two count-token HTTP requests per action**, giving at most **four provider HTTP requests** total. No third generation, retries, or continuations.
- Keep the **20-second total deadline**, including counting, generation, and local tool work. The client may keep its existing 25-second timeout.
- Server-wide local-demo defaults: **one active AI action**, **six admitted actions per rolling minute**, **100 admitted actions per UTC day**. These are application limits, not claims about Google's quota.
- Validate request and configuration first, then atomically admit/reserve quota before any provider call. An admitted action consumes a daily/minute slot even if counting, generation, or validation later fails; malformed requests rejected before admission do not.
- Return HTTP 429 with `Retry-After` for temporary concurrency/rate limits. Use an explicit safe budget-limit response for daily/budget exhaustion. Retain structured workflow errors for failures after admission.

### FR-05: Usage and estimated cost

- Capture `usageMetadata.promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, and `totalTokenCount` per generation when valid nonnegative integers. Capture usage before final content validation. Missing fields remain nullable; do not infer zero unless the provider contract explicitly guarantees it.
- Aggregate known usage over both calls. Preserve partial totals and completeness status for failed runs. Include actual model ID and price-table version/date.
- For uncached text-only requests, estimated USD cost is `(prompt tokens * input price + (candidate tokens + thinking tokens) * output price) / 1,000,000`. Do not add `totalTokenCount` again. Verify candidate/thinking accounting against current provider documentation and a live sample before accepting cost reconciliation.
- Count-token requests are tracked separately; do not treat their count response as billed generation usage. Recheck their pricing at implementation time and include any applicable charges.
- Expose only sanitized counters and estimates, never prompts, API keys, raw provider responses, or thought text. Small costs must display enough precision, e.g. `$0.000900`, rather than misleading `$0.00`.

### FR-06: Spending reservations and persistence

- Default local application allowance: **$1.00 per UTC day**. This is an application estimate guard, not a provider billing-account cap or a monthly guarantee.
- Reserve the maximum estimated cost of both configured generation calls before admission, using their input/output caps and the selected profile prices. Include any priced counting overhead. Deny admission if the reservation would exceed the remaining allowance.
- Reconcile a reservation to known actual estimated cost only when complete usage is available. Retain the relevant conservative reservation for timeouts, crashes, missing metadata, or uncertain billing; never release it as zero automatically.
- Persist admitted-action counts and cost reservations in a small atomic local ledger, e.g. `.local/ai-usage.json`; add it to `.gitignore`. Serialize admission/reconciliation in the one Node process and write before provider dispatch. On unreadable/corrupt ledger, disable AI safely; core gameplay still works.
- This is a loopback, single-process demo. The quota is global to this service; no new accounts, distributed infrastructure, database service, or per-user identity is needed. Do not describe it as a distributed hard spending cap. Changing profile/prices must not erase existing reservations.

## Edge cases

- Multibyte/Serbian text: enforce Unicode and byte limits separately; exact token counting still applies.
- Boundary counts: accept the cap exactly, reject cap + 1 before generation.
- Concurrent requests: only one admission succeeds; no race can exceed daily or spending reservations.
- Crash after dispatch: retain unresolved reservation across restart.
- UTC midnight: reset the new day's allowance without deleting the prior day's unresolved records; rolling-minute rules remain independent.
- One call succeeds, second fails: preserve first-call usage and any known second-call usage.
- HTTP 429/503 from provider: no automatic retries or expensive fallback.
- Output needs more than its proposed cap: report failure and revise the specification using measured evidence; do not silently expand budgets.
- Duplicate clicks: disable AI actions while busy; server still enforces limits for direct HTTP requests.

## Success criteria

Execution evidence must be maintained in [evidence.md](evidence.md) in this same feature folder. After each implementation session, record actual changes, commands/results, task-to-evidence mapping, sanitized workflow observations, failures, and acceptance status. Do not mark tasks complete or claim feature acceptance without corresponding observed evidence. Preserve mock/live/browser distinctions and previous run history.

- All four workflows retain their tool validation and gameplay non-mutation tests.
- Automated fixtures prove input/output caps, field lengths, two-generation/four-HTTP ceilings, quota races, restart persistence, and conservative unknown-usage handling.
- For one configured live smoke per workflow, record prompt/candidate/thinking/total tokens, cost estimate, model, status, and elapsed time. No paid live requests are part of this documentation task.
- Every successful live result fits its proposed budgets and validates; do not label the model integration accepted from mocks alone.
- Normal gameplay, `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build` pass after implementation.
- No automatic model upgrade, direct AI order submission, or secret committed to Git.

## Sources and review date

Checked 2026-10-29. Pricing and availability can change; recheck before implementation.

- [Google model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [Google Standard API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google availability and deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations)
- [Token counting](https://ai.google.dev/gemini-api/docs/tokens)
- [Generation API, thinking configuration, and usage metadata](https://ai.google.dev/api/generate-content)
- [Spec Kit workflow](https://github.com/github/spec-kit)
