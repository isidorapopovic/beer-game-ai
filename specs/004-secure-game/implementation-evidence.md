# W08: šta je postojalo, šta je dodato i šta je stvarno provereno

Aktuelna isporuka: implementacija `8e7d165` je spojena i pushovana na GitHub
main; remote SHA je potvrđen. [Potvrda isporuke](delivery.md). Raniji zapisi
necommitovanog rada su istorija odgovarajućih sesija.

## Najnovije izvršenje 2026-10-30

**500/500 testova, 54/54 security testa, typecheck/build/UI/logging/sentinel i
stvarni automatizovani Chrome DOM/CSP prolaze; novi audit ima 0 nalaza.**
S15/S16 su zatvoreni; [completion-evidence.md](completion-evidence.md) beleži
komande, rezultate, negativnu proveru i ograničenja. Novi [T17](t17-results.json)
i [browser driver dokaz](browser-results.json) zamenjuju raniji delimični status.
Lični doprinos preskočen je po zahtevu korisnika; stvarna proba/odbrana NOT RUN.
Ostatak dokumenta čuva ranije faze i njihove tadašnje statuse.


Polazna politika: 2026-10-29. Base `d87bc24`, radna grana
`feature/004-secure-decision-coach`. Tačni UTC timestamp-i run-ova su u priloženim
JSON artefaktima; vremenska zona korisnika je Europe/Budapest.

**Tehničke lokalne provere prolaze: 499 testova / 0 fail / 0 skipped, od toga 53
W08 security testa, typecheck, rendered UI, production build, mock logging/export,
security/sentinel smoke, stvarni Chrome DOM/CSP/stale-advice i audit bez nalaza.**

Izabran je samo `decision_coach` / `getCurrentGameState({})`. Druga tri postojeća
toka prolaze regresije. Nema novih naloga, baze, write alata, ekonomskih/game-engine
izmena, live AI poziva ili deployment-a. Rad je necommitovan/nepushovan; main je
neizmenjen. Doprinos članova para i individualna odbrana nisu izmišljeni.

## 1. Redosled i početno stanje

Prvo su zapisani Z01-Z11, konkretni limiti, arhitektura/inventar podataka i devet
rizika sa tri prioriteta. [policy-before.md](policy-before.md) čuva izvorni tekst,
a njegov SHA-256 je u [verification.json](verification.json). Zatim je pre novih
testova/runtime promena zapisan [nezavisni oracle](security-matrix.md): očekivanja
prema zabranjenim efektima, legitimnoj upotrebi i stvarnim granicama. Testovi ne
uvoze produkcione cap-ove da bi proizveli sopstveno očekivanje.

Ponovljeni W08 baseline: 446 pass / 0 fail, typecheck/rendered UI/build PASS,
Vite 7.3.6. Privatni `.env`, stvarni igrači i produkcioni ledger nisu korišćeni.

Već su postojali kanonski replay, HTTP/text/token/call cap-ovi, allowlist/own-property
dispatch, read-only coach projekcija i proverene činjenice, 0-50 preporuka,
globalni minute/day/cost ledger, deadline, no retry/fallback, tekstualni React
prikaz, source clear starog saveta i opcioni detaljni log. Ponovo su korišćeni i
provereni; nisu uklanjani radi demonstracije popravke.

## 2. Dodate/pooštrene kontrole

