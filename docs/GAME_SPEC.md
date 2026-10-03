# GAME_SPEC.md

# Beer Distribution Game — Retailer MVP

## 1. Naziv projekta

**Beer Distribution Game — Retailer MVP**

Interaktivna simulacija upravljanja zalihama inspirisana klasičnom **Beer Distribution Game** simulacijom lanca snabdevanja.

Ova verzija predstavlja **MVP (Minimum Viable Product)** i fokusira se isključivo na ulogu **Retailer-a**.

---

# 2. Opis igre

Beer Distribution Game je simulacija lanca snabdevanja u kojoj igrač pokušava da zadovolji potražnju kupaca uz što manje ukupne troškove.

U punoj verziji Beer Game-a lanac se sastoji od četiri nivoa:

**Retailer → Wholesaler → Distributor → Factory**

U ovoj prvoj verziji igrač kontroliše **samo Retailer-a**.

Retailer svake nedelje prima potražnju kupaca, prodaje robu iz dostupnog inventara i odlučuje koliko novih jedinica piva želi da poruči od dobavljača.

Porudžbine i isporuke ne stižu odmah, već postoji vremensko kašnjenje, zbog čega igrač mora da planira buduću potražnju i balansira između prevelikog inventara i nedostatka robe.

---

# 3. Uloga igrača

Igrač igra ulogu:

## Retailer

Retailer predstavlja poslednju kariku lanca snabdevanja pre krajnjeg kupca.

Njegov zadatak je da:

- prati trenutni inventar;
- prati potražnju kupaca;
- prati postojeće backorder-e;
- vidi koje isporuke su trenutno na putu;
- odluči koliko piva želi da poruči;
- pokušava da zadovolji potražnju kupaca;
- minimizuje ukupne troškove.

Igrač **ne kontroliše druge delove lanca snabdevanja** u ovoj verziji.

---

# 4. Glavni cilj igrača

Glavni cilj je:

> **Zadovoljiti što više potražnje kupaca uz što manji ukupni trošak inventara i backorder-a.**

Igrač mora da pronađe balans između dve situacije:

### Previše inventara

Ako Retailer ima mnogo piva na stanju, plaća trošak skladištenja.

Primer:

```text
Inventory Cost = $0.50 po jedinici / nedelji
```

### Premalo inventara

Ako Retailer nema dovoljno proizvoda da zadovolji potražnju kupaca, nastaje **backorder**.

Primer:

```text
Backorder Cost = $1.00 po jedinici / nedelji
```

Backorder je skuplji od držanja robe na stanju.

---

# 5. Kontrole igrača

Igrač tokom svake nedelje treba da ima veoma mali broj kontrola.

Glavna kontrola je:

```text
Order Quantity
```

Igrač unosi broj jedinica piva koje želi da poruči.

Na primer:

```text
Order Quantity: 8
```

Nakon toga bira:

```text
Submit Order
```

ili:

```text
Next Week
```

Nakon potvrde porudžbine simulacija prelazi na sledeću nedelju.

Igrač ne može da menja odluku nakon prelaska na sledeću nedelju.

---

# 6. Informacije koje igrač vidi

Na glavnom ekranu igrač mora da vidi najmanje sledeće informacije:

```text
Week
Customer Demand
Current Inventory
Backorders
Incoming Shipment
Previous Order
Order Quantity
Weekly Cost
Total Cost
```

Primer:

```text
Week: 6

Customer Demand: 8
Current Inventory: 12
Incoming Shipment: 4
Backorders: 0

Previous Order: 6

Order Quantity:
[ 8 ]

[ Submit Order ]

Weekly Cost: $6.00
Total Cost: $31.50
```

---

# 7. Osnovni Game Loop

Jedna runda predstavlja **jednu nedelju**.

Game loop treba da izgleda ovako:

```text
START WEEK
     ↓
Primi isporuku koja je ranije poslata
     ↓
Prikaži novu potražnju kupaca
     ↓
Pokušaj da zadovoljiš potražnju
     ↓
Ažuriraj Inventory
     ↓
Ažuriraj Backorders
     ↓
Igrač bira Order Quantity
     ↓
Porudžbina ulazi u pipeline
     ↓
Izračunaj troškove
     ↓
Pređi na sledeću nedelju
     ↓
REPEAT
```

