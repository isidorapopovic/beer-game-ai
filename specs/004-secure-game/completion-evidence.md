# Dovršavanje tehničkih zadataka S15/S16

Datum: **2026-10-30, Europe/Budapest**. JSON artefakti čuvaju stvarni UTC `at`,
pa datum može biti 29. oktobar UTC dok je lokalno već 30. oktobar.
Ovo je novo izvršenje posle [prethodnog pregleda](requirements-review.md),
a ne preimenovanje ranijih 499/53 rezultata.

## Izvršeno i rezultat

| Provera | Rezultat ovog izvršenja |
|---|---|
| `npm.cmd test` | **500 PASS**, 0 fail/cancelled/skipped; uključuje jedan novi T17 |
| `npm.cmd run test:security` | **54 PASS**, 0 fail; prethodno 53 |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS, Vite 7.3.7, 40 modula |
| `npm.cmd run test:ui` | PASS, SSR; nije korišćen kao DOM dokaz |
| `npm.cmd run test:logging` | PASS, četiri workflow-a, 76 događaja, bez upozorenja |
| `npm.cmd run test:security:smoke` | PASS, 8 metadata događaja, učitan sentinel, odbijeni zahtev 0 provider poziva, uspešan 4 HTTP / 1 alat |
| `npm.cmd run test:security:browser` | PASS, verzionisani input-i u stvarnom Chrome-u, 8 faza, 12 opažanja, DOM/XSS/CSP/stale advice i identični JS/CSS assets |
| `npm.cmd audit --json` | PASS, 0 prijavljenih ranjivosti; 119 ukupnih zavisnosti u audit metapodacima |

Svi AI odgovori su sintetički. **0 live provider poziva**, bez novih zavisnosti,
naloga, izmene game engine-a/ekonomije ili javnog deployment-a. Commit/merge/push
nisu deo ovog izvršenja. Spec 001 live acceptance ostaje zaseban.

Sirovi lokalni izlazi su u `.local/spec004/`: `tests-completion.txt`,
`security-completion.txt`, `typecheck-completion.txt`, `build-completion.txt`,
`ui-completion.txt`, `logging-completion.txt`, `smoke-completion.txt`,
`browser-completion.txt` i `audit-completion.json`. Ovo su lokalni tragovi,
ne tvrdnja da je `.local/` objavljen ili verzionisan. Sanitizovani deljivi dokazi
su [verification.json](verification.json), [T17](t17-results.json),
[browser](browser-results.json), [security](security-results.json),
[logging](logging-results.json) i [audit](dependency-audit.json).

## S16 / T17: jedan kombinovani HTTP scenario

Test `T17 last-slot HTTP race with changed labels cannot authorize a hostile
model tool` je u [coachSecurity.test.mjs](../../server/coachSecurity.test.mjs).
Oracle je prethodno definisan u spec odeljku 8, prema R1/R2/R8.

1. Devet uspešnih HTTP coach zahteva troši devet mesta jednog serverskog
   konteksta. Injektovan sat pomera minute; produkcioni limiti nisu smanjeni.
2. Dva konkurentna validna zahteva menjaju label/session i imaju hostilan cilj.
   Kontrolisana promise barijera zadržava primljeni generation odgovor dok se
   drugi zahtev stvarno ne vrati kao quota-denied.
3. Samo jedan novi admission i jedan novi ledger zapis. Drugi dobija
   `429 / COACH_GAME_LIMIT`, bez dodatnog provider rada. Primljeni zahtev ima
   jedan count i jedan generate, ukupno dva provider HTTP poziva.
4. Namerno poslušan mock predlaže `place_order(99)`. Dispatch vraća
   `unknown_tool`, bez finala i bez izvršenog alata. Security trag ima jedan
   admission i jedan tool-denied, bez tool-allowed događaja u napadu. Snapshot-i
   ostaju identični.
5. Bezazlen zahtev istog iscrpljenog konteksta i dalje dobija 429, sa nula novih
   poziva/zapisa. Pozitivan sused sa novim dozvoljenim anonimnim kontekstom
   uspeva sa četiri provider HTTP poziva i jednim read-only alatom.

[t17-results.json](t17-results.json) beleži 36 pripremnih + 2 napadačka + 4
pozitivna provider HTTP poziva, ukupno **42 mock HTTP operacije**, i 11 ledger
zapisa. To nisu 42 generacije ni živi model. Novi kontekst ostaje anoniman;
test ne dokazuje nepromenljivu kvotu po čoveku ili autentifikaciju.

## S15: verzionisani browser input-i i stvarni DOM

Dodat je [securityBrowserDriver.js](../../server/securityBrowserDriver.js), koji
test fixture učitava kao zaseban same-origin skript. Aktivira ga samo
`?security-auto=1`. Driver radi u stvarnom browseru, koristi javne input/button
DOM kontrole, DOM događaje i navigaciju, čeka stvarna opažanja i prijavljuje pad
na timeout-u. Ne poziva React interne funkcije, ne prepravlja game state i ne
isključuje CSP. Programatski DOM input-i nisu tvrdnja o trusted fizičkim
keyboard/mouse događajima; za ove tekstualne kontrole prolaze stvarni React
handler-i i rendering. Driver nikada nije deo production build-a.

