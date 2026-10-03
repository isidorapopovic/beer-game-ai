# TOOL_CONTRACT.md

# Week 4 — Sesija 004
# Tool Contract: AI Hint za Beer Distribution Game

## 1. Svrha

Ovaj dokument definiše ugovor za jedinu AI funkcionalnost koja se dodaje u trenutnoj Week 4 fazi projekta:

```text
AI Hint
```

Korisnik u UI-ju može da klikne:

```text
Ask AI for Hint
```

AI ne menja stanje igre.

AI može samo da dobije ograničen, read-only snapshot trenutne partije i na osnovu njega vrati strukturisan savet.

Osnovni princip:

> AI daje savet. Aplikacija ostaje jedini autoritet nad game state-om.

---

# 2. Ključna granica

Model može da:

```text
predloži dozvoljeni tool call
```

ali model ne odlučuje sam da li će se alat izvršiti.

Aplikacija mora da:

1. proveri naziv alata;
2. proveri argumente;
3. proveri allowlist;
4. proveri scope;
5. tek onda izvrši read-only alat;
6. validira rezultat alata;
7. prosledi validan rezultat modelu;
8. validira finalni `HintResponse`;
9. prikaže hint ili safe fallback.

Model nikada ne dobija pravo da izvršava proizvoljan alat ili proizvoljan kod.

---

# 3. Tool Contract

## Tool name

```text
get_game_state
```

## Purpose

Vraća mali, sanitizovan i read-only snapshot trenutne Beer Distribution Game partije potreban za generisanje AI hint-a.

Alat nije namenjen za debug dump cele aplikacije niti za pristup internim detaljima implementacije.

---

## Read / Write

```text
READ ONLY
```

Alat ne sme da menja stanje igre.

---

## Allowed caller

```text
AI Hint flow only
```

`get_game_state` nije opšti alat za druge delove aplikacije.

---

# 4. Input Contract

Dozvoljeni input je:

```ts
type GetGameStateInput = {
  detail: "summary" | "tactical";
};
```

Dozvoljene vrednosti su samo:

```text
summary
tactical
```

## Validni primeri

```json
{
  "detail": "summary"
}
```

ili:

```json
{
  "detail": "tactical"
}
```

## Nevalidan primer

```json
{
  "detail": "everything",
  "executeCode": "..."
}
```

Ovaj poziv mora biti odbijen pre izvršavanja alata.

---

# 5. Input Runtime validacija

TypeScript tip sam po sebi nije dovoljan.

Sledeće nije dovoljan dokaz:

```ts
const args = rawArgs as GetGameStateInput;
```

Mora postojati runtime validacija.

Na primer:

```ts
function validateGetGameStateInput(
  input: unknown
): GetGameStateInput {
  // runtime checks
}
```

Validacija mora proveriti:

- input je objekat;
- postoji samo očekivani `detail`;
- `detail` je `"summary"` ili `"tactical"`;
- nema nedozvoljenih dodatnih polja ako implementacija koristi strict contract;
- ne prihvata se `executeCode`;
- ne prihvataju se proizvoljni stringovi;
- invalid input ne sme doći do samog alata.

Ako input nije validan:

```text
tool call se odbija
callCount = 0
```

---

# 6. Output Contract

`get_game_state` mora vraćati samo mali sanitizovan snapshot.

Predloženi output:

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

Ovaj output sadrži samo informacije potrebne za hint.

---

# 7. Summary vs Tactical

Ako je:

```text
detail = "summary"
```

alat može vratiti osnovni snapshot iz `GameStateSnapshot`.

Ako je:

```text
detail = "tactical"
```

alat i dalje ostaje read-only i sanitizovan.

Može vratiti isti osnovni snapshot i, samo ako već postoji u game state-u i ako je potrebno za hint, mali dodatni read-only podatak kao što je:

```text
next incoming shipment / shipment pipeline summary
```

Ne treba uvoditi dodatne podatke samo zato što AI može da ih koristi.

Week 4 scope je mala kontrolisana AI funkcionalnost.

---

# 8. Tool Must NOT Return

`get_game_state` ne sme vraćati:

- secrets;
- API ključeve;
- environment variables;
- source code;
- file paths koji nisu potrebni;
- kompletan application state;
- React component state koji nije relevantan;
- private data;
- system prompt;
- developer prompt;
- raw logs;
- backend credentials;
- config secrets;
- proizvoljne interne objekte;
- funkcije;
- executable code;
- unrelated application state.

Alat treba da vrati najmanji snapshot dovoljan za AI hint.

---

# 9. Read-only pravilo

