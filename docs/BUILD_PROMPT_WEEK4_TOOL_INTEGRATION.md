# BUILD_PROMPT_WEEK4_TOOL_INTEGRATION.md

# Week 4 — Sesija 004
# Implementacija jednog kontrolisanog read-only AI alata

Pre implementacije:

1. Sažmi razumevanje zadatka.
2. Navedi relevantne fajlove koje si pregledao.
3. Napiši plan implementacije u nekoliko koraka.
4. Navedi nejasnoće, pretpostavke ili konflikte.
5. Navedi fajlove koje očekuješ da menjaš.
6. Ne proširuj scope.
7. Ne uvodi drugi alat, write operaciju, novi framework ili autonomnu agent petlju.

---

# 1. Cilj

Na postojeći Beer Distribution Game Retailer MVP dodaj jednu kontrolisanu AI sposobnost:

```text
Ask AI for Hint
```

AI Hint koristi tačno jedan read-only alat:

```text
get_game_state
```

Cilj je mali kompletan vertikalni slice:

```text
ugovor
→ input validacija
→ allowlist
→ scope/authorization provera
→ adapter
→ fake/mock poziv
→ timeout/retry politika
→ output validacija
→ finalna HintResponse validacija
→ bezbedan UI rezultat ili greška
→ testovi
→ dokaz
```

AI ne sme da menja game state.

Aplikacija je autoritet nad izvršavanjem alata i stanjem igre.

---

# 2. Obavezni izvori koje prvo treba pročitati

Pročitaj ovim redom:

```text
1. CONTEXT_MANIFEST.md
2. GAME_SPEC.md
3. BUILD_PROMPT_V1.md
4. EVALS.md
5. TOOL_CONTRACT.md
6. EVIDENCE_004.md
7. AI_USAGE_LOG.md
8. package.json
9. relevantne src/ fajlove
10. relevantne tests/ fajlove
```

Ako neki fajl ne postoji, navedi to.

Nemoj izmišljati komande koje ne postoje u `package.json`.

---

# 3. Scope

Dozvoljeno je implementirati samo:

- `Ask AI for Hint` UI flow;
- jedan tool: `get_game_state`;
- runtime input validaciju;
- runtime output validaciju;
- explicit allowlist;
- scope/authorization proveru;
- adapter;
- request/correlation ID;
- timeout;
- bounded retry samo za eksplicitno retryable greške;
- safe telemetry/event zapis;
- structured `HintResponse`;
- runtime validaciju `HintResponse`;
- safe fallback;
- fake/mock provider ili fake tool client;
- unit/integration testove;
- jedan smoke scenario.

Nije dozvoljeno:

- drugi alat;
- write tool;
- automatsko postavljanje order-a;
- menjanje inventory-ja kroz AI;
- menjanje backorder-a kroz AI;
- menjanje week-a kroz AI;
- menjanje `GameConfig`;
- shell execution;
- file write iz AI flow-a;
- backend redesign;
- novi framework;
- provider router;
- autonomna agent petlja;
- više agenata;
- generički `execute anything`;
- veliki refaktor koji nije potreban za ovaj task.

---

# 4. Ključna granica

Model-generated tool call je:

```text
PREDLOG
```

a ne dozvola.

Obavezni flow:

```text
user request
  -> model proposes tool
  -> application validates tool name
  -> application validates arguments
  -> application checks allowlist
  -> application checks scope/authorization
  -> adapter creates requestId
  -> read-only fake/tool client executes
  -> timeout/retry policy applies
  -> tool output is validated
  -> public output is mapped
  -> model returns structured HintResponse
  -> HintResponse is validated
  -> UI displays valid hint or safe fallback
```

Ni jedan korak ne sme da preskoči validaciju.

---

# 5. Tool Contract

Koristi postojeći contract iz:

```text
TOOL_CONTRACT.md
```

Tool name:

```text
get_game_state
```

Read/write:

```text
READ ONLY
```

Allowed caller:

```text
AI Hint flow only
```

Input:

```ts
type GetGameStateInput = {
  detail: "summary" | "tactical";
};
```

Output:

