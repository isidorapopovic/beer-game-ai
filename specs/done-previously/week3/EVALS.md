# EVALS.md

# Mini eval skup — Beer Distribution Game / Retailer MVP

## 1. Svrha

Ovaj dokument definiše mali, ponovljiv eval skup za proveru Retailer MVP verzije Beer Distribution Game-a.

Eval skup je izveden iz:

- aktuelnog `GAME_SPEC.md`;
- `BUILD_PROMPT_V1.md`;
- `CONTEXT_MANIFEST.md`.

Cilj nije samo da se proveri da li aplikacija može da se pokrene, već i da li se ponaša u skladu sa pravilima igre.

Posebno proveravamo:

- početak i završetak simulacije;
- trajanje od tačno 10 nedelja;
- Retailer-only scope;
- customer demand;
- inventory;
- backorders;
- order quantity;
- shipping delay od 2 nedelje;
- incoming shipments;
- inventory i backorder troškove;
- weekly i total cost;
- završne metrike;
- strukturisani `GameConfig`;
- runtime validaciju;
- ponašanje na nevalidan input;
- ranije poznate propuste.

---

# 2. Pravilo korišćenja eval skupa

Pre pokretanja svakog evala mora biti zapisano:

```text
Očekivanje
```

Tek nakon pokretanja popunjavaju se:

```text
Baseline
Posle izmene
Status
```

Ne menjati očekivanje nakon što se vidi rezultat samo da bi test prošao.

Dozvoljeni statusi:

```text
PASS
FAIL
BLOCKED
NOT RUN
```

Značenje:

- `PASS` — stvarni rezultat odgovara unapred definisanom očekivanju;
- `FAIL` — stvarni rezultat ne odgovara očekivanju;
- `BLOCKED` — eval nije moguće izvršiti zbog konkretnog tehničkog blokera;
- `NOT RUN` — eval još nije pokrenut.

Ne označavati `PASS` ako test nije stvarno izvršen.

---

# 3. Kontekst eval run-a

Za svaki ozbiljan run treba zabeležiti:

```text
Build Prompt:
BUILD_PROMPT_V1.md

Context Manifest:
CONTEXT_MANIFEST.md

Game Spec:
current GAME_SPEC.md

Game duration:
10 weeks

Player role:
Retailer only

Shipping delay:
2 weeks

Inventory cost:
$0.50 / unit / week

Backorder cost:
$1.00 / unit / week
```

Ako se bilo koji od ovih izvora promeni, zabeležiti novu verziju ili commit pre ponovnog eval run-a.

---

# 4. Glavna eval tabela

