# CONTEXT_MANIFEST

# 1. Namena manifesta

Ovaj dokument definiše **koji kontekst coding agent treba da dobije pre implementacije Retailer MVP verzije Beer Distribution Game-a**.

Cilj manifesta nije da opiše ceo projekat, već da jasno zabeleži:

- šta je agent stvarno dobio;
- šta je namerno izostavljeno;
- koji izvori su autoritativni;
- koji izvor ima prednost kada postoji konflikt;
- koji rizici postoje u kontekstu;
- koje informacije agent ne sme da tretira kao pravilo;
- kako da se izbegnu zastareli, konfliktni ili nerelevantni izvori.

Osnovni princip je:

> Agent ne treba da dobije sve što postoji u folderu. Treba da dobije najmanji skup informacija koji je dovoljan da ispravno implementira trenutni zadatak.

Ovaj manifest se odnosi samo na trenutni scope:

```text
Beer Distribution Game
Retailer MVP
Frontend-only
Bez backenda
Minimalan, ali igriv UI
```

---

# 2. Odluka koju kontekst treba da podrži

Kontekst treba da omogući coding agentu da donese sledeću odluku:

> Kako implementirati najmanju ispravnu i igrivu frontend verziju Beer Distribution Game-a u kojoj igrač kontroliše samo Retailer-a, po pravilima definisanim u Game Spec-u, bez dodavanja funkcionalnosti van trenutnog scope-a?

Kontekst nije namenjen za:

- dizajn backend arhitekture;
- bazu podataka;
- autentifikaciju;
- multiplayer;
- druge supply-chain uloge;
- cloud infrastrukturu;
- analitiku;
- buduće faze projekta.

---

# 3. Šta agent mora da dobije

Agentu treba poslati samo izvore koji direktno pomažu trenutnoj implementaciji.

## Obavezni izvori

| Izvor | Uključen? | Tip | Zašto? | Prioritet | Rizik |
|---|---|---|---|---|---|
| `BUILD_PROMPT_V1.md` | Da | Instrukcija / task brief | Definiše ulogu agenta, scope, Definition of Done, granice i provere | Critical | Može postati zastareo ako se Game Spec promeni |
| `GAME_SPEC.md` | Da | Autoritativna specifikacija | Definiše pravila igre, gameplay i ponašanje sistema | Critical | Moguće interne kontradikcije ili zastarela pravila |
| `package.json` | Da | Tehnički izvor | Pokazuje postojeće skripte, dependencies i način pokretanja projekta | High | Može sadržati skripte koje nisu relevantne za trenutni task |
| `README.md` | Da, ako postoji | Setup / dokumentacija | Može sadržati setup, postojeće komande i strukturu projekta | Medium | Može biti zastareo u odnosu na kod |
| postojeći `src/` frontend fajlovi | Da | Izvorni kod | Agent mora da vidi postojeću arhitekturu pre izmene | High | Veliki broj fajlova može uneti šum |
| `tsconfig.json` | Da, ako postoji | Tehnička konfiguracija | Potrebno za TypeScript pravila i build | Medium | Nizak |
| frontend config fajlovi | Samo relevantni | Tehnička konfiguracija | Potrebni samo ako direktno utiču na build ili UI | Medium | Nepotreban config može povećati šum |
| postojeći frontend testovi | Da, ako postoje | Provera / dokaz | Pomažu da se ne pokvari postojeće ponašanje | High | Mogu biti zastareli |
| `CONTEXT_MANIFEST.md` | Da | Meta-kontekst | Objašnjava izbor izvora i precedence | High | Mora biti održavan zajedno sa promptom |
| `GameConfig` ugovor / validator | Da | Strukturisani ugovor | Definiše i runtime proverava ključne parametre igre | High | TypeScript tip bez runtime provere daje lažan osećaj sigurnosti |

---

# 4. Šta se namerno izostavlja

Sledeći sadržaj ne treba automatski uključivati u payload.