U Core delu Week 4 model kroz alat ne sme da:

- menja `inventory`;
- menja `backorders`;
- menja `customerDemand`;
- menja `incomingShipment`;
- menja `previousOrder`;
- menja `currentWeek`;
- menja `weeklyCost`;
- menja `totalCost`;
- automatski postavlja `Order Quantity`;
- izvršava order umesto korisnika;
- menja `GameConfig`;
- menja shipping pipeline;
- resetuje simulaciju;
- prelazi na sledeću nedelju;
- piše fajlove;
- izvršava shell komande;
- uvodi drugi alat;
- pokreće autonomnu petlju.

AI funkcionalnost je savetodavna.

---

# 10. Obavezni tok

Osnovni tok mora biti:

```text
user request
  -> model proposes allowed tool
  -> application validates tool name
  -> application validates arguments
  -> application checks allowlist and scope
  -> read-only tool executes
  -> tool output is validated
  -> model receives validated snapshot
  -> model returns structured HintResponse
  -> final HintResponse is validated
  -> UI displays valid hint or safe fallback
```

Nijedan korak se ne preskače.

---

# 11. Tool Allowlist

Za trenutni AI Hint flow dozvoljen je samo:

```text
get_game_state
```

Primer allowlist-a:

```ts
const ALLOWED_AI_TOOLS = [
  "get_game_state"
] as const;
```

Ako model predloži:

```text
set_inventory
place_order
reset_game
execute_shell
read_file
```

ili bilo koji drugi naziv:

```text
poziv mora biti odbijen
```

Ništa se ne izvršava.

---

# 12. Tool Name Validation

Pre izvršavanja aplikacija mora da proveri:

```ts
toolName === "get_game_state"
```

Ne sme se koristiti dinamički pattern tipa:

```ts
tools[modelGeneratedName](args)
```

bez prethodne allowlist provere.

Model-generated tool name je predlog, ne dozvola.

---

# 13. Tool Output Validation

Ni rezultat samog alata ne sme se automatski smatrati validnim.

Aplikacija mora proveriti da output odgovara očekivanom `GameStateSnapshot` contract-u.

Proveriti najmanje:

```text
week je validan broj
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

Ako tool output nije validan:

```text
AI hint flow ne sme nastaviti kao success
```

Treba prikazati kontrolisanu grešku ili safe fallback.

---

# 14. Final AI Output Contract

Model mora vratiti strukturisan odgovor.

Za Beer Distribution Game koristimo:

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

---

# 15. Značenje `suggestedAction`

## `order_more`

AI sugeriše da korisnik razmotri povećanje sledeće porudžbine.

AI ne postavlja order automatski.

---

## `order_less`

AI sugeriše da korisnik razmotri smanjenje sledeće porudžbine.

---

## `keep_order_stable`

AI smatra da trenutni pristup ne zahteva veliku promenu na osnovu dostupnog snapshot-a.

---

## `review_pipeline`

AI savetuje korisniku da posebno obrati pažnju na incoming shipments / pipeline pre donošenja odluke.

---

## `wait`

AI nema dovoljno osnova za agresivnu promenu i savetuje oprez.

`wait` ne znači automatsko slanje order-a od 0.

Korisnik i dalje sam odlučuje.

---

# 16. Final Output Runtime validacija

TypeScript tip nije dovoljan.

Mora postojati runtime validator, npr:

```ts
function validateHintResponse(
  input: unknown
): HintResponse {
  // runtime validation
}
```

Validator proverava:

- `hint` postoji;
- `hint` je string;
- `hint` nije prazan;
- `suggestedAction` je jedna od dozvoljenih vrednosti;
- `urgency` je `"low"`, `"medium"` ili `"high"`;
- nisu prisutne vrednosti koje UI treba da izvrši kao kod;
- odgovor ne pokušava da zaobiđe game rules.

---

# 17. UI pravilo

UI ne parsira proizvoljan AI tekst kao komandu.

UI sme da koristi samo validirani `HintResponse`.

Na primer:

```text
Hint:
"Backorders are increasing while no large shipment is arriving soon.
Consider increasing the next order cautiously."

Suggested action:
order_more