| ID | Tip | Ulaz ili scenario | Očekivanje pre pokretanja | Baseline | Posle izmene | Status |
|---|---|---|---|---|---|---|
| E1 | Tipičan | Normalan start aplikacije | Simulacija počinje u Week 1; prikazani su demand, inventory, backorders, incoming shipment, previous order, weekly cost, total cost i Order Quantity input | NOT RUN | HTTP smoke check returned 200 for app shell and transformed modules; browser rendering was not run | NOT RUN |
| E2 | Boundary | Završetak Week 10 | Week 10 je poslednja nedelja; nakon završetka nema novih porudžbina; prikazuje se `Simulation Complete` i završne metrike | NOT RUN | Automated test: 10 turns complete at Week 10; further submit returns unchanged state; completion UI branch builds | PASS |
| E3 | Nevalidan | Nevalidan `GameConfig` | Runtime validacija odbija config; simulacija se ne pokreće; nema tihog coercion-a ili nastavka sa pogrešnim vrednostima | NOT RUN | Automated tests reject invalid duration, delay, cost type, and missing property before initialization | PASS |
| E4 | Raniji propust | Trajanje igre je bilo konfliktno: 30 vs 10 nedelja | Aktuelni izvori moraju jednoznačno definisati tačno 10 nedelja; stara 30-week referenca ne sme uticati na build | FAIL — raniji baseline je sadržao konflikt 30 vs 10 | Current Game Spec, Build Prompt, and Context Manifest specify 10 weeks; old reference is classified stale | PASS |
| E5 | Tipičan | Validan Order Quantity, npr. `5` | Porudžbina se prihvata, previous order se ažurira, simulacija napreduje po pravilima | NOT RUN | Automated test submits 5, advances one week, and verifies Previous Order | PASS |
| E6 | Boundary | Order Quantity = `0` | `0` je validna nenegativna porudžbina; simulacija je prihvata bez greške | NOT RUN | Automated pipeline test submits 0 and advances normally | PASS |
| E7 | Nevalidan | Order Quantity = `-1` | Input se odbija; nedelja se ne menja; state se ne korumpira | NOT RUN | Automated test rejects -1 and confirms the original week remains unchanged | PASS |
| E8 | Nevalidan | Order Quantity nije broj | Input se odbija; simulacija ne napreduje; ne nastaje `NaN` u state-u ili troškovima | NOT RUN | Automated test rejects NaN; the UI also rejects an empty numeric input before transition | PASS |
| E9 | Gameplay | Order postavljen u Week 1 | Porudžbina ne stiže odmah; shipping delay je tačno 2 nedelje | NOT RUN | Automated test verifies no Week 2 arrival and receipt in Week 3 | PASS |
| E10 | Gameplay | Nema dovoljno inventory-ja za demand | Dostupan inventory se koristi; neispunjena potražnja postaje backorder | NOT RUN | Automated test: inventory 3, demand 8 produces 5 backorders | PASS |
| E11 | Gameplay | Postoji backorder, zatim stiže shipment | Novi inventory prvo omogućava ispunjavanje postojećeg backorder-a prema Game Spec pravilima | NOT RUN | Automated test verifies arriving stock clears existing backorders before current demand | PASS |
| E12 | Trošak | Ending inventory = 8, backorders = 0 | Inventory Cost = `8 × 0.50 = $4.00`; Backorder Cost = `$0`; Weekly Cost = `$4.00` | NOT RUN | Automated test returns weekly cost 4 for inventory 8 and no backorders | PASS |
| E13 | Trošak | Ending inventory = 0, backorders = 6 | Inventory Cost = `$0`; Backorder Cost = `6 × 1.00 = $6.00`; Weekly Cost = `$6.00` | NOT RUN | Automated test returns weekly cost 6 for 6 backorders | PASS |
| E14 | Trošak | Više od jedne odigrane nedelje | Total Cost je zbir svih prethodnih Weekly Cost vrednosti, bez resetovanja između nedelja | NOT RUN | Automated test verifies Week 1 cost 6 plus Week 2 cost 4 gives total cost 10 | PASS |
| E15 | Structured contract | Validan `GameConfig` | Runtime validator prihvata config sa 10 nedelja, delay 2, inventory cost 0.5 i backorder cost 1.0 | NOT RUN | Automated test validates the shipped configuration | PASS |
| E16 | Structured contract | `totalWeeks: 30` | Runtime validator odbija config; ne pokreće se alternativni 30-week mode | NOT RUN | Automated test rejects totalWeeks 30 during game initialization | PASS |
| E17 | Structured contract | `shippingDelayWeeks: -1` | Runtime validator odbija config | NOT RUN | Automated test rejects a negative shipping delay | PASS |
| E18 | Structured contract | `inventoryCostPerUnit: "0.5"` | String se ne prihvata kao broj i ne pretvara se tiho u `0.5` | NOT RUN | Automated test rejects the string cost value | PASS |
| E19 | Structured contract | Nedostaje obavezno config polje | Runtime validator odbija nepotpun objekat; simulacija se ne inicijalizuje | NOT RUN | Automated test rejects the config with a missing cost property | PASS |
| E20 | Scope | UI ili state pokušava da uvede Wholesaler/Distributor/Factory kontrolu | Igrač kontroliše samo Retailer-a; dodatne igrive role nisu deo MVP-a | NOT RUN | Source review found only the Retailer role and no controls for other stages | PASS |
| E21 | Scope | Provera mrežnih/backend zavisnosti | MVP radi bez backenda, baze, autentifikacije i API poziva za osnovni gameplay | NOT RUN | Source/package review found no backend, API, auth, or persistence dependency | PASS |
| E22 | Completion | Final summary nakon Week 10 | Prikazani su Final Total Cost, Average Weekly Inventory, Total Backordered Units, Maximum Backorder, Total Customer Demand, Total Units Sold i Service Level | NOT RUN | Summary data and all required labels are implemented; browser rendering was not run | NOT RUN |
| E23 | Boundary | Pokušaj order submit-a nakon završetka | Order input/submit više ne menja game state | NOT RUN | Automated test verifies a post-completion submit returns the same state | PASS |
| E24 | State integrity | Inventory i backorders nakon iste nedelje | Iste jedinice se ne broje istovremeno kao dostupni inventory i backorder | NOT RUN | Automated shortage/replenishment test verifies remaining inventory and backorders are disjoint | PASS |

