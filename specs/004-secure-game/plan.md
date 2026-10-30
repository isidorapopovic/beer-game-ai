# Plan 004: prvo ugovori i zabrane, zatim implementacija

Status: implementacija odobrena naknadnim korisničkim zahtevom 2026-10-29.
Zabrane Z01-Z11 prethode novim testovima. Početna dokumentaciona faza ostaje
zabeležena u evidence-u; rezultati implementacije se dodaju odvojeno.
Autoritativni projektni ugovor je [spec.md](spec.md); ne prepisivati limite u više
nezavisnih policy tabela. Nastavni zahtevi su u originalnom W08 dokumentu.

## Redosled budućeg rada

1. Sačuvati checkpoint i ponoviti početni uspešan coach tok sa fake provider-om,
   typecheck, testove i build. Stare 446-test rezultate označiti kao spec 003
   istorijski dokaz; ne preimenovati ih u W08 prolaz.
2. Razrešiti identitet/lifecycle brojača za predlog 10 zahteva po partiji.
   Dokumentovati serversko izdavanje/reset/istek konteksta, vezu sa browser
   partijom i posledice restarta. Ne vezivati hard kvotu za klijentski nadimak,
   UUID ili proizvoljan game ID. Ako nema održivog minimalnog rešenja, ostaviti
   per-game zahtev otvoren umesto deklarisati lažnu zaštitu.
3. Prvo napisati proverljive negativne i pozitivne slučajeve za razlike u kodu:
   dodatna polja tool/final rezultata, kontrolne znakove cilja, timeout po pozivu,
   atomic admission dva posla i per-game brojač. Ne slabiti postojeće granice.
4. Proširiti postojeću politiku/ledger bez druge globalne evidencije potrošnje.
   Globalni maksimum 2 mora važiti za sve postojeće workflow-e koji dele servis.
   Dva različita izvršavanja mogu biti aktivna; koraci unutar svakog su
   sekvencijalni. Nema čekajućeg reda ni pozadinskog retry-a. Testirati race na
   drugom aktivnom slotu i poslednjem mestu kvote, otkazivanje i oslobađanje.
5. Reupotrebiti coach formatter/registry i validatore. Uvesti strogu projekciju ili
   odbijanje dodatnih tool polja pre slanja modelu, strogo odbijanje dodatnih
   finalnih/evidence polja i finitu/proverenu strukturu nizova. Ne dodavati
   nove cap-ove stvarnim istorijskim porudžbinama da bi pomoć prihvatila stanje.
6. Serversku politiku učiniti nezavisnom od sadržaja cilja. Modelu namerno vratiti
   nedozvoljen fake predlog; pokazati da nema zabranjenog alata/promene stanja.
   Razlikovati ulaz odbijen pre modela i predlog odbijen posle prvog model koraka.
7. Predvideti minimalne security događaje odvojene od opcionog spec 002 transkripta.
   Dokazati da sintetička tajna i lažni log red ne ulaze u operativni log.
   Ne menjati/brisati postojeće privatne logove ili uključivati snimanje u `.env`.
8. Proveriti stvarnu browser putanju za tekst, DOM, stale advice i normalne kontrole.
   Poslužiti production build lokalno sa aktivnim CSP, `nosniff` i eksplicitnom
   Referrer-Policy. Dev/HMR i SSR nisu zamena. Bez zaobilaženja CSP u test runner-u.
9. Izvršiti sentinel proveru bundle-a/model konteksta/HTTP/loga i audit zavisnosti.
   Obrazložiti CSRF neprimenljivost samo ako automatski slati auth credential-i
   stvarno ne postoje; dokumentovati postojeći origin/local-only model.
10. Pokrenuti potrebne završne provere, popuniti stvarni W08 evidence i doprinos
    članova koji su zaista radili. Commit/merge/push tek u kasnijoj traženoj isporuci.

## Veza sa nastavnim invarijantama

