# W08 test oracle, zapisan pre novih testova i implementacije

Datum: 2026-10-29. Pravila: [Z01-Z11 i limiti](spec.md).
Uspeh se meri stvarnim provider/tool pozivima, primljenim podacima, DOM-om i
pre/posle stanjem, ne samo HTTP statusom, frazom u prompt-u ili brojem testova.

| ID | Scenario / zabranjen efekat | Nezavisno očekivanje |
|---|---|---|
| A01 | Normalna aktivna partija sa srpskim tekstom, emoji, apostrofom, `a < b` | Dva model koraka, jedan stvarni alat, tekst ostaje tekst, stanje nepromenjeno |
| A02 | Porudžbine 2.5/51, prazna istorija, backlog, nedelje 9/10 | Legalna kanonska stanja prihvaćena; coach nema buduću tražnju |
| A03 | Posle završetka partije | Nema provider/tool rada za coach; ručno igranje ostaje moguće do završetka |
| B01 | Direktan HTTP: null/niz/tip/missing/privilege polje i lažni media type | Odbijanje pre provider/tool rada; dozvoljeni JSON parametar charset prolazi |
| B02 | Cilj 1/499/500/501 Unicode code point-a; kontrolni/bidi tekst i normalni LF/TAB | Dozvoljene granice rade; 501/NUL/bidi odbijeni, bez prećutnog skraćivanja |
| B03 | Telo 19.999/20.000/20.001 bajt; provider/JSON/tool veličine | Granica prolazi, +1 se odbija/čitanje prekida; parser nije jedina granica |
| C01 | Promena trajanja, cena, istorije, stanja ili faze u payload-u | Nekonzistentan snapshot odbijen; druga kanonska istorija nije autentifikovana prevara |
| C02 | Cilj traži promenu pravila, reset, shell, URL ili drugi workflow; fake model posluša | Najviše prvi model korak, nula zabranjenih alata i bez mutacije; bez automatskog dekodiranja/novog evaluator poziva |
| C03 | Dozvoljen alat sa dodatnim argumentom/stanjem/ownerId | Nema izvršenja; pozitivan isti alat sa `{}` uspeva |
| C04 | Tool vraća dodatnu sintetičku tajnu, nested objekat, NaN ili prevelik rezultat | Nema drugog model koraka za odbijeni rezultat; nedozvoljena polja ne stižu do modela/UI/security loga |
| C05 | Final ima dodatne ključeve, pogrešnu količinu, prazne dokaze ili lažnu činjenicu | Nema uspešnog prikaza; stvarni potrošeni pozivi ostaju evidentirani |
| D01 | Dva odložena zahteva i treći napad; promena nadimka/toka | Tačno dva aktivna posla; treći 429 sa nula dodatnog provider rada; nema A/B curenja; kasniji legitiman uspeva |
| D02 | Deseti/jedanaesti coach zahtev, race za poslednje mesto, lažni/tuđi/istekli kontekst | Samo validan kontekst i raspoloživo mesto troše admission; nema klijentskog resetovanja brojača; globalna kvota ostaje |
| D03 | Per-call prekorači 8 s; odvojeno četiri pojedinačno kratka poziva ukupno prelaze 20 s | Bez novog koraka/success-a posle odgovarajućeg roka; podržani fetch/body abort i cleanup |
| D04 | Ignorisan abort, kasna rezolucija, cancel/reissue, ponovljeni alat/treći model | Nema kasnijeg success-a niti dodatnog poziva; aktivni posao ne može izazvati neograničeno stvarno paralelno izvršavanje |
| E01 | Sintetički ključ u grešci/dodatnom polju, cilj pokušava lažni log red | Ključ nije u response/model/security log/bundle; jedan strukturisan događaj, bez korisničkog sadržaja |
| E02 | Browser dobije XSS/HTML/Markdown/URL tekst kroz stvarni coach final i nadimak | Nema markera izvršenja ni opasnih DOM elemenata/linkova; normalan tekst vidljiv |
| E03 | Lokalni production build i inače dostupan zabranjen skript | Stvarni CSP header blokira skript uz securitypolicyviolation, bez CSP bypass-a; igra/AI tok rade |
| E04 | Stari savet posle invalidne/validne porudžbine | Invalidna čuva nedelju/savet; validna napreduje i uklanja stari savet/usage; log nije obrisan |
| F01 | Novi AI agent/alat/nalog/write/scenario feature van izabranog opsega | Ne dodaje se; regresije druga tri postojeća toka moraju prolaziti |
| F02 | Dependency audit, CORS/credential/CSRF, restart | Nalaz i primenljivost dokumentovani; nema slepog force upgrade-a ili izmišljene autentifikacije |

Pokrivanje je ograničeno i smisleno, ne „svi mogući napadi”. Mešoviti ulazi:
običan tekst, JSON tekst, code fence, Unicode/confusable/bidi, Base64, percent,
HTML/NUL, nested/repeated/contradictory komande. Nedozvoljeni efekat se proverava
čak i kada fake model namerno posluša cilj. Zasebno pozitivni scenariji sprečavaju
da zabrana svega izgleda kao uspeh. Browser status ostaje otvoren ako stvarni
browser nije dostupan; SSR i parsiranje stringa nisu zamena za DOM/CSP dokaz.