Urgency:
medium
```

UI prikazuje savet.

UI ne izvršava:

```text
order_more
```

kao game action.

To je samo label / recommendation.

---

# 18. Safe Fallback

Ako bilo koji od sledećih koraka padne:

- model provider failure;
- timeout;
- invalid tool proposal;
- invalid arguments;
- unsupported tool;
- tool execution failure;
- malformed tool output;
- malformed final AI output;

UI treba da prikaže kontrolisanu poruku.

Predloženi fallback:

```text
AI hint is currently unavailable. Please continue using the visible game information.
```

Fallback:

- ne menja stanje igre;
- ne šalje order;
- ne menja current week;
- ne resetuje igru;
- ne prikazuje nevalidan model output.

---

# 19. Failure Policy

## Invalid tool name

```text
REJECT
tool not executed
```

## Invalid arguments

```text
REJECT
callCount = 0
```

## Tool failure

```text
controlled error / safe fallback
```

## Timeout

```text
controlled error / safe fallback
```

## Malformed tool output

```text
validation failure
do not call result success
```

## Malformed final model output

```text
do not display raw invalid hint
show safe fallback
```

---

# 20. Retry pravilo

Core implementacija ne treba da uvodi autonomni retry loop.

Ako se implementira retry za provider failure, mora biti:

- mali;
- eksplicitno ograničen;
- testiran;
- bez mogućnosti beskonačne petlje.

Ako nije potreban za trenutni task:

```text
no automatic retry
```

je prihvatljiva i jednostavnija opcija.

---

# 21. Fake First, Live Second

Većina testova mora raditi bez live AI providera.

Preporučeni tok:

```text
contract
  -> fake/mock model
  -> fake/mock tool client
  -> unit/integration tests
  -> negative paths
  -> all green
  -> optional limited live provider test
