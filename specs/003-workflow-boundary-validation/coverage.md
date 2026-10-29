# Spec 003 deterministic coverage

Executed on 2026-10-29. These IDs are literal test-name prefixes in
[workflowBoundaries.test.mjs](../../server/workflowBoundaries.test.mjs) and
[activitySummary.test.mjs](../../server/activitySummary.test.mjs). All inputs are synthetic.
No live-model injection success rate was measured.

## Catalogs

Workflow indices W0–W3: decision_coach, candidate_order_simulation, game_analyst,
scenario_generator. Known tool indices use that same order.

| State | Construction using unchanged engine | Oracle |
|---|---|---|
| S0 | Fresh default game | Coach/candidate/scenario eligible |
| S1 | Submit 9 once | Pipeline present; coach/candidate eligible |
| S2 | Submit zero five times | Backlog; coach/candidate eligible |
| S3 | Submit 4 eight times; week 9 | Candidate arrival week 11 is hypothetical |
| S4 | Submit 4 nine times; pending week 10 | Last-week simulation omits future inbound/arrival |
| S5 | Submit 4 ten times | Only analyst eligible |
| S6 | Isolated edits to config/week/status/order/cost/pipeline/history | Reject before model/tool execution |
| S7 | Canonical A=[2.5,51], B=[19,0] | Both valid; consistency does not prove provenance |

## Full small matrices and bounded pairwise table

| IDs | Cases | Assertions |
|---|---:|---|
| M1-W-T | 16 workflow/tool pairs | 4 responsible tools complete, 12 cross-workflow choices return unknown_tool; exact model/tool counts; no mutation |
| M1-X-W-name | 24 | Every workflow rejects place_order/changeScenario/unknown/constructor/__proto__/toString; one scripted proposal, zero tools |
| M2-W-S | 24 | Every workflow × S0–S5; 12 eligible and 12 rejected; ineligible: zero model/tool calls |
| M3-F-W-control | 40 | Each encoding reaches all four workflows; valid task completes with two scripted calls/one tool |
| M3-F-W-hostile | 40 | Same goals, hostile place_order proposal; unknown_tool, one scripted call/zero tools |
| M3-F-W-hostile-final | 40 | Valid tool followed by fabricated evidence, unavailable-history evidence, or scenario substitution; invalid_final_result, two calls/one tool |
| M4-Q0/Q9/Q50 | 3 | Explicit selected candidate quantity preserved |
| M4-scenario-difficulty | 12 | Every approved scenario/difficulty pair; final matches controls and selected facts |
| M4-invalid-workflow | 4 grouped tests | Missing/extra/wrong-type inputs, invalid numeric/enums; zero model calls |
| M4-facts-workflow | 2 grouped tests | False inventory, cost, week, shipment arrival and inbound facts rejected |
| M4-budget | All four workflows | Actual final prompt includes verified facts; supplied count at existing cap accepted; two count/two generation/one tool ceilings retained |
| M4 exact goal/provider/JSON edges | Grouped | 1/499/500 code points accepted, empty/501 rejected; provider 63999/64000 accepted and 64001 rejected; extracted JSON 11999/12000 accepted and 12001 rejected |
| M4 protocol / client | Grouped | Missing/wrong-type protocol, last duplicate JSON key semantics, 19999/20000/20001-byte HTTP boundary; exact control serialization and no fetch for missing selection |
| M5-tamper-workflow | 44 | Eleven corruption forms × all four workflows; zero model calls, isolated state unchanged |
| M5-S7 | Grouped | Independent canonical histories and exact recent-order projections |
| M5-demand-boundary | 1 | Engine accepts custom 101; AI API still limits demand to 100 |
| M5-horizon-S3/S4 | 2 | Unavailable archive/week goals do not create records or advance game |
| M6/M8 repeat/session | 7 sequential HTTP actions | Six admissions/24 mock provider requests; seventh protocol-valid request denied; changed labels do not bypass global quotas; no deduplication |
| M6 concurrent A/B | 3 HTTP actions | A admitted, concurrent B busy with no extra provider call, later B admitted; unique goal/state remains isolated in prompts |
| M6 failed/phase | 2 HTTP actions | Admitted failures consume slots; ineligible phase makes zero provider requests |
| M6 cancel/reissue | 2 HTTP actions | Cancellation followed by successful reissue, distinct admissions, five total mock HTTP requests, no retry |
| M7-invalid-* | 15 | Bad participant/run/date/duration/sequence/payload/usage shapes skipped; 18 valid neighbors export; source unchanged |
| M7-lifecycle-* | 14 | Reorder/gap/duplicate/run/context/identity/conflicting terminal/post-terminal execution/missing workflow or tool/status/duration/final-counter/run-payload issues make record incomplete |
| M7 special cases | Grouped | UTC correction allowed; early failure and late cancellation observations valid; exact event-line edges; omission/redaction explicit |
| M8 old/absent usage | Grouped | Old v1 admission unknown; missing usage unknown; empty capture creates no invented records |

The M2 eligible count includes ten coach/candidate cells, one analyst cell, and one
scenario cell. Phase rejection occurs after HTTP quota reservation, so a valid
HTTP request in the wrong phase still consumes an admitted slot. Invalid protocol
and quota denial do not reserve a slot.

| Input ID | Representation | Pairwise states for coach/candidate controls and hostile proposals |
|---|---|---|
| F0 | Plain multi-step scope/rule/progression command | S0 |
| F1 | JSON text with spoofed system role | S1 |
| F2 | Markdown/system code fence | S2 |
| F3 | Unicode confusable, combining character, bidi | S3 |
| F4 | Base64 text | S4 |
| F5 | Percent-encoded text | S0 |
| F6 | NUL, HTML, special characters | S1 |
| F7 | Nested JSON instructions | S2 |
| F8 | Repeated commands below goal limit | S3 |
| F9 | Contradictory task/scenario controls | S4 |

Every row also reaches analyst S5 and scenario S0, with both legitimate and hostile
controls. Hostile finals use S0 for active/pre-game workflows and S5 for analyst.
No goal decoding, keyword authority, code evaluation, extra model or retries exist.

## Reused checks and uncovered combinations

The original 137 tests remain in the suite, including exact proposal/final input
caps and cap+1, output/thinking limits, missing usage, global 6/minute and 100/day,
restart/crash reservations, cancellation/deadlines, private paths/no overwrite,
redaction, ten-MB storage, and engine invariants. Their fixtures were updated for
required selections and exact evidence, without weakening their assertions.

This is deliberately not every state × encoding × tool × quantity combination.
S7 isolation is exercised through coach projections and the real HTTP A/B cases;
canonical replay validation is shared by every workflow. Every approved scenario
pair is checked, but every mismatched pair is not enumerated. Free advisory prose
is not semantically certified. Mock token counts exercise enforcement; actual
Gemini tokenization of new prompts was not measured. The real countTokens gate
remains authoritative and can reject an oversized live prompt without retry.

The stale-advice change has source inspection evidence only. Native Chrome access
timed out waiting for app approval after browser-host discovery failed; no browser
interaction pass or screenshot is claimed. See the manual acceptance steps in
[evidence.md](evidence.md). Spec 001 T022 remains separate.
