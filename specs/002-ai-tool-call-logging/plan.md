# Implementation plan: AI tool-call logging

Feature: 002

Status: Future implementation. This package currently contains documentation only.

Read [spec.md](spec.md), use [log-template.md](log-template.md) for the report format, and execute [tasks.md](tasks.md) in dependency order.

## Architecture

Browser session/optional participant label -> server request correlation -> observed model/tool/workflow events -> sanitization and bounded JSONL writer -> local Markdown export.

Keep event capture beside the existing execution boundaries. Observe actual validated dispatch rather than reconstructing tool execution from a model's final answer. Preserve the existing two-model-call flow and canonical game engine.

## Proposed files and responsibilities

| Area | Proposed files | Responsibility |
|---|---|---|
| Session context | `src/agent/agentClient.ts`, `src/App.tsx` | Anonymous session ID, optional pseudonymous label, safe logging status |
| HTTP correlation | `server/index.mjs` | Request ID, metadata validation, logging configuration and failure reporting |
| Model events | `server/gemini.mjs`, `server/workflows.mjs` | Visible input, actual model, request status, known usage; no secrets or thoughts |
| Tool events | `src/agent/boundedAgent.ts` | Optional event callback around proposal validation and actual execution |
| Local persistence | New `server/aiToolCallLog.mjs` | Event schema, sanitization, serialized append, byte/storage limits |
| Markdown export | New `server/exportAiToolCallLog.mjs` | Safe local report generation using the template structure |
| Setup/evidence | `.env.example`, `.gitignore`, integration docs | Explicit logging setup, ignored runtime files, observed verification |

Do not import Node filesystem modules into browser-shared workflow code. Inject a server-owned event callback; use a no-op when logging is disabled. Wrap callback failures so they cannot execute a tool twice or replace a workflow result.

## Implementation order and proposed future commits

1. `feat(logging): define correlated AI action events` — event schema, session attribution, server request IDs, and metadata validation.
2. `feat(logging): capture model and tool execution events` — optional observers at existing boundaries, safe failure states, and usage integration when available.
3. `feat(logging): persist sanitized bounded local events` — single-process JSONL writer, ignored paths, capacity behavior, and logging status.
4. `feat(logging): export AI action history as Markdown` — template-based index/details with safe escaping and local output selection.
5. `test(logging): verify correlation privacy and failure handling` — deterministic integration/export tests and regression evidence.

These are future runtime commits, not commits already made for this documentation reorganization.

## Dependency on feature 001

Feature 002 can be implemented independently of [low-cost AI](../001-low-cost-ai/spec.md). Existing model/tool counters are sufficient for a first record; unavailable tokens/costs remain unknown. If feature 001 is implemented first, reuse its known usage and stop reasons instead of adding duplicate measurement or extra API requests. Coordinate edits to shared files without changing either feature's validation requirements.

## Verification and delivery

Use mock fetch, an injected clock, isolated temporary log paths, and deterministic workflow fixtures. Verify no secret leakage, no cross-request mixing, zero additional provider requests, unchanged game state, and correct rejected-versus-executed tool counts. Test safe export of backticks/HTML and crash-truncated JSONL.

After implementation run `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`, followed by a local mock workflow/export smoke. Do not claim live per-user recording until verified with actual observed calls. Keep runtime data out of Git. Work on a feature branch; no merge or push to `main` is part of this package.
