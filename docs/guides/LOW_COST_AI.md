# Low-cost AI setup and operating limits

Feature 001: [specification](../../specs/001-low-cost-ai/spec.md), [tasks](../../specs/001-low-cost-ai/tasks.md), [actual evidence](../../specs/001-low-cost-ai/evidence.md).

## Local setup

Use Node 24. Keep `GEMINI_API_KEY` server-side. `.env.example` documents the supported settings; private `.env` is never committed. The only supported model profile is `gemini-3.1-flash-lite`. An absent/blank model uses that default; an explicit unsupported model returns a configuration error rather than silently upgrading.

In PowerShell, an explicit process-level selection without changing a private file is:

```powershell
$env:GEMINI_MODEL = 'gemini-3.1-flash-lite'
npm.cmd run agent:dev
```

In another terminal run `npm.cmd run dev`. Restart the agent after configuration changes. Ordinary gameplay works without AI credentials. `/api/agent/status` reports non-secret model/configuration information.

## Enforced policy

- Goals: 1–500 Unicode code points after trimming; incoming JSON body at most 20,000 bytes.
- Exact full-prompt token counting before generation; 768 input tokens for proposals, 1,024 for most finals, 3,072 for analysis finals.
- Output: 128 proposal tokens; final coach 512, candidate 640, analyst 1,024, scenario 384. One candidate, JSON, MINIMAL thinking, no provider retry/fallback.
- Two generations, two count-token requests, and one executed local tool per action; all share a 20-second deadline.
- One active action, six admitted actions per rolling minute, 100 per UTC day. Failed admitted actions still consume slots. HTTP 429 includes `Retry-After`.
- Default $1/day local **estimated** spending allowance. `AI_DAILY_BUDGET_USD` can lower it, but cannot exceed 1. This is not a billing-account cap.

## Usage records and uncertainty

The ignored `.local/ai-usage.json` ledger persists counters and worst-case reservations before any provider request. `AI_USAGE_LEDGER_PATH` can select another server-local path. Use a single Node service/process per ledger. Do not erase or reset this file to bypass quotas. Corruption/read/write failures disable new AI requests safely; core gameplay remains usable. Prior-day records are retained. A crashed service leaves its unresolved reservations intact.

Public UI evidence shows separate request counts, prompt/candidate/thinking/total tokens, model, price date, and USD estimates with six decimal places. Missing token fields stay unknown. A known cost portion is a lower bound, not the full bill. Provider usage is retained on rejected output and failed actions when available.

Keep `AI_COST_RECONCILIATION_VERIFIED=false` until a live sample verifies complete candidate/thinking billing accounting. In the observed live runs Gemini omitted thinking-token metadata; full cost remained unknown and reservations were retained. The opt-in reconciliation path is covered by deterministic tests, but it is not certified by those incomplete live samples. Do not enable it merely because an action succeeded.

If a ledger write fails after a request, the result may still be shown with a retained-reservation/unavailable-ledger warning. Restore the original ledger before continuing AI requests. Transcript capture is a separate opt-in [feature 002 logging system](AI_TOOL_CALL_LOGGING.md); its JSONL is independent from the spending ledger.

## Verification commands

```text
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:ui
```

`test:ui` renders the initial game and usage components in Node. It is not an interactive browser test. Vite/esbuild may require execution outside the filesystem sandbox on this machine for the production build.

`npm.cmd run test:live` makes real API requests through the same HTTP endpoint and quota ledger: one attempt per workflow, no automatic retries. Run it only when ready to use API quota. `AI_LIVE_WORKFLOWS=game_analyst,scenario_generator` selects individual workflows; the default is all four. `AI_LIVE_EVIDENCE_PATH` optionally writes sanitized fixture results to an explicit local file. Never point it at a credential or private file, and preserve previous evidence rather than overwriting failure history.

Current acceptance limitations and all prior failed live runs are in [evidence.md](../../specs/001-low-cost-ai/evidence.md). Provider timeouts/503s are reported safely; the implementation does not widen the deadline or select a more expensive model to hide them.