Ovaj proces se ponavlja do kraja simulacije.

---

# 8. Trajanje igre

Za MVP simulacija traje:

```text
10 nedelja
```

Broj nedelja mora biti definisan kao konfiguraciona vrednost tako da kasnije može lako da se promeni.

Primer:

```typescript
const TOTAL_WEEKS = 10;
```

---

# 9. Pravila igre

## Pravilo 1 — Potražnja kupaca

Svake nedelje Retailer dobija određenu količinu **Customer Demand-a**.

Retailer mora pokušati da zadovolji tu potražnju iz trenutnog inventara.

---

## Pravilo 2 — Inventory

Retailer ima određeni broj jedinica proizvoda na stanju.

Ako postoji dovoljno inventara:

```text
Inventory >= Customer Demand
```

potražnja se normalno ispunjava.

Inventory se nakon prodaje smanjuje.

---

## Pravilo 3 — Backorders

Ako Retailer nema dovoljno inventara da zadovolji kompletnu potražnju:

```text
Customer Demand > Inventory
```

razlika postaje:

```text
Backorder
```

Primer:

```text
Demand = 10
Inventory = 6

Backorder = 4
```

Backorder ostaje aktivan i mora biti ispunjen kada nova roba stigne.

---

## Pravilo 4 — Porudžbine ne stižu odmah

Kada igrač napravi porudžbinu, roba ne stiže iste nedelje.

Postoji **shipping delay**.

Za MVP koristi:

```text
Shipping Delay = 2 weeks
```

Primer:

```text
Week 3:
Order = 10

Week 4:
Shipment još nije stigao.

Week 5:
10 jedinica stiže.
```

---

## Pravilo 5 — Igrač vidi samo Retailer informacije

Igrač ne zna kompletno stanje ostatka lanca snabdevanja.

Za MVP igrač vidi samo informacije relevantne za Retailer-a:

- Customer Demand
- Inventory
- Incoming Shipment
- Backorders
- Previous Order
- Weekly Cost
- Total Cost

---

## Pravilo 6 — Inventory ima cenu

Za svaku jedinicu koja ostane u inventaru na kraju nedelje obračunava se:

```text
$0.50 po jedinici
```

Formula:

```text
Inventory Cost = Ending Inventory × 0.50
```

---

## Pravilo 7 — Backorder ima cenu

Za svaku neispunjenu jedinicu obračunava se:

```text
$1.00 po jedinici
```

Formula:

```text
Backorder Cost = Backorders × 1.00
```

---

## Pravilo 8 — Cilj je minimizacija ukupnog troška

Ukupan trošak je:

```text
Weekly Cost =
Inventory Cost
+
Backorder Cost
```

A rezultat igre je:

```text
Total Cost =
sum svih Weekly Cost vrednosti
```

Što je ukupni trošak manji, to je igrač efikasnije upravljao zalihama.

---

# 10. Customer Demand za MVP

Za prvu verziju nije potrebna kompleksna ili nasumična potražnja.

Koristi unapred definisan niz.

Na primer:

```typescript
const customerDemand = [
  4, 4, 4, 4,
     8, 8, 8, 8, 8, 8
];
```

Cilj ove verzije nije pravljenje sofisticiranog demand modela.

Demand mora biti deterministički kako bi ponašanje igre moglo jednostavno da se testira.

---

# 11. Početno stanje

Za MVP koristiti jasno definisano početno stanje.

Primer:

```text
Week = 1

Inventory = 12

Backorders = 0

Incoming Shipment = 4

Previous Order = 4

Total Cost = 0
```

Sve početne vrednosti treba da budu definisane na jednom mestu u konfiguraciji igre.

---

# 12. Win / Lose uslov

Klasični Beer Distribution Game nema klasičan:

```text
YOU WIN
```

ili:

```text
GAME OVER — YOU LOSE
```

mehanizam.

Cilj je da igrač završi simulaciju sa što manjim ukupnim troškom.

Zbog toga se za MVP koristi **performance-based završetak igre**.

Nakon:

```text
Week 10
```