| Izvor | Uključen? | Zašto je izostavljen? | Prioritet | Rizik |
|---|---|---|---|---|
| stari chat transcript-i | Ne | Nisu autoritativna specifikacija | - | Visok rizik konflikta i zastarelih odluka |
| slučajni web primeri Beer Game-a | Ne | Mogu imati druga pravila i drugačiji scope | - | Visok rizik mešanja tuđih pravila sa Game Spec-om |
| backend ideje | Ne | Backend nije deo trenutne faze | - | Scope creep |
| baze podataka | Ne | Nisu potrebne za frontend MVP | - | Nepotrebna kompleksnost |
| autentifikacija | Ne | Nije deo MVP-a | - | Scope creep |
| Factory / Distributor / Wholesaler implementacije | Ne | Igrač kontroliše samo Retailer-a | - | Proširenje scope-a |
| budući planovi projekta | Ne | Ne pomažu trenutnoj implementaciji | - | Distraction |
| nebitni folderi projekta | Ne | Ne podržavaju trenutnu odluku | - | Šum |
| privatni podaci ili tajne | Ne | Nisu potrebni | - | Bezbednosni rizik |
| environment tajne | Ne | Frontend MVP ih ne treba | - | Bezbednosni rizik |
| nasumični kod sa interneta | Ne | Nije deo projekta niti specifikacije | - | Nepouzdan obrazac |
| stara verzija Game Spec-a | Ne | Može biti u konfliktu sa trenutnom | - | Clash |
| stara verzija build prompta | Ne | Može sadržati zastarele zahteve | - | Clash |

---

# 5. Prioritet izvora

Kada se dva izvora razlikuju, agent ne sme sam da bira proizvoljno.

Koristi sledeći redosled prioriteta:

```text
1. Eksplicitna trenutna odluka vlasnika projekta
2. Aktuelni GAME_SPEC.md
3. BUILD_PROMPT_V1.md
4. Važeći kod i tehnička konfiguracija projekta
5. Postojeći testovi
6. README.md
7. Primeri
8. Istorija razgovora
9. Spoljašnji web primeri
```

Važno:

- `GAME_SPEC.md` je glavni izvor pravila igre.
- `BUILD_PROMPT_V1.md` definiše kako agent treba da radi zadatak.
- Kod pokazuje šta trenutno postoji, ali ne sme automatski da pregazi eksplicitnu specifikaciju.
- README može biti koristan, ali nije automatski autoritativan.
- Primer nije pravilo.
- Chat istorija nije izvor istine ako nije eksplicitno preneta u aktuelnu specifikaciju.

---

# 6. Trajanje igre — konačno pravilo

Trajanje igre je sada jasno i usaglašeno u aktuelnim izvorima.

```text
Igra traje tačno 10 nedelja.
```

Aktuelni:

```text
GAME_SPEC.md
BUILD_PROMPT_V1.md
```

definišu isto pravilo.

Zbog toga više ne postoji konflikt između 10 i 30 nedelja.

Agent mora da tretira sledeće kao autoritativno pravilo:

```text
Simulation starts at Week 1.
Simulation ends after Week 10.
No orders can be submitted after Week 10.
```

Ako se u starom chatu, staroj verziji dokumenta ili drugom izvoru pojavi vrednost:

```text
30 weeks
```

taj izvor se smatra zastarelim i ne sme uticati na implementaciju.

Takav sadržaj treba klasifikovati kao:

```text
STALE
```

i izostaviti iz aktivnog payload-a.

---

# 7. Vrste sadržaja

Svaki izvor treba mentalno klasifikovati.

## RULE

Pravilo koje agent treba da prati.

Primer:

```text
Shipping delay = 2 weeks
```

## DATA

Trenutni podatak ili stanje sistema.

Primer:

```text
Current inventory = 12
```

## EXAMPLE

Primer koji pomaže razumevanju, ali nije automatski pravilo.

Primer:

```text
Inventory Cost = $0.50 per unit/week
```

Ako je ista vrednost definisana u Game Spec-u kao pravilo, onda je RULE.

## COMMENT

Objašnjenje koje može pomoći čoveku, ali ne sme automatski menjati ponašanje sistema.

## STALE

Zastarela verzija pravila ili dokumenta.

Takav izvor treba izostaviti iz payload-a kada je moguće.

---

# 8. Rizici context rot-a

Tokom rada posebno pratiti sledeće rizike.

## Poisoning

Rana greška ili pretpostavka počinje da se ponavlja kao činjenica.

Primer:

```text
Ranije je u chatu slučajno napisano da shipping delay traje 1 nedelju.
```

Ako Game Spec kaže 2 nedelje, stari chat se ne koristi.

---

## Distraction

Previše istorije, koda ili dokumentacije odvlači pažnju od trenutnog zadatka.

Rešenje:

- učitati samo relevantne fajlove;
- ne slati ceo repository bez potrebe;
- ne slati dugačke chat transcript-e.