| Promena | Mesto i ponašanje |
|---|---|
| Transport i cilj | [index.mjs](../../server/index.mjs), [aiLimits.ts](../../src/agent/aiLimits.ts): tačan JSON media type/UTF-8, NUL/DEL/C0/bidi zabrana; normalan Unicode, emoji, LF/TAB i `a < b` rade |
| Tačni rezultati | [decisionCoach.ts](../../src/agent/decisionCoach.ts): dodatni final/evidence ključevi se odbijaju; ranije su izostavljani |
| Tool granica | [boundedAgent.ts](../../src/agent/boundedAgent.ts): bajtovi, additionalProperties, dubina, nizovi i finite brojevi pre drugog modela; odbijen sirovi rezultat ne ide u log |
| Dva posla | [aiUsageLedger.mjs](../../server/aiUsageLedger.mjs), [aiPolicy.mjs](../../server/aiPolicy.mjs): ticket-ID skup po zajedničkoj ledger putanji, treći 429, bez reda čekanja |
| Game scope | [coachContexts.mjs](../../server/coachContexts.mjs): server-issued token, 10 admission-a, config/demand/prefiks istorije, expiry/capacity/issuance granice |
| UI/client | [agentClient.ts](../../src/agent/agentClient.ts), [App.tsx](../../src/App.tsx): izdavanje tokena bez AI poziva, isti token kroz nedelje; nema automatskog obnavljanja pri grešci/kvoti |
| Rokovi i cleanup | [gemini.mjs](../../server/gemini.mjs): 8 s per provider HTTP poziv unutar 20 s run roka; necooperativni posao drži slot do stvarnog završetka, kasni rezultat nije uspeh |
| Minimalni security log | [securityLog.mjs](../../server/securityLog.mjs): allowlist metadata, bez sirovog cilja/stanja/identiteta/tajni; odvojen opt-in i bounded storage |
| Production HTTP | [secureApp.mjs](../../server/secureApp.mjs): lokalni build/API, aktivan CSP, nosniff/no-referrer i bezbedne file putanje |
| Dependency patch | Vite 7.3.6 -> 7.3.7, ciljano, bez `--force` ili nove direktne zavisnosti |

Poseban nalaz: `maxToolResultBytes: 50_000` ranije je bio deklarisan, ali nije bio
sproveden u validatoru. Ranija dokumentaciona pretpostavka je ovde ispravljena.
Sada su provereni stvarni 49.999/50.000/50.001 bajtovi, bez skraćivanja sadržaja.

Game engine/config su upoređeni sa base commit-om: bez izmena. Hash-evi su u JSON
verifikaciji. Stvarne porudžbine 2.5/51 i dalje rade; AI preporuka ostaje integer 0-50.

## 3. Isti slučajevi pre/posle

Prvih osam novih regresija: 0 pass / 8 fail pre implementacije, zatim 8 pass / 0 fail.
Isti fixture-i i očekivanja nisu menjani da bi se sakrio defekt.

| Slučaj | Pre | Posle |
|---|---|---|
| B02: cilj sa NUL/bidi | Prihvaćen | Odbijen pre modela; normalan tekst radi |
| C05: validan final + extra secret/execute | Normalizer izostavlja extra | Final odbijen bez uspešnog prikaza |
| C04: tool extra secret/nested količina | Dostiže drugi model | invalid_tool_result, drugi model 0, raw rezultat nije u logu |
| D01: dva aktivna admission-a | Drugi odbijen | Dva aktivna, treći odbijen, oslobađanje jednog ne briše drugi |
| D03: odložen pojedinačni poziv | Uspeva unutar run roka | provider_timeout bez generacije/retry-a |
| B01: application/json-evil | Dostiže provider | 415, provider/tool 0 |
| D02: game context ruta | 404 | 201, server token i kvota, provider 0 |
| E01: minimalni observer | Nema događaja | request.denied metadata, bez sirovog cilja/lažnog log reda |

Promena 1 -> 2 sama nije bezbednosni dokaz. Dokazi su tačan aktivni maksimum,
atomski poslednji slot, A/B izolacija, cleanup i očuvanje globalnih kvota.

## 4. Pokrivenost W08 i izvršene komande

