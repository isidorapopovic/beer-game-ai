# Tasks: AI tool-call logging

Feature: 002

All 20 tasks were implemented and verified on 2026-10-29 for the configured local mock capture/export environment. See [evidence.md](evidence.md) for each task's observations, failed-run history, and live/browser limitations. Runtime capture remains explicitly opt-in.

Required execution record: [evidence.md](evidence.md) in this folder. After each session, record actual outcomes and link each completed task to its evidence. This is separate from the user activity log; do not mark completion from a template or baseline tests alone.

## Foundations — US1

- [x] T001 Define event schema, context/evidence mode, completeness, and logging status types.
- [x] T002 Add anonymous browser session attribution and optional validated participant label without accounts or inferred identity.
- [x] T003 Allocate server request IDs and link agent run IDs and monotonic event sequence numbers.
- [x] T004 Capture UTC timestamps and durations; test `Europe/Budapest` display offsets.

## Observed execution — US1/US2

- [x] T005 Capture action admission and safe pre-run failures with request correlation.
- [x] T006 Capture visible model input, actual model, generation status, and known usage without raw provider errors or thought text.
- [x] T007 Add optional tool-event hooks for proposals, rejection, execution, result, and failure; keep Node-only logging outside shared browser code.
- [x] T008 Capture the final validated user response or safe failure; never infer that advice was applied.
- [x] T009 Integrate feature 001 metadata if available; otherwise preserve unknown usage and add zero provider calls.

## Persistence and export — US2/US3

- [x] T010 Implement sanitization/redaction with explicit exact/redacted/summary/omitted labels.
- [x] T011 Implement serialized local JSONL append with 64,000-byte event and 10-MB storage caps.
- [x] T012 Surface partial/unavailable logging independently from workflow status and handle truncated restart records.
- [x] T013 Add explicit server configuration and ignore runtime logs/exports in Git; document local data handling.
- [x] T014 Build local Markdown export matching [log-template.md](log-template.md), escaping untrusted content and preserving event order.

## Verification and completion

- [x] T015 Test all four workflow success paths, rejected proposals, invalid arguments, timeouts, cancellation, and malformed outputs.
- [x] T016 Test interleaved requests, anonymous/shared-session attribution, missing metadata, restart, and file failures.
- [x] T017 Test secret redaction, multibyte limits, storage capacity, backticks/HTML, and exact-vs-omitted payload representation.
- [x] T018 Assert no extra provider requests, no tool retries caused by logging, and unchanged game state.
- [x] T019 Run tests, typecheck, build, and a mock local log/export smoke; record actual commands, exit codes, test counts, observations, and failures in [evidence.md](evidence.md).
- [x] T020 Finalize this folder's [evidence.md](evidence.md): task mapping, changed files/commits, sanitized log/export observations, privacy checks, live status, limitations, and acceptance conclusion; update setup docs. Record live evidence only when actually observed; keep work on a feature branch and do not push without instruction.