| Invarijanta | Projektna kontrola iz spec-a |
|---|---|
| I1 | HTTP format/veličina/tip/faza i prijem pre provider rada; privilegovana polja Z05 |
| I2 | Serverska konfiguracija, odvojen neproveren session ID i game kontekst; Z05 |
| I3 | Jedini alat, tačni argumenti, dozvoljeni trenutni podaci; Z03/Z04/Z07 |
| I4 | Read-only snapshot, identično stanje i nikakva automatska porudžbina; Z01/Z02 |
| I5 | Tekstualni UI, browser DOM i aktivan produkcioni CSP; Z09 |
| I6 | Atomske kvote, 2 aktivna mesta, token/byte/call/time granice; Z10 |
| I7 | Projekcija podataka, sentinel i minimalni security log; Z11 |
| I8 | Normalan coach tok i igranje ostaju funkcionalni |

## Planirana laboratorija

| Nastavni testovi | Naš slučaj i oracle |
|---|---|
| T00 | Normalna partija + coach: 2 model koraka, 1 alat, provereni final, stanje identično |
| T01/T02 | Tip/null/višak polja, 500/501 code point-a, 20.000/20.001 bajt; nula provider/alata pri odbijanju |
| T03/T15 | Lokalni neautentifikovani model, tamper replay i neprovereno poreklo; bez izmišljenog vlasništva |
| T04/T05 | XSS marker i opasna URL šema kroz stvarni prikaz; nema izvršenja/opasnog DOM-a; srpski tekst ostaje ispravan |
| T06/T07/T08 | Loš/prevelik final, dodatna polja, nepoznat/prototype/drugi alat, nevalidni argumenti |
| T09 | Hostilan cilj + fake `place_order`/rule-change predlog; stvarni dispatch odbija |
| T10/T14 | Dodatno tool polje sa sentinelom, interna greška i lažni log zapis; nema drugog model poziva za nevalidan tool rezultat niti curenja |
| T11 | Treći model/drugi alat; zasebno iscrpljivanje globalnog i game budžeta; bez resetovanja brojača |
| T12 | Zasebno 8 s per-call, 20 s zbirni deadline i kasni odgovor; otkazivanje/cleanup i bez kasnijeg success-a |
| T13 | Dva aktivna, treći 429, zatim novi dozvoljen zahtev; zasebno rate limit i game-quota race |
| T16 | Lokalni production build, stvarna zaglavlja, CSP blokira inače dostupan probni resurs; sentinel ne ulazi u klijenta |
| T17 | Otvoren kombinovani HTTP scenario: race za poslednje mesto konteksta + promena nadimka + nedozvoljen tool predlog; oracle u dopuni ispod |

Pre/posle koristiti najmanje tri ista fixture-a: dodatno tool polje sa sentinelom,
treći paralelni zahtev i kontrolni znak u cilju. Za concurrency promena kapaciteta
1 -> 2 nije sama bezbednosna popravka: poređenje mora proveriti stvarni limit,
izolaciju i očuvanje budžeta. Postojeće dobre granice ne uklanjati radi demonstracije.

Sve probe su lokalne, sintetičke i fake-first. Ne uvoditi browser dependency,
schema biblioteku, naloge ili poseban AI guardrail bez stvarne potrebe. Ako browser
alat nije dostupan, browser red ostaje NOT RUN, a acceptance otvoren.

## Razrešen serverski kontekst i nezavisni test oracle

Coach HTTP poziv zahteva neproverljiv nasumični `coachContext` izdat preko
`POST /api/agent/coach-context` sa kanonskim aktivnim `state`. Samo server bira
token i brojač. Kontekst je vezan za demand/config i poslednji prihvaćeni prefiks
istorije; rewind/drugačiji već poznati potez ne prolaze. Kvota je 10 primljenih
coach izvršavanja po izdatom kontekstu, ne po nadimku. Novi kontekst može izdati
samo server; lokalni neautentifikovani klijent ipak može zatražiti novi kontekst.
Zato ne tvrdimo nepromenljivu kvotu po stvarnoj ljudskoj partiji. Globalne trajne
kvote ograničavaju i nove kontekste. UI čuva jedan kontekst u memoriji partije,
ne obnavlja ga na quota/error, resetuje ga samo novim scenarijem/reload-om.

