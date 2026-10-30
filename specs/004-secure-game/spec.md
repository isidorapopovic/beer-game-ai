# Specifikacija 004: zabrane i ograničenja za AI Decision Coach

Datum: 2026-10-29. Polazno stanje: `d87bc24`.
Status: **implementirano i lokalno provereno** na feature grani. Zabrane su
napisane pre novih testova; izvorni tekst je sačuvan u [policy-before.md](policy-before.md).
Kolone „Sada” u početnim tabelama opisuju polazni kod `d87bc24`, a ne završno stanje.
Završne razlike i dokazi su u odeljku 7 i [EVIDENCE_W08.md](EVIDENCE_W08.md).

## 1. Opseg i dozvoljena funkcija

Izabrani tok je `decision_coach`. Tok je dostupan u aktivnoj partiji, u nedeljama
1-10 pre završne predaje porudžbine. Jedini poslovni alat je
`getCurrentGameState({})`, bez argumenata.

Uspešan tok ima dva model koraka i jedno stvarno izvršenje alata između njih.
Alat vraća samo: `week`, `currentDemand`, `inventory`, `backorder`,
`incomingShipments`, `recentDemand`, `recentOrders`, `totalCost`.
Istorijski prozor ostaje najviše pet prethodno odigranih nedelja.

Agent sme da predloži količinu, obrazloži savet i citira proverene činjenice.
Porudžbinu podnosi igrač zasebnom akcijom. Preporuka može uticati na odluku igrača;
ne tvrdimo da savet nema nikakav posredan uticaj na rezultat.

## 2. Izričite zabrane

| ID | Šta je zabranjeno | Mesto buduće/proverene kontrole |
|---|---|---|
| Z01 | Menjanje trajanja igre, kašnjenja isporuke, tražnje, cena i obračuna troškova | Kanonska konfiguracija i replay na serveru; game engine ostaje neizmenjen |
| Z02 | Predaja porudžbine, promena zalihe/zaostatka, rezultata, istorije, nedelje, reset ili završetak partije od strane agenta | Registar sadrži samo read-only alat; stanje pre/posle mora biti isto |
| Z03 | Drugi poslovni alat, drugi workflow unutar coach izvršavanja, `constructor`, `__proto__`, `toString` ili proizvoljna funkcija | Own-property članstvo, allowlist, validacija predloga i argumenata |
| Z04 | Proizvoljan URL fetch, shell, izvršavanje koda, čitanje fajlova ili tajni | Takve mogućnosti se ne registruju; provider ide kroz fiksni serverski adapter |
| Z05 | Menjanje modela, providera, system prompt-a, ovlašćenja, limita, kvota ili concurrency vrednosti iz browsera/modela | Tačan ulazni ugovor; nema spajanja korisničkog JSON-a sa serverskom konfiguracijom |
| Z06 | Pretvaranje korisničkog cilja ili sadržaja alata u sistemsku instrukciju | Cilj i alat su podaci; izvršna politika proverava svaki predlog nezavisno od modela |
| Z07 | Pristup budućoj tražnji, nepostojećoj arhivi ili drugoj partiji kroz coach alat | Eksplicitna projekcija dozvoljenog trenutnog stanja; bez pretrage drugih zapisa |
| Z08 | Izmišljene strukturisane činjenice, nevalidna količina ili prikaz nevalidnog finala kao uspeha | Članstvo u determinističkim činjenicama, izlazni ugovor i granice količine |
| Z09 | HTML/JavaScript izvršavanje, aktivni opasni linkovi ili tumačenje teksta modela kao koda | Tekstualni React prikaz; stvarni browser/DOM i CSP testovi u kasnijoj fazi |
| Z10 | Automatsko ponavljanje, skuplji fallback, zaobilaženje budžeta, uspeh posle isteka roka | Serverski brojači, rezervacija budžeta, deadline i kontrolisan prekid |
| Z11 | Slanje ključa, privatnog chain-of-thought-a, interne greške ili nedozvoljenog dodatnog polja u sledeći model/UI/log korak | Projekcija podataka, stroga izlazna validacija i minimalni security događaji |

„Zabranjen prompt injection” znači da pokušaj instrukcije u nepouzdanim podacima
ne daje dodatne mogućnosti. Ne obećavamo prepoznavanje svakog zlonamernog teksta.
Nema crne liste reči, automatskog dekodiranja Base64/URL instrukcija, novog modela
za procenu namere ili tvrdnje o univerzalnoj otpornosti live modela.