| W08 | Dokaz |
|---|---|
| T00 / I4/I8 | Fresh/decimal/51/backlog/week9/week10 legitimni HTTP tokovi; dva modela, jedan alat, identično stanje; druga tri workflow-a u regresijama |
| T01/T02 / I1/I2 | Tip/null/missing/privilege/media/UTF-8, tačne Unicode/byte granice, svaki privilegovani ključ posebno i pozitivne granice |
| T03/T15 | Tamper i promena poznatog prefiksa odbijeni; kanonska druga istorija nije proglašena dokazom vlasništva |
| T04/T05 / I5 | Stvarni Chrome: img/onerror i Markdown javascript kao tekst u finalu; marker u nadimku; nema opasnog DOM-a/izvršenja, srpski tekst vidljiv |
| T06-T10 / I3/I7 | Nepoznati/prototype/drugi alati, nevalidni argumenti, preveliki/nested/nonfinite tool i lažni/extra final; production kontrola stvarno učestvuje |
| T09 | Deset formata cilja sa namerno poslušnim fake modelom; nula zabranjenih alata; postojeća mešovita matrica zadržana uz novo rano NUL/bidi odbijanje |
| T11 / I6 | Reused token/call/repeated-action/global quota/restart/cost testovi i nova 10-context quota, race, promena label/session bez resetovanja brojača |
| T12 | Odvojen per-call i run timeout, kasni odgovor, cancel/reissue i necooperativni fetch koji drži slot; bez late success-a |
| T13 | Dva stvarna aktivna HTTP posla, treći odbijen, kasniji legitiman uspeva; A/B promptovi/stanja izolovani; odvojene rate/game probe |
| T14 | Sintetički ključ stvarno opažen u mock auth header-u; odsutan iz response/model/bundle/security loga; lažni log red nije događaj |
| T16 | Aktivni produkcioni header-i, Chrome securitypolicyviolation, pozitivna kontrola bez CSP, finalni JS/CSS identični testiranim |
| T17 | Status pre dopune: DELIMIČNO: zasebne A/B, label/session, quota-race i forbidden-tool probe postoje; jedan imenovan kombinovani HTTP scenario nije implementiran. Ranije nazivanje zbira „lancem” bilo je preširoko; otvoren S16. |

| Komanda/faza | Stvarni rezultat |
|---|---|
| npm.cmd test - baseline | 446 pass, 0 fail |
| typecheck / test:ui / build - baseline | PASS, Vite 7.3.6 |
| node --test server/coachSecurity.test.mjs - pre/posle | 8 fail -> 8 pass |
| npm.cmd test - integracija/proširenje | 454, zatim 491 pass |
| npm.cmd audit --json - početni | Exit 1: jedan ranjiv paket Vite, pet advisory stavki, agregat high |
| npm.cmd view vite@7.3 version --json | Potvrđena dostupna patch verzija 7.3.7 |
| npm.cmd install --save-dev vite@^7.3.7 | Exit 0, ciljana ispravka bez force. Npm esbuild install-script upozorenje nije zaobilaženo; build uspeva |
| npm.cmd audit --json - završni | Exit 0, 0 prijavljenih ranjivosti |
| npm.cmd test - posle dependency patch-a | 491 pass |
| test:security - prvi byte fixture | 51 pass / 1 fail: generički fixture final nije imao summary/evidence; popravljen fixture, ne production validacija |
| npm.cmd test - završno | 498 pass, zatim 499 pass posle dodate nevalidne UTF-8 provere |
| npm.cmd run test:security - završno | 53 pass, 0 fail/skipped |
| npm.cmd run typecheck / test:ui | PASS; SSR nije korišćen kao browser dokaz |
| npm.cmd run build | PASS, Vite 7.3.7, 40 modula, JS 246.92 kB / gzip 76.36 kB |
| npm.cmd run test:logging | PASS, četiri workflow-a, 76 događaja, 0 warnings, nepromenjena stanja |
| npm.cmd run test:security:smoke | PASS, osam metadata događaja; denied provider 0, success provider 4/tool 1, učitan sentinel ne curi |
| npm.cmd run security:browser:verify | PASS, stvarni Chrome, 12 opservacija, CSP+/CSP-, XSS/DOM/stale advice, identični završni assets |
| git diff --check / game/config poređenje | PASS / game mehanika bez izmena |

Browser host discovery nije radio, ali native Chrome pristup jeste. Prvi browser
run je pao zbog novog mock routinga finalnog koraka: provider evidence 3 pokušaja,
fake je zabeležio 2 pre greške. Ispravljen je fixture, startovan svež izolovan run
i ponovljena provera. Nije prikazano kao prolaz. Tokom dokumentacije ispravljena
je i neuspešna Unicode pretraga u pomoćnoj skripti, bez runtime promena.

Privatni stdout ostaje u `.local/spec004/`. Sve fixture putanje su nove i ignored.
Verzionisani JSON summary-i sadrže samo sintetičke rezultate/metapodatke, bez
pravog ključa, realnih igrača ili screenshots sa browser profilom.