```

Core Week 4 rezultat ne zavisi od dostupnosti live providera.

Ako live provider nije korišćen:

```text
to mora biti jasno dokumentovano
```

i ne sme se tvrditi da je live integracija testirana.

---

# 22. Minimalni Test Matrix

Pre implementacije zapisati očekivanje.

Posle implementacije zapisati stvarni rezultat.

| ID | Scenario | Očekivanje | Obavezni dokaz | Status |
|---|---|---|---|---|
| T1 | validan AI Hint zahtev | jedan dozvoljen tool call sa validnim argumentima i validan HintResponse | request, args, response, spy/callCount | NOT RUN |
| T2 | invalid arguments | alat nije izvršen | `callCount = 0` | NOT RUN |
| T3 | unsupported tool | ništa nije izvršeno | allowlist assertion | NOT RUN |
| T4 | timeout/provider failure | kontrolisana greška ili fallback | status + attempts | NOT RUN |
| T5 | malformed tool output | nema lažnog success-a | output validation assertion | NOT RUN |
| T6 | malformed final AI output | UI ne prikazuje invalid hint | final validation assertion | NOT RUN |
| T7 | read-only integrity | game state isti pre i posle hint flow-a | state snapshot before/after | NOT RUN |
| T8 | extra malicious argument | poziv odbijen | `callCount = 0` | NOT RUN |
| T9 | tool called twice | flow ne sme nepotrebno izvršiti više poziva | exact `callCount` assertion | NOT RUN |
| T10 | valid hint displayed | UI prikazuje samo validirani structured response | rendered result assertion | NOT RUN |

---

# 23. T1 — Validan zahtev

Scenario:

```text
User clicks:
Ask AI for Hint
```

Model predlaže:

```json
{
  "tool": "get_game_state",
  "arguments": {
    "detail": "summary"
  }
}
```

Očekivanje:

```text
tool name valid
arguments valid
allowlist pass
scope pass
tool executes exactly once
output validates
model returns valid HintResponse
final response validates
UI displays hint
```

Obavezni dokaz:

```text
callCount = 1
```

i sačuvani validirani argumenti.

---

# 24. T2 — Invalid arguments

Model predlaže:

```json
{
  "detail": "everything",
  "executeCode": "..."
}
```

Očekivanje:

```text
REJECT BEFORE TOOL EXECUTION
```

Obavezni dokaz:

```text
callCount = 0
```

---

# 25. T3 — Unsupported tool

Model predloži:

```text
set_inventory
```

ili:

```text
place_order
```

Očekivanje:

```text
REJECT
```

Ni jedan tool se ne izvršava.

Obavezni dokaz:

```text
allowlist test
callCount = 0
```

---

# 26. T4 — Timeout ili provider failure

Scenario:

AI provider ne odgovara ili vraća failure.

Očekivanje:

```text
kontrolisana greška
ili
safe fallback
```

Game state ostaje nepromenjen.

Ne sme postojati beskonačni retry.

---

# 27. T5 — Malformed tool output

Fake tool vrati na primer:

```json
{
  "week": "five",
  "inventory": -20
}
```

Očekivanje:

```text
tool output validation FAIL
```

Flow ne sme tretirati rezultat kao uspešan.

Model ne treba da dobije nevalidan snapshot kao da je validan game state.

---

# 28. T6 — Malformed final output

Model vrati na primer:

```json
{
  "hint": 123,
  "suggestedAction": "delete_game",
  "urgency": "extreme"
}
```

Očekivanje:

```text
HintResponse validation FAIL
```

UI ne prikazuje ovaj odgovor kao validan hint.

Prikazuje se safe fallback.

---

# 29. T7 — Read-only integrity

Pre AI hint flow-a sačuvati snapshot relevantnog state-a.

Na primer:

```text
week
inventory
backorders
incomingShipment
previousOrder
weeklyCost
totalCost
```

Pokrenuti AI Hint.

Nakon flow-a ponovo pročitati state.

Očekivanje:

```text
game state unchanged
```

osim UI state-a koji je potreban samo za prikaz hint-a, kao što su:

```text
hint loading
hint error
hint response
```

AI Hint ne sme menjati gameplay state.

---

# 30. T8 — Malicious / Extra argument

Input:

```json
{
  "detail": "summary",
  "executeCode": "rm -rf /",
  "newInventory": 99999
}
```

Očekivanje:

```text
REJECT
callCount = 0
```

Ne izvršava se ništa iz dodatnih polja.

---

# 31. T9 — Broj tool poziva

Za jedan običan `Ask AI for Hint` zahtev očekuje se:

```text
jedan potreban get_game_state poziv
```

Ako implementacija bez razloga pozove alat više puta:

```text
FAIL
```

Test mora pratiti broj poziva.

---

# 32. T10 — Validan hint u UI-ju

Validan model response:

```json
{
  "hint": "Backorders are increasing while the incoming shipment is small. Consider increasing your next order cautiously.",
  "suggestedAction": "order_more",
  "urgency": "medium"
}
```

Očekivanje:

- response prolazi runtime validaciju;
- UI prikazuje hint;
- UI može prikazati suggestedAction i urgency;
- ništa se automatski ne izvršava u game state-u.

---

# 33. Dozvoljeni Week 4 scope

Dozvoljeno je dodati:

- `Ask AI for Hint` button;
- AI hint UI state;
- `get_game_state`;
- tool input validator;
- tool output validator;
- allowlist;
- HintResponse type;
- HintResponse runtime validator;
- safe fallback;
- fake/mock provider;
- fake/mock tool client;
- unit/integration testove za flow.

---

# 34. Zabranjeni Week 4 scope

Ne dodavati:

- AI koji automatski igra igru;
- automatsko postavljanje order-a;
- drugi tool;
- write tool;
- autonomous agent loop;
- shell execution;
- file write iz AI flow-a;
- database;
- backend osim ako je kasnije eksplicitno odobren kao poseban task;
- multiplayer;
- memory između partija;
- AI koji menja GameConfig;
- AI koji menja gameplay pravila;
- dodatne supply-chain role.

---

# 35. Definition of Done za Tool Contract implementaciju

Week 4 AI Hint Core smatra se spremnim samo ako:

- [ ] postoji `Ask AI for Hint`;
- [ ] postoji samo jedan dozvoljeni tool: `get_game_state`;
- [ ] alat je read-only;
- [ ] tool input ima strukturisan contract;
- [ ] tool input ima runtime validaciju;
- [ ] invalid args ne izvršavaju alat;
- [ ] postoji explicit tool allowlist;
- [ ] unsupported tool se odbija;
- [ ] tool output ima strukturisan contract;
- [ ] tool output se runtime validira;
- [ ] finalni `HintResponse` ima strukturisan contract;
- [ ] finalni `HintResponse` se runtime validira;
- [ ] UI ne izvršava `suggestedAction`;
- [ ] invalid final output ne stiže do UI-ja kao success;
- [ ] safe fallback postoji;
- [ ] AI Hint ne menja gameplay state;
- [ ] fake/mock testovi pokrivaju positive i negative path;
- [ ] test proverava `callCount`;
- [ ] test proverava šta je poslato;
- [ ] test proverava šta je vraćeno;
- [ ] test proverava šta se nije desilo;
- [ ] live provider nije potreban za Core completion;
- [ ] ako live provider nije testiran, to je eksplicitno navedeno.

---

# 36. Kritični podsetnik

```text
MODEL PROPOSES.
APPLICATION VALIDATES.
ALLOWLIST DECIDES.
READ-ONLY TOOL EXECUTES.
OUTPUT IS VALIDATED.
MODEL ADVISES.
APPLICATION VALIDATES AGAIN.
UI DISPLAYS.
GAME STATE REMAINS AUTHORITATIVE.
```

AI savet nikada nije direktna game komanda.
