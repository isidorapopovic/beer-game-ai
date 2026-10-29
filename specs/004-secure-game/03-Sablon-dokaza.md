# `EVIDENCE_W08.md` — Secure the Arcade

Popunite ovaj zapis iz stvarnog rada u svom W03–W05 repozitorijumu. Očekivanje napišite pre testa. Razlikujte planirano, izvršeno, opaženo i zaključeno; ne upisujte izmišljene rezultate. Koristite sintetičke vrednosti i fake provider.

## 1. Opseg i checkpoint

- Tim i članovi:
- Igra/projekat i postojeći W05 agentski tok:
- Repo URL ili bezbedna lokalna putanja:
- Početni branch/commit:
- Završni branch/commit:
- Okruženje, Node verzija i browser:
- Početne komande i stvarni rezultati (typecheck, test, build, funkcionalna provera):
- Da li je tok local-only, single-user ili ima naloge/privatne resurse? Dokaz:
- Ako početni W05 tok nije radio, tačna prepreka i odobrena rezervna putanja:

## 2. Arhitektura i inventar podataka

Prikažite tok od browser akcije do izlaza i security događaja. Prilagodite crtež slojevima koji zaista postoje.

```text
Browser / localStorage / URL
        → HTTP granica: telo, origin/credential, ulaz i limiti
        → agent/orchestrator: identitet, pravila, budžet
        → provider adapter ↔ fake provider
        → validacija model predloga → dozvoljeni tool → dozvoljeni resurs
        → provera tool rezultata → finalna validacija → bezbedan UI prikaz
        ↘ minimalni security događaj
```

| Polje/capability | Ko ga kontroliše | Gde se proverava i koristi | Šalje se modelu? | Čuva se gde/koliko dugo? | Potrebno i razlog |
|---|---|---|---|---|---|
| | | | | | |

Uključite stvarne izvore kao što su cilj korisnika, ime, ID resursa/partije, game state, lokalni skor, istorija/replay, URL parametri, `localStorage`, model output, tool argumenti/rezultati, greške i logovi. Razlikujte resource ID od session/bearer tokena.

## 3. Model pretnji i prioriteti

Navedite najmanje **šest konkretnih rizika** i izaberite **tri prioriteta**. Vežite scenario za stvarni izvor i granicu; ne dodajte generičku listu napada.

| ID | Scenario i preduslov | Pogođeni korisnik/resurs | Verovatnoća × uticaj i obrazloženje | Postojeća kontrola | Planirani dokaz | Prioritet |
|---|---|---|---|---|---|---|
| R1 | | | | | | |
| R2 | | | | | | |
| R3 | | | | | | |
| R4 | | | | | | |
| R5 | | | | | | |
| R6 | | | | | | |

Zašto su prva tri prioritetna? Koje rizike ste odbacili i zašto? Prompt injection je relevantan samo ako nepouzdan tekst zaista stiže do modela.

## 4. SpecKit/SDD invarijante i granice

Povežite svaku invarijantu sa specifikacijom, enforcement lokacijom i testom. Prilagodite reči projektu, ali ne izostavljajte obavezno pravilo.

| ID | Pravilo | Spec/acceptance kriterijum | Mesto enforcement-a | Test |
|---|---|---|---|---|
| I1 | Nevalidan/neovlašćen početni HTTP zahtev ne pokreće provider ni poslovni alat. | | | |
| I2 | Browser/model ne biraju identitet, ovlašćenje, provider konfiguraciju ni limite. | | | |
| I3 | Samo allowlist alat, sa validnim argumentima i dozvoljenim opsegom podataka, može da se izvrši. | | | |
| I4 | Read-only agentski tok ne menja kanonsko stanje igre. | | | |
| I5 | Nepouzdan sadržaj se ne prikazuje kao izvršiv browser sadržaj. | | | |
| I6 | Pozivi, trajanje, veličina podataka i istovremena izvršavanja imaju serverske granice. | | | |
| I7 | Tajne i privatni podaci ostaju u dozvoljenom opsegu; logovi sadrže samo potrebne podatke. | | | |
| I8 | Normalan W05 tok uspeva posle hardening-a. | | | |

| Resurs | Izabrana serverska granica | Zašto odgovara projektu | Gde se enforce-uje | Test |
|---|---:|---|---|---|
| HTTP body / tekst | | | | |
| Tool rezultat / model odgovor | | | | |
| Model koraci / svi provider pokušaji | | | | |
| Tool izvršavanja | | | | |
| Poziv timeout / ukupni deadline | | | | |
| Simulacija kandidati/iteracije | | | | |
| Paralelna izvršavanja | | | | |
| Učestalost zahteva | | | | |

Ne predstavljajte primer vrednosti iz zadatka kao industrijski standard. Zabeležite stvarnu izabranu granicu i ograničenje jednog lokalnog serverskog procesa.

## 5. Rezultati scenarija T00–T17

Za svaki red upišite fixture/stvarni ulaz, očekivanje pre testa, komandu/test, stvarni rezultat, provider pokušaje, tool izvršavanja, promenu stanja i uski zaključak. Oznake: `PASS`, `FAIL`, `NOT RUN` ili obrazloženi `N/A` samo za uslovnu granu.