Neispravan početni protokol mora biti odbijen pre provider/tool rada. Ako je
zlonamerna instrukcija običan dozvoljen tekst, provider već može biti pozvan;
zabranjeni predlog modela tada mora biti odbijen sa nula izvršenja tog alata.

## 3. Konkretne granice

### 3.1. Ulaz, format i podaci

| Stavka | Ciljna granica | Sada / razlika |
|---|---|---|
| HTTP | `POST /api/agent/run`, JSON objekat, `Content-Type: application/json`; najviše 20.000 bajtova pre kompletnog parsiranja | JSON/veličina već postoje; proveriti i strogoću media-type provere |
| Polja zahteva | Samo `workflow`, `goal`, `state`, opciono `participant`, opciono prazan `taskInput` za coach | Postoji allowlist; `workflow` za ovaj tok mora biti `decision_coach` |
| Poruka/cilj | String, 1-500 Unicode code point-a posle trim-a; nema praznog/nedostajućeg/null/string-array ulaza | Brojanje i tip već postoje |
| Format poruke | Običan tekst; srpska slova, emoji, apostrof i `a < b` dozvoljeni; nema izvršavanja HTML/Markdown/JSON sadržaja cilja | Tekst ostaje podatak; ne uvoditi novi renderer |
| Kontrolni znakovi | Predlog: odbiti NUL, DEL, C0 kontrole osim TAB/LF/CR i bidi override/isolate znakove; ne oštećivati običan Unicode | Dodatno pravilo za cilj tek treba implementirati/testirati |
| Nadimak | Opciono 0-80 Unicode code point-a, bez kontrolnih znakova; ne služi kao identitet/dozvola | Postoji; ne šalje se modelu |
| Stanje | Potpuni kanonski replay/deep equality; aktivna partija; istorija i konfiguracija po postojećem engine-u | Postoji; ne uvoditi 0-50 ograničenje za stvarne istorijske porudžbine |
| Alat | Isključivo `getCurrentGameState`, argumenti tačno `{}` | Postoji validacija argumenata i own-property dispatch |
| Tool rezultat | Samo osam navedenih polja, konačni brojevi i provereni nizovi; najviše 50.000 serijalizovanih bajtova pre modela | Veličina/osnovni tipovi postoje; strogo odbijanje dodatnih polja i dubina nizova zahtevaju proveru/doradu |

Zadržava se postojeći `JSON.parse` pristup duplim ključevima: poslednja vrednost se
zatim validira. To nije put za promenu politike: svaki nepoznat privilegovani ključ
se odbija. U ovoj fazi ne planiramo poseban JSON parser.

### 3.2. Model i završni odgovor

| Stavka | Granica |
|---|---|
| Prvi korak | Najviše 768 ulaznih i 128 izlaznih tokena |
| Završni korak coach-a | Najviše 1.024 ulazna i 512 izlaznih tokena |
| Provera tokena | Postojeći serverski `countTokens` pre svake generacije; prekoračenje prekida tok bez retry-a |
| Provider HTTP telo | Najviše 64.000 bajtova, ograničeno tokom čitanja |
| Izdvojeni tekst JSON odgovora | Najviše 12.000 bajtova; nevalidan JSON se odbija |
| Finalni ugovor | Tačno `summary`, `recommendation`, `recommendedOrderQuantity`, `evidence`, `confidence`, `completed`; odbiti dodatna polja |
| Sažetak i preporuka | Svako polje 1-240 Unicode code point-a |
| Preporučena količina | Ceo broj 0-50; nema `NaN`, beskonačnosti, stringa ili razlomka |
| Dokazi | 1-2 stavke, svaka tačno `{source:"game_state",fact:string}`; činjenica 1-160 code point-a i tačno podudaranje sa odobrenim činjenicama alata |
| Pouzdanost i završetak | `confidence` samo `low`, `medium`, `high`; `completed` mora biti `true` |

Token/tekst granice i članstvo činjenica već postoje. Trenutni coach normalizer
izostavlja nepoznata polja; ciljno strogo odbijanje dodatnih polja je nova dorada.
Izlaz se ne skraćuje tako da nevalidan sadržaj prividno postane validan. Proverene
činjenice nisu dokaz semantičke tačnosti svakog slobodno formulisanog saveta.

### 3.3. Pozivi, partija i istovremenost