```ts
type GameStateSnapshot = {
  week: number;
  totalWeeks: 10;
  customerDemand: number;
  inventory: number;
  backorders: number;
  incomingShipment: number;
  previousOrder: number;
  weeklyCost: number;
  totalCost: number;
};
```

---

# 6. Stroga input validacija

TypeScript tip sam po sebi nije dovoljan.

Mora postojati runtime validacija.

Validni inputi:

```json
{
  "detail": "summary"
}
```

```json
{
  "detail": "tactical"
}
```

Nevalidan input:

```json
{
  "detail": "everything",
  "executeCode": "..."
}
```

Za nevalidan input očekivanje je:

```text
INVALID_INPUT
callCount = 0
```

Tool client ne sme biti pozvan.

---

# 7. Boundary provera

Dodaj najmanje jednu eksplicitnu boundary proveru.

Primeri:

- `detail` mora biti tačno `"summary"` ili `"tactical"`;
- nema praznog `detail`;
- nema proizvoljno dugačkog stringa;
- nema dodatnih izvršnih polja.

Ako koristiš strict object validation, dodatna nedozvoljena polja treba odbiti.

---

# 8. Tool allowlist

Dozvoljen je samo:

```text
get_game_state
```

Primer:

```ts
const ALLOWED_AI_TOOLS = ["get_game_state"] as const;
```

Ako model predloži:

```text
place_order
set_inventory
reset_game
execute_shell
read_file
```

očekivanje je:

```text
UNSUPPORTED_TOOL
callCount = 0
```

Ništa se ne izvršava.

---

# 9. Scope / Authorization provera

Validacija inputa nije isto što i authorization.

Pre poziva mora postojati eksplicitna provera da:

```text
caller === AI Hint flow
```

i da zahtev pripada dozvoljenom read-only scope-u.

Ako je tool name i input validan, ali caller/scope nije dozvoljen:

```text
FORBIDDEN
callCount = 0
```

Ne otkrivaj kroz korisničku poruku dodatne interne detalje.

---

# 10. Adapter

Implementiraj mali adapter između orchestration sloja i fake/tool client-a.

Adapter mora:

- primiti validiran zahtev;
- generisati ili primiti `requestId`;
- proslediti samo dozvoljene argumente;
- primeniti timeout;
- primeniti retry policy samo gde je dozvoljeno;
- vratiti stabilan rezultat;
- ne prosleđivati raw provider payload direktno UI-ju.

Ne uvoditi provider router.

---

# 11. Request / Correlation ID

Svaki AI Hint tool flow mora imati stabilan:

```text
requestId
```

Primer:

```text
req_hint_123
```

Isti `requestId` treba da povezuje:

- početak adapter poziva;
- attempts;
- finalni status;
- telemetry/event zapis.

Ne koristiti tajne ili korisničke privatne podatke kao request ID.

---

# 12. Timeout

Adapter mora imati jasan timeout/deadline.

Ne dozvoli beskonačno čekanje.

Ako timeout istekne:

```text
TIMEOUT
```

UI dobija kontrolisanu poruku ili safe fallback.

Game state ostaje nepromenjen.

---

# 13. Retry politika

Retry je dozvoljen samo za eksplicitno retryable greške.

Retryable:

```text
TIMEOUT
UPSTREAM_UNAVAILABLE
```

Not retryable:

```text
INVALID_INPUT
FORBIDDEN
UNSUPPORTED_TOOL
NOT_FOUND
MALFORMED_OUTPUT
CANCELLED
```

Budžet:

```text
najviše 2 pokušaja ukupno
```

Ne koristiti:

```text
retry until success
```

Ako prvi pokušaj vrati retryable 503/upstream failure:

```text
attempt 1 = failure
attempt 2 = final attempt
```

Ako attempt 2 uspe:

```text
success
attempts = 2
```

Ako attempt 2 opet padne:

```text
UPSTREAM_UNAVAILABLE
attempts = 2
```

---

# 14. Cancellation

Ako postojeća arhitektura podržava `AbortSignal` ili ekvivalent:

- prosledi signal adapteru/client-u;
- cancellation mora vratiti:

```text
CANCELLED
```

