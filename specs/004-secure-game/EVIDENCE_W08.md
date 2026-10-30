# EVIDENCE_W08: početna pravila za Decision Coach

## Najnovije izvršenje 2026-10-30

**500/500 testova, 54/54 security testa, typecheck/build/UI/logging/sentinel i
stvarni automatizovani Chrome DOM/CSP prolaze; novi audit ima 0 nalaza.**
S15/S16 su zatvoreni; [completion-evidence.md](completion-evidence.md) beleži
komande, rezultate, negativnu proveru i ograničenja. Novi [T17](t17-results.json)
i [browser driver dokaz](browser-results.json) zamenjuju raniji delimični status.
Lični doprinos preskočen je po zahtevu korisnika; stvarna proba/odbrana NOT RUN.
Ostatak dokumenta čuva ranije faze i njihove tadašnje statuse.


## Istorijski zapis prethodne implementacije i prvog pregleda

Posle početne dokumentacione faze korisnik je odobrio implementaciju i testiranje.
**Završni tehnički rezultat: 499 testova, uključujući 53 W08 security testa, stvarni
Chrome DOM/CSP/stale-advice dokaz, build/typecheck/rendered UI, security/logging
smoke i audit sa 0 prijavljenih ranjivosti.**

Kompletan zapis šta je bilo pre, šta je dodato, koji pokušaji su pali, stvarne
komande i ograničenja nalazi se u [implementation-evidence.md](implementation-evidence.md).
Mašinski zapisi su [verification](verification.json), [browser](browser-results.json),
[security](security-results.json), [logging](logging-results.json) i [audit](dependency-audit.json).
Rad je na feature grani, necommitovan/nepushovan. S14 čeka lični doprinos članova
para. Pregled 2026-10-30 je u [requirements-review.md](requirements-review.md):
S15 browser pokretač, S16 kombinovani T17 i S18/S19 stvarna proba/odbrana ostaju
otvoreni. [Osmominutni scenario](demo-8-minuta.md) je pripremljen, nije izveden.
U ovom pregledu testovi nisu ponavljani; 499/53 su prethodni rezultati.
Spec 001 live acceptance ostaje otvoren.

## Istorijski zapis prve dokumentacione faze

Tekst ispod opisuje isključivo prvobitnu fazu bez kodiranja. Njegovi NOT RUN redovi
nisu završni status implementacije; služe poređenju sa naknadnim dokazima iznad.

Datum: 2026-10-29. Početni branch/commit: `main` / `d87bc24`.
Status: **DOCUMENTATION ONLY; W08 implementacija i izvršivi testovi NOT RUN**.

## Izabrani tok i obim ovog zapisa

Korisnik je izabrao `decision_coach` i `getCurrentGameState({})` i izričito tražio
da se prvo definišu zabrane, format, dužina, broj poziva i granica dva istovremena
izvršavanja, bez izmene koda. Ovaj zapis ne predstavlja završen domaći.

## Stvarno pregledano

Korišćeni su `git status`, `git rev-parse`, `rg` i čitanje projektnih fajlova.
Pregledani su postojeća politika/ledger, HTTP ruta, provider adapter, coach
projekcija/normalizer, shared input limiti, participant kontekst, UI i W08 zahtevi.
Nije čitan privatni `.env`, nisu menjani runtime logovi ni ledger.

