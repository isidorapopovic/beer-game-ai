# AI_USAGE_LOG.md

# AI Usage Log — Beer Distribution Game

## 1. Svrha

Ovaj dokument vodi kratku evidenciju važnih AI poziva tokom Week 3 i Week 4 rada.

Ne beleži se privatni chain-of-thought.

Beleže se samo:

- faza;
- razlog poziva;
- očekivani rezultat;
- stvarni rezultat;
- sledeća odluka.

Pre svakog većeg AI poziva treba moći odgovoriti:

> Šta očekujem da se promeni i kojim signalom ću proveriti da li se to dogodilo?

Ako to nije jasno, sledeći korak treba da bude analiza ili lokalni test, a ne novi prompt.

---

# 2. Evidencija

| # | Faza | Zašto je AI pozvan | Šta se očekivalo | Rezultat | Sledeća odluka |
|---:|---|---|---|---|---|
| 1 | Week 3 / Spec | Strukturisati Build Prompt za Retailer MVP | Jasan scope, gameplay pravila, DoD i zabrane | Kreiran `BUILD_PROMPT_V1.md` | Definisati context paket |
| 2 | Week 3 / Context | Napraviti Context Manifest | Uključeni/izostavljeni izvori, precedence i rizici | Kreiran `CONTEXT_MANIFEST.md` | Proveriti konflikte |
| 3 | Week 3 / Fix | Uskladiti trajanje igre | Jednoznačno pravilo od 10 nedelja | Konflikt 30 vs 10 uklonjen iz aktuelnih dokumenata | Sačuvati baseline failure |
| 4 | Week 3 / Contract | Dodati strukturisan deo igre | `GameConfig`, validan/nevalidan primer i runtime validacija | Contract dodat u Build Prompt i Context Manifest | Definisati evale |
| 5 | Week 3 / Eval | Napraviti mini eval skup | Tipičan, boundary, invalid i raniji failure scenario | Kreiran `EVALS.md` sa E1–E24 | Ne označavati runtime testove kao PASS pre pokretanja |
| 6 | Week 3 / Evidence | Dokumentovati Week 3 rad | Jasno odvojiti urađeno od NOT RUN | Kreiran Week 3 izveštaj | Preći na Week 4 |
| 7 | Week 4 / Tool Design | Definisati jednu kontrolisanu AI sposobnost | AI Hint sa jednim read-only alatom | Kreiran `TOOL_CONTRACT.md` | Napraviti fake/mock implementaciju |
| 8 | Week 4 / Safety | Definisati granicu model vs aplikacija | Model predlaže, aplikacija validira i allowlist odlučuje | Granica dokumentovana | Implementirati input/output validaciju |
| 9 | Week 4 / Test Design | Definisati success/negative/failure testove | `callCount`, allowlist, malformed output i read-only dokaz | T1–T10 definisani u Tool Contract-u | Pokrenuti fake-first testove |
| 10 | Week 4 / Evidence | Napraviti evidence šablon pre runtime testa | Evidencija Tool Contract-a i mesta za stvarne rezultate | Kreiran `EVIDENCE_004.md` | Popuniti tek nakon stvarnih testova |
| 11 | Week 4 / Session 004 Implementation | Implementirati jedan read-only AI Hint flow | Runtime contracts, tool authorization, bounded retries, model routing, phase hints, mock tests | Typecheck/build passed; 30 tests passed; pre-game, in-game, and completed browser smoke passed using fake provider; live provider not tested | Preserve fake-only boundary until an approved provider integration exists |
| 12 | Week 4 / Session 004 Verification | Strogo proveriti Tool Contract test matrix | Actual per-case calls, attempts, IDs, phase behavior, state integrity, and safe outputs recorded | Case 18 fixed using sanitized 10-week history; P5, completed browser smoke, 30 tests, typecheck, and build passed | Preserve fake-only provider boundary; real HTTP/provider integration remains untested |

---

# 3. Pravilo za buduće AI pozive

Za svaki sledeći značajan coding-agent poziv dopisati novi red.

Primer:

| # | Faza | Zašto je AI pozvan | Šta se očekivalo | Rezultat | Sledeća odluka |
|---:|---|---|---|---|---|
| 11 | Implementation | implementirati fake AI Hint flow | T1/T2/T3 mogu da se pokrenu | [popuniti] | [popuniti] |
| 12 | Test | popraviti failing allowlist test | `callCount=0` za unsupported tool | [popuniti] | [popuniti] |
| 13 | Review | pregledati diff i read-only rizik | nema gameplay state mutacije | [popuniti] | [popuniti] |

---

# 4. Šta se ne beleži

Ne beležiti:

- privatni chain-of-thought;
- interne skrivene reasoning korake;
- API keys;
- credentials;
- environment secrets;
- privatne payload-e;
- raw stack trace sa osetljivim podacima;
- privatne URL-ove ili tokene.

---

# 5. AI budžet

Operativni guardrail za dvonedeljni projekat:

```text
10–15 značajnih coding-agent iteracija ukupno
20–30 live AI poziva tokom razvoja
najviše 5 live poziva tokom završne demonstracije
```

Ovo nije cilj potrošnje.

Bolji rezultat je:

```text
manje poziva
+
isti ili bolji dokaz
```

Core testovi treba prvenstveno da koriste:

```text
fake/mock clients
```

a ne live provider.

---

# 6. Core pre Stretch-a

AI se prvo koristi za Core zahteve:

- mali i proverljiv scope;
- Build Prompt;
- Context Manifest;
- baseline;
- runtime validation;
- evale;
- Tool Contract;
- allowlist;
- fake/mock test;
- success/negative/failure evidence.

Tek nakon stabilnog Core-a razmatra se Stretch.

---

# 7. Stretch guardrail

Dozvoljene su najviše jedna ili dve Stretch opcije nakon stabilnog Core-a, na primer:

- prompt ablation;
- context reduction;
- config-driven gameplay;
- dva holdout primera;
- quality eval za hint;
- caching sa objašnjenjem invalidacije;
- lokalna usage telemetry;
- još jedan usko definisan read-only alat.

Ne uvoditi:

```text
execute anything tool
unbounded agent loop
automatic write operation
```

bez eksplicitne potvrde korisnika.

---

# 8. Bezbednosni podsetnik

Nikada ne stavljati u:

```text
prompt
repo
screenshot
evidence
AI Usage Log
```

sledeće:

- API ključ;
- credential;
- environment secret;
- privatni token;
- privatni URL;
- nepotreban privatni payload;
- osetljiv raw stack trace.

---

# 9. Završni format za svaki važan AI poziv

Pre poziva:

```text
Cilj:
Šta očekujem da se promeni:

Signal uspeha:
Kako ću proveriti da li se promena dogodila:

Šta mora ostati isto:
```

Posle poziva:

```text
Stvarni rezultat:

Da li je signal uspeha ispunjen:
PASS / FAIL / BLOCKED

Sledeća odluka:
```

Ovaj format sprečava da novi prompt zameni lokalni test kada problem još nije jasno definisan.