simulacija se završava.

Prikazuje se ekran:

```text
Simulation Complete
```

sa rezultatima:

```text
Total Cost
Average Weekly Inventory
Total Backordered Units
Maximum Backorder
Total Customer Demand
Total Units Sold
Service Level
```

Glavna vrednost rezultata je:

```text
Total Cost
```

Manji Total Cost predstavlja bolje upravljanje lancem snabdevanja.

Ne postoji klasičan "Lose" ekran.

---

# 13. Minimalni vizuelni zahtev

Aplikacija mora imati jednostavan i čist interfejs.

Nije potreban kompleksan dizajn.

Glavni ekran treba da sadrži:

```text
-----------------------------------

BEER DISTRIBUTION GAME

Week 5 / 10

Customer Demand
8

Inventory
12

Backorders
0

Incoming Shipment
4

-----------------

Your Order

[      8      ]

[ Submit Order ]

-----------------

Weekly Cost
$6.00

Total Cost
$27.50

-----------------------------------
```

Vizuelni prioritet je:

1. preglednost;
2. čitljivost;
3. jasno prikazano stanje sistema;
4. lako unošenje porudžbine.

Animacije nisu potrebne.

---

# 14. Tehnički zahtevi

Aplikacija treba da bude web aplikacija.

Koristiti:

```text
TypeScript
```

Preferirani frontend:

```text
React + TypeScript
```

Aplikacija mora moći lokalno da se pokrene komandom kao što je:

```bash
npm run dev
```

i mora biti dostupna preko lokalnog URL-a, na primer:

```text
http://localhost:5173
```

Aplikacija ne sme imati TypeScript build greške.

Komanda:

```bash
npm run build
```

mora uspešno da se izvrši.

---

# 15. Minimalna struktura aplikacije

Logika simulacije mora biti odvojena od UI-a.

Primer:

```text
src/

  components/
      GameDashboard.tsx
      OrderInput.tsx
      GameSummary.tsx

  game/
      gameEngine.ts
      gameConfig.ts
      types.ts

  App.tsx
```

`gameEngine.ts` treba da sadrži glavnu logiku simulacije.

`gameConfig.ts` treba da sadrži konfiguracione vrednosti kao što su:

```text
TOTAL_WEEKS
INITIAL_INVENTORY
SHIPPING_DELAY
INVENTORY_COST
BACKORDER_COST
CUSTOMER_DEMAND
```

UI komponente ne treba da sadrže glavnu poslovnu logiku simulacije.

---

# 16. Van scope-a

Sledeće funkcionalnosti **NE SMEJU biti implementirane u ovoj verziji projekta**.

## Supply Chain

Nema igranja kao:

- Wholesaler
- Distributor
- Factory

Nema mogućnosti menjanja uloge.

---

## Multiplayer

Nema:

```text
multiplayer
```

Nema komunikacije između više igrača.

Nema online game room-a.

---

## Korisnički sistem

Nema:

```text
login
registration
user accounts
profiles
authentication
```

---

## Online funkcionalnosti

Nema:

```text
online leaderboard
global ranking
cloud save
online multiplayer
```

---

## Napredna simulacija

Nema:

```text
procedural generation
random economic events
dynamic pricing
multiple products
multiple suppliers
supplier selection
advanced forecasting
```

---

## AI

Nema:

```text
AI-controlled enemy
AI player
AI strategy recommendations
AI demand prediction
```

Sistemska logika potrebna da bi Retailer primao isporuke nije AI i može biti implementirana kao jednostavna deterministička pravila.

---

## Audio

Nema:

```text
custom audio
music
sound effects
voice acting
```

---

## Napredna grafika

Nema:

```text
3D graphics
complex animations
animated trucks
warehouse animations
interactive supply chain map
```

---

## Analytics

Za ovu verziju nisu potrebni:

```text
advanced dashboards
historical game comparison
machine learning analytics
player statistics database
```

Na završnom ekranu prikazuju se samo osnovne statistike trenutne simulacije.

---

# 17. Definition of Done

Retailer MVP se smatra završenim samo ako su ispunjeni svi sledeći zahtevi.

## Aplikacija

