# Demonstracija Decision Coach-a: 8 minuta

Status 2026-10-30: **PRIPREMLJENO, proba i nastup NOT RUN**. Raspored je tačno
480 sekundi. Individualna odbrana dolazi posle osam minuta i nije uračunata.
Učesnike A/B zameniti stvarnim imenima tek kada članovi potvrde uloge/doprinos.
Ovo nije zapis da su članovi već izveli ove radnje.

## Priprema pre pokretanja sata

Koristiti lokalni sintetički demo, bez pravog provider ključa i stvarnih igrača.
Pripremiti terminal u korenu repozitorijuma, Chrome i otvorene
[mapu pokrivenosti](requirements-review.md), [pre/posle evidence](implementation-evidence.md),
[browser rezultat](browser-results.json) i [security rezultat](security-results.json).
Ne otvarati privatni `.env` ni privatne logove pred publikom.

Pre probe izvršiti sledeće, sačuvati datum, exit status i izlaz u izolovanom
`.local/` direktorijumu; ovo su komande za buduću probu, ne novi rezultati:

```powershell
npm.cmd test
npm.cmd run test:security
npm.cmd run typecheck
npm.cmd run test:ui
npm.cmd run build
npm.cmd run test:security:smoke
npm.cmd audit --json
```

Smoke i browser verifier ažuriraju svoje verzionisane JSON dokaze tek nakon
uspešnih provera; pregledati diff i ne mešati stare i nove datume. `test:ui` je
SSR, a stvarni DOM se proverava u sledećoj laboratoriji.

U posebnom terminalu pokrenuti `npm.cmd run security:browser`, pa u stvarnom
Chrome-u otvoriti `http://127.0.0.1:5179/?security-auto=1`. Verzionisani
[driver](../../server/securityBrowserDriver.js) sam izvodi javne DOM input-e:
coach sa hostilnim HTML/Markdown/link tekstom, praznu pa legalnu porudžbinu 4,
novu partiju sa img/onerror nadimkom, drugi coach i pozitivnu CSP kontrolu.

U drugom terminalu pokrenuti `npm.cmd run test:security:browser`. Verifier traži
svih osam novih faza, stvarne DOM opservacije i odgovarajuće asset hash-eve.
Nedostajući browser/input-i daju FAIL; stari JSON nije zamena. Za ponavljanje
pokrenuti svež fixture. Ova automatizacija je izvršena i prošla, uz 500/54 testova;
[completion-evidence.md](completion-evidence.md) je zapis. Stvarna vremenski
merena proba sa članovima i dalje NOT RUN.

Za interaktivni prikaz tokom nastupa koristiti zaseban svež fixture i početni
URL bez `security-auto` query-ja. Ne mešati dodatne ručne coach pozive sa
fixture-om čiji verifier očekuje tačno dva coach izvršavanja. Ako browser nije
dostupan tokom nastupa, prikazati sačuvani dokaz sa datumom i reći da nije novo
izvršenje. Imena/lični doprinos preskočeni su po zahtevu korisnika.

## Raspored nastupa

| Od–do | Sekundi | Govornik / konkretna radnja i poruka |
|---|---:|---|
| 00:00–01:00 | 60 | A: pokazuje igru i `decision_coach -> getCurrentGameState({})`. Browser šalje nepouzdan snapshot/cilj; server proverava replay, ulaz i budžet; model samo predlaže, igrač ručno naručuje. Izdvaja tri rizika: proširenje ovlašćenja, iscrpljivanje resursa, curenje podataka. |
| 01:00–02:30 | 90 | B: sveža partija u mock browser fixture-u, jedan coach zahtev. Pokazuje preporuku i proverene činjenice, bez promene zalihe/nedelje. Objašnjava dva model koraka, jedan alat i četiri provider HTTP operacije (dva count + dva generate), uz nula live poziva. Zatim ručno šalje porudžbinu i pokazuje uklanjanje prethodnog saveta. |
| 02:30–03:45 | 75 | A: pokreće `npm.cmd run test:security:smoke`, pokazuje odbijen zahtev sa privilegovanim poljem i zatim uspešan zahtev. U JSON-u pokazuje `deniedProviderCalls: 0`, dozvoljeni alat, isto stanje i metadata-only denied/allowed događaje. Ne čita sirovi prompt ili ključ. |
| 03:45–05:00 | 75 | B: pokreće ispod navedeni jedan C02-F0 test. Objašnjava da fake model namerno posluša hostilan cilj i zatraži zabranjen alat; stvarni dispatch ga odbija. Jedan skriptovani model korak, nula izvršenih alata, stanje identično. To je dokaz backend granice, ne live-model injection otpornosti. |
| 05:00–06:30 | 90 | A: pokreće ispod navedeni D01 test i pokazuje dva primljena posla, treći odbijen i očuvan drugi slot nakon oslobađanja prvog. Otvara postojeći quota/race dokaz i objašnjava 10 admission-a po izdatom kontekstu, 6/min, 100/dan i budžet. Jasno navodi da novi anonimni kontekst nije identitet čoveka. |
| 06:30–08:00 | 90 | A+B: prikazuju browser DOM/CSP dokaz iz preflight-a sa datumom i pozitivnom kontrolom. Pokazuju tri pre/posle slučaja: tool dodatno polje, lažni JSON media type, kontrolni znak u cilju. Navode audit rezultat njegovog datuma, završene S15/S16 i neodržanu stvarnu probu/odbranu S18/S19. Završavaju do 08:00; pitanja/individualna odbrana kreću posle toga. |

