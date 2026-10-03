# WEEK_3_REPORT.md

# Izveštaj za Week 3 — Context Engineering, Build specifikacija i dizajn evaluacije

## 1. Cilj treće nedelje

Glavni cilj Week 3 bio je da se od neformalne ideje za igru pređe ka **strukturisanom, ponovljivom i proverljivom AI-assisted development workflow-u** za Beer Distribution Game.

Fokus još nije bio na izgradnji backenda niti na proširivanju igre dodatnim funkcionalnostima. Umesto toga, rad je bio usmeren na definisanje:

- šta coding agent treba da napravi;
- koje informacije agent treba da dobije;
- koji izvori imaju prioritet;
- šta agent ne sme da dodaje;
- kako se predstavljaju važna pravila igre;
- kako treba obraditi nevalidne ulaze;
- kako će se finalna implementacija evaluirati;
- kako razlikovati stvarno poboljšanje od neproverene tvrdnje.

Workflow za Week 3 postao je:

```text
Game Spec
    ↓
Build Prompt
    ↓
Context Manifest
    ↓
Strukturisani ugovor
    ↓
Mini Eval skup
    ↓
Implementacija
    ↓
Provera / dokaz
```

Ovo prati princip context engineering-a da nije važno samo pitanje:

> Šta postoji u repozitorijumu?

već i:

> Šta je model stvarno dobio, koji izvor je imao prioritet i kako dokazujemo da se rezultat poboljšao?

---

# 2. Scope projekta definisan tokom Week 3

Scope projekta je sužen na prvi igrivi MVP za:

```text
Beer Distribution Game
```

Igrač kontroliše samo:

```text
Retailer
```

Trenutna verzija je:

```text
Frontend-only
```

Sledeće funkcionalnosti su eksplicitno van scope-a za Week 3:

- backend;
- baza podataka;
- autentifikacija;
- multiplayer;
- cloud infrastruktura;
- API servisi;
- Wholesaler gameplay;
- Distributor gameplay;
- Factory gameplay;
- AI protivnici;
- napredna analitika;
- nepotrebni vizuelni efekti;
- spekulativne funkcionalnosti koje nisu definisane u Game Spec-u.

Cilj je da se napravi najmanja ispravna i igriva Retailer verzija pre proširivanja sistema.

---

# 3. Finalizovana osnovna pravila igre

Glavna gameplay pravila su razjašnjena i usklađena kroz radne dokumente.

## Uloga igrača

Igrač kontroliše samo:

```text
Retailer
```

Retailer mora da:

- prati customer demand;
- prati trenutni inventory;
- prati postojeće backorder-e;
- prati incoming shipments;
- odabere Order Quantity;
- zadovolji što više customer demand-a;
- minimizuje inventory i backorder troškove.

---

## Trajanje igre

Jedan od važnih ishoda Week 3 bio je rešavanje ranijeg konflikta oko trajanja igre.

Konačno pravilo je:

```text
Igra traje tačno 10 nedelja.
```

Simulacija:

```text
počinje u Week 1
završava se nakon Week 10
```

Nakon Week 10:

- nije moguće poslati novu porudžbinu;
- simulacija se označava kao završena;
- prikazuju se završne statistike.

Starije reference na simulaciju od 30 nedelja sada se tretiraju kao:

```text
STALE
```

i ne smeju uticati na implementaciju.

---

## Shipping Delay

Konačno pravilo za isporuku je:

```text
Shipping Delay = 2 nedelje
```

Porudžbina ne sme stići odmah.

Porudžbine moraju prolaziti kroz shipment pipeline pre nego što postanu raspoloživ inventory.

---

## Troškovi

Definisan je sledeći cost model:

```text
Inventory Cost = $0.50 po inventory jedinici nedeljno
Backorder Cost = $1.00 po backordered jedinici nedeljno
```

Weekly cost:

```text
Weekly Cost =
Inventory Cost + Backorder Cost
```

Total cost:

```text
Total Cost =
zbir svih Weekly Cost vrednosti
```

---

# 4. Fajlovi napravljeni tokom Week 3

Kreirano je nekoliko verzionisanih projektnih dokumenata.