| ID | Fixture/ulaz i očekivanje | Test/komanda | Opaženi rezultat i brojači/stanje | Status i zaključak/ograničenje |
|---|---|---|---|---|
| T00 Normalan W05 tok + igranje | | | | |
| T01 Direktan HTTP: JSON/tip/domensko pravilo | | | | |
| T02 Veliko telo i privilege polja (`role`, `ownerId`, `maxSteps`, provider) | | | | |
| T03 Tuđ/nepoznat resurs ili stvarna javna/local-only granica | | | | |
| T04 XSS marker kroz finalni odgovor i postojeći tekst | | | | |
| T05 HTML/Markdown/link politika | | | | |
| T06 Nevalidan/prevelik provider izlaz | | | | |
| T07 Nepoznat alat/nasleđeno ime (`constructor`, `toString`) | | | | |
| T08 Dozvoljen alat sa nevalidnim argumentom/opsegom + pozitivan slučaj | | | | |
| T09 Prompt injection + namerno nedozvoljen fake predlog | | | | |
| T10 Nevalidan/prevelik tool rezultat/dodatno polje sa sintetičkom tajnom | | | | |
| T11 Ponovljen poziv i ukupni budžet, odvojeno dokazani | | | | |
| T12 Poziv timeout, ukupan deadline i zakašnjeli odgovor, odvojeno | | | | |
| T13 Paralelni zahtevi i rate limit, pa uspešan legitimni zahtev | | | | |
| T14 Sentinel u grešci/tool polju; zabranjen lažni log zapis | | | | |
| T15 Izmenjen browser/localStorage skor ili stanje | | | | |
| T16 Production build, stvarna zaglavlja/CSP, sentinel i browser smoke | | | | |
| T17 Novi rizik ili lanac preko najmanje dve granice | | | | |

Automatizujte T00–T15 i T17. T04/T05 zahtevaju stvarni browser. T16 može uključiti ručne korake sa zabeleženim stvarnim izlazom. Za svaku glavnu kontrolu navedite i pozitivan slučaj; tok koji odbija sve zahteve ne prolazi.

### CSRF — samo ako se credential automatski šalje

- Koji cookie/credential browser automatski šalje?
- Ako postoji: cross-origin test, ulaz, očekivani server ishod, stvarni rezultat i zaštita:
- Ako ne postoji: obrazloženje neprimenljivosti i provera stvarne boundary:

### Dependency audit

- Komanda i stvarni rezultat:
- Relevantni runtime/dev nalazi: paket, verzija, advisory, uslov izloženosti:
- Odluka: popravljeno / ublaženo / dokazano neprimenljivo / otvoren rizik:
- Ako audit nije mogao da se izvrši, prepreka i preostala neizvesnost:

## 6. Poređenje pre/posle

Odaberite najmanje tri scenarija. Koristite iste fixture-e/ulaze pre i posle; postojeću dobru kontrolu nemojte uklanjati radi demonstracije.

| Scenario | Početni commit, input i rezultat | Promena/diff | Završni commit, isti input i rezultat | Šta poređenje dokazuje, a šta ne |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

## 7. Arhitektura, tajne i security događaji

- Izabrana granica i zašto je najmanja smislena promena:
- Kod/SpecKit lokacija gde se sprovodi politika:
- Kako je produkcioni provider adapter odvojen od fake-a:
- Kako se proverava da read-only tok ne menja stanje:
- Sintetički sentinel korišćen u proveri:
- Klijentski bundle/source map, HTTP odgovor i model context rezultat:
- Dependency nalaz i odluka:

Priložite redigovan primer dozvoljenog i odbijenog security događaja. Ne stavljajte session/bearer identifikator, prompt, game stats, secret, raw provider output, chain-of-thought ili stack trace.

```json
{"event":"ai.authorization","timestamp":"2026-10-23T10:30:00.000Z","outcome":"denied","reasonCode":"RESOURCE_NOT_AVAILABLE","correlationId":"synthetic-001"}
```

- Ko može da čita log, koliko dugo se zadržava i kako se resetuje/uklanja?
- Kako ste testirali da sirovi sadržaj ne stvara lažni security događaj?

## 8. Ponovljivost i isporuka

| Provera | Tačna komanda/korak | Stvarni izlaz i checkpoint | Ograničenje |
|---|---|---|---|
| Typecheck | | | |
| Unit/integration security suite | | | |
| Production build | | | |
| Browser smoke i T04/T05/T16 | | | |
| Sentinel provera artefakata | | | |
| Dependency audit | | | |

Dokumentujte jednu komandu za fake-first security suite i potrebne reset korake. Ako koristite rezervni projekat, označite ga kao izolovan demo, a ne kao izmenu timskog repozitorijuma.

## 9. Zaključci i preostali rizik

- Šta je dokazano na konkretnom checkpoint-u:
- Šta je samo pregledano u kodu, a nije izvršeno:
- Šta nije provereno i zašto:
- Šta važi samo za lokalni/fake režim:
- Koji rizik ostaje i koji je sledeći konkretan test:

## 10. Doprinos para i AI odgovornost

| Član | Konkretna promena/provera | Test koji lično može da objasni | Ograničenje koje razume |
|---|---|---|---|
| | | | |
| | | | |

- Korišćeni AI alati/modeli:
- Šta je AI predložio:
- Kako ste proverili prihvaćene izmene i koje ste odbacili:
- Jedan test koji je svaki član samostalno osmislio:

## 11. Dodatni izazov (opciono, najviše jedan)

- Izabrana opcija:
- Novi dokaz:
- Zašto obavezni deo već prolazi:

---

**Pripremio:** Marko Pavkovic