Konteksti traju najviše 2 sata bez produženja, najviše 128 živih zapisa, izdavanje
najviše 6/minut globalno za lokalni proces. Restart ih briše, ne briše globalni
ledger. Token se ne šalje modelu, transkriptu ni security logu. Ove vrednosti su
serverska politika, a ne JSON opcije ili autentifikacija. Protokol za postojeća
druga tri toka ostaje isti; interni runWorkflow nema transportni admission.

Pre implementacije, nova matrica [security-matrix.md](security-matrix.md) definiše
oracle prema zabranjenom efektu, ne prema tome šta trenutni validator prihvata.
Testovi ne uvoze produkcione limite da bi sami izračunali očekivani ishod.
Postojeći pozitivni testovi koji očekuju samo jedan aktivan posao prilagođavaju
se novom ugovoru dva aktivna/treći odbijen, bez uklanjanja brojača/izolacije.

## Dopuna plana posle pregleda zahteva, 2026-10-30

[Pregled](requirements-review.md) razlikuje postojeće izvršene testove od
preostalih acceptance zahteva. Sledeći rad zadržava prethodne zabrane:

1. **S15, ponovljiv browser:** sačuvati pokretač stvarnih browser input-a za
   postojeći fixture: sveža sesija, normalan coach, XSS/HTML/link final i nadimak,
   invalidna/validna porudžbina, CSP pozitivna kontrola, postojeći verifier.
   Negativne DOM/marker tvrdnje upariti sa vidljivim tekstom i funkcionalnom igrom.
   Dokumentovati pokretanje koje pada kada browser/opažanja nedostaju; stari JSON,
   SSR ili isključen CSP nisu prolaz. Postojeća native automatizovana sesija
   ostaje istorijski dokaz, bez tvrdnje da je njen input skript u repozitorijumu.
2. **S16, jedan novi T17:** zadržati oracle spec odeljka 8, pa napisati imenovan
   integracioni test u postojećem security suite-u. Izolovan ledger, injektovan
   sat i kontrolisane promise barijere; pripremnih devet admission-a rasporediti
   preko minutnog limita bez smanjivanja produkcionih kvota. Dva validna HTTP
   zahteva, isti state/context, različite label-e, hostilan cilj. Mock pobednika
   traži `place_order`: jedan admission, jedan quota-denied, nula alata, identična
   stanja i bez retry-a. Kasniji bezazlen zahtev istog scope-a ostaje odbijen,
   pozitivan sused u dozvoljenom scope-u uspeva. Odvojeno brojati count/generate,
   tool i ledger delta; interni model korak nije isto što i provider HTTP poziv.
3. Posle S15/S16 pokrenuti ciljane testove i potrebne regresije/build za promene.
   Dopisati stvarne rezultate/padove, bez prepisivanja istorije ili unapred
   zadatog budućeg broja svih testova.
4. **S17–S19, demonstracija:** [scenario](demo-8-minuta.md) je pripremljen.
   Potvrditi stvarne učesnike/uloge, održati probu i izmeriti 480 s; potom svaki
   član zasebno objašnjava novu varijantu. Sačuvati datum, trajanje, zastoje i
   stvarne odgovore. Pripremljen tekst ne označavati održanom odbranom.

U prethodnoj dokumentacionoj sesiji zatvorena je priprema S17. Tada su S15/S16 bili budući izvršivi rad,
a S18/S19 zahtevaju stvarno izvođenje; nisu proglašeni implementiranim/prošlim.

## Izvršenje dopunskog plana

Na sledeći zahtev korisnika S15/S16 su implementirani i izvršeni.
[Dokaz](completion-evidence.md): browser-native driver u test fixture-u,
verifier sa obaveznim svežim fazama, negativna proba bez browser input-a,
kombinovani T17 i završne regresije 500/54. Nove zavisnosti nisu uvedene.
S17 je dokumentaciona priprema; stvarna proba/odbrana S18/S19 nisu održane.
Lični podaci/doprinos preskočeni su po zahtevu korisnika.