## 4.1 `BUILD_PROMPT_V1.md`

Ovaj fajl definiše zadatak za coding agenta.

Sadrži:

- ulogu coding agenta;
- cilj projekta;
- očekivani rezultat;
- frontend-only scope;
- zabranjene dodatke;
- tehnički kontekst;
- gameplay pravila;
- UI zahteve;
- završni summary igre;
- strukturisani configuration contract;
- zahtev za runtime validaciju;
- Definition of Done;
- dozvoljene fajlove i oblasti izmene;
- obavezne verifikacione komande;
- obavezno ponašanje agenta pre kodiranja;
- obavezan summary nakon implementacije.

Prompt takođe zahteva da coding agent prvo vrati:

```text
1. Razumevanje
2. Plan
3. Nejasnoće / pretpostavke
4. Potvrdu scope-a
```

pre izmene koda.

Ovo je dodato da bi se smanjila mogućnost da agent počne implementaciju pre nego što ispravno razume zadatak.

---

# 5. `CONTEXT_MANIFEST.md`

Napravljen je Context Manifest koji dokumentuje stvarni informacioni paket koji coding agent treba da dobije.

Manifest odgovara na tri važna pitanja:

```text
1. Šta je model stvarno dobio?
2. Šta je namerno izostavljeno?
3. Koji izvor ima prioritet kada informacije dođu u konflikt?
```

Manifest odvaja relevantan od nerelevantnog konteksta.

## Uključeni izvori

Primeri:

```text
GAME_SPEC.md
BUILD_PROMPT_V1.md
package.json
tsconfig.json
relevantni frontend source fajlovi
postojeći frontend testovi
CONTEXT_MANIFEST.md
GameConfig contract / validator
```

## Namerno izostavljeni izvori

Primeri:

```text
stari chat transcript-i
stare verzije Game Spec-a
nasumični web primeri
backend planovi
planovi za bazu
ideje za autentifikaciju
buduće multiplayer funkcionalnosti
privatne informacije
tajne
nerelevantni folderi repozitorijuma
```

Ovo smanjuje context noise i sprečava model da meša aktuelna pravila sa starim ili nerelevantnim informacijama.

---

# 6. Prioritet izvora / Precedence

Definisan je redosled prioriteta izvora.

Za trenutni task:

```text
1. Eksplicitna trenutna odluka vlasnika projekta
2. Aktuelni GAME_SPEC.md
3. BUILD_PROMPT_V1.md
4. Trenutni kod projekta i tehnička konfiguracija
5. Postojeći testovi
6. README.md
7. Primeri
8. Stara istorija razgovora
9. Spoljašnji web primeri
```

Najvažnija razlika je:

```text
GAME_SPEC.md
→ autoritativni izvor gameplay pravila
```

dok je:

```text
BUILD_PROMPT_V1.md
→ autoritativni izvor za način izvođenja coding taska
```

Ovo sprečava da primeri, stari chatovi ili nerelevantna dokumentacija neprimetno pregaze aktuelna pravila igre.

---

# 7. Identifikovani Context Rot rizici

Context Manifest takođe dokumentuje četiri važna tipa problema.

## Poisoning

Ranija greška se ponavlja toliko puta da počinje da izgleda kao činjenica.

Primer:

```text
stara poruka sadrži pogrešan shipping delay
```

Ako aktuelni Game Spec definiše drugu vrednost, stara vrednost ne sme ostati aktivna.

---

## Distraction

Previše istorije ili previše nerelevantnih fajlova smanjuje fokus na trenutni zadatak.

Rešenje je da se obezbedi samo najmanji relevantan kontekst.

---

## Clash

Dve verzije istog pravila postoje istovremeno.

Stvarni primer iz ovog projekta bio je:

```text
30 weeks
vs.
10 weeks
```

Ovaj konflikt je eksplicitno rešen.

---

## Lost in the Middle

Kritičan zahtev postoji, ali je zatrpan u dugom promptu.

Zbog toga se najvažnija scope pravila ponavljaju pri kraju konteksta:

```text
Retailer-only
Frontend-only
Exactly 10 weeks
No backend
No additional features outside the Game Spec
```