## 5. Stvarni browser rezultat i raniji spec 003 T017

[browser-results.json](browser-results.json) beleži klik na coach, doslovno vidljiv
img/onerror/Markdown tekst, normalan srpski tekst, unsafeCoachDOM=0 i false XSS marker.
Prazna porudžbina zadržava nedelju 1/savet/usage; porudžbina 4 prelazi u nedelju 2
i uklanja stari savet/usage/recommendation kontrolu, bez brisanja activity loga.
Reload i drugi coach sa sintetičkim XSS nadimkom takođe daju unsafePageDOM=0/false
marker. Dve konsultacije daju osam provider HTTP zahteva i 38 activity događaja.

Chrome blokira inline probu: effectiveDirective=script-src-elem, blockedURI=inline.
Ista proba u izolovanoj control.html bez CSP-a izvršava se. Zato rezultat nije
404, pogrešna putanja ili neizvršen skript. Policy nije bypass-ovan u aplikacionom
testu. Probe/control ruta postoje samo u browser fixture-u, ne u production serveru.

JS/CSS finalnog Vite 7.3.7 build-a su bajtno identični browser-tested kopiji;
verifier čuva SHA-256. Ovaj run naknadno zatvara tehnički browser deo spec 003 T017;
njegov raniji NOT RUN ostaje istorijski tačan. Spec 001 live acceptance ostaje otvoren.

## 6. Ponovljivost i čuvanje podataka

Bez pravog ključa pokrenuti npm.cmd test, npm.cmd run test:security, typecheck,
test:ui, build, test:logging, test:security:smoke i npm.cmd audit --json.
Tačna imena testova i komande su u [verification.json](verification.json).

Za browser posle build-a: `npm.cmd run security:browser`. Otvoriti localhost:5179
u svežem tabu, kliknuti coach, poslati praznu pa legalnu porudžbinu 4. Reload,
uneti kratak sintetički img/onerror nadimak, kliknuti coach, otvoriti /control.html.
Zatim `npm.cmd run security:browser:verify`. Verifier proverava stvarni DOM/CSP i
hash-eve; ulazne interakcije ovde su automatizovane native computer-use alatom.
Runbook omogućava ručno ponavljanje bez novog browser dependency-ja. Svež fixture
resetuje test, ne realni ledger. Običan production prikaz: build pa npm.cmd run serve;
dev/preview HMR nije production CSP dokaz.

Dopuna pregleda 2026-10-30: pokretač native computer-use input-a nije sačuvan kao
samostalan verzionisan skript. Observer/verifier i stvarni browser prolaz postoje,
ali jedan npm poziv još ne izvodi ceo test. S15 prati ovu razliku: T04/T05 imaju
stvarni DOM dokaz, uz delimičnu ponovljivost ulazne automatizacije.

Minimalni logger: server-side AI_SECURITY_LOG_ENABLED=true i opciono privatni
AI_SECURITY_LOG_PATH; default .local/security-events.jsonl. Testovi koriste samo
izolovane putanje. Dozvoljena polja su event/timestamp/correlationId/workflow/
outcome/reasonCode/elapsedMs/providerAttempts/executedToolCalls. Stvarni allowed i
denied primeri su u [security-results.json](security-results.json). Nema cilja,
nadimka, session/context tokena, stanja, raw odgovora ili stack trace-a.

Najviše 1.024 bajta po liniji i 1.000.000 ukupno; zatim nema novih upisa niti
automatskog brisanja/rotacije. Lokalni operator može čitati/menjati fajl; POSIX
mode opcija nije garancija Windows ACL-a/enkripcije. Isključen/nepotpun log ne
potvrđuje kompletnu aktivnost. Detaljni spec 002 transkript je zasebna opt-in funkcija.

## 7. Granice, prihvatanje i doprinos

Kvota je deset po izdatom anonimnom kontekstu: 2 h TTL, 128 živih zapisa, izdavanje
6/minut. Novi token/restart stvaraju novi scope, nisu dokaz vlasništva ili kvota
po čoveku. Globalni trajni ledger ostaje zaštita. Nema server-authoritative game,
anti-cheat-a ili sačuvane tuđe partije koju coach može čitati. Canonical replay
potvrđuje konzistentnost, ne poreklo.