- ne retry-uj nakon cancellation-a;
- ne prikazuj lažni success.

Ako cancellation nije podržan u starteru, jasno ga označi kao poznato ograničenje umesto da uvodiš veliki refaktor.

---

# 15. Tool output validacija

Tool output mora biti runtime validiran.

Proveriti najmanje:

```text
week je number
1 <= week <= 10

totalWeeks === 10

customerDemand >= 0
inventory >= 0
backorders >= 0
incomingShipment >= 0
previousOrder >= 0
weeklyCost >= 0
totalCost >= 0
```

Ako fake/upstream vrati na primer:

```json
{
  "week": "five",
  "inventory": -20
}
```

rezultat mora biti:

```text
MALFORMED_OUTPUT
```

Ne sme biti lažnog success-a.

Ne pokušavaj da "pogodiš" šta je provider verovatno mislio.

---

# 16. Public output projection

UI/model ne treba da dobije proizvoljan interni objekat.

Mapiraj samo ugovorena javna polja iz validiranog `GameStateSnapshot`.

Ne prosleđuj:

- secrets;
- environment variables;
- raw logs;
- stack trace;
- file paths;
- hidden state;
- source code;
- private provider fields;
- credential;
- private URL;
- token.

Ako output sadrži dodatno privatno polje, strict output validation ili mapper treba da ga odbije ili ukloni prema ugovoru.

Za Core preferiraj:

```text
MALFORMED_OUTPUT
```

ako upstream krši strict contract.

---

# 17. Stabilni javni statusi

Koristi stabilne interne/javne statuse.

Minimalni skup:

```text
SUCCESS
INVALID_INPUT
FORBIDDEN
UNSUPPORTED_TOOL
NOT_FOUND
TIMEOUT
UPSTREAM_UNAVAILABLE
MALFORMED_OUTPUT
CANCELLED
```

Ne mora svaki status imati različit dugačak tekst u UI-ju, ali testovi treba da mogu razlikovati uzrok.

---

# 18. HintResponse Contract

Finalni AI odgovor mora biti strukturisan:

```ts
type HintResponse = {
  hint: string;
  suggestedAction:
    | "order_more"
    | "order_less"
    | "keep_order_stable"
    | "review_pipeline"
    | "wait";
  urgency: "low" | "medium" | "high";
};
```

Runtime validator mora proveriti:

- `hint` je neprazan string;
- `suggestedAction` je dozvoljena vrednost;
- `urgency` je dozvoljena vrednost;
- nema izvršnog koda;
- nema automatske game komande.

UI nikada ne izvršava `suggestedAction`.

---

# 19. Safe fallback

Ako AI/provider/tool flow ne može bezbedno da završi, prikaži stabilan fallback:

```text
AI hint is currently unavailable. Please continue using the visible game information.
```

Fallback ne sme:

- promeniti week;
- postaviti order;
- promeniti inventory;
- promeniti backorders;
- menjati shipping pipeline;
- menjati total cost.

---

# 20. Safe telemetry / event

Sačuvaj samo minimalan bezbedan signal.

Primer:

```json
{
  "operation": "game.hint.state",
  "status": "SUCCESS",
  "requestId": "req_hint_123",
  "attempts": 1,
  "latencyMs": 42
}
```

Dozvoljena polja:

```text
operation
status
requestId
latencyMs
attempts
```

Ne loguj:

- raw prompt;
- raw provider payload;
- source code;
- full game object;
- credential;
- token;
- private URL;
- environment values;
- stack trace sa osetljivim podacima.

Telemetry služi za dokaz i korelaciju, ne kao kopija privatnog payload-a.

---

# 21. Fake First

Core implementacija mora prvo raditi sa:

```text
fake/mock AI
fake/mock tool client
```

Ne zavisi od live providera.

Preporučeni redosled:

```text
contract
  -> fake client
  -> positive test
  -> negative tests
  -> failure/fault injection
  -> all green
  -> smoke test
  -> optional limited live test
```

Ako live provider nije testiran:

```text
LIVE PROVIDER: NOT TESTED
```

mora biti napisano u evidence-u.

---

# 22. Obavezni test matrix

