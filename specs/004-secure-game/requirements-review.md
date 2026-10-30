# Provera zahteva T00–T17 i pripreme demonstracije

Poslednje izvršenje: **2026-10-30, Europe/Budapest**. Početni dokumentacioni
pregled otkrio je nedostatke S15/S16; oni su sada implementirani i izvršeni.
**500 testova / 54 security testa PASS**, stvarni Chrome sa verzionisanim
browser input-ima, DOM/CSP i build dokazom. Detalji i neuspešni pokušaji su u
[completion-evidence.md](completion-evidence.md). Ranijih 499/53 ostaje istorija.

Tehnički zahtevi T00–T17 imaju dokaze u dokumentovanom lokalnom/mock opsegu.
[Scenario od osam minuta](demo-8-minuta.md) je pripremljen; stvarna proba i
individualna odbrana još nisu održane. Imena/lični doprinos preskočeni su na
izričit zahtev korisnika, bez izmišljanja.

## Mapa na konkretne dokaze

PASS ispod označava izvršeni dokaz u navedenom opsegu; završni suite je ponovljen. Prefiksi označavaju
stvarna imena testova, ne zamišljene nove fajlove T00.test do T17.test.

| Test | Status | Postojeći izvršivi dokaz i praktična granica |
|---|---|---|
| T00 | PASS | `A01/A02-*` u [coachSecurity.test.mjs](../../server/coachSecurity.test.mjs): normalan HTTP coach, legalne porudžbine 2.5/51, backlog, nedelje 9/10, isti snapshot. [Engine testovi](../../src/game/gameEngine.test.mjs) proveravaju igranje do kraja; browser dokaz obuhvata coach i napredovanje jedne nedelje, ne celu desetonedeljnu browser partiju. |
| T01 | PASS | `B01`, `B02`, `B03` u coachSecurity: format/tip/media type/neispravan UTF-8, 1/499/500/501 code point i 19.999/20.000/20.001 bajt, bez provider rada pri ranom odbijanju. |
| T02 | PASS | `B01/Z05-*`: deset privilegovanih polja pojedinačno odbijeno kroz HTTP; uspešan susedni zahtev dokazuje da servis nije samo sve odbio. Model/prompt/limiti nisu klijentske opcije. |
| T03 | PASS u lokalnom modelu | `A03/C01`, `M1-*`, `M5-*` u [workflowBoundaries.test.mjs](../../server/workflowBoundaries.test.mjs): kanonski replay, faza, projekcija bez buduće tražnje i workflow allowlist. Nema naloga/tuđeg server-owned resursa za proveru vlasništva; druga konzistentna istorija nije dokaz porekla. |
| T04 | AUTOMATED BROWSER PASS | [Driver](../../server/securityBrowserDriver.js) koristi javne DOM kontrole u stvarnom Chrome-u; [browser-results.json](browser-results.json) beleži img/onerror final i nadimak, sve faze bez izvršenja markera/opasnog DOM-a, uz normalan vidljiv tekst. Osam faza input automatizacije i 12 opažanja, komanda `npm.cmd run test:security:browser`. |
| T05 | AUTOMATED BROWSER PASS | Isti stvarni browser proverava HTML/Markdown/javascript-link kao tekst; nema opasnog DOM-a/izvršenja, CSP ima pozitivnu kontrolu. Verzionisani driver i verifier, bez SSR/CSP bypass-a. Programatski DOM input-i prolaze stvarne React handler-e; nisu tvrdnja o trusted fizičkim događajima. |
| T06 | PASS | `C05-*` kroz HTTP/model/tool/final i [lowCostAi.test.mjs](../../server/lowCostAi.test.mjs): dodatni ključevi, količina van opsega/razlomak, prazni/lažni dokazi, malformed/refusal/response cap. Validna preporuka prolazi. |
| T07 | PASS | `M1-*`, prototype slučajevi i `C02-F0..F9`: drugi workflow, write/shell/URL/rule-change alat ne dobija ovlašćenje. Broje se izvršeni alati i stanje. |
| T08 | PASS | [boundedAgent.test.mjs](../../src/agent/boundedAgent.test.mjs) i workflow matrica: pogrešni/dodatni argumenti i šeme ne izvršavaju alat; dozvoljeni `{}` prolazi. |
| T09 | PASS za backend granice | `C02-F0..F9` i `M3-*`: mešoviti hostilni tekst, namerno poslušan skriptovani model, zabranjeni efekat ipak odbijen. Ovo nije merenje otpornosti živog modela. C02 je interni workflow test, ne HTTP provider test. |
| T10 | PASS | `C04-*`: dodatna tajna, nested/nonfinite vrednosti, tačnih 49.999/50.000/50.001 bajt; nevalidan rezultat ne stiže drugom model koraku, raw odbijeni rezultat se ne loguje. |
| T11 | PASS | lowCostAi token/call/repeated/global minute/day/budget/restart probe; `D02-*` za deset admission-a po kontekstu, greške troše mesto, promena nadimka ne resetuje kvotu. Novi anonimni kontekst ipak nije identitet čoveka. |
| T12 | PASS sa ubrzanim satom/rokovima | `D03-*`, `D04-*` i streaming/deadline testovi: pojedinačni timeout, odvojen zbirni deadline, cancel i kasna rezolucija, necooperativni provider drži slot. Testovi koriste kraće serverske test rokove (npr. 5 ms; 500 ms i zbirno 1.200 ms), ne tvrde da je svaki test čekao produkcionih 8/20 s. Produkcioni cap-ovi ostaju 8/20 s. |
| T13 | PASS | HTTP concurrency u lowCostAi, `D01-before`, `D02 race`, `D04`, A/B u [activitySummary.test.mjs](../../server/activitySummary.test.mjs): dva aktivna, treći 429 bez dodatnog provider rada, kasniji uspeh, izolacija, rate i quota race. |
| T14 | PASS | `E01-*` i [security-results.json](security-results.json): sintetički ključ stvarno učitan u mock auth header, odsutan iz bundle-a/response/model/security loga; lažni log tekst ne pravi lažni događaj. Detaljni transkript je zasebna opt-in funkcija. |
| T15 | PASS za proverljivu granicu | `M5-*`, `A03/C01`, D02 prefiks/rewind i engine regresije: izmenjeni snapshot/troškovi/istorija ne prolaze replay; coach ne piše stanje. Nema autoritativnog leaderboard-a; vlasnik browsera može menjati svoj lokalni prikaz. Nije izveden poseban browser anti-cheat test i ne tvrdi se zaštita od njega. |
| T16 | PASS, automatizovano + stvarni browser | [secureApp.test.mjs](../../server/secureApp.test.mjs) proverava transport/static/API/header granice; browser služi kopiju stvarnog build-a, CSP violation i isti inline kod izvršen na kontrolnoj strani bez CSP. Verifier potvrđuje identične finalne JS/CSS bajtove, funkcionalan coach/igru i sentinel provere. Kontrolna ruta postoji samo u test fixture-u. |
| T17 | PASS | Jedan imenovan HTTP test u [coachSecurity.test.mjs](../../server/coachSecurity.test.mjs): poslednje mesto kvote + promena label/session + poslušan hostilni model. [t17-results.json](t17-results.json): jedan admission, jedan 429, dva provider HTTP poziva, unknown_tool, nula alata/mutacija; kasniji bezazlen zahtev odbijen, pozitivan novi scope uspeva. |

