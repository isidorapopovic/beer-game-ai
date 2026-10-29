# Local AI activity logging

Feature 002: [specification](../../specs/002-ai-tool-call-logging/spec.md), [tasks](../../specs/002-ai-tool-call-logging/tasks.md), [execution evidence](../../specs/002-ai-tool-call-logging/evidence.md), and [record template](../../specs/002-ai-tool-call-logging/log-template.md).

## Enable capture explicitly

Logging is off by default. In PowerShell, start the agent with these server-side settings:

```powershell
$env:AI_TOOL_LOG_ENABLED = 'true'
$env:AI_TOOL_LOG_MODE = 'live'
$env:AI_TOOL_LOG_PATH = '.local/ai-tool-calls.jsonl'
npm.cmd run agent:dev
```

Run `npm.cmd run dev` in another terminal as usual. Restart the agent when changing server settings. These flags can also be set in the private `.env` using `.env.example` as a reference. The implementation task did not edit your private `.env` or enable recording in an already-running service.

Use `mock-test` only for synthetic/mock activity and `development` for explicitly labelled development activity. The mode is operator-supplied provenance, not proof of live model access. The browser cannot choose it. `/api/agent/status` reports whether capture is enabled.

## What is recorded

- Request ID, agent run ID, UTC timestamps, monotonic elapsed time, workflow, and game week/phase.
- Anonymous browser session and optional supplied nickname, with unverified identity provenance. IDs persist in browser session storage when available, with an in-memory fallback. Shared browsers can represent multiple people.
- User goal and visible model instructions/input, with exact/redacted/omitted labels.
- Separate count-token and generation request events, actual returned model ID, safe status, and available usage metadata.
- Tool proposals/rejections, actual execution attempts, arguments/results, and the validated final answer or safe error.
- Separate action completion, failure, or cancellation. A recommendation does not prove the player applied it or submitted an order.

The optional participant label is limited to 80 Unicode code points. Before body validation, identity is unknown; later records attach validated anonymous/session metadata to the same request ID. No login or authenticated identity is introduced.

Known server secrets, credential fields/patterns, email/contact fields, recognizable phone/ID patterns, URLs, and hidden thought fields are redacted before persistence. Redaction is pattern-based, not a universal personal-data detector: enter only shareable game questions and pseudonymous labels. Provider headers, raw private errors, and hidden model reasoning are never deliberately captured. Missing usage remains unknown, not zero.

## Files, limits, and errors

The append-only source is `.local/ai-tool-calls.jsonl`; Markdown reports are exports of that source. Runtime data stays in ignored `.local/` or an explicitly configured path outside the repository. Logging paths inside tracked source/documentation folders are refused. The tracked spec template is never appended to automatically.

Each complete event is bounded to 64,000 UTF-8 bytes; oversized payloads are explicitly omitted with their original byte length. Storage is capped at 10,000,000 bytes. Reaching capacity stops new writes and reports `unavailable` or `partial`; it does not delete records or change the AI result. Logging is serialized in one Node process; this is not a distributed or tamper-proof audit system.

The UI reports `recorded`, `partial`, or `unavailable` independently from AI success, with a request reference. If recording is disabled, it says so. File/configuration/logger failures never trigger another model/tool call or block normal gameplay. Client cancellation aborts outstanding provider work and records observed cancellation stages.

If the file ends in an unfinished line after a crash, new appends are refused. Export reports the invalid/truncated tail and preserves earlier valid events; it never fabricates completion. Preserve the damaged file. Explicitly select a new private log path and restart the service if you need to continue; no rotation or cleanup runs automatically.

## Export to Markdown

Choose a new output filename in `.local/` or outside this repository:

```powershell
npm.cmd run logs:export -- --input .local/ai-tool-calls.jsonl --output .local/exports/session-report.md
```

The exporter refuses existing outputs and tracked source/template destinations. Reports contain an index and per-action model/tool/input/output details, usage when available, and warnings about incomplete records. UTC times are rendered with the correct `Europe/Budapest` date-specific offset. Labels are escaped, and payloads are indented JSON so Markdown, HTML, links, and embedded fences cannot change the report structure. Treat exports as local activity records; do not publish or commit them automatically.

## Local verification

```text
npm.cmd test
npm.cmd run typecheck
npm.cmd run test:ui
npm.cmd run build
npm.cmd run test:logging
```

`test:logging` uses explicit mock responses and no private credentials. It captures all four synthetic workflows, verifies game state and request counts, and invokes the actual export CLI in a fresh ignored directory. Its output gives the generated local report path. `test:ui` renders components; it is not an interactive browser test.

Observed results and their limits are in [feature 002 evidence](../../specs/002-ai-tool-call-logging/evidence.md). Feature 001's unresolved live-model acceptance is separate; logging does not turn those earlier failures into successes.