---

# 8. Dodat strukturisani ugovor igre

Tokom Week 3 uveden je i strukturisani ugovor za važne parametre igre.

Izabrani ugovor je:

```ts
type GameConfig = {
  totalWeeks: 10;
  shippingDelayWeeks: 2;
  inventoryCostPerUnit: number;
  backorderCostPerUnit: number;
};
```

Obavezne vrednosti su:

```text
totalWeeks = 10
shippingDelayWeeks = 2
inventoryCostPerUnit = 0.5
backorderCostPerUnit = 1.0
```

---

# 9. Validan strukturisani primer

Definisan je validan primer konfiguracije:

```ts
const validConfig: GameConfig = {
  totalWeeks: 10,
  shippingDelayWeeks: 2,
  inventoryCostPerUnit: 0.5,
  backorderCostPerUnit: 1.0,
};
```

Očekivano ponašanje:

```text
Runtime validacija prolazi.
Simulacija može da se pokrene.
```

---

# 10. Nevalidan strukturisani primer

Definisan je i nevalidan primer:

```ts
const invalidConfig = {
  totalWeeks: 30,
  shippingDelayWeeks: -1,
  inventoryCostPerUnit: "0.5",
  backorderCostPerUnit: null,
};
```

Očekivano ponašanje:

```text
Runtime validacija pada.
Simulacija ne sme da se pokrene.
```

Sistem ne sme neprimetno da:

- pretvori `"0.5"` u `0.5`;
- prihvati `30` nedelja;
- ignoriše nedostajuće ili nevalidno polje;
- nastavi sa delimično validnom konfiguracijom.

---

# 11. Zahtev za Runtime validaciju

Važna odluka u Week 3 bila je da TypeScript tip sam po sebi nije dokaz validacije.

Na primer:

```ts
const config = rawInput as GameConfig;
```

nije dovoljno.

Implementacija mora imati runtime validaciju ili ekvivalentnu proveru.

Mogući dizajn:

```ts
function validateGameConfig(input: unknown): GameConfig {
  // runtime validacija
}
```

Validator mora proveriti najmanje:

```text
totalWeeks === 10
shippingDelayWeeks === 2
inventoryCostPerUnit === 0.5
backorderCostPerUnit === 1.0
sva obavezna polja postoje
numeričke vrednosti su validni konačni brojevi
```

Ovim se odvaja:

```text
compile-time typing
```

od:

```text
runtime validation
```

---

# 12. Napravljen Mini Eval skup

Kreiran je poseban fajl:

```text
EVALS.md
```

Svrha eval skupa je da definiše očekivano ponašanje **pre nego što se vidi rezultat implementacije**.

Eval struktura koristi:

| ID | Scenario | Očekivanje | Baseline | Posle izmene | Status |
|---|---|---|---|---|---|

Dozvoljeni statusi su:

```text
PASS
FAIL
BLOCKED
NOT RUN
```

Eval ne sme biti označen kao `PASS` osim ako je stvarno izvršen i posmatran.

---

# 13. Pokrivene obavezne kategorije evala

Week 3 eval skup sadrži više od minimalna četiri obavezna slučaja.

Uključuje:

## Tipičan scenario

Primer:

```text
E1 — Normalan start aplikacije
```

Očekivano:

- prikazuje se Week 1;
- demand je vidljiv;
- inventory je vidljiv;
- backorders su vidljivi;
- incoming shipment je vidljiv;
- order input je dostupan;
- troškovi su vidljivi.

---

## Boundary scenario

Primer:

```text
E2 — Kraj Week 10
```

Očekivano:

- simulacija se završava nakon Week 10;
- Week 11 gameplay ne postoji;
- dodatne porudžbine nisu moguće;
- prikazuje se completion screen.

---

## Nevalidan scenario

Primer:

```text
E3 — Invalid GameConfig
```

Očekivano:

- runtime validacija odbija config;
- simulacija se ne inicijalizuje;
- nevalidne vrednosti se ne ispravljaju tiho.

---

## Raniji propust

Primer:

```text
E4 — konflikt 30 nedelja vs 10 nedelja
```

