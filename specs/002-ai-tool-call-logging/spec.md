# Feature specification: AI tool-call logging

Feature: 002

Date: 2026-10-29

Branch: `docs/cheap-ai-model-spec`

Status: Specified, not implemented. This change moves the manual template and adds planning documents; it does not enable automatic logging.

## Goal and scope

Track when a participant asks the game for AI assistance, their input, the model and tool called, the tool arguments/result, the final response, and the outcome. Give the project owner a readable Markdown record backed by observed events.

The existing manual record format has moved from `docs/AI_TOOL_CALL_LOG.md` to [log-template.md](log-template.md). The [plan](plan.md) and [tasks](tasks.md) define future automatic capture. Keep development-agent activity separate from player activity. Never fabricate historical calls.

## Current baseline

- The app has four workflows and a local Node endpoint, `POST /api/agent/run`.
- Run evidence currently includes workflow, run ID, provider, model/tool counters, elapsed time, status, and stop reason.
- There are no player accounts, persistent participant/session IDs, or automatic input/output log files.
- The template is a manual document. Existing counters are not a complete transcript.

## User stories and acceptance scenarios

### US1 — Know who called what and when (P1)

As the project owner, I can correlate one participant's AI action with its tool activity.

- Given a participant/session identifier, when an action starts, then record a unique request ID, workflow, goal, timestamp, and identifier provenance.
- Given no supplied participant label, then use a generated anonymous session identifier. Never infer a real person; a shared browser may represent multiple people.
- Given a rejected tool proposal, then record the proposed name/arguments and rejection, with zero executed-tool events.

### US2 — Inspect actual inputs and outputs (P1)

As the project owner, I can distinguish the user's message, model request, local tool call, and final answer.

- Given a successful action, then record the shareable goal, visible model input, model ID, tool arguments/result, validated final response, and ordering of events.
- Given a failed action, then preserve events already observed and a safe failure status; do not invent missing outputs.
- Given redacted/omitted content, then mark its representation explicitly. A summary must never be labelled an exact transcript.

### US3 — Review a readable persistent report (P1)

As the project owner, I can export captured events into the format in [log-template.md](log-template.md).

- Given recorded events, then produce a Markdown index and per-action details grouped by request/run ID.
- Given interleaved runs or process restart, then preserve correlation and event sequence without overwriting prior records.
- Given a mock test, then label it as mock evidence rather than live player activity.

## Functional requirements

- **FR-01 Identity:** Add an anonymous browser session ID and optional explicitly supplied pseudonymous participant label. Record the source and mark labels unverified. This is local-demo attribution, not authentication. No login or accounts are required.
- **FR-02 Correlation:** Allocate a server request ID before workflow execution. Link any subsequent agent run ID, session ID, workflow, and per-request monotonically increasing event sequence. Failures before run creation must still correlate to the request.
- **FR-03 Time:** Store UTC ISO timestamps and measured durations. Render local dates with `Europe/Budapest` and the date's actual UTC offset. Never derive duration by subtracting formatted local time strings.
- **FR-04 Events:** Capture request accepted, model request started/completed/failed, tool proposed, tool rejected, tool execution started/completed/failed, and action completed/failed/cancelled. Count-token requests, if feature 001 introduces them, are distinct events.
- **FR-05 Payloads:** Capture user goal, shareable visible system instructions/model input, exact tool arguments/result, and validated final response or safe user-facing failure. Record proposed versus executed calls separately. Include model-output validation status without persisting unsafe raw provider error bodies or hidden thoughts.
- **FR-06 Usage:** Capture known model IDs, request counters, token usage, and estimated cost when supplied by the implementation of feature 001. If unavailable, record null/unknown and partial completeness. Logging must work without feature 001 and must not issue new model/count requests just to fill fields.
- **FR-07 Persistence:** Use append-only structured events in an ignored local JSONL file, e.g. `.local/ai-tool-calls.jsonl`. Serialize writes in the single Node process. Generate Markdown from those events; do not maintain two competing authoritative logs or append runtime records to this tracked template.
- **FR-08 Export:** Render the index and details following the template. Escape participant labels, prompts, output, Markdown links, HTML, and embedded code fences so content cannot alter report structure. Export to an explicitly selected local output path, not a new public endpoint.
- **FR-09 Data boundaries:** Persist only shareable data. Redact credentials, known secrets, and unnecessary personal data before storage, and label redactions. Never log authorization headers, API keys, environment values, thought text, or sensitive raw provider responses. Raw private transcripts stay outside Git.
- **FR-10 Bounded records:** Reject participant labels over 80 Unicode code points. Bound each sanitized event to 64,000 UTF-8 bytes and active JSONL storage to 10 MB. Mark oversized payloads omitted with their original byte length; do not silently call a truncated record exact. At capacity, stop logging new payloads and expose a safe logging-unavailable status; no silent deletion or unlimited growth.
- **FR-11 Failure semantics:** Logging failures must not change canonical gameplay state, resubmit tools, retry model calls, or mask the actual workflow result. Return a separate safe logging status (`recorded`, `partial`, `unavailable`) and document missing records. On restart, report a crash-truncated final JSONL line and export valid earlier events; never fabricate completion.
- **FR-12 Controls:** Make logging explicit in local server configuration and documented as local-demo capture. Store runtime logs outside tracked sources and exclude them from Git. Rotation/cleanup is a separate explicit local operation; do not auto-publish transcripts or add remote telemetry.

## Edge cases

- Failure before tool execution, unsupported tool, invalid arguments, timeout, malformed final output, or cancelled request: capture only observed stages.
- Duplicate clicks and concurrent requests: separate request IDs; no cross-user payload mixing.
- Server crash: unfinished requests remain incomplete, with any already-written events preserved.
- Missing metadata: unknown is distinct from zero. A proposed recommendation does not prove that the player submitted an order.
- Participant changes label or uses a shared device: preserve per-request source; do not retroactively rewrite identity.
- Payload contains backticks, HTML, secret-looking text, or multibyte Serbian characters: validate redaction and safe rendering.
- File unavailable/full: clearly mark incomplete logging while core gameplay stays usable.

## Success criteria

Execution evidence must be maintained in [evidence.md](evidence.md) in this same feature folder. After each implementation session, record actual changes, commands/results, task-to-evidence mapping, sanitized workflow/log/export observations, failures, and acceptance status. Do not mark tasks complete or claim feature acceptance without corresponding observed evidence. This implementation evidence is separate from [the activity-log template](log-template.md) and private runtime logs.

- Mock success and failure tests cover all four workflows and verify exact safe input/tool/final-output correlation.
- Tests verify timestamps, event ordering, redaction, unknown identity/usage, safe Markdown rendering, restart handling, and record/storage limits.
- Logging adds zero provider calls and does not mutate gameplay or weaken existing tool validation.
- Markdown exports clearly distinguish live, mock, and development evidence; no fabricated history is delivered.
- After runtime implementation, tests, typecheck, production build, and local log/export smoke pass. Live AI validation is recorded only if actually run.

## Exclusions

No accounts, authenticated audit trail, cross-device identity, public transcript dashboard, external analytics service, retroactive recovery of missing calls, or automatic capture of this coding chat. This feature is a local activity log for the existing game.
