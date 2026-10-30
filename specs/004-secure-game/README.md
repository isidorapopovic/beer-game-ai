# W08 - Secure the Arcade: AI Decision Coach

Datum: 2026-10-29. Početni commit: `d87bc24`, grana `main`.

Status: **implementirano i lokalno provereno** na grani
`feature/004-secure-decision-coach`, nakon naknadnog odobrenja implementacije.
500 testova i 54 W08 security testa prolaze uz verzionisane input-e u stvarnom
Chrome-u, DOM/CSP/stale-advice dokaz, novi kombinovani T17 i audit sa 0 nalaza.
S15/S16 su zatvoreni. Demo je pripremljen; stvarna proba/odbrana NOT RUN.
Lični doprinos preskočen je na zahtev korisnika. Nema live AI poziva.
Rad je necommitovan/nepushovan; main nije menjan.

Za domaći je izabran `decision_coach`, sa jedinim alatom
`getCurrentGameState({})`. Ostala tri toka ostaju van implementacionog opsega;
zajedničke serverske kvote i dalje moraju sprečiti zaobilaženje promenom toka.

## Dokumentacija našeg projekta

- [Specifikacija zabrana, limita, arhitekture i pretnji](spec.md)
- [Plan buduće implementacije i provera](plan.md)
- [Zadaci i preostali lični doprinos](tasks.md)
- [Provera svih zahteva T00–T17 i otvorenih stavki](requirements-review.md)
- [Scenario od osam minuta i individualne varijante](demo-8-minuta.md)
- [Najnoviji izvršeni dokazi S15/S16 i završne provere](completion-evidence.md)
- [W08 evidencija - pre/posle i ograničenja](EVIDENCE_W08.md)
- [Izvorna politika pre implementacije](policy-before.md)
- [Nezavisni test oracle](security-matrix.md)
- [Mašinska verifikacija](verification.json), [browser](browser-results.json), [T17](t17-results.json), [security smoke](security-results.json), [audit](dependency-audit.json)

## Originalni nastavni materijali

- [Sesija 1](01-Materijal-sesija-1.md)
- [Nedeljni zadatak](02-Nedeljni-zadatak-Secure-the-Arcade.md)
- [Originalni šablon dokaza](03-Sablon-dokaza.md)
- [Sesija 2](04-Materijal-sesija-2.md)

Originalni materijali ostaju neizmenjeni. Predloženi limit **10 coach zahteva po
partiji** je naša početna projektna odluka, a ne broj koji je korisnik zadao ili
kurs propisao. **Najviše dva istovremena izvršavanja** jeste zahtev korisnika.
Server sada dopušta najviše dva aktivna posla; treći se odbija. Game kvota važi
po izdatom anonimnom kontekstu; novi kontekst/restart nisu autentifikacija ili
nepromenljiva kvota po čoveku. Globalne trajne kvote ostaju.