Pre implementacije zadrži očekivanja ispod.

Posle implementacije zabeleži stvarne rezultate.

## T1 — Valid request

Input:

```json
{
  "detail": "summary"
}
```

Očekivanje:

```text
SUCCESS
callCount = 1
valid args
same requestId
valid public output
valid HintResponse
```

Dokaz:

- spy;
- exact args;
- response;
- requestId;
- attempts.

---

## T2 — Invalid input

Primer:

```json
{
  "detail": "everything"
}
```

Očekivanje:

```text
INVALID_INPUT
callCount = 0
```

---

## T3 — Malicious extra field

Input:

```json
{
  "detail": "summary",
  "executeCode": "..."
}
```

Očekivanje:

```text
INVALID_INPUT
callCount = 0
```

---

## T4 — Forbidden scope

Validan input, ali caller nije AI Hint flow.

Očekivanje:

```text
FORBIDDEN
callCount = 0
```

---

## T5 — Unsupported tool

Model predlaže:

```text
place_order
```

Očekivanje:

```text
UNSUPPORTED_TOOL
callCount = 0
```

---

## T6 — Not found

Ako fake client podržava scenario da traženi snapshot/resurs nije dostupan:

```text
NOT_FOUND
attempts = 1
no retry
```

Korisniku vrati stabilnu safe poruku.

Ne izmišljaj ovaj scenario ako ga starter uopšte nema; u tom slučaju ga označi kao `NOT APPLICABLE`.

---

## T7 — 503 → success

Fake client:

```text
attempt 1 -> UPSTREAM_UNAVAILABLE
attempt 2 -> SUCCESS
```

Očekivanje:

```text
SUCCESS
attempts = 2
```

Najviše 2 ukupna pokušaja.

---

## T8 — 503 → 503

Fake client:

```text
attempt 1 -> UPSTREAM_UNAVAILABLE
attempt 2 -> UPSTREAM_UNAVAILABLE
```

Očekivanje:

```text
UPSTREAM_UNAVAILABLE
attempts = 2
```

Nema trećeg pokušaja.

---

## T9 — Timeout

Fake client kasni duže od deadline-a.

Očekivanje:

```text
TIMEOUT
bounded attempts
controlled fallback
```

Ako timeout retry policy dozvoljava retry:

```text
attempts <= 2
```

---

## T10 — Malformed output

Fake tool vrati:

```json
{
  "week": "five",
  "inventory": -20
}
```

Očekivanje:

```text
MALFORMED_OUTPUT
no false success
```

---

## T11 — Malformed final HintResponse

Model vrati:

```json
{
  "hint": 123,
  "suggestedAction": "delete_game",
  "urgency": "extreme"
}
```

Očekivanje:

```text
final validation FAIL
safe fallback
```

UI ne prikazuje invalid hint kao success.

---

## T12 — Read-only integrity

Sačuvaj gameplay state pre poziva:

```text
week
inventory
backorders
incomingShipment
previousOrder
weeklyCost
totalCost
```

Pokreni validan AI Hint flow.

Ponovo pročitaj state.

Očekivanje:

```text
gameplay state unchanged
```

Dozvoljena promena:

```text
hint loading/error/result UI state
```

---

## T13 — Cancellation

Ako adapter podržava cancellation:

Očekivanje:

```text
CANCELLED
no retry after cancellation
```

Ako nije podržano:

```text
NOT APPLICABLE / documented limitation
```

---

# 23. Smoke scenario

Dodaj jedan osnovni smoke scenario:

```text
1. aplikacija se pokrene;
2. igra je u validnom state-u;
3. korisnik klikne Ask AI for Hint;
4. fake flow uspe;
5. validan hint se prikaže;
6. gameplay state ostane isti.
```

Ovo nije zamena za unit/integration testove.

---

# 24. Obavezne provere

Koristi samo komande koje stvarno postoje u projektu.

Proveri `package.json`.

Kada postoje, pokreni:

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

Ako postoji posebna smoke komanda, pokreni je.

Za svaku komandu zabeleži:

```text
command
exit/result
PASS/FAIL
```

Ne tvrdi da je nešto prošlo ako nije stvarno pokrenuto.

