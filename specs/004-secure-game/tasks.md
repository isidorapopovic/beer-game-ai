# Zadaci 004: AI Decision Coach / W08

Datum početne politike: 2026-10-29. Status: **zaštite implementirane i lokalno
proverene; S15/S16 i tehnički acceptance završeni**, posle naknadnog
korisničkog odobrenja kodiranja/testiranja. Pregled 2026-10-30 je ispod.
Lični doprinos preskočen je na zahtev korisnika. S14 je tehnički zatvoren;
stvarna proba i individualna odbrana S18/S19 nisu izmišljene niti izvršene.
Brojevi S01-S14 ispod su naši radni zadaci; nastavni T00-T17 su testovi u
[planu](plan.md), a spec 003 T017 je zasebna, ranije otvorena browser provera.

- [x] S01 Sačuvati početni checkpoint i izvršiti normalan coach/fake tok, typecheck, testove i build za W08 baseline.
- [x] S02 Potvrditi ugovor iz [spec.md](spec.md): predlog 10 zahteva po partiji, 8 s pojedinačni timeout, zadržani globalni limiti i najviše 2 aktivna izvršavanja.
- [x] S03 Definisati minimalan serverski game-context lifecycle za kvotu; bez kvote vezane za proizvoljan klijentski ID i bez tvrdnje o autentifikaciji/provenanci.
- [x] S04 Napisati početne regresije i tri pre/posle fixture-a za stvarno postojeće razlike, sa brojačima i stanjem.
- [x] S05 Dopuniti runtime ugovore za media type, kontrolne znakove/bidi, tool-result allowlist/nizove i tačna final/evidence polja. Zadržati dozvoljen srpski tekst i engine-legal istoriju.
- [x] S06 Implementirati atomsku globalnu concurrency granicu 2, bez reda čekanja, uz cleanup/otkazivanje i izolaciju A/B; globalni limit pokriva sve workflow-e.
- [x] S07 Implementirati predloženu game kvotu po odobrenom lifecycle-u i atomsku rezervaciju pre provider rada; zadržati trajne globalne kvote i budžet.
- [x] S08 Dodati odvojen pojedinačni timeout i dokaz ukupnog deadline-a, kasnih odgovora i odsustva retry/fallback-a.
- [x] S09 Dopuniti adversarial coach testove: zabranjeni alati/promena pravila, lažni system prompt/role/limiti, mešoviti tekstualni formati i nevalidni finali; bez promene igre.
- [x] S10 Predvideti minimalne security događaje, sentinel i log-injection provere; odvojiti opcioni detaljni transkript bez izmene privatnih podešavanja/logova.
- [x] S11 Izvršiti stvarne browser/DOM testove za XSS, normalan tekst i stale advice; završiti odgovarajuću spec 003 browser proveru samo stvarnim opažanjem.
- [x] S12 Poslužiti production build lokalno sa aktivnim bezbednosnim zaglavljima; dokazati CSP blokiranje i funkcionalnost igre/AI toka bez bypass-a.
- [x] S13 Proveriti CORS/CSRF primenljivost, sentinel u artefaktima i dependency audit; dokumentovati nalaze, ne raditi naslepi force upgrade.
- [x] S14 Pokrenuti završne provere i popuniti evidence za I1-I8/T00-T17 i tri pre/posle slučaja. Tehnički deo završen; lični doprinos preskočen na izričit zahtev korisnika. Stvarna proba/odbrana prati se zasebno u S18/S19.

S01-S13 imaju dokaze u [EVIDENCE_W08.md](EVIDENCE_W08.md): 500 testova, 54 security
testa, typecheck/build/rendered UI, stvarni Chrome, audit i security/sentinel smoke.
Ranijih 446 testova ostaje početni W08 baseline, a ne novi rezultat.

S14: tehnička evidencija je ponovljena i popunjena. Lični doprinos korisnik je
izričito preskočio; S18/S19 ostaju za stvarne učesnike. Spec 001 live acceptance
nije zatvoren fake/browser proverenama.

## Dopunski zadaci pregleda i njihovo naknadno izvršenje, 2026-10-30

Mapa T00–T17: [requirements-review.md](requirements-review.md). S11 potvrđuje
stvarno izvršen browser test, bez tvrdnje da postoji verzionisan samostalan
pokretač svih interakcija u prvobitnom pregledu. Naknadno je dodat driver i jedan
kombinovani T17, sa novim izvršenim dokazima. Prethodni prolazi ostaju istorija.

- [x] S15 Verzionisati i izvršiti pokretač T04/T05 u stvarnom browseru: sveža sesija, pozitivan tekst/igra, HTML/Markdown/link i nadimak, DOM/marker, stale advice i CSP kontrola. Verifier mora čitati nova opažanja; sačuvati komandu/skript, datum i rezultat, bez SSR/CSP bypass zamene.
- [x] S16 Dodati imenovan automatizovan T17 prema spec odeljku 8: dva validna HTTP zahteva sa promenjenim label-ima se trkaju za deseto mesto; primljeni mock traži zabranjen alat. Dokazati admission/provider/tool/ledger brojače, isto stanje, kasnije quota odbijanje i uspešan pozitivan sused. Pokrenuti ciljane i potrebne regresije, ažurirati evidence stvarnim rezultatom.
- [x] S17 Pripremiti [scenario od tačno osam minuta](demo-8-minuta.md), preflight, konkretne komande, tri pre/posle slučaja, ograničenja dokaza i banku novih varijanti za individualno objašnjenje.
- [ ] S18 Sa stvarnim članovima potvrditi uloge/doprinos, održati probu i zabeležiti datum, izmereno trajanje, odstupanja i korekcije. Planiranih 480 s nije izmereno trajanje.
- [ ] S19 Posle demonstracije svaki član zasebno objašnjava novu varijantu; zabeležiti stvarnog člana, varijantu, njegov odgovor/granicu/oracle i nedostatke, bez izmišljenih ličnih iskaza.

Prethodni pregled bio je dokumentacioni. Nakon novog odobrenja za izvršenje
S15/S16 su implementirani i prošli: 500/54, browser driver, T17 i regresije.
Dokazi: [completion-evidence.md](completion-evidence.md), [T17](t17-results.json),
[browser](browser-results.json). Imena/doprinos preskočeni po odgovoru korisnika
„preskoci to”; stvarna proba i odbrana nisu time proglašene izvršenim.