---

# 5. Detaljni eval slučajevi

## E1 — Normalan početak

### Kategorija

```text
Tipičan scenario
```

### Početni uslovi

Pokrenuti aplikaciju sa validnim `GameConfig`.

### Očekivanje pre pokretanja

Simulacija mora:

1. početi u `Week 1`;
2. prikazati Customer Demand;
3. prikazati Inventory;
4. prikazati Backorders;
5. prikazati Incoming Shipment;
6. prikazati Previous Order;
7. prikazati Order Quantity input;
8. prikazati dugme za potvrdu;
9. prikazati Weekly Cost;
10. prikazati Total Cost.

Ne sme zahtevati backend da bi osnovna igra počela.

### Baseline

```text
NOT RUN
```

### Posle izmene

```text
HTTP 200 for /, /src/App.tsx, and /src/game/gameEngine.ts. Browser-rendered state was not inspected.
```

### Status

```text
NOT RUN
```

---

# 6. E2 — Granica trajanja igre

## Scenario

Igrač normalno prolazi kroz simulaciju do Week 10.

### Očekivanje pre pokretanja

Igra traje:

```text
tačno 10 nedelja
```

Posle završetka Week 10:

- ne postoji Week 11 gameplay;
- više nije moguće slati order;
- prikazuje se `Simulation Complete`;
- prikazuje se finalni Total Cost;
- prikazuju se završne metrike.

### Negativna provera

Sledeće ponašanje znači `FAIL`:

```text
currentWeek === 11
```

u aktivnoj simulaciji.

Takođe je `FAIL` ako aplikacija nastavi da prihvata porudžbine posle završetka.

### Baseline

```text
NOT RUN
```

### Posle izmene

```text
Automated test completed 10 turns at Week 10; subsequent submit returned the identical state. Completion UI branch is present and build passes.
```

### Status

```text
PASS
```

---

# 7. E3 — Nevalidan GameConfig

## Scenario

Aplikaciji se prosledi:

```ts
const invalidConfig = {
  totalWeeks: 30,
  shippingDelayWeeks: -1,
  inventoryCostPerUnit: "0.5",
  backorderCostPerUnit: null,
};
```

### Očekivanje pre pokretanja

Runtime validator mora odbiti konfiguraciju.

Simulacija:

```text
ne sme da se pokrene
```

Ne sme:

- da koristi `30`;
- da pretvori `"0.5"` u `0.5`;
- da ignoriše `null`;
- da nastavi sa delimično validnim config-om.

Mora postojati jasan failure signal kroz postojeći error-handling mehanizam, development output ili UI.

### Baseline

```text
NOT RUN
```

### Posle izmene

```text
Automated tests rejected totalWeeks 30, negative shipping delay, string cost, and missing property before game initialization.
```

### Status

```text
PASS
```

---

# 8. E4 — Raniji stvarni baseline propust

## Scenario

Ranija verzija zahteva sadržala je dve različite vrednosti za trajanje igre:

```text
30 weeks
```

i:

```text
simulation ends after Week 10
```

Ovo je bio stvaran `context clash`.

### Očekivanje pre izmene

Jedan autoritativan zahtev mora definisati trajanje igre.

### Baseline rezultat

```text
FAIL
```

Razlog:

```text
Baseline specifikacija nije jednoznačno određivala trajanje igre.
```

Agent je mogao da implementira 10 ili 30 nedelja u zavisnosti od izvora koji je pratio.

### Izmena

Aktuelni:

```text
GAME_SPEC.md
BUILD_PROMPT_V1.md
CONTEXT_MANIFEST.md
```

definišu:

```text
Game duration = exactly 10 weeks
```

Reference na 30 nedelja smatraju se zastarelim.

### Rezultat posle izmene

```text
PASS
```

### Šta ovaj eval dokazuje?

Dokazuje da je konkretan konflikt specifikacije uklonjen.

### Šta ovaj eval ne dokazuje?

Ne dokazuje sam po sebi da runtime aplikacija zaista završava nakon Week 10.

To posebno proverava `E2`.

---

# 9. E5 — Normalna porudžbina

## Input

```text
Order Quantity = 5
```

### Očekivanje