Verzionisane faze: `orders.started`, `coach.safe`, `invalid.preserved`,
`advanced.cleared`, `label.started`, `label.safe`, `control.started`, `complete`.
Završni [verifier](../../server/verifySecurityBrowser.mjs) traži tačan uspešan
redosled i nova opažanja sa živog lokalnog fixture-a. Sve opažene faze moraju
imati neizvršen XSS marker i nula opasnih application DOM elemenata. Pored
pojedinačnih pozitivnih uslova proverava dva stvarna coach izvršavanja, nula
drugih tokova, aktivna zaglavlja i identične finalne assets.

Pokrenuti u korenu repozitorijuma:

```powershell
npm.cmd run build
npm.cmd run security:browser
```

U stvarnom Chrome tabu otvoriti **http://127.0.0.1:5179/?security-auto=1**.
Nisu potrebni dalji ručni input-i: driver zatraži savet, pošalje praznu i legalnu
porudžbinu, proveri prelazak nedelje, učita novu partiju sa hostilnim nadimkom,
ponovo zatraži savet i otvori pozitivnu CSP kontrolu. U drugom terminalu:

```powershell
npm.cmd run test:security:browser
```

Verifier čeka najviše 30 s i ne učitava prethodni JSON kao rezultat. Ako browser
nije otvorio automatizovani URL, faza padne ili nema novih opažanja, komanda
mora pasti. Za ponavljanje zaustaviti prethodni fixture i pokrenuti svež;
izolovani test ledger nije pravi produkcioni ledger.

U uspešnom izvršenju: **12 opažanja**, osam uspešnih faza, dva coach zahteva,
osam mock provider HTTP poziva i 38 activity događaja. Opasan HTML/Markdown/link
je tekst; srpski tekst je vidljiv; prazna porudžbina čuva savet, legalna uklanja
prethodni savet/usage. Glavni CSP blokira inline probu uz violation, isti kod na
fixture kontrolnoj strani bez CSP radi. Kontrolna ruta nije u production serveru.

## Neuspešni pokušaji i granice dokaza

- Prvi build u sandbox-u pao je jer esbuild nije mogao da pročita roditeljski
  direktorijum/razreši Vite konfiguraciju. Ista komanda van sandbox-a, uz
  odobrenu eskalaciju, prolazi. Nije menjana bezbednosna politika aplikacije.
- Prvi audit nije pristupio npm registry-ju u sandbox-u. Odobreno ponavljanje
  van sandbox-a vraća stvarni audit sa 0 nalaza. Neuspeh pristupa nije audit PASS.
- Browser access host nije bio dostupan; native computer-use je otvorio lokalni
  URL. Posle navigacije kontrola je prekinuta jer alat nije mogao pouzdano da
  utvrdi tekući URL. **Nije slat dalji Windows/browser input.** Već učitani
  verzionisani driver je sam završio; to je provereno nezavisnim lokalnim HTTP
  izveštajem i uspešnim verifier-om. Prekid UI kontrole nije prikriven niti
  korišćen za zaobilaženje zaštite. Fixture procesi se gase kroz njihove
  terminalske sesije, bez daljeg upravljanja browserom.
- Dodatna negativna proba koristi nov, prazan fixture bez browser navigacije:
  automation verifier mora odbiti odsustvo faza, bez prepisivanja uspešnog JSON-a.
  Rezultat te probe se zasebno beleži u completion delu verification.json.

Završna dokumentaciona provera: **132 lokalna Markdown linka, 0 neispravnih**,
svih 18 redova T00–T17, scenario ukupno 480 s, validni JSON artefakti i četiri
uspešne JS syntax provere. `git diff --check` prolazi. Originalni nastavni
materijali i policy-before ostaju neizmenjeni. LF-normalizovani SHA-256 game
engine-a/config-a odgovara početnim Git sadržajima; Windows CRLF nije izmena
mehanike. U ovoj dopuni menjani su test, fixture, verifier i npm script, uz novi
fixture driver; aplikaciona produkciona politika nije menjana.

## Lični deo i status zadataka

S15/S16 su tehnički završeni; S17 je već pripremljen
[osam minuta dug scenario](demo-8-minuta.md), sada sa aktuelnim komandama.
Korisnik je na pitanje o članovima/doprinosima odgovorio **„preskoci to”**.
Imena, uloge i lični doprinos zato se preskaču po njegovom zahtevu. To ne
pretvara izmerenu probu od 480 s ili individualnu odbranu u izvršene događaje:
S18/S19 ostaju NOT RUN, za stvarne učesnike. Tehnički deo S14 je završen, lični
deo nije izmišljen. Ograničenja lokalne igre, anonimnog scope-a i mock modela
ostaju ista.