| Izvor | Opaženo pregledom koda |
|---|---|
| [aiLimits.ts](../../src/agent/aiLimits.ts) | Cilj 1-500 Unicode code point-a posle trim-a; tekstualni validatori |
| [aiPolicy.mjs](../../server/aiPolicy.mjs) | 20.000-byte zahtev; token/response cap-ovi; 6/min, 100/dan, do 1 USD; konfiguracija kaže maxActive 1 |
| [aiUsageLedger.mjs](../../server/aiUsageLedger.mjs) | Jedan aktivan posao po zajedničkoj ledger putanji kroz Set; samo promena policy broja ne bi omogućila dva |
| [index.mjs](../../server/index.mjs) | Ulaz/replay, admission pre workflow-a, AbortController; nema kvote po partiji |
| [gemini.mjs](../../server/gemini.mjs) | Najviše 2 generacije/2 countTokens; preostali ukupni deadline, nema posebnog 8 s per-call limita |
| [decisionCoach.ts](../../src/agent/decisionCoach.ts) | Jedini alat, osam snapshot polja, pet istorijskih nedelja, proverene činjenice, količina 0-50; finalna nepoznata polja se izostavljaju |
| [boundedAgent.ts](../../src/agent/boundedAgent.ts) | Own-property dispatch i veličina rezultata; tool-result validator ne sprovodi potpuno zabranu dodatnih polja |
| [App.tsx](../../src/App.tsx) | Coach UI šalje fiksno pitanje, prikazuje tekst, igrač zasebno podnosi porudžbinu; source clear prethodnog saveta postoji |
| [aiToolCallLog.mjs](../../server/aiToolCallLog.mjs) | Opciono detaljno snimanje i redakcija; to nije automatski minimalni W08 operativni security log |

Ovo su statička opažanja, ne ponovno izvršeni testovi. Prethodni spec 003 evidence
beleži 446 testova i zasebno otvorenu browser proveru; taj rezultat ovde nije
preimenovan u W08 PASS.

## Šta je sada napravljeno

- [Specifikacija](spec.md): Z01-Z11, konkretni postojeći i predloženi limiti,
  inventar podataka, devet rizika i tri prioriteta.
- [Plan](plan.md): redosled buduće implementacije, I1-I8/T00-T17 mapiranje,
  tri planirana pre/posle slučaja i ograničenja dokaza.
- [Zadaci](tasks.md): S01-S14, svi otvoreni.
- [Indeks foldera](README.md) i veza u [indeksu specifikacija](../README.md).

## Izvršenje i acceptance

| Provera | Status u ovoj fazi |
|---|---|
| Pregled sadašnjih fajlova/politike i git checkpoint-a | EXECUTED - read-only |
| Relativni linkovi i samo dokumentacioni diff | EXECUTED - 28 linkova, 0 neispravnih; 11 zabrana, 9 rizika/3 prioriteta i 14 otvorenih zadataka; samo Markdown izmene |
| Novi unit/integration security testovi | NOT RUN |
| Typecheck/build/runtime smoke | NOT RUN - nema izmene koda |
| Browser DOM/XSS/stale advice/CSP | NOT RUN |
| Live AI provider pozivi | NOT RUN; 0 poziva u ovoj fazi |
| Audit zavisnosti i sentinel test | NOT RUN |
| Implementacija limita 2, game kvote 10 i timeout-a 8 s | NOT IMPLEMENTED |

Dokumentaciona provera je koristila Python standardnu biblioteku za proveru
relativnih putanja i broja stavki, `git diff --check`, `git diff --name-only HEAD`
i `git ls-files --others --exclude-standard`. `git diff --exit-code HEAD -- src
server package.json package-lock.json vite.config.ts .env.example` potvrdio je da
runtime, konfiguracija i zavisnosti nemaju izmene. Ovo nisu security testovi.
Novi dokumenti su ostavljeni necommitovani; push nije rađen u ovoj fazi.

## Ograničenja i sledeći korak

Pregled koda nije dokaz da su novi limiti sprovedeni. Nova granica dva posla nije
još uključena. Predlozi 10 zahteva po partiji i 8 s po HTTP pozivu su projektne
odluke za budući rad. Game kvota zahteva održiv serverski lifecycle; browser UUID
nije autentifikacija. Savet može uticati na odluku igrača, ali agent ne sme
direktno menjati rezultat/pravila ili podneti porudžbinu.

Nema tvrdnje o opštoj otpornosti na prompt injection ili tačnosti slobodnog saveta.
Članovi para, njihovi lični doprinosi i AI refleksija nisu izmišljeni/popunjeni.
Sledeći korak je pregled ovog ugovora, pa zasebno tražena implementacija.