---

## Clash

Dve aktivne verzije pravila se razlikuju.

Primer:

```text
10 weeks
vs.
30 weeks
```

Rešenje:

- jasno definisati precedence;
- ukloniti zastareli izvor;
- ne držati dve verzije kao jednako važeće.

---

## Lost in the middle

Važna instrukcija je prisutna, ali zatrpana u velikom payload-u.

Kritične granice zato treba ponoviti na početku i kraju:

```text
Frontend-only.
Retailer-only.
No backend.
Do not expand the Game Spec.
```

---

# 9. Preporučeni payload za coding agenta

Preporučeni redosled konteksta je:

```text
1. Uloga i pravila
2. Scope i zabrane
3. BUILD_PROMPT_V1.md
4. Relevantni delovi GAME_SPEC.md
5. Relevantni tehnički fajlovi
6. Trenutni kod na kome se radi
7. Konkretan zadatak
8. Završni podsetnik na scope
```

Primer strukture:

```text
<role>
Implementiraj Retailer MVP Beer Distribution Game-a.
</role>

<constraints>
Frontend-only.
No backend.
Retailer-only.
Ne dodavati funkcionalnosti van Game Spec-a.
</constraints>

<sources>
GAME_SPEC.md
BUILD_PROMPT_V1.md
package.json
relevantni src fajlovi
</sources>

<task>
Implementirati minimalnu igrivu verziju.
</task>

<output_reminder>
Ne proširuj scope.
Ako pronađeš konflikt, prijavi ga pre nego što doneseš produkt odluku.
</output_reminder>
```

---

# 10. Šta model stvarno dobija

Za svaki konkretan run treba moći zapisati tačan payload.

Primer:

```text
RUN: Retailer MVP Build V1

INCLUDED:
- BUILD_PROMPT_V1.md
- CONTEXT_MANIFEST.md
- GAME_SPEC.md
- package.json
- tsconfig.json
- src/App.tsx
- src/main.tsx
- relevantni postojeći frontend stilovi

EXCLUDED:
- stari chat transcript
- backend planovi
- web primeri
- buduća multiplayer ideja
- stara verzija specifikacije
- nerelevantni folderi

TOOLS:
- read files
- edit frontend files
- run npm commands

NOT PROVIDED:
- backend credentials
- database access
- production secrets
```

Ovo je mnogo preciznije od tvrdnje:

```text
"Agent je imao pristup projektu."
```

---

# 11. Minimalni Context Manifest po run-u

Za svaki važan implementation run zabeležiti:

```text
Task:
Retailer MVP implementacija

Prompt version:
BUILD_PROMPT_V1

Context manifest version:
CONTEXT_MANIFEST_V1

Game Spec version:
[upiši verziju ili commit]

Included:
- GAME_SPEC.md
- BUILD_PROMPT_V1.md
- package.json
- relevantni frontend fajlovi

Excluded:
- stara specifikacija
- chat istorija
- backend plan
- web primeri

Precedence:
1. explicit current project decision
2. current GAME_SPEC.md
3. BUILD_PROMPT_V1.md
4. current code
5. tests
6. README

Known conflicts:
- Nema poznatog konflikta za trajanje igre.
- Aktuelni Game Spec i Build Prompt definišu trajanje od tačno 10 nedelja.

Expected checks:
- npm install
- npm run build
- TypeScript check
- relevant tests
- manual gameplay verification
```

---

# 12. Pravila za relevantnost

Izvor se uključuje samo ako pomaže najmanje jednoj konkretnoj odluci.

Pitaj:

```text
Koju odluku ovaj fajl pomaže agentu da donese?
```

Ako nema jasan odgovor, izvor verovatno ne treba da bude u payload-u.

Primer:

`GAME_SPEC.md`

```text
Odluka:
Kako rade demand, inventory, backorders, shipping i cost?
```

Uključiti.

Backend design dokument:

```text
Odluka:
Nijedna odluka trenutnog frontend MVP taska.
```

Izostaviti.

---

# 13. Pravilo za tehničke fajlove

Agent prvo treba da pregleda:

```text
package.json
src/
tsconfig.json
frontend config
postojeće testove
```

Ali ne treba automatski učitati svaki fajl iz projekta.

Relevantni kod se bira na osnovu zadatka.

Na primer, ako je kompletna aplikacija u:

```text
src/App.tsx
```

