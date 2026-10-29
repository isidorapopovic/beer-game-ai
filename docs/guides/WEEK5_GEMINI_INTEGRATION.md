# Week 5 Gemini integration

Implemented on 2026-10-03. All four Week 5 UI actions now call a server endpoint rather than hardcoded model callbacks. Gemini credentials are deliberately not configured yet. No live acceptance or browser smoke is claimed.

## Run locally

Use Node 24 (the tested runtime). Copy `.env.example` to `.env`, then set `GEMINI_API_KEY` and `GEMINI_MODEL` locally when ready. The model must support JSON output and be available to your Google account. Never use a `VITE_` prefix for the key.

Start two terminals:

```text
npm.cmd run agent:dev
npm.cmd run dev
```

The agent service listens on `127.0.0.1:3001`. Vite proxies `/api` to it for both development and preview. Without credentials, ordinary gameplay works; AI requests return a clear configuration error, with no fake fallback. Restart the agent service after changing `.env`.

## Architecture and contracts

```text
UI -> POST /api/agent/run -> canonical state replay/validation
   -> existing bounded workflow -> Gemini JSON proposal
   -> existing allowlisted tool -> Gemini JSON final
   -> existing workflow final validation -> safe result and run metadata
```

The existing Week 4/5 orchestrator and game engine remain the base. A new server-only Gemini adapter supplies real model steps because the previous repository had only fake clients. It uses Google's `generateContent` REST API, JSON output, and an API-key header: https://ai.google.dev/api/generate-content.

| Workflow | Tool | Bounds and behavior |
|---|---|---|
| Decision Coach | `getCurrentGameState({})` | Active game, read-only; recommendation integer 0..50 |
| Candidate simulation | `simulateCandidateOrder({orderQuantity})` | Active game, integer 0..50; deterministic shipment timing; no state change or speculative cost forecast |
| Post-game analyst | `getGameHistory({})` | Completed game only; 1..6 findings, exact supplied history evidence, 1..4 advice items |
| Scenario generator | `getAllowedScenarioTypes({})` | Fresh context; approved scenario/difficulty only; engine authors demand |

The UI passes the order field quantity to the simulation goal (or the previous order when empty). A model can propose tools only from the workflow registry. The first model step cannot skip the required tool. Argument, result, and final validation remain in the shared workflows. Scenario selection is displayed first; a separate **Start this scenario** action creates deterministic demand with seed 5. Selection cannot overwrite an ongoing game after orders have been submitted. Order submission is disabled while an AI request runs to prevent recommendations from becoming stale during a week transition.

Limits remain four steps, two tool calls, one retry per step, a 20-second total deadline, and 50,000 bytes per tool result. Gemini network requests share the run deadline and are aborted at its expiration. No additional provider retry or fake fallback is added.

Secrets stay server-side. Provider errors are sanitized, thinking parts are excluded, and public evidence contains only run identifiers, workflow, provider, counters, elapsed time, status, and stop reason. No shell, filesystem, SQL, arbitrary URL, or gameplay mutation tool is exposed. Submitted game snapshots must match a replay of canonical game rules; this is a local demo service, not an authenticated multiplayer backend.

## Verification and later live demo

`npm.cmd test`: 79 passed, 0 failed, including eight server integration checks. Those checks mock Gemini HTTP responses and verify the real endpoint wiring, two model calls/one tool for each workflow, phase checks, tampered-state rejection, malicious tools/arguments, premature finals, safe errors, and missing configuration.

`npm.cmd run build`: TypeScript and Vite production build passed. Vite needed execution outside the filesystem sandbox to read its config.

`npm.cmd run test:live`: ready, **not run against Gemini**. Once configured, it exercises all four workflows with real model calls, prints safe evidence, and fails unless each completes with a tool step and unchanged game snapshot. It consumes Gemini API usage. This is an API smoke test, not a browser test.

For the Spec 07 browser demo: start the default game, request the Decision Coach and candidate simulation, explicitly submit orders, complete Week 10, analyze the game, ask for a hard growth scenario, review the selection, and explicitly start it. Verify all results and safe evidence in the UI. Browser smoke remains pending.

The unknown-tool and invalid-order failure traces are automated deterministic tests. They are not described as observed live provider behavior. The original extended tables in `EVIDENCE_005.md` remain unfinished historical templates.

Production deployment is not included: the built frontend needs this Node service behind a same-origin `/api` reverse proxy. The current service intentionally binds to loopback for local integration.