- input je validan;
- order se prihvata;
- vrednost postaje deo shipping pipeline-a;
- ne stiže trenutno;
- Previous Order se ažurira prema gameplay flow-u;
- game state napreduje samo jednom.

### FAIL primer

```text
Order = 5
Incoming Shipment odmah postane 5 u istoj nedelji
```

To bi prekršilo shipping delay.

---

# 10. E6 — Nulta porudžbina

## Input

```text
Order Quantity = 0
```

### Očekivanje

Pošto je zahtev:

```text
Order Quantity cannot be negative
```

`0` je dozvoljena vrednost.

Simulacija treba normalno da obradi nedelju sa porudžbinom od nula jedinica.

### FAIL primer

Aplikacija odbija `0` samo zato što nije pozitivan broj.

---

# 11. E7 — Negativna porudžbina

## Input

```text
Order Quantity = -1
```

### Očekivanje

- input je odbijen;
- current week ostaje isti;
- shipping pipeline ostaje isti;
- total cost se ne duplira;
- state ne napreduje.

### FAIL primer

UI prikaže grešku, ali ipak izvrši weekly transition.

---

# 12. E8 — Nenumerički order input

## Input

Primer:

```text
abc
```

ili stanje koje bi proizvelo:

```ts
NaN
```

### Očekivanje

Input se ne prihvata.

Ne sme se pojaviti:

```text
NaN
```

u:

- inventory;
- backorders;
- incoming shipment;
- Weekly Cost;
- Total Cost.

---

# 13. E9 — Shipping delay od dve nedelje

## Scenario

U Week 1 igrač poruči:

```text
5 units
```

### Očekivanje

Porudžbina ne sme biti raspoloživa odmah.

Pipeline mora poštovati:

```text
Shipping Delay = 2 weeks
```

Tačan trenutak prikaza i prijema treba pratiti redosled definisan u Game Spec-u, ali u svakom slučaju shipment ne sme biti dodat inventory-ju u istoj nedelji kada je naručen.

### FAIL primer

```text
Week 1:
Order = 5
Inventory immediately increases by 5
```

---

# 14. E10 — Kreiranje backorder-a

## Scenario

Primer:

```text
available inventory = 3
customer demand = 8
existing backorder = 0
```

### Očekivanje

Najviše 3 jedinice trenutne potražnje može biti ispunjeno iz raspoloživog inventory-ja.

Preostalih:

```text
5 units
```

mora ostati kao backorder, osim ako Game Spec za konkretni weekly ordering flow definiše dodatni relevantni state koji menja račun.

Neispunjena potražnja ne sme nestati.

---

# 15. E11 — Ispunjavanje postojećeg backorder-a

## Scenario

Postoji backorder, a kasnije stiže shipment.

### Očekivanje

Kada roba postane dostupna, postojeći backorder mora biti ispunjen.

Backorder ne sme ostati nepromenjen ako postoji dovoljno raspoloživog inventory-ja da ga pokrije.

### Dodatna provera

Nakon fulfillment-a iste jedinice ne smeju ostati zabeležene i kao:

```text
inventory
```

i kao:

```text
backorder
```

---

# 16. E12 — Inventory cost

## Scenario

Na kraju nedelje:

```text
ending inventory = 8
ending backorders = 0
```

### Očekivanje

```text
Inventory Cost = 8 × $0.50 = $4.00
Backorder Cost = 0 × $1.00 = $0.00
Weekly Cost = $4.00
```

### FAIL primer

Weekly Cost = `$8.00`.

To bi značilo da je korišćena pogrešna cena inventory-ja.

---

# 17. E13 — Backorder cost

## Scenario

Na kraju nedelje:

```text
ending inventory = 0
ending backorders = 6
```

### Očekivanje

```text
Inventory Cost = $0.00
Backorder Cost = 6 × $1.00 = $6.00
Weekly Cost = $6.00
```

---

# 18. E14 — Total Cost akumulacija

## Scenario

Pretpostavimo da su Weekly Cost vrednosti:

```text
Week 1 = $4
Week 2 = $6
Week 3 = $3
```

### Očekivanje

Nakon Week 3:

```text
Total Cost = $13
```

Ne sme biti:

```text
$3
```

jer Total Cost nije samo poslednji Weekly Cost.

---

# 19. E15 — Validan strukturisani config

## Input