nema razloga automatski slati desetine nerelevantnih foldera.

---

# 14. Pravilo za README

`README.md` može pomoći za:

- instalaciju;
- pokretanje;
- build;
- strukturu projekta.

Ali ako se README razlikuje od:

```text
package.json
```

za komande i aktuelni projekat, proveriti stvarnu konfiguraciju.

README nije automatski jači izvor od trenutnog koda.

---

# 15. Pravilo za Game Spec

`GAME_SPEC.md` je autoritativni domen-spec izvor za gameplay.

Koristi se za:

- trajanje igre;
- demand;
- inventory;
- backorders;
- shipping delay;
- order behavior;
- cost pravila;
- završetak simulacije;
- finalne metrike;
- player role.

Ako Game Spec ima unutrašnju kontradikciju, ne izmišljati resolution.

Konflikt mora biti eksplicitno prijavljen.

---

# 16. Pravilo za BUILD_PROMPT_V1

`BUILD_PROMPT_V1.md` je implementation task specification.

On definiše:

- ulogu coding agenta;
- očekivani rezultat;
- dozvoljeni scope;
- zabranjene dodatke;
- required checks;
- Definition of Done;
- način izveštavanja.

Ako BUILD prompt kaže nešto što je gameplay kontradikcija u odnosu na aktuelni Game Spec:

```text
GAME_SPEC.md ima prednost za pravila igre.
```

Ako se radi o načinu rada agenta:

```text
BUILD_PROMPT_V1.md ima prednost.
```

---

# 17. Pravilo za primere

Primer ne sme automatski postati zahtev.

Primer:

```text
A dashboard with three cards
```

ne znači da UI mora imati tačno tri kartice, osim ako je to eksplicitno zahtevano.

Primer služi za razumevanje.

Game Spec i acceptance criteria određuju ponašanje.

---

# 18. Pravilo za web izvore

Web izvori nisu deo standardnog context pack-a ovog taska.

Ne treba koristiti web da bi se menjala pravila Beer Game-a definisana u projektu.

Web može biti koristan samo ako postoji odvojeni research task.

Na primer:

```text
"Uporedi našu implementaciju sa klasičnim MIT Beer Game pravilima."
```

To je novi task i zahteva poseban context manifest.

Za trenutni build:

```text
Web nije autoritativan izvor gameplay pravila.
```

---

# 19. Privatnost i bezbednost

U context ne uključivati:

- API ključeve;
- lozinke;
- access tokene;
- production credentials;
- privatne korisničke podatke;
- environment secrets;
- nepotrebne logove sa poverljivim informacijama.

Ako takav sadržaj postoji u projektu:

```text
EXCLUDED — SECRET / PRIVATE
```

Agentu treba dati samo informacije neophodne za trenutni frontend build.

---

# 20. Dozvoljeni alati

Za trenutni task agentu su potrebni alati za:

- čitanje relevantnih fajlova;
- izmenu frontend koda;
- pregled diff-a;
- pokretanje build komandi;
- pokretanje testova;
- lokalnu proveru aplikacije.

Nisu potrebni alati za:

- bazu podataka;
- cloud infrastrukturu;
- production deploy;
- email;
- eksterni API;
- write operacije izvan projekta.

Princip:

> Ponuditi najmanji broj alata dovoljan za trenutni zadatak.

---

# 21. Očekivane provere

Context treba da omogući proveru, ne samo generisanje koda.

Agent mora imati dovoljno informacija da proveri:

```text
npm install
npm run dev
npm run build
```

Ako postoje:

```text
npm run typecheck
npm run lint
npm test
```

Pored tehničke provere mora postojati i semantička provera gameplay-a.

Primer:

```text
Order placed in Week 1
must not arrive immediately.
```

Validan build ne dokazuje da shipping logic radi ispravno.

---

# 22. Semantička provera

Potrebno je proveriti ne samo da aplikacija radi, već da ponašanje odgovara Game Spec-u.

Primeri:

```text
Da li backorder ostaje dok se ne ispuni?
Da li incoming shipment stiže nakon 2 nedelje?
Da li weekly cost koristi ispravne vrednosti?
Da li total cost akumulira sve nedelje?
Da li više nije moguće naručivati nakon završetka igre?
```

Tehnički validan kod nije dovoljan ako je gameplay pogrešan.

---


# 23. Strukturisani ugovor igre

Najmanje jedan važan deo sistema mora imati eksplicitno definisan strukturisani ugovor.