CORS nije autentikacija. Nema automatski slatog auth cookie/bearer credential-a;
CSRF za privatnu cookie sesiju je N/A. Nepoznat origin je odbijen, simple non-JSON
zahtev ne pokreće AI; lokalni direktni klijent ostaje pod globalnim kvotama.

[dependency-audit.json](dependency-audit.json) sadrži pre/posle verzije, advisory
URL-ove i nalaze dev-server/editor putanje na Windows-u. Patch uklanja prijavljene
nalaze u ovom auditu; nula nalaza nije dokaz bezbednosti poslovne logike.

Lokalni abort ne dokazuje prestanak udaljene obrade/naplate. Neprekinuti posao drži
slot i ne postaje late success; dostupnost može ostati ograničena do završetka ili
restarta. Enforcement je jedan lokalni proces/zajednička ledger putanja, bez
distribuiranog zaključavanja ili autentifikovane multiplayer izolacije.

S01-S13 su tehnički završeni. S14 ima završenu tehničku evidenciju; stvarni članovi
para treba da dopune svoj doprinos, samostalne testove i odbranu. AI je korišćen
za dokumentaciju/implementaciju/probe, a izmene su proverene navedenim run-ovima.
Njihov lični rad/refleksija nisu izmišljeni.

Ne tvrdi se live-model injection otpornost, semantička tačnost celog saveta,
autentifikacija, neizmenjiva istorija, real-player prihvatanje ili javni deployment.
Savet može posredno uticati na odluku igrača; agent ne podnosi porudžbinu i ne
menja direktno pravila/stanje/rezultat. Funkcionalnosti van domaćeg nisu dodate.


Computer-use was stopped by the user with physical Escape during a final optional control-page observation. No further Computer Use input was issued. The successful browser verifier output and JSON artifact had already been saved before the interruption. Documentation checks and test-process cleanup were completed without browser control.

## 9. Pregled potpunosti nastavnih zahteva, 2026-10-30

Na zahtev korisnika pregledani su spec/plan/tasks, izvršivi security/ledger/
workflow/engine testovi, browser fixture/observer/verifier, HTTP/client transport
i sačuvani JSON dokazi. Nova [mapa T00–T17](requirements-review.md) sadrži svih 18
redova, konkretne testove, status i granice tvrdnji.

**Šta je ispravljeno:** T17 je ranije preširoko opisan kao jedan lanac, iako su
izvršene odvojene concurrency/quota/tool probe. Sada je DELIMIČNO, sa novim
preciznim oracle-om u spec-u i otvorenim S16. Stvarni browser prolaz T04/T05 nije
povučen: opažanja postoje, a input-i su izvršeni native automatizacijom. Međutim,
njen samostalan verzionisan pokretač nedostaje; to prati otvoreni S15. Raniji
tehnički brojevi 499/53 ne znače da su svi uslovi predaje zatvoreni.

**Šta je dodato:** [scenario osam minuta](demo-8-minuta.md), preflight i komande,
raspored od 480 s, banka osam novih varijanti za individualno objašnjenje i
nepopunjena evidencija stvarne probe/odbrane. S17 je završen kao priprema
dokumenta; S18/S19 ostaju otvoreni do stvarnog izvođenja. Spec, plan, tasks,
indeksi i EVIDENCE_W08 su usklađeni. Izvorni nastavni materijali i policy-before
nisu menjani. Nisu izmišljeni članovi, doprinosi ili lični odgovori.

U ovoj sesiji nije bilo izmena runtime/test koda, novih zavisnosti, runtime
testiranja, browser kontrole ni live API poziva. Prethodni PASS/audit/browser
artefakti zadržavaju svoje datume; nisu predstavljeni kao novo izvršenje.
`requirementsReview` u [verification.json](verification.json) zasebno beleži
dokumentacionu proveru, statuse, proveru lokalnih linkova, svih T00–T17 redova,
trajanja scenarija, JSON formata, whitespace-a i neizmenjenosti 49 izvornih/
package fajlova prema SHA-256 snimku napravljenom na početku ovog pregleda.
Ove dokumentacione provere nisu security testovi. Commit/merge/push nisu rađeni.