| Resurs | Ciljna granica | Sada / status |
|---|---|---|
| Jedan coach zahtev | Najviše 2 generacije + 2 countTokens zahteva = 4 provider HTTP zahteva; najviše 1 poslovni alat | Postoji; rano odbijanje može imati manje poziva |
| Retry/fallback | 0 automatskih retry-a i 0 fallback generacija | Postoji |
| Ukupan deadline | 20 s za agent izvršavanje; nijedan novi korak/uspeh nakon isteka | Postoji; W08 dodatno treba dokaz prekida i zakašnjelog nastavka |
| Pojedinačni provider HTTP poziv | Predlog: najviše 8 s, uvek i unutar preostalog ukupnog deadline-a | Poseban 8 s timeout trenutno ne postoji |
| Istovremena izvršavanja | Najviše 2 aktivna izvršavanja globalno u jednom lokalnom serverskom procesu; treći zahtev odmah dobija 429, bez provider rada i bez reda čekanja | Zahtev korisnika; sada je 1, ne 2 |
| Pozivi unutar jednog izvršavanja | Sekvencijalno; dva model koraka nisu dva paralelna poziva | Postojeći model adapter već sprečava paralelni korak istog izvršavanja |
| Zahtevi po partiji | Predlog: najviše 10 primljenih u izvršavanje coach zahteva za jedan serverski kontekst partije | NOVO; trenutno nema pouzdanog brojača po partiji |
| Globalna učestalost | Zadržati najviše 6 primljenih u izvršavanje za 60 s | Postoji; nastavnih 5/60 s je primer, nije obavezna vrednost |
| Globalna dnevna kvota | Zadržati najviše 100 primljenih u izvršavanje dnevno, reset po UTC | Postoji; disk rezervacije ostaju trajne |
| Globalni dnevni budžet | Zadržati serverski procenjeni plafon do 1 USD i konzervativne rezervacije | Postoji; nije garancija tačnog provider računa |

Usvojen je limit **deset coach zahteva po serverski izdatom kontekstu**.
To je lokalni obračunski scope, ne nepromenljiva kvota po čoveku ili stvarnoj partiji.
To ne znači jedan zahtev po nedelji: dozvoljeno je više konsultacija u istoj
nedelji dok ukupna kvota nije potrošena. Gornja granica je zato 20 generacija,
20 brojanja tokena i 10 alata po takvom kontekstu partije.

Nevalidan zahtev i zahtev odbijen zbog kvote/zauzetosti ne troše novo mesto.
Prihvaćen zahtev koji zatim padne/istekne/bude otkazan troši svoje mesto. Novi,
ponovljeni legitimni HTTP zahtev je nova potrošnja; ne dodajemo opštu deduplikaciju.
Brojači i slotovi se rezervišu atomski pre provider rada, uključujući race na
desetom mestu. Limit 2 nije podešavanje dugmeta ili proizvoljno klijentsko polje.

Važno: aplikacija nema autentifikaciju ni server-owned autoritativnu partiju.
`POST /api/agent/coach-context` izdaje nasumični token vezan za config, demand i
poslednji prihvaćeni prefiks istorije. Klijent ne bira token/brojač. Rewind i
drugačija već poznata istorija se odbijaju. Prihvaćeni neuspešni/otkazani zahtevi
troše mesto. Token se ne šalje modelu ni logovima.

Kontekst ističe posle 2 sata, najviše 128 živih konteksta, izdavanje 6/minut.
Memorijski store se gubi restartom; globalni trajni ledger ostaje. UI koristi isti
token kroz nedelje i ne obnavlja ga pri grešci/kvoti; novi scenario/reload pokreću
novi kontekst. Lokalni neautentifikovani klijent ipak može zatražiti novi kontekst.
Zato je ovo deset zahteva po izdatom scope-u, ne dokaz vlasništva ili stvarno
odigrane partije. Globalne kvote važe i preko novih konteksta i drugih workflow-a.
Nisu uvedeni nalozi ni baza.

Aktivno mesto ne sme biti oslobođeno dok lokalni posao i podržano otkazivanje nisu
završeni, tako da zaostali posao ne probije granicu 2. Abort lokalnog HTTP zahteva
ne dokazuje prestanak sve udaljene obrade ili naplate. Ostali workflow-i ne smeju
zaobići globalne limite iako je domaći fokusiran na coach.

## 4. Arhitektura, podaci i vlasnici odluka

