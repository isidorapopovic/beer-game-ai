# Bezbedna i odgovorna izgradnja AI sistema

Nedelja 08 obrađuje AI bezbednost, privatnost, arhitekturu, pouzdanost i odgovoran inženjering. Nedeljni zadatak **Secure the Arcade** primenjuje ove principe na jedan postojeći W03–W05 AI tok.

## Cilj

W03–W05 ste već napravili različite retro-inspired igre i dodali im AI funkcije. Ova nedelja nastavlja isti projekat u istom repozitorijumu. Pregledamo konkretne granice vaše aplikacije, ne pretpostavljamo da svi imaju istu igru, backend, naloge ili alat. RetroSnake može biti primer predavača, nije zadatak svakog para.

Uspeh nije tvrdnja „sada je sve bezbedno“. Uspeh je jasno ograničen AI tok, kontrole u odgovarajućim slojevima, provere koje se mogu ponoviti i iskreno objašnjenje onoga što nismo proverili.

## 1. Pratite jedan vertikalni tok

```text
Korisnik pokrene postojeću AI funkciju
        ↓
Frontend šalje zahtev
        ↓
Backend (ako postoji) proverava ulaz i primenljivi pristup
        ↓
Aplikaciona logika bira šta je dozvoljeno
        ↓
Fake/provider adapter generiše ili vraća odgovor
        ↓
Backend proverava izlaz i beleži bezbedan događaj
        ↓
Frontend prikazuje samo kodirani/validirani rezultat
```

Označite svaku strelicu sa podacima koji prelaze. Project ID ili session ID sam po sebi ne dokazuje identitet ili dozvolu. Modelov predlog nije ovlašćenje.

## 2. Razlikujte tri vrste podataka

| Vrsta | Primer | Pravilo |
| --- | --- | --- |
| Funkcionalni ulaz | rezultat igre, tekst zahteva ili drugi domen podatak | Šaljite samo polja potrebna za funkciju i objasnite svrhu. |
| Ovlašćenje | ko sme da vidi konkretnu sesiju | Odluku donosi backend na osnovu proverenog konteksta; nikada samo na osnovu vrednosti koju klijent/model pošalje. |
| Operativni trag | ishod dozvole, provider status, latencija | Beležite allowlist polja potrebna za dijagnostiku; ne beležite ceo request/response. |

Ako nema korisničkih naloga, napišite šta tačno aplikacija podržava (na primer single-user/local-only) i granice te tvrdnje. Ne pretvarajte UUID u tvrdnju da postoji autentikacija. Ako projekat podržava vlasnike/resurse ili više korisnika, testirajte dozvoljen i nedozvoljen pristup.

## 3. Odvojite odgovornosti bez suvišnog refaktora

Za izabrani tok utvrdite ko radi sledeće:

- HTTP ruta čita transportni zahtev i mapira grešku na HTTP odgovor;
- aplikacioni servis sprovodi dozvolu, pravila i granice poziva;
- session store vraća samo traženu partiju;
- provider adapter sakriva SDK i omogućava fake provider testove;
- log sink beleži odobrene događaje sa eksplicitnim poljima;
- UI bezbedno prikazuje provereni izlaz.

Ovi delovi mogu biti funkcije ili moduli, ne moraju biti klase niti novi framework. Dodajte sloj samo kada donosi testabilnu granicu.

## 4. Napravite pre/posle test

Pre nego što menjate kod, odredite scenario, očekivani rezultat i šta ćete posmatrati. Posle promene koristite isti ulaz. Zapišite i broj provider poziva, status dozvole i log polja ako su relevantni.

Napad ne mora da uspe. Odbijanje nevalidnog ulaza ili tuđe sesije je koristan rezultat ako možete da pokažete tačan ulaz, test, stvarni odgovor i sloj koji je odbio zahtev.

## 5. Logujte pristupe uz zaštitu privatnosti

Log treba da pomogne da odgovorite: koja vrsta radnje se pokušala, da li je dozvoljena, kada, kroz koji tok i kojim kodom razloga. Ne treba da vam pokaže ceo prompt, statistiku, tajnu, bearer token, raw provider odgovor ili stack trace.

Odvojite korisniku bezbednu poruku od internog događaja. Lokalni JSON ili konzola u demo aplikaciji nisu sami po sebi centralizovan ili otporan audit sistem. Navedite ko može da ih čita, koliko dugo ostaju i koje granice imaju.

## 6. Ne mešajte kontrolu sa promptom

System prompt može da ograniči nameru modela, ali backend i dalje validira modelov izlaz. Provider fake fixture može da vrati pogrešnu šemu ili markup da biste proverili API/UI putanju. Ovaj test pokazuje kako aplikacija postupa sa tim izlazom; ne dokazuje da je stvarni model otporan na sve napade.

Prompt injection proverite samo ako postoji put kojim nepouzdani tekst ulazi u kontekst modela. Ako vaša funkcija vidi samo ograničene strukturisane podatke, zabeležite da taj napad nije deo te putanje i fokusirajte testove na stvarno postojeće granice.

## 7. Za svaku tvrdnju navedite dokaz

Koristite sledeću razliku u evidence-u:

- **Planirano:** šta ste nameravali da proverite.
- **Izvršeno:** komanda/test i stvarni izlaz.
- **Opaženo:** šta je UI, API, provider fake ili log uradio.
- **Zaključeno:** šta rezultat podržava i šta ne podržava.

Ne izvodite zaključak o live Gemini/OpenAI ponašanju iz fake provider testa. Ne izvodite zaključak o celom sistemu iz jednog odbijenog zahteva.

## 8. Bezbedan obim

Radite samo nad lokalnim repozitorijumom i sintetičkim podacima. Ne testirajte druge timove, internet servise ili stvarne naloge. Ne dodajte tajne, javni deployment ili write-capable alat. Ako se pravi ključ slučajno pojavi, zaustavite rad, ne kopirajte ga u evidence i prijavite kroz dogovoreni kanal.

---

**Pripremio:** Marko Pavkovic