Za trenutni Retailer MVP koristi se:

```ts
type GameConfig = {
  totalWeeks: 10;
  shippingDelayWeeks: 2;
  inventoryCostPerUnit: number;
  backorderCostPerUnit: number;
};
```

Ovaj ugovor predstavlja stabilna pravila konfiguracije igre.

Obavezne vrednosti su:

```text
totalWeeks = 10
shippingDelayWeeks = 2
inventoryCostPerUnit = 0.50
backorderCostPerUnit = 1.00
```

## Očekivani oblik

`GameConfig` mora sadržati sva četiri polja:

- `totalWeeks`;
- `shippingDelayWeeks`;
- `inventoryCostPerUnit`;
- `backorderCostPerUnit`.

Nedostajuće ili pogrešno tipizirano polje znači da konfiguracija nije validna.

## Validan primer

```ts
const validConfig: GameConfig = {
  totalWeeks: 10,
  shippingDelayWeeks: 2,
  inventoryCostPerUnit: 0.5,
  backorderCostPerUnit: 1.0,
};
```

Ovaj primer predstavlja dozvoljenu konfiguraciju za trenutni MVP.

## Nevalidan primer

```ts
const invalidConfig = {
  totalWeeks: 30,
  shippingDelayWeeks: -1,
  inventoryCostPerUnit: "0.5",
  backorderCostPerUnit: null,
};
```

Ovaj primer je nevalidan zato što:

- igra ne traje 30 nego tačno 10 nedelja;
- shipping delay ne može biti `-1`, već mora biti tačno `2`;
- inventory cost mora biti broj `0.5`;
- backorder cost mora biti broj `1.0`.

## Runtime validacija

TypeScript tip sam po sebi nije dokaz runtime validacije.

Sledeće nije dovoljno:

```ts
const config = rawInput as GameConfig;
```

Niti je dovoljno samo to što projekat prolazi TypeScript build.

Mora postojati runtime provera ili ekvivalentna validacija, na primer:

```ts
function validateGameConfig(input: unknown): GameConfig {
  // proveri strukturu, tipove i dozvoljene vrednosti
}
```

Runtime provera mora potvrditi najmanje:

```text
totalWeeks === 10
shippingDelayWeeks === 2
inventoryCostPerUnit === 0.5
backorderCostPerUnit === 1.0
sva obavezna polja postoje
sve numeričke vrednosti su validni konačni brojevi
```

## Ponašanje kada konfiguracija nije validna

Ako konfiguracija nije validna:

```text
simulacija ne sme da se pokrene
```

Agent ne sme:

- tiho ispraviti pogrešnu vrednost;
- pretvoriti `"0.5"` u `0.5` bez eksplicitnog pravila;
- ignorisati nedostajuće polje;
- pokrenuti simulaciju sa delimično validnim config-om;
- prihvatiti `30` nedelja kao alternativni mode.

Očekivano ponašanje:

```text
1. runtime validacija pada;
2. konfiguracija se odbacuje;
3. simulacija se ne inicijalizuje;
4. greška se jasno prijavljuje kroz postojeći error-handling mehanizam ili jasan development/UI signal.
```

## Zašto je ovaj ugovor u context manifestu

`GameConfig` je važan jer odvaja:

```text
pravilo igre
od
slučajne vrednosti u implementaciji
```

i daje proverljiv ugovor za ključne parametre simulacije.

Za svaki run treba biti moguće dokazati:

- koji je očekivani shape;
- koji primer je validan;
- koji primer je nevalidan;
- koja runtime provera je korišćena;
- šta se dogodilo kada je validacija pala.


---

# 24. Baseline i dokaz

Pre većih izmena treba sačuvati početno stanje.

Minimalni baseline:

```text
- trenutni commit ili stanje projekta;
- trenutni build rezultat;
- postojeći UI;
- postojeći gameplay behavior;
- poznati problem.
```

Nakon izmene zapisati:

```text
- šta je promenjeno;
- koji fajlovi su promenjeni;
- šta je ostalo isto;
- koje provere su pokrenute;
- rezultat provera;
- poznata ograničenja.
```

---

# 25. Šta ne treba raditi

Ne treba:

- uključivati sve fajlove zato što postoje;
- tretirati chat istoriju kao specifikaciju;
- držati istovremeno v1 i v2 pravilo bez precedence-a;
- rešavati konflikt dodatnim kontradiktornim promptom;
- slati ceo repository ako su potrebna 3 fajla;
- mešati podatak, primer i instrukciju;
- dodavati backend jer "će svakako trebati kasnije";
- koristiti web primer kao nadređeni Game Spec-u;
- tvrditi da je agent video fajl samo zato što postoji u folderu;
- tvrditi da implementacija radi samo zato što build prolazi;
- menjati prompt, specifikaciju, arhitekturu i testove odjednom bez traga šta je izazvalo promenu.

---

# 26. Obavezna pitanja pre implementacije

Pre početka coding taska treba moći odgovoriti na sledeće:

## Šta je model stvarno dobio?

Navesti tačne fajlove i relevantne izvode.

## Šta je namerno izostavljeno?

Navesti bar glavne kategorije:

```text
stara istorija
backend
web primeri
nerelevantni kod
tajne
stare verzije specifikacije
```

## Koji izvor ima prioritet?

Za gameplay:

```text
Current GAME_SPEC.md
```

Za način implementacionog rada:

```text
BUILD_PROMPT_V1.md
```

Za tehničku realnost projekta:

```text
Current code + package.json + config
```

## Koji rizik trenutno postoji?

Poznati rizik:

```text
Stari izvori mogu i dalje sadržati zastarelo pravilo od 30 nedelja.
```

Takve izvore treba označiti kao `STALE` i ne uključivati ih u aktivni context.

---

# 27. Preporučeni odgovor coding agenta pre rada

Pre implementacije agent treba da napiše:

```text
Razumevanje:
[kratak opis zadatka]

Plan:
1.
2.
3.

Uključeni izvori:
- ...

Namerno izostavljeno:
- ...

Prioritet izvora:
1.
2.
3.

Nejasnoće / konflikti:
- ...

Scope:
Frontend-only.
Retailer-only.
No backend.
No features outside Game Spec.
```

Tek nakon toga treba da počne izmenu koda.

---

# 28. Završni Context Check

Pre slanja payload-a proveriti:

- [ ] Da li je cilj trenutnog taska jasan?
- [ ] Da li je `GAME_SPEC.md` uključen?
- [ ] Da li je `BUILD_PROMPT_V1.md` uključen?
- [ ] Da li su relevantni tehnički fajlovi uključeni?
- [ ] Da li su stare verzije specifikacije izostavljene?
- [ ] Da li je chat istorija izostavljena osim ako je direktno potrebna?
- [ ] Da li je precedence definisan?
- [ ] Da li je potvrđeno da igra traje tačno 10 nedelja?
- [ ] Da li su svi izvori koji pominju 30 nedelja označeni kao zastareli i izostavljeni?
- [ ] Da li su tajne i privatni podaci izostavljeni?
- [ ] Da li su alati ograničeni na ono što je potrebno?
- [ ] Da li postoji plan tehničke provere?
- [ ] Da li postoji plan semantičke gameplay provere?
- [ ] Da li je strukturisani `GameConfig` ugovor uključen ili jasno referenciran?
- [ ] Da li postoji validan primer konfiguracije?
- [ ] Da li postoji nevalidan primer konfiguracije?
- [ ] Da li postoji runtime validacija?
- [ ] Da li je ponašanje pri nevalidnom config-u jasno definisano?
- [ ] Da li kritične granice stoje i na kraju payload-a?

---

# 29. Kritična granica

Na kraju svakog većeg context payload-a ponoviti:

```text
CURRENT SCOPE:
- Beer Distribution Game
- Retailer MVP
- Frontend-only
- Minimal playable UI
- No backend
- No additional supply-chain roles
- No functionality outside the current Game Spec
- Structured GameConfig must be runtime-validated
- Game duration = exactly 10 weeks
- Ignore stale 30-week references
- Report any new conflicts instead of inventing product decisions
```

---

# 30. Sažetak manifesta

Ovaj Context Manifest treba da omogući da bilo ko može da rekonstruiše:

1. **šta je agent dobio;**
2. **šta nije dobio;**
3. **zašto je svaki izvor uključen ili izostavljen;**
4. **koji izvor ima prednost;**
5. **koji rizici postoje;**
6. **kako će se proveriti da li je implementacija stvarno ispravna.**

Najvažniji princip:

> Dobar context nije najveći mogući context. Dobar context je najmanji dovoljan skup relevantnih, aktuelnih i pravilno prioritizovanih izvora.