```text
Igrač / browser (nepouzdan unos, lokalna partija, sessionStorage)
  -> POST /api/agent/run: veličina, format, cilj, kanonski replay, faza
  -> serverska politika: globalne kvote; planirani game brojač i 2 aktivna mesta
  -> model korak 1: serverska instrukcija + korisnički cilj kao podatak
  -> dispatch: samo getCurrentGameState({})
  -> allowlist projekcija stanja + validacija veličine/šeme + proverene činjenice
  -> model korak 2: cilj, dozvoljeni rezultat alata i činjenice
  -> finalna validacija -> tekstualni React prikaz
  -> igrač odvojeno odlučuje i ručno podnosi porudžbinu
  -> minimalni security događaji, odvojeni od opcionog detaljnog AI transkripta
```

| Podatak / mogućnost | Ko kontroliše / gde se proverava | Odlazi modelu? | Čuvanje sada / cilj |
|---|---|---|---|
| Cilj | UI sada šalje fiksno pitanje; direktan API klijent može poslati drugi tekst; server proverava dužinu/tip | Da, kao podatak | Sada može u opcioni detaljni JSONL; cilj: ne u minimalni security log |
| Stanje i istorija | Browser; server proverava kanonsku konzistentnost, ne poreklo | Ne kompletno; samo coach projekcija | Partija u React memoriji; opcioni transkript beleži alat, ne predstavlja autoritativnu partiju |
| Cela buduća tražnja | U lokalnom game state-u; server je koristi za replay | Ne u coach projekciji | Browser vlasnik može pregledati svoj JS/state; ovo nije anti-cheat |
| Session ID / nadimak | Browser/sessionStorage ili serverski anonimni fallback; validacija formata | Ne | ID u sessionStorage, nadimak u UI memoriji; opciono u detaljnom logu, identitet neproveren |
| System prompt, model, limiti i ključ | Samo serverski kod/konfiguracija | Instrukcija/model da; API ključ samo provider autentikaciji, ne sadržaju prompt-a | Ključ ostaje u serverskoj konfiguraciji; privatni `.env` se ne otvara niti kopira u dokaz |
| Tool predlog/argumenti | Model, zatim orchestrator | Samo dozvoljeni rezultat posle provere | Minimalni log beleži kod ishoda; proizvoljan naziv/sadržaj ne kopira se kao log polje |
| Izlaz modela / dokaz | Model; server proverava format, činjenice i granice | Nema trećeg evaluator poziva | UI memorija; opciono detaljni log; bez tretiranja kao izvršivog sadržaja |
| Brojači / prijem zahteva | Server, ne nadimak/model | Ne | Globalni ledger na disku; budući per-game lifecycle zasebno dokumentovan |

Sadašnji opcioni detaljni log iz spec 002 može čuvati sanitizovane prompt/tool/final
podatke u `.local/`, do 10.000.000 bajtova ukupno i 64.000 po događaju, bez
automatskog brisanja. To nije W08 minimalni operativni security log. Za W08 treba
predvideti eksplicitna metadata polja: tip događaja, UTC vreme, serverski
correlation ID, workflow, ishod, reasonCode, trajanje i brojače; bez cilja, punog
stanja, participant/session tokena, tajne, raw provider odgovora ili stack trace-a.
Detaljno snimanje ostaje odvojena opciona funkcija; pravilo brisanja/pristupa mora
biti opisano pre testiranja. Ne menjamo sada privatna podešavanja ni stare logove.

## 5. Model pretnji i tri prioriteta

Procene su kvalitativne za lokalni single-player demo, ne procena internet servisa.
„Postoji” znači pregled koda, a ne novi izvršeni dokaz.