```ts
const config = {
  totalWeeks: 10,
  shippingDelayWeeks: 2,
  inventoryCostPerUnit: 0.5,
  backorderCostPerUnit: 1.0,
};
```

### Očekivanje

Runtime validator vraća validan `GameConfig` ili ekvivalentan uspešan rezultat.

Simulacija može da se inicijalizuje.

---

# 20. E16 — Stara vrednost od 30 nedelja

## Input

```ts
{
  totalWeeks: 30,
  shippingDelayWeeks: 2,
  inventoryCostPerUnit: 0.5,
  backorderCostPerUnit: 1.0,
}
```

### Očekivanje

```text
REJECT
```

Ne postoji 30-week mode u trenutnom MVP-u.

### Važna semantička provera

Ako TypeScript shape prođe zbog preširokog tipa, runtime validator i dalje mora odbiti ovu vrednost.

---

# 21. E17 — Nevalidan shipping delay

## Input

```ts
shippingDelayWeeks: -1
```

### Očekivanje

Config je nevalidan.

Simulacija se ne pokreće.

---

# 22. E18 — Pogrešan runtime tip

## Input

```ts
inventoryCostPerUnit: "0.5"
```

### Očekivanje

Validator odbija string.

Ne sme se koristiti implicitno:

```ts
Number("0.5")
```

kao tiha korekcija, osim ako bi takva normalizacija jednog dana bila eksplicitno deo specifikacije.

Trenutno nije.

---

# 23. E19 — Nepotpun config

## Input

```ts
{
  totalWeeks: 10,
  shippingDelayWeeks: 2,
  inventoryCostPerUnit: 0.5
}
```

Nedostaje:

```text
backorderCostPerUnit
```

### Očekivanje

Runtime validator odbija objekat.

Simulacija se ne pokreće.

---

# 24. E20 — Retailer-only scope

## Scenario

Pregledati UI i gameplay.

### Očekivanje

Igrač može da kontroliše samo:

```text
Retailer
```

Ne postoje user controls za:

```text
Wholesaler
Distributor
Factory
```

Njihovo dodavanje bi bilo scope expansion.

---

# 25. E21 — Frontend-only

## Scenario

Pokrenuti MVP u njegovom predviđenom lokalnom frontend okruženju.

### Očekivanje

Core gameplay ne zahteva:

- backend server;
- bazu;
- login;
- API credentials;
- cloud service.

Ako aplikacija ne može da odigra osnovnu simulaciju bez backenda, eval pada.

---

# 26. E22 — Final summary

## Scenario

Završiti Week 10.

### Očekivanje

Prikazati:

```text
Simulation Complete
```

i najmanje:

- Final Total Cost;
- Average Weekly Inventory;
- Total Backordered Units;
- Maximum Backorder;
- Total Customer Demand;
- Total Units Sold;
- Service Level.

Nedostajanje bilo koje obavezne metrike znači `FAIL`.

---

# 27. E23 — Pokušaj porudžbine nakon završetka

## Scenario

Simulacija je završena.

Korisnik pokuša da promeni input ili potvrdi novu porudžbinu.

### Očekivanje

Game state više ne napreduje.

Ne sme nastati:

```text
Week 11
```

Ne sme se dodati nova pošiljka u pipeline.

---

# 28. E24 — Konzistentnost inventory/backorder state-a

## Scenario

Proveriti state nakon shortage i nakon kasnijeg shipment-a.

### Očekivanje

Jedna ista jedinica ne sme istovremeno biti računata kao:

```text
available inventory
```

i:

```text
unfulfilled backorder
```

Ovo je semantička provera, a ne samo TypeScript ili build provera.

---

# 29. Obavezni baseline problem

Minimalni eval zahtev kaže:

> Najmanje jedan eval mora da pokaže stvaran problem baseline verzije.

Za ovaj skup to je:

```text
E4 — konflikt trajanja igre
```

Baseline:

```text
FAIL
```

jer su postojala dva aktivna zahteva:

```text
30 weeks
10 weeks
```

Posle izmene:

```text
PASS
```

jer aktuelni Game Spec, Build Prompt i Context Manifest definišu:

```text
exactly 10 weeks
```

Ovaj poznati baseline propust mora ostati zabeležen kao dokaz da je konkretna promena rešavala stvaran problem, a ne samo menjala tekst bez razloga.

---

# 30. Predloženi dodatni regresioni evali

Ako projekat napreduje, mogu se dodati i sledeći slučajevi:

| ID | Scenario | Očekivanje |
|---|---|---|
| E25 | Veoma velika validna Order Quantity | Nema overflow-a, `NaN` ili pucanja UI-ja |
| E26 | Više uzastopnih order-a različite veličine | Shipping pipeline čuva ispravan redosled |
| E27 | Više nedelja backorder-a | Backorder se prenosi, ne nestaje između nedelja |
| E28 | Shipment veći od backorder-a | Backorder ide na 0, ostatak ostaje inventory |
| E29 | Demand = 0 | Nema lažnog backorder-a; ostali state se ažurira konzistentno |
| E30 | Inventory = 0 i Demand > 0 | Cela neispunjena količina postaje backorder |
| E31 | Refresh/reload tokom igre | Ponašanje prati frontend-only specifikaciju; persistence se ne očekuje ako nije definisan |
| E32 | Dvostruki klik na submit | Jedna korisnička akcija ne bi smela nenamerno da odigra dve nedelje |
| E33 | Build verification | `npm run build` prolazi bez TypeScript grešaka |
| E34 | Dev verification | `npm run dev` uspešno pokreće aplikaciju na localhost-u |

Ovi dodatni slučajevi ne proširuju gameplay scope. Oni proveravaju robusnost već definisanog ponašanja.

---

# 31. Eval run zapis

Za svaki run kopirati i popuniti:

```text
Run ID:
Date:
Commit / version:

GAME_SPEC version:
BUILD_PROMPT version:
CONTEXT_MANIFEST version:

Commands executed:
- ...

Eval IDs executed:
- ...

PASS:
- ...

FAIL:
- ...

BLOCKED:
- ...

Unexpected behavior:
- ...

Changed after baseline:
- ...

Known limitations:
- ...
```

---

# 32. Pravilo za izmene nakon FAIL-a

Ako eval padne:

1. zabeležiti stvarni rezultat;
2. klasifikovati problem;
3. napraviti najmanju opravdanu izmenu;
4. ne menjati očekivanje osim ako se promenio autoritativni Game Spec;
5. ponovo pokrenuti isti eval;
6. zabeležiti rezultat u `Posle izmene`.

Primer:

```text
E9
Expected:
order does not arrive immediately

Baseline:
shipment added in same week

Status:
FAIL

Change:
fixed shipping pipeline indexing

After:
shipment respects 2-week delay

Status:
PASS
```

---

# 33. Šta se smatra dokazom

Sledeće samo po sebi nije dovoljno:

```text
"izgleda da radi"
```

Bolji dokaz je:

```text
E12:
ending inventory = 8
expected weekly cost = $4.00
actual weekly cost = $4.00
PASS
```

Za runtime config:

```text
E16:
totalWeeks = 30
expected = reject
actual = validation error, simulation not initialized
PASS
```

Za boundary:

```text
E23:
simulation completed after Week 10
attempted additional submit
expected = state unchanged
actual = state unchanged
PASS
```

---

# 34. Završni acceptance kriterijum za eval skup

Mini eval skup je spreman kada:

- [x] postoji tipičan scenario;
- [x] postoji boundary scenario;
- [x] postoji nepotpun/nevalidan scenario;
- [x] postoji raniji stvarni propust;
- [x] očekivanje je zapisano pre rezultata;
- [x] postoji najmanje jedan dokumentovan baseline `FAIL`;
- [x] postoje gameplay evali;
- [x] postoje cost evali;
- [x] postoje shipping evali;
- [x] postoje config/runtime validation evali;
- [x] postoji scope eval;
- [x] postoji completion eval;
- [ ] aplikacioni evali su stvarno pokrenuti;
- [ ] stvarni baseline rezultati su zabeleženi;
- [ ] stvarni rezultati posle izmene su zabeleženi.

Poslednje tri stavke ostaju otvorene dok se testovi zaista ne izvrše.

---

# 35. Kritični podsetnik

Eval ne proverava samo da li aplikacija kompajlira.

Mora da proveri i da li aplikacija semantički prati pravila:

```text
Retailer only
Frontend only
Exactly 10 weeks
2-week shipping delay
Inventory cost = $0.50
Backorder cost = $1.00
No negative orders
Backorders persist until fulfilled
Runtime-validated GameConfig
No orders after completion
```

Ako build prolazi, ali jedno od ovih pravila ne radi, relevantni eval mora biti označen kao:

```text
FAIL
```