Kratke izdvojene komande za nastup:

```powershell
node --test --test-name-pattern='C02-F0 hostile intent' server/coachSecurity.test.mjs
node --test --test-name-pattern='D01-before two jobs' server/coachSecurity.test.mjs
```

C02 je interni workflow sa skriptovanim modelom; D01 je ledger/admission test.
Ne nazivati ih oba HTTP/live-model testovima. Ako se koristi snimljen izlaz umesto
novog izvršenja, to izgovoriti i prikazati datum. Pri usporavanju koristiti već
pripremljene dokaze uz tu oznaku; ne izmišljati prolaz. Deo prikaza quota dokaza može se zameniti izvršenim
[T17 rezultatom](t17-results.json), uz novu probu trajanja. Imenovani test se
pokreće komandom `node --test --test-name-pattern="T17 last-slot" server/coachSecurity.test.mjs`.

## Individualno objašnjenje nove varijante, posle nastupa

Svaki član zasebno dobija novu varijantu. Bez dopunjavanja od partnera treba da
objasni: koji je nepouzdan ulaz, koja granica ga proverava, očekivani rezultat i
broj provider/tool operacija, šta se čuva i koji dokaz bi potvrdio ili osporio
zaključak. Ne učiti samo broj testa ili formulaciju prompt-a.

| Nova varijanta za vežbu | Očekivani princip objašnjenja |
|---|---|
| Validan JSON dobije `maxActive: 99`, a cilj ostane bezazlen | Serverski allowlist odbija privilegovano polje pre provider rada; isti zahtev bez polja mora uspeti. |
| Legalna istorija sadrži porudžbinu 51, a coach preporuči 51 | Legalnost istorije i granica coach preporuke su različiti ugovori; istorija se ne odbija samo zbog 51, finalna preporuka mora biti ceo broj 0–50. |
| Dva zahteva se trkaju za deseto mesto i menjaju nadimak | Atomska kvota je na serverskom kontekstu, ne nadimku; samo jedan admission. Ne poistovećivati taj race sa globalna dva aktivna mesta. |
| Model u finalu vrati `[račun](javascript:...)` i ispravnu količinu | Proveriti strogi final/evidence, zatim tekstualni prikaz i stvarni browser DOM/marker; sam SSR ili fraza iz prompt-a nisu dokaz. |
| Provider ignoriše abort pa odgovori nakon deadline-a | Nema kasnijeg uspeha; slot ostaje zauzet do stvarnog settlement-a. Lokalni abort nije garancija prekida udaljene naplate. |
| Alat doda nepoznato polje sa sintetičkom tajnom uz validan inventory | Validacija pre drugog model koraka; sirovi odbijeni rezultat ne sme u log. Tačna očekivanja razlikovati od opšte redakcije. |
| Klijent vrati staru kanonsku nedelju uz postojeći kontekst | Provera prihvaćenog prefiksa/rewind; novi kontekst nije autentifikacija. Razlikovati konzistentnost od porekla i lokalnog anti-cheat-a. |
| Sutra se uvede automatski auth cookie | CSRF više nije N/A: dopuniti model pretnji i testirati cross-site zahtev sa automatskim credential-om, pre isporuke. |

Ovo je banka za pripremu, ne zapis stvarnih studentskih odgovora i ne predviđanje
ispitnog pitanja. Konkretna varijanta na odbrani treba da bude nova za tog člana.

## Zapis probe i odbrane — popuniti tek posle događaja

- [x] Napisan raspored: 60 + 90 + 75 + 75 + 90 + 90 = 480 sekundi.
- [x] Pripremljeni konkretni prikazi, komande, oracle i banka novih varijanti.
- [ ] Stvarni članovi potvrdili imena, uloge i svoj doprinos.
- [ ] Proba održana: datum, početak/kraj, izmereno trajanje, odstupanja i popravke.
- [ ] Za svakog člana zabeležena nova varijanta, njegovo objašnjenje i utvrđene rupe.
- [x] Tehnički završni dokazi ažurirani po uspešnom S15/S16 i novim proverama.

Predložak zapisa: `datum | član | nova varijanta | objašnjena granica/oracle |
opažen rezultat ili samo usmeni odgovor | praznine | putanja dokaza`. Ne upisivati
lični odgovor, rad ili refleksiju u ime stvarnog člana.