| ID | Scenario i preduslov; pogođeni resurs | Verovatnoća / uticaj i razlog | Postojeća zaštita i razlika | Planirani dokaz | Prioritet |
|---|---|---|---|---|---|
| R1 | Cilj ili tekst alata traži `place_order`, reset pravila ili drugi tool; model posluša | Srednja / visok: nepouzdan cilj stiže modelu, nedozvoljeno izvršenje bi promenilo igru | Zatvoren registar, tačni argumenti, read-only alat; zadržati i testirati celu putanju | Hostilan cilj + namerno nedozvoljen fake predlog; nula zabranjenih izvršenja i identično stanje | **P1 - prvi prioritet** |
| R2 | Paralelni/ponovljeni zahtevi i promena session ID-a zaobilaze brojače; pogođeni trošak i raspoloživost | Visoka / srednji: direktni HTTP zahtevi su laki, postoje globalne kvote | Sada 1 aktivan posao; nema per-game kvote; promena na 2 zahteva atomsku kontrolu | 2 aktivna, treći 429; race poslednjeg game mesta; promena nadimka ne resetuje server brojač | **P1 - drugi prioritet** |
| R3 | Dodatno polje tool rezultata ili interna greška nosi sintetičku tajnu do modela/loga/UI-ja | Srednja / visok: granica izlaza je kritična; detaljni log čuva sadržaj | Fiksna projekcija/redakcija postoje; generička tool-result provera ne sprovodi potpuno additionalProperties:false | Neočekivano polje sa sentinelom; odbijanje pre drugog model poziva; sentinel odsutan iz bundle-a, HTTP, modela i security loga | **P1 - treći prioritet** |
| R4 | Model ili nadimak vrati XSS marker; opasan sadržaj se tumači u browseru | Niža / visok: trenutni React tekst smanjuje rizik, stvarni browser nije potvrđen | Tekstualni prikaz; CSP produkcionog servera tek treba posebno proveriti/uvesti | Stvarni DOM i marker, normalan srpski tekst; aktivan CSP uz funkcionalnu igru | P2 |
| R5 | Klijent prepravi istoriju, troškove ili nedelju i traži savet/ovlašćenje na osnovu toga | Visoka / srednji: lokalni state je pod kontrolom igrača | Kanonski replay odbija nekonzistentnost; druga konzistentna istorija nije dokaz prevare ili vlasništva | Odbijanje nekonzistentnog stanja pre modela; alternativna kanonska istorija označena kao neprovereno poreklo | P2 |
| R6 | Klijent doda `role`, `ownerId`, `maxSteps`, `maxActive`, model ili novi system prompt | Visoka / srednji: jednostavan JSON pokušaj | Allowlist ulaza/serverska konfiguracija; ne smeju se proširiti W08 izmenom | Svako polje zasebno u inače validnom zahtevu; nula provider/tool rada | P2 |
| R7 | Zakašnjeli odgovor ili preporuka prethodne nedelje ostane primenljiva nakon napredovanja | Srednja / srednji: asinhroni zahtevi i UI stanje | Deadline postoji; source invalidacija iz spec 003 postoji, browser T017 otvoren | Lažni sat/odloženi provider; nema kasnijeg success-a; stvarna invalid/valid order interakcija | P2 |
| R8 | Dva aktivna coach zahteva pomešaju stanje, rezultat ili trošak A/B | Srednja / srednji: concurrency promena povećava potrebu za izolacijom | Request/run korelacija i izolovane projekcije; nije autentifikovana multiplayer izolacija | Dva različita sintetička stanja/cilja, odvojeni promptovi/izlazi/brojači | P2 |
| R9 | Veliko telo, duga poruka ili prevelik provider rezultat iscrpljuje memoriju/parser | Visoka / srednji: granice se mogu gađati direktno | Streaming byte/token cap i tekstualne granice postoje | Tačna granica i granica+1; prekid čitanja, kontrolisana greška i stvarni brojači | P2 |

R1 štiti osnovnu zabranu da predlog postane ovlašćenje. R2 je važan zbog novog
zahteva za dva istovremena posla i brojača tokom igre. R3 štiti granicu koja podatke
šalje modelu i logovima; sama redakcija ili system prompt nisu dovoljni.

## 6. Acceptance i granice ove faze

Za svaku zaštitu mora postojati pozitivan slučaj: normalan coach tok sa dva model
koraka/jednim alatom i validnom preporukom. Ne prolazi rešenje koje sve odbija.
Mapiranje na I1-I8 i T00-T17 domaćeg, najmanje tri pre/posle scenarija, browser
XSS/CSP, sentinel, audit zavisnosti i minimalni security događaji nalaze se u
[planu](plan.md), [zadacima](tasks.md), [matrici](security-matrix.md) i evidence-u.

Brojevi su projektna politika, ne industrijski standard. Nova autentifikacija,
baza, anti-cheat, promena ekonomskih pravila, novi AI tokovi, novi evaluator model,
write alat, live adversarial proba i javni deployment nisu deo ove faze.
Spec 001 live acceptance ostaje otvoren. Spec 003 browser T017 je naknadno
proveren stvarnim W08 run-om, sa eksplicitnom vezom ka novom dokazu.