---

# 25. Required evidence posle implementacije

Ažuriraj:

```text
EVIDENCE_004.md
```

sa stvarnim:

- changed files;
- command results;
- success flow;
- exact tool args;
- `callCount`;
- requestId;
- attempts;
- negative pre-call rejection;
- one provider/output failure;
- final structured `HintResponse`;
- telemetry/event primerom;
- poznatim ograničenjem;
- doprinosom oba člana.

Ažuriraj:

```text
AI_USAGE_LOG.md
```

sa važnim coding-agent iteracijama.

Ne čuvaj chain-of-thought.

---

# 26. Acceptance Criteria

Core je završen samo ako:

- [ ] postoji samo jedan read-only tool;
- [ ] Tool Contract je jasan;
- [ ] input runtime schema postoji;
- [ ] boundary input test postoji;
- [ ] invalid input daje `callCount = 0`;
- [ ] allowlist postoji;
- [ ] unsupported tool daje `callCount = 0`;
- [ ] scope/authorization provera postoji;
- [ ] forbidden scope daje `callCount = 0`;
- [ ] adapter ima `requestId`;
- [ ] adapter ima timeout;
- [ ] retry je bounded na najviše 2 pokušaja;
- [ ] retry se koristi samo za retryable greške;
- [ ] cancellation se ne retry-uje ako je podržana;
- [ ] tool output se runtime validira;
- [ ] malformed output ne daje success;
- [ ] samo javna ugovorena polja izlaze iz boundary-ja;
- [ ] finalni `HintResponse` se runtime validira;
- [ ] UI ne izvršava `suggestedAction`;
- [ ] safe fallback postoji;
- [ ] telemetry sadrži samo bezbedna minimalna polja;
- [ ] fake/mock positive path prolazi;
- [ ] fake/mock negative path prolazi;
- [ ] fake/mock failure path prolazi;
- [ ] read-only integrity je dokazan;
- [ ] test dokazuje exact arguments;
- [ ] test dokazuje `callCount`;
- [ ] test dokazuje attempts;
- [ ] typecheck prolazi ako postoji;
- [ ] testovi prolaze;
- [ ] build prolazi;
- [ ] smoke scenario je izvršen;
- [ ] diff sadrži samo namerne fajlove;
- [ ] nema credential-a ili tajni;
- [ ] `EVIDENCE_004.md` ima stvarne rezultate;
- [ ] `AI_USAGE_LOG.md` je ažuriran.

---

# 27. Stop pravilo

Stani kada:

```text
Core acceptance criteria prođu
+
diff sadrži samo namerne promene
+
evidence postoji
+
poznato ograničenje je dokumentovano
```

Ako Core radi, ne troši vreme na drugi alat ili veći refaktor.

Dodatno vreme koristi za:

```text
bolji test
ili
jasniji evidence
```

---

# 28. Finalni odgovor coding agenta

Na kraju vrati:

## Implementirano

- šta je dodato;
- gde je dodato.

## Promenjeni fajlovi

Tačna lista.

## Tool Boundary

- tool name;
- allowlist;
- input validator;
- scope check;
- requestId;
- timeout;
- retry budget;
- output validator;
- final validator.

## Komande

Za svaku:

```text
command
actual result
```

## Test Matrix

Za svaki relevantni T1–T13:

```text
Expected
Observed
PASS / FAIL / BLOCKED / NOT APPLICABLE
Evidence
```

## Safe telemetry example

Prikaži samo sanitizovan event.

## Known limitation

Najmanje jedno realno ograničenje.

## Scope confirmation

Potvrdi:

```text
one read-only tool only
no write operations
no autonomous loop
no second tool
no new framework
```

---

# 29. Kritični podsetnik

```text
MODEL PROPOSES.
APPLICATION VALIDATES.

INVALID INPUT:
NO CALL.

FORBIDDEN SCOPE:
NO CALL.

UNSUPPORTED TOOL:
NO CALL.

VALID READ:
BOUNDED CALL.

MALFORMED OUTPUT:
NO FALSE SUCCESS.

AI ADVISES.
GAME STATE DOES NOT CHANGE.
```