## Zavisnosti i CSRF

[Dependency audit](dependency-audit.json) čuva početni Vite nalaz i patch,
a `followUp` beleži novi audit 2026-10-30 sa **0 prijavljenih ranjivosti**.
Nula nalaza nije garancija buduće bezbednosti.

Pregled [API-ja](../../server/index.mjs), [production servera](../../server/secureApp.mjs)
i [klijenta](../../src/agent/agentClient.ts): nema auth cookie sesije, izdavanja
`Set-Cookie` niti automatskog slanja aplikacionih pristupnih sredstava.
`coachContext` se eksplicitno šalje u JSON telu; nije automatski browser cookie.
CSRF za automatske auth credential-e je zato **N/A u sadašnjoj arhitekturi**.
Nepoznat Origin se odbija, JSON media type je obavezan, a direktan lokalni klijent
je i dalje ograničen kvotama. CORS nije autentifikacija. Uvođenje cookie/HTTP auth
ili druge automatske autentikacije ponovo otvara obavezne CSRF testove pre isporuke.

## Šta je završeno i šta ostaje

- S15 završen: verzionisan browser driver, stvarni Chrome prolaz i negativna
  proba praznog fixture-a. Verifier odbija nedostajuće faze i ne koristi stari JSON.
- S16 završen: novi kombinovani T17 i ponovljene regresije; osnovne kontrole su
  ponovo korišćene, bez promene produkcione politike ili game engine-a.
- S14 tehnički deo završen; lični doprinos preskočen po zahtevu korisnika.
- S17 završen kao priprema dokumenta; S18/S19 ostaju NOT RUN za stvarnu probu
  i pojedinačna objašnjenja učesnika. Plan 480 s nije izmereno trajanje.

[Zadaci](tasks.md), [novi evidence](completion-evidence.md) i `implementationCompletion`
u [verification.json](verification.json) sadrže aktuelni status. Prvobitni
`requirementsReview` zapis ostaje sačuvan kao prethodni pregled.
