# Sesija 2: pregled dokaza i odbrana granica

## Svrha

Druga sesija proverava da li se bezbednosna promena vidi u ponašanju projekta koji je svaki tim zaista razvio, i da li svaki član razume šta je tim proverio. Igre i arhitekture se razlikuju; ne porede se timovi po broju ranjivosti ili obimu refaktora.

## Šta ponesite

- repo i tačan branch/commit;
- početne i ponovljene rezultate testova;
- izabrani trust-boundary dijagram i 3 prioritetna rizika;
- relevantan diff i demonstracioni runbook;
- bezbedan primer dozvoljenog i odbijenog log događaja;
- fake/live provider razliku i preostale limite;
- dokaz o ličnom doprinosu oba člana.

## Demo format

| Deo | Sadržaj |
| --- | --- |
| Problem | Jedan konkretan rizik i pogođeni resurs/korisnik. |
| Početno stanje | Input, expected, test/komanda i actual pre izmene. |
| Izmena | Gde se kontrola sprovodi i zašto baš tamo. |
| Ponovljena provera | Isti slučaj posle izmene, rezultat mock providera, API/UI ishod i log. |
| Ograničenje | Koji napad ili sistemski deo nije obuhvaćen. |
| Tim | Koji deo je svaki član napisao, proverio ili samostalno objasnio. |

Demo neka bude kratak i ponovljiv. Ako tim prikaže sliku ili zapis umesto živog rada, jasno treba da kaže kada i kako je dokaz napravljen.

## Kolektivni pregled

Tokom sesije prikupljamo deidentifikovane obrasce, kao što su:

- koji sloj je izabran da sprovodi autorizaciju;
- da li session ID tretiramo kao referencu ili kao dokaz identiteta;
- koliko log sadržaja je zaista potrebno da se objasni odluka;
- kako tim testira UI prikaz modelom generisanog teksta;
- koja tvrdnja je bila jača od dokaza.

Interaktivni fokus bira se iz stvarnih demo-a i pitanja. Ne izmišljati unapred probleme kohorte.

## Lična odbrana

Svaki član odgovara na zasebnu varijantu slučaja:

1. gde bi aplikacija donela odluku;
2. kako bi izgledao test koji razlikuje deny od leak-a;
3. koja log polja bi pomogla istrazi bez zapisivanja poverljivog sadržaja;
4. šta bi rezultat tog testa još uvek ne dokazivao.

Ocenjuje se preciznost razumevanja, ne brzina izmene koda. Ako je odgovor nepoznat, kvalitetno je reći šta bi se prvo proverilo.

## Zaključak

Pre prelaska na sledeću nedelju, tim ume da kaže:

- koja je jedna kontrola koju će zadržati;
- koja preostala granica je važna za capstone;
- gde je pronaći dokaz i ponoviti proveru;
- šta tim mora da skrati ili ukloni pre širenja scope-a.

---

**Pripremio:** Marko Pavkovic
