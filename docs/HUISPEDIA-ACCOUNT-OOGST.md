# Huispedia accountomgeving: oogst uit screenshots (23 jul 2026)

Mitch leverde 19 screenshots van zijn eigen Huispedia-account (inlogomgeving,
Mijn Woning, makelaar-vergelijker, zoeken, listingpagina, matches, shortlist,
berichten, ingelogde homepage). Dit document is de gap-analyse en de spec voor
**Wave F: dashboard-verrijking** (start ná oplevering Wave B/C, want app/dashboard
en app/account zijn tot die tijd van die agents).

Zelfde wet als altijd: structuur en features als skelet, Wonea-huid, en ALLEEN
echte data. Geen persoonsgegevens uit de screenshots in code of seed zetten.

## 1. Account-IA (menu) — Huispedia vs Wonea
Huispedia-menu: Mijn berichten · Zoekopdrachten · Vriendenkorting · Opgeslagen
woningen · Mijn biedingen · Waarderapporten · Help · Mijn account · Uitloggen.

Wonea-menu (alleen wat echt bestaat of deze wave gebouwd wordt):
- **Mijn Woning** (dashboard, bestaand)
- **Opgeslagen woningen** (nieuw, klein: bewaarde adressen per gebruiker)
- **Waarde-alerts** (bestaande alertSubscriptions als beheer-scherm)
- **Waarderapporten** (bestaande gedeelde rapporten, sharedReports, als lijst)
- **Mijn account** (bestaand, Wave B/C)
- **Uitloggen**
NIET: berichten (geen messaging), biedingen (geen biedplatform), vriendenkorting.
Begroeting-patroon mag ("Hoi <voornaam>."), zonder de "Leuk dat je er bent"-copy.

## 2. Mijn Woning dashboard-modules (de kern van Wave F)

### Woningkaart met status + kenmerken-beheer
Huispedia: adreskaart op kaartachtergrond, status "Niet te koop", "Update je
status", "Update je kenmerken" (oppervlak, kamers).
Wonea: adreskaart (geen echte kaart-tiles; rustige merk-achtergrond) met
kenmerken uit BAG/onze data + **eigenaar-correcties**: oppervlak, kamers,
woningtype aanpasbaar; opgeslagen input voedt de AVM (zoals eigenaar-WOZ al
werkt). Status-keuze beperkt tot wat betekenis heeft zonder biedplatform:
"Niet te koop" / "Sta open voor interesse" (signaal, zichtbaar op de eigen
woningpagina als de eigenaar dat wil; default uit, privacy-eerst).

### Waarde-blok met verwachte verkoopprijs + voorspelling vs index
Huispedia: Woningwaarde-range, "Verwachte verkoopprijs" als los getal, grafiek
woning vs Nederland-index, met voorspellingsband en prijsindex-toggle, plus
feedback-duimpjes "Sluit dit aan bij wat je zelf verwachtte?".
Wonea: bandbreedte + midden (bestaand AVM), historiegrafiek uit valuations
(bestaand), NIEUW: CBS-prijsindexlijn ernaast (ingest-cbs data, met bron).
GEEN voorspelling (ons model voorspelt niet; niet faken). Feedback-duimpjes
overnemen: "Sluit deze schatting aan bij wat je verwacht?" → opslaan als
eigenaar-feedback bij de valuation (echt leersignaal, past bij eerlijkheid).

### Verkoopstrategie-kaart (vraagprijs laag/midden/hoog)
Huispedia: vraagprijs-segmenten Laag/Gemiddeld/Hoog met ranges + "kopers actief"
+ "concurrerende woningen" + makelaar-CTA.
Wonea: drie prijsstrategieën afgeleid uit onze eigen bandbreedte (laag = sneller
verkopen, midden, hoog = meer vraagprijs-risico), in gewone taal, expliciet
indicatie. GEEN "kopers zoeken actief" / "concurrerende woningen" (geen bron).
CTA → bestaande verkoop-funnel.

### Referentiewoningen kiezen (sterkste feature uit de screenshots)
Huispedia: "Kies 5 huizen die op die van jou lijken; prijzen tonen we na je
selectie."
Wonea: eigenaar kiest uit onze buurt-adressen 3-5 referentiewoningen; de AVM
weegt die comparables zwaarder en het dashboard toont het effect op de
bandbreedte. Volledig op eigen data bouwbaar; leg in de UI uit wat het doet.

### Buurt-blok
Huispedia: recente verkopen-lijst + "X woningen verkocht in jouw buurt" +
kaart met (locked) prijzen als Plus-teaser.
Wonea: recente verkopen op buurtniveau (sales, VoorbeelddataLabel), teller
echt uit de db, link naar de buurtpagina. Geen lock/paywall-teasers in v1.

### Alerts-feed ("Wat is er nieuw")
Uit het eerdere prototype, sluit aan op Huispedia's alerts: regels als
"WOZ <jaar> staat in je dossier", "je geschatte waarde is bijgewerkt",
"nieuwe verkoop in <buurt>". Alleen gebeurtenissen die echt in onze data
zitten (wozValues, valuations-runs, sales), met datum. Geen verzonnen events.

### Overwaarde-indicatie
Waarde minus restschuld (mortgageInfo, door eigenaar ingevuld, bestaand veld):
tegel + één zin uitleg + link naar hypotheek-funnel. Alleen tonen als de
eigenaar hypotheekgegevens heeft ingevuld; anders uitnodiging om in te vullen.

### Bezoekers-teller
Huispedia: vandaag/totaal bekeken + volgers.
Wonea: KAN echt (pageview-teller op de woningpagina, alleen zichtbaar voor de
eigenaar van een geclaimd adres). V2-kandidaat; alleen bouwen mét echte teller,
nooit een nepgetal. Niet in Wave F tenzij triviaal in te passen.

## 3. Bewust NIET (met reden)
- Biedlogboek, "Plaats een bod", bezichtiging plannen → geen biedplatform/agenda.
- Makelaar-vergelijker op verkoopprestaties (% boven vraagprijs, meeropbrengst,
  verkocht 24 mnd) → die data is gesloten (NVM/brainbay); onze makelaars-tool
  blijft OSM + eerlijke dekkingsdisclaimer. Geen "beste makelaar"-claims.
- "Kopers zoeken actief: 2.500" e.d. → geen bron.
- Zoekprofiel-matches / "Voor jou" / shortlist met matchscore → vereist
  listings-aanbod dat wij niet hebben. Terug op tafel zodra er een listingsbron is.
- Berichten/chat, woning overdragen, meerdere beheerders → v1 te zwaar.
- Waarde-VOORSPELLING (forecast-band) → ons model voorspelt niet.
- Affiliate-rijen in kenmerken-tabellen (Rabobank/Eneco/verzekering) →
  monetisatie-patroon om te onthouden, maar nu geen partners; niets faken.
- Plus-paywall met geblurde bedragen → past niet bij gratis-inzicht-positionering
  van de testfase; monetisatie-beslissing voor later.

## 4. Ingelogde homepage (patroon voor later)
Huispedia toont ingelogd een persoonlijk overzicht (zoekprofiel-kaart,
budget-kaart, mijn-woning-kaart met waarde-delta). Voor Wonea: /dashboard is al
die hub; optioneel later de homepage-hero voor ingelogde gebruikers vervangen
door "Jouw overzicht" met woningwaarde-kaart + budget-tool-kaart. Genoteerd,
niet in Wave F.