## 7. Šta je stvarno sprovedeno

Strogi UTF-8/media-type ugovor, kontrolni/bidi znakovi, tačni coach final/evidence
ključevi, tool-result bajtovi/dubina/dodatna polja i izostavljanje sirovog odbijenog
tool rezultata iz loga sada se sprovode. Za razliku od početne pretpostavke u
tabeli, tool-size cap ranije je bio samo deklarisan; sada se proverava.

Per-call 8 s, globalni maksimum 2 i deset admission-a po izdatom kontekstu rade
serverski. Neprekinuti pozadinski provider posao zadržava aktivni slot do stvarnog
završetka; kasni rezultat nije uspeh. Minimalni security logger je poseban i opt-in.

Novi Node production server služi build/API sa aktivnim CSP/nosniff/no-referrer.
Vite je ciljano ažuriran 7.3.6 -> 7.3.7 posle audita, bez novih direktnih zavisnosti.
Game engine, ekonomija, stvarne porudžbine i druga tri postojeća toka su očuvani.

U prvom izvršenju provereno je 499 testova, od toga 53 W08, typecheck, renderovani UI, production
build, logging/export, sentinel/security smoke i stvarni Chrome DOM/CSP/stale-advice
run. Nema tvrdnje o semantičkoj tačnosti svake slobodne rečenice ili opštoj
bezbednosti/live-model injection otpornosti.

## 8. Dopuna acceptance-a: laboratorija i demonstracija, 2026-10-30

[Pregled svih zahteva](requirements-review.md) razlikuje izvršene tehničke provere
od preostalih uslova predaje. Važe sledeća dodatna očekivanja:

1. T00–T15 i T17 moraju imati automatizovane slučajeve. T04/T05 zahtevaju stvarni
   browser i DOM/marker, uz pozitivan normalan tekst; SSR nije dovoljan. Postojeći
   browser prolaz važi za izvršenu sesiju. Dodati verzionisan pokretač input-a za
   samostalno ponavljanje uz postojeći observer/verifier, bez CSP bypass-a.
   T16 može kombinovati automatizovane i precizno dokumentovane ručne provere.
2. **T17 — race poslednjeg mesta plus poslušan hostilni model**, iz R1/R2/R8:
   posle devet admission-a jednog konteksta poslati dva konkurentna validno
   oblikovana HTTP zahteva, sa istim state/context, različitim nadimcima i
   hostilnim ciljem. Mock za primljeni zahtev predlaže `place_order`. Oracle:
   tačno jedan novi admission, drugi quota-denied bez provider rada; primljeni
   predlog odbijen pre izvršenja, nula alata/promena stanja. Sledeći bezazlen
   zahtev istog konteksta i dalje je quota-denied. Zaseban pozitivan sused sa
   novim dozvoljenim scope-om prolazi. Brojati admission/count/generate/tool i
   ledger delta; sam HTTP status ili zbir ranijih odvojenih testova nije dokaz.
3. Dependency audit mora imati datum/pre-posle nalaze. CSRF je N/A samo dok nema
   automatskih pristupnih sredstava; cookie/HTTP auth ponovo otvara obavezni CSRF
   test. Origin/CORS nisu dokaz autentifikacije.
4. Pripremiti **480 sekundi demonstracije**, pa svaki stvarni član posebno
   objašnjava novu varijantu: ulaz, granicu, oracle, potrošnju i trag.
   [Scenario](demo-8-minuta.md) je pripremljen; stvarno trajanje i individualna
   objašnjenja zabeležiti tek posle probe/odbrane. Ne izmišljati učesnike/doprinos.
5. Evidence razlikuje prethodne prolaze, današnji pregled, pripremljen materijal
   i neizvršene stavke. S15/S16/S18/S19 ostaju otvoreni do odgovarajućih dokaza.

Dopuna je dokumentaciona; ne menja policy-before.md, runtime limite ili igru.

## 9. Naknadno izvršenje dopune

S15/S16 su sprovedeni i provereni prema odeljku 8; [completion-evidence.md](completion-evidence.md)
sadrži nove rezultate 500/54, browser automatizaciju, T17 i ponovljeni audit.
S17 je priprema; S18/S19 ostaju stvarni nastup/odbrana NOT RUN. Lični doprinos
korisnik je izričito preskočio. Raniji acceptance je ugovor, ne tvrdnja da je
stvarni lični događaj već održan. Produkcioni limiti i game engine nisu menjani.
