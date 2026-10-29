# AI tool-call logging: record template

Created: 2026-10-29

## Purpose and current status

Record who requested AI assistance, when it happened, the user's input, which tool was requested/executed, the tool input/output, and the final AI response. Keep one record per AI action, with a separate event for every tool attempt.

This is a **manual/reference recording template**, not a runtime log. Feature 002 now implements automatic server capture when explicitly enabled, using ignored local JSONL and a Markdown export command. The application never appends to this tracked file. No historical user calls have been reconstructed, and no live player calls are entered below. See [setup](../../docs/guides/AI_TOOL_CALL_LOGGING.md) and [execution evidence](evidence.md).

The current game has no login or user accounts. Use an explicitly supplied pseudonymous participant ID when available; otherwise record `unknown`. A run ID identifies an AI action, not a person. Do not infer a person's identity from the device, API key, Git author, or this chat.

Feature documents: [specification](spec.md), [implementation plan](plan.md), and [tasks](tasks.md).

For development decisions and project progress, see [AI_USAGE_LOG.md](../../docs/logs/AI_USAGE_LOG.md). For proposed token/cost controls, see [the low-cost AI specification](../001-low-cost-ai/spec.md).

## What counts as a call

- **AI action:** a player asks for coaching, simulation, analysis, or scenario selection. Record the request even if it fails before a tool executes.
- **Model request:** a provider generation call; capture its sequence number and actual model separately from local tool execution.
- **Tool request:** a proposed named local tool with arguments. Record whether validation allowed execution; a rejected proposal is not an executed call.
- **Tool attempt:** an actual execution, including failed attempts. Give retries their own attempt number if a future workflow supports them.
- **Token counting:** a separate provider request, when implemented; do not count it as generation or local tool execution.
- **Development-agent calls:** if recording coding-assistant tools here, mark `context: development` and use observed tool names. Do not mix them with player calls or claim they are Gemini game requests.

## Current game workflow reference

| Workflow | Allowed local tool | Expected phase |
|---|---|---|
| `decision_coach` | `getCurrentGameState` | Active game |
| `candidate_order_simulation` | `simulateCandidateOrder` | Active game |
| `game_analyst` | `getGameHistory` | Completed game |
| `scenario_generator` | `getAllowedScenarioTypes` | Fresh scenario context |

These are tool names, not model IDs. Preserve the distinction between the user's goal, the tool arguments/result, and the model's final response.

## Recording rules

1. Append a record immediately after an observed action; never fill missing data with a guessed timestamp, response, token count, or user ID.
2. Use ISO 8601 timestamps with an explicit UTC offset, e.g. `YYYY-MM-DDTHH:mm:ss+01:00`, and name the timezone. Use `Europe/Budapest` for local reporting, with its actual offset on that date; UTC timestamps may also be retained.
3. Preserve exact input and output when safe. If summarized, label `summary`; if redacted, label `redacted` and explain what was removed. Do not call a summary an exact transcript.
4. Never record API keys, credentials, private tokens, hidden reasoning/thought text, unnecessary personal data, or sensitive raw error bodies. Use safe error codes/messages. This tracked Markdown file must contain only shareable records; private transcripts belong outside Git.
5. Use `not captured` for unavailable information and `not executed` for a tool blocked before dispatch. Missing usage is unknown, not zero.
6. Separate `live`, `mock/test`, and `development` evidence. A test fixture is not a real player interaction or evidence of live provider success.
7. Link related records by run ID and sequence number. Record known usage even if output validation failed. Mark partial/incomplete records explicitly.

## Call index

No observed calls have been entered yet. Add rows only when supported by actual evidence.

| Record ID | Started at (with offset) | Participant ID | Context / live or mock | Run ID | Workflow | Requested tool(s) | Executed tool(s) | Status |
|---|---|---|---|---|---|---|---|---|

## Per-action template

Copy the following section below the template for each observed action. Replace placeholders with captured values or `not captured`; do not add a fabricated sample run.

### Record `<record-id>`

| Field | Observed value |
|---|---|
| Context | `<gameplay / development>` |
| Evidence mode | `<live / mock-test / development>` |
| Participant ID and source | `<pseudonymous ID supplied by participant, or unknown>` |
| Session/game ID | `<captured ID or not captured>` |
| Started / completed | `<ISO timestamps with offsets>` |
| Reporting timezone | `<Europe/Budapest or UTC>` |
| Run/request ID | `<captured ID or not captured>` |
| Workflow and game week/phase | `<actual values or not applicable>` |
| Provider / actual model ID | `<actual values or not captured>` |
| Final status / stop reason | `<actual values>` |
| Elapsed milliseconds | `<measured value or not captured>` |
| Generation / count-token / executed-tool requests | `<separate observed counts or not captured>` |
| Prompt / candidate / thinking / total tokens | `<separate actual counts or not captured>` |
| Estimated USD cost and price date | `<estimate with assumptions or not captured>` |
| Record completeness | `<complete / partial, with missing fields>` |

**User input — `<exact / redacted / summary>`**

```text
<User's actual message/goal. Explain any redaction.>
```

**Model request(s)**

For each generation request, record its sequence, start/end timestamps, model ID, input provenance, and result status. Include shareable exact visible system instructions and serialized model input when captured; otherwise state that only the user goal/tool data was captured. Never include hidden thoughts. Do not infer the full provider prompt from the user message alone.

**Tool event `<sequence>`, attempt `<attempt-number>`**

| Field | Observed value |
|---|---|
| Tool name proposed | `<exact name>` |
| Proposed / started / completed at | `<captured timestamps or not captured>` |
| Validation / execution status | `<accepted, rejected-before-execution, succeeded, failed, timed-out, etc.>` |
| Safe error / rejection reason | `<actual safe message or not applicable>` |

Tool input — `<exact / redacted / summary>`:

```text
<Actual arguments, preferably JSON. If rejected, preserve safe proposed arguments and mark not executed.>
```

Tool output — `<exact / redacted / summary / not executed / not captured>`:

```text
<Actual returned tool data or safe failure. This is distinct from the AI's final response.>
```

Repeat the tool event section for every proposal/attempt in this action.

**Final AI output shown to the user — `<exact / redacted / summary / no final output>`**

```text
<Actual validated response or the safe error shown to the user.>
```

**Evidence source and follow-up**

- Source: `<sanitized trace, manual observation, or test name; never a private tokenized URL>`.
- Game state changed: `<observed result or not verified; do not assume>`.
- User subsequently applied advice/submitted an order: `<observed action or not captured; a suggestion is not proof of application>`.
- Missing data/redactions/corrections: `<explicit details or none>`.

## Observed records

None entered in this reference template. Configured runtime capture and exports are implemented separately; use the setup guide. Synthetic smoke results are explicitly labelled mock evidence and do not certify live player activity.