Ovo je prvi dokumentovani baseline failure.

---

# 14. Identifikovan stvarni Baseline problem

Najmanje jedan eval je morao da pokaže stvaran problem u baseline verziji.

Dokumentovani baseline failure je:

```text
E4
```

Ranija specifikacija je sadržala oba zahteva:

```text
30 weeks
```

i:

```text
simulation ends after Week 10
```

Zbog toga je baseline rezultat:

```text
FAIL
```

jer zahtev nije bio jednoznačan.

Nakon izmene:

```text
GAME_SPEC.md
BUILD_PROMPT_V1.md
CONTEXT_MANIFEST.md
```

svi koriste:

```text
exactly 10 weeks
```

Zbog toga je specification-level rezultat nakon izmene:

```text
PASS
```

Ovaj eval pokazuje stvarno poboljšanje pre/posle.

Važno: ovo još ne dokazuje da runtime aplikacija zaista završava nakon Week 10.

To mora biti provereno posebno tokom implementacije.

---

# 15. Dodatni gameplay evali

Eval skup takođe uključuje provere za:

```text
E5  — validna porudžbina
E6  — nulta porudžbina
E7  — negativna porudžbina
E8  — nenumerička porudžbina
E9  — shipping delay od 2 nedelje
E10 — nastanak backorder-a
E11 — ispunjavanje postojećeg backorder-a
E12 — inventory cost
E13 — backorder cost
E14 — akumulacija Total Cost
E15 — validan GameConfig
E16 — nevalidan 30-week GameConfig
E17 — nevalidan shipping delay
E18 — nevalidan runtime tip
E19 — nepotpun GameConfig
E20 — Retailer-only scope
E21 — frontend-only ponašanje
E22 — final summary
E23 — porudžbina nakon završetka igre
E24 — konzistentnost inventory/backorder state-a
```

Predloženi su i dodatni regression testovi za buduće run-ove.

---

# 16. Primeri Cost evala

Definisan je deterministički test za inventory cost.

Input:

```text
ending inventory = 8
backorders = 0
```

Očekivano:

```text
Inventory Cost = 8 × 0.50 = $4.00
Backorder Cost = $0.00
Weekly Cost = $4.00
```

Drugi test proverava:

```text
inventory = 0
backorders = 6
```

Očekivano:

```text
Inventory Cost = $0.00
Backorder Cost = 6 × $1.00 = $6.00
Weekly Cost = $6.00
```

Ovi evali su korisni jer je očekivani rezultat deterministički i lako proverljiv.

---

# 17. Primer Shipping evala

Definisan je scenario za proveru shipping delay-a.

Scenario:

```text
Week 1:
Order Quantity = 5
```

Očekivano:

```text
5 jedinica ne sme odmah postati dostupno.
```

Implementacija mora poštovati:

```text
2-week shipping delay
```

Ako se inventory odmah poveća za 5 u istoj nedelji, eval mora pasti.

---

# 18. Definisan Definition of Done

Build specifikacija sada ima jasan Definition of Done.

Aplikacija se ne smatra završenom samo zato što se UI prikazuje.

Mora takođe ispuniti:

## Aplikacija

```text
npm install
npm run dev
npm run build
```

i bez TypeScript grešaka.

---

## Gameplay

Mora da radi:

- start u Week 1;
- tačno 10 nedelja;
- Retailer-only gameplay;
- demand updates;
- inventory updates;
- backorder updates;
- validan order input;
- odbijanje negativnih porudžbina;
- delayed shipments;
- prikaz incoming shipment-a;
- backorder fulfillment.

---

## Troškovi

Mora biti ispravno:

- Inventory Cost;
- Backorder Cost;
- Weekly Cost;
- Total Cost.

---

## Strukturisani ugovor

Mora postojati:

- `GameConfig` ili ekvivalent;
- validan primer;
- nevalidan primer;
- runtime validacija;
- failure behavior za nevalidnu konfiguraciju.

---

## Završetak igre

Nakon Week 10 aplikacija mora prikazati:

```text
Simulation Complete
```

i:

- Final Total Cost;
- Average Weekly Inventory;
- Total Backordered Units;
- Maximum Backorder;
- Total Customer Demand;
- Total Units Sold;
- Service Level.

---

# 19. Definisan Coding Agent workflow

Definisan je i workflow za korišćenje Codex-a ili drugog coding agenta.

Preporučeni redosled čitanja je:

```text
1. CONTEXT_MANIFEST.md
2. GAME_SPEC.md
3. BUILD_PROMPT_V1.md
4. EVALS.md
```

Agent zatim treba da pregleda postojeći repozitorijum.

Pre izmene koda treba da vrati:

```text
1. Razumevanje zadatka
2. Relevantne projektne fajlove
3. Plan implementacije
4. Nejasnoće
5. Fajlove koje očekuje da menja
6. Pristup runtime validaciji
7. Pristup shipping pipeline-u
8. Kako će proveriti završetak nakon 10 nedelja
```

Tek nakon toga treba da počne implementacija.

---

# 20. Preporučeni Development Flow

Week 3 workflow za AI-assisted implementaciju je:

```text
STEP 1
Agent čita Context Manifest, Game Spec, Build Prompt i Evals

        ↓

STEP 2
Agent pregleda repozitorijum

        ↓

STEP 3
Agent vraća razumevanje + plan

        ↓

STEP 4
Implementacija

        ↓

STEP 5
Build / TypeScript / testovi

        ↓

STEP 6
Pokretanje EVALS.md

        ↓

STEP 7
Zapis PASS / FAIL / BLOCKED / NOT RUN

        ↓

STEP 8
Ispravka najmanjeg failing behavior-a

        ↓

STEP 9
Ponovno pokretanje istog evala
```

Ovo daje ponovljiviji proces nego jednostavan zahtev:

```text
"Build the game."
```

---

# 21. Šta je stvarno urađeno tokom Week 3

Sledeći projektni artefakti su stvarno napravljeni ili ažurirani:

```text
BUILD_PROMPT_V1.md
CONTEXT_MANIFEST.md
EVALS.md
```

Game Spec je takođe ažuriran tako da finalno trajanje igre bude:

```text
tačno 10 nedelja
```

Build prompt i context manifest su zatim ažurirani da budu usklađeni sa ovom odlukom.

U specifikacije je dodat strukturisani `GameConfig` ugovor i zahtev za runtime validaciju.

Napravljen je mini eval framework sa:

- expected behavior;
- baseline kolonom;
- after-change kolonom;
- statusom;
- stvarnim baseline failure-om;
- gameplay scenarijima;
- invalid-input scenarijima;
- cost scenarijima;
- scope scenarijima;
- structured-config scenarijima.

---

# 22. Šta je testirano tokom Week 3

Važno je razlikovati proveru specifikacije od runtime testiranja aplikacije.

## Stvarno provereno na nivou dokumentacije/specifikacije

Sledeći problem je stvarno verifikovan i ispravljen:

```text
konflikt 30 nedelja vs 10 nedelja
```

Baseline:

```text
FAIL
```

Nakon ažuriranja dokumentacije:

```text
PASS
```

Aktuelni radni dokumenti sada konzistentno definišu:

```text
tačno 10 nedelja
```

---

## Još nije izvršeno nad finalnom aplikacijom

Sledeći runtime testovi su definisani, ali još nisu pokrenuti:

- normalan start aplikacije;
- ponašanje shipping delay-a;
- obrada negativne porudžbine;
- prenos backorder-a;
- fulfillment backorder-a;
- cost kalkulacije u running aplikaciji;
- final completion screen;
- runtime `GameConfig` validator;
- final Service Level kalkulacija;
- sprečavanje Week 11;
- sprečavanje order submit-a nakon završetka.

Oni ostaju:

```text
NOT RUN
```

dok aplikacija ne bude implementirana i provere stvarno izvršene.

Ne smeju se prijaviti kao `PASS` pre toga.

---

# 23. Šta još nije implementirano

Na kraju dokumentovanog Week 3 rada sledeće još nije dokazano kao implementirano:

- finalna igriva frontend aplikacija;
- finalni simulation engine;
- shipping queue implementacija;
- runtime config validator u production kodu;
- automatizovani test suite;
- kompletan UI;
- finalne game-summary kalkulacije.

Ovo su sledeći implementation-stage zadaci.

Week 3 je prvenstveno uspostavio specifikaciju, kontekst, strukturisani ugovor, granice i evaluacionu metodu potrebnu da se ovi delovi implementiraju bezbedno i ponovljivo.

---

# 24. Dokaz napravljen tokom Week 3

Glavni dokaz čine sledeći artefakti:

```text
BUILD_PROMPT_V1.md
```

Dokaz za:

- eksplicitan implementation scope;
- Definition of Done;
- coding-agent ograničenja.

```text
CONTEXT_MANIFEST.md
```

Dokaz za:

- izabrane izvore;
- izostavljene izvore;
- prioritet izvora;
- context rizike.

```text
EVALS.md
```

Dokaz za:

- unapred definisana očekivanja;
- baseline failure;
- planiranu validaciju;
- eksplicitna PASS/FAIL pravila.

Ključno poboljšanje je to što buduće tvrdnje poput:

```text
"Igra radi."
```

sada moraju biti podržane posmatranim eval rezultatima.

---

# 25. Ishod Week 3

Glavni rezultat Week 3 nije bilo dodavanje još funkcionalnosti.

Glavni rezultat je pretvaranje projekta iz neformalnog development zahteva u **ograničen, verzionisan i testabilan AI-assisted engineering task**.

Pre Week 3 važni zahtevi su mogli postojati na više mesta i biti međusobno konfliktni.

Nakon Week 3 projekat ima:

```text
jasan Game Spec
verzionisan Build Prompt
Context Manifest
strukturisani GameConfig contract
runtime-validation zahteve
Definition of Done
Mini Eval skup
dokumentovan baseline failure
ponovljiv coding-agent workflow
```

---

# 26. Poznato ograničenje

Najveće trenutno ograničenje je:

> Većina gameplay evala je definisana, ali još nije izvršena nad finalnom implementacijom.

Zato ispravan zaključak nije:

```text
"Kompletna igra je testirana i sve radi."
```

Precizniji zaključak je:

> Tokom Week 3 formalizovani su scope projekta, kontekst, strukturisani ugovor i evaluacioni kriterijumi. Identifikovan je i ispravljen stvarni konflikt u specifikaciji. Runtime gameplay evali su sada unapred definisani i spremni za pokretanje nakon implementacije.

---

# 27. Sledeći korak

Sledeći development korak je:

```text
Implementirati Retailer MVP koristeći BUILD_PROMPT_V1.md
```

dok se coding agentu obezbeđuje kontekst definisan u:

```text
CONTEXT_MANIFEST.md
```

a zatim pokreće:

```text
EVALS.md
```

nad stvarnom aplikacijom.

Proces treba da ostane:

```text
mala izmena
→ isti eval
→ posmatrani rezultat
→ dokaz
```

umesto menjanja više slojeva odjednom.

---

# 28. Završni sažetak Week 3

Tokom Week 3 Beer Distribution Game projekat je pretvoren u kontrolisan AI-assisted development task.

Završeni rad uključuje:

- sužavanje MVP-a na Retailer-only frontend igru;
- finalizaciju pravila od 10 nedelja;
- definisanje shipping delay-a od 2 nedelje;
- definisanje inventory i backorder troškova;
- kreiranje `BUILD_PROMPT_V1.md`;
- kreiranje `CONTEXT_MANIFEST.md`;
- definisanje source precedence-a;
- dokumentovanje context-rot rizika;
- dodavanje strukturisanog `GameConfig`;
- zahtev za runtime validacijom;
- definisanje validnog i nevalidnog config primera;
- kreiranje `EVALS.md`;
- definisanje više od četiri evaluaciona scenarija;
- dokumentovanje stvarnog baseline failure-a;
- definisanje Definition of Done;
- definisanje kako Codex treba da čita projekat i implementira task;
- jasno odvajanje testiranih činjenica od testova koji su i dalje `NOT RUN`.

Projekat je sada spreman za fazu implementacije i prikupljanja dokaza.