- [ ] Projekat može da se instalira bez grešaka.
- [ ] `npm run dev` uspešno pokreće aplikaciju.
- [ ] Aplikacija je dostupna preko localhost-a.
- [ ] `npm run build` prolazi bez grešaka.
- [ ] Nema TypeScript grešaka.

---

## Gameplay

- [ ] Simulacija počinje od Week 1.
- [ ] Igra traje 10 nedelja.
- [ ] Igrač igra samo kao Retailer.
- [ ] Customer Demand se prikazuje svake nedelje.
- [ ] Inventory se pravilno ažurira.
- [ ] Backorders se pravilno ažuriraju.
- [ ] Igrač može da unese Order Quantity.
- [ ] Order Quantity ne može biti negativan broj.
- [ ] Porudžbina ne stiže odmah.
- [ ] Shipping delay od 2 nedelje funkcioniše.
- [ ] Incoming Shipment se pravilno prikazuje.
- [ ] Backorders se ispunjavaju kada roba postane dostupna.

---

## Troškovi

- [ ] Inventory Cost se pravilno računa.
- [ ] Backorder Cost se pravilno računa.
- [ ] Weekly Cost se pravilno računa.
- [ ] Total Cost predstavlja zbir svih Weekly Cost vrednosti.

---

## UI

- [ ] Trenutna nedelja je jasno prikazana.
- [ ] Customer Demand je jasno prikazan.
- [ ] Inventory je jasno prikazan.
- [ ] Backorders su jasno prikazani.
- [ ] Incoming Shipment je jasno prikazan.
- [ ] Previous Order je prikazan.
- [ ] Postoji input za Order Quantity.
- [ ] Postoji dugme za potvrdu porudžbine.
- [ ] Weekly Cost je prikazan.
- [ ] Total Cost je prikazan.

---

## Završetak igre

- [ ] Simulacija se završava nakon 10. nedelje.
- [ ] Nakon završetka više nije moguće unositi porudžbine.
- [ ] Prikazuje se `Simulation Complete`.
- [ ] Prikazuje se konačni Total Cost.
- [ ] Prikazuje se Average Weekly Inventory.
- [ ] Prikazuje se Total Backordered Units.
- [ ] Prikazuje se Maximum Backorder.
- [ ] Prikazuje se Total Customer Demand.
- [ ] Prikazuje se Total Units Sold.
- [ ] Prikazuje se Service Level.

---

# 18. Scope Verification

Pre nego što se verzija smatra završenom potrebno je proveriti dve stvari.

## 1. Da li je urađeno sve što pripada ovoj verziji?

Sve stavke iz **Definition of Done** moraju biti završene.

Ako makar jedna obavezna stavka nije implementirana, Retailer MVP nije završen.

---

## 2. Da li je slučajno urađeno nešto što pripada budućim verzijama?

Potrebno je proveriti da NIJE implementirano:

- [ ] Wholesaler gameplay
- [ ] Distributor gameplay
- [ ] Factory gameplay
- [ ] izbor između više supply-chain uloga
- [ ] multiplayer
- [ ] login
- [ ] registration
- [ ] user accounts
- [ ] authentication
- [ ] online leaderboard
- [ ] procedural generation
- [ ] multiple products
- [ ] advanced forecasting
- [ ] AI player
- [ ] AI strategy assistant
- [ ] custom audio
- [ ] complex animations
- [ ] cloud database
- [ ] advanced analytics dashboard

Ako je bilo koja od ovih funkcionalnosti implementirana bez eksplicitnog zahteva, treba je ukloniti iz trenutnog scope-a.

---

# 19. Pravilo za AI development

Prilikom implementacije ovog projekta AI mora da prati sledeće pravilo:

> Implementiraj samo funkcionalnosti eksplicitno navedene u `GAME_SPEC.md`.

Ne dodavati funkcionalnosti samo zato što bi mogle biti korisne.

Ako funkcionalnost nije definisana u trenutnom spec-u, tretirati je kao funkcionalnost za buduću verziju.

Prioritet trenutne verzije je:

```text
jednostavan
+
ispravan
+
igriv
+
testabilan

Retailer Beer Distribution Game
```

a ne kompletna Beer Distribution Game platforma.