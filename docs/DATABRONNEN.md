# Databronnen-inventaris (geverifieerd 23 jul 2026)

Kernconclusies uit deep-research, waarvan de beslissende claims door onszelf zijn
nagetrokken op de primaire bron (datum: 2026-07-23). Dit document stuurt welke tool
op welke data draait en wat er eerlijk wel en niet kan.

## Hard geverifieerd (primaire bron gelezen)

1. **Leennormen 2026: volledig open.** De Wijzigingsregeling hypothecair krediet 2026
   (Staatscourant 2025-36471) bevat de vier financieringslastpercentage-tabellen 2026
   plus de energielabel-bedragen die buiten beschouwing blijven (art. 4 lid 3:
   E/F/G €0 · C/D €5.000 · A/B €10.000 · A+/A++ €20.000 · A+++ €25.000 ·
   A++++ €30.000 · A++++ met ≥10 jaar garantie €40.000) en de extra
   verduurzamingsbedragen (lid 4: E/F/G €20.000 · C/D €15.000 · A/B en A+/A++
   €10.000 · A+++ en beter €0). Toetsrente werkt in banden (≤1,500% t/m ≥6,501%).
   → De budgetberekenaar kan 100% op deze openbare publicatie draaien.
   Bron: zoek.officielebekendmakingen.nl/stcrt-2025-36471.html

2. **NHG 2026.** Kostengrens €470.000; met energiebesparende voorzieningen €498.200;
   borgtochtprovisie 0,4%. Bron: nhg.nl (persbericht kostengrens 2026).

3. **Kadaster-tarieven 2026.** Koopsominformatie via de API €0,45 per adres (webwinkel
   €3,70 per postcode). WOZ-bevragingen bij het Kadaster: gratis, individueel en
   massaal. Let op: gratis tarief zegt niets over de toegangsroute; account/aansluiting
   (Mijn Kadaster/Kadata) vermoedelijk vereist — uitzoeken bij aansluiten.
   Bron: kadaster.nl/zakelijk/over-ons/financieel/tarieven

4. **EP-Online (energielabels): gratis en expliciet toegestaan.** API-key gratis en
   self-service (apikey.ep-online.nl). Maandelijks totaalbestand + dagelijkse mutaties
   van alle geregistreerde labels. Voorwaarden letterlijk: gebruik kosteloos; het is
   "wel toegestaan gegevens op individueel niveau in grote aantallen indirect aan
   derden te leveren, bijvoorbeeld als onderdeel van de informatie op een internetsite
   voor het kopen en huren van woningen" (= precies ons scenario). Verboden: de ruwe
   dataset herkenbaar doorleveren. Key is persoonsgebonden.
   Bron: apikey.ep-online.nl/Home/TermsOfUse

## Uit de research (aannemelijk, primaire bron genoemd, nog niet zelf nagelezen)

5. **DNB-hypotheekrentes: alleen gemiddelden.** DNB publiceert gemiddelde bancaire
   rentes op nieuwe woninghypotheken in vier rentevast-buckets (variabel/≤1, 1-5,
   5-10, >10 jaar), niet per geldverstrekker en niet NHG-gesplitst.
   → Een per-verstrekker-vergelijker kan NIET op open data; een eerlijke
   "actuele rentestanden + wat betekent dit voor jouw maandlasten" wel.
   Per-verstrekker vereist een betaalde/partnerbron of eigen redactie (TODO).

6. **Altum AI als betaalde aanvulling.** Self-service key (mopsus.altum.ai), 15 gratis
   credits/30 dagen; Startups-tarief €100/mnd (≤5.000 calls) voor bedrijven ≤5 jaar;
   losse API's voor WOZ, AVM, woningdata, verduurzaming, transacties. Kandidaat voor
   de betaalde verdieping ("kleine fee voor betaalde data"), niet voor de gratis laag.

7. **Makelaars: geen open register.** NVM/VBO-lijsten zijn niet open. OpenStreetMap
   (Overpass) kent estate_agent-POI's onder ODbL: bruikbaar met bronvermelding,
   dekking wisselend. KvK/Google Places zijn betaald. → V1 op OSM + eerlijke
   dekkingsdisclaimer + de bestaande verkoop-funnel als kern.

8. **ISDE 2026 en besparingskentallen** (RVO / Milieu Centraal): openbaar raadpleegbaar;
   bedragen per maatregel in de ingest vastleggen met bron en peildatum.

## Wat dit betekent per tool

| Tool | Gratis laag draait op | Betaalde verdieping (later) |
|---|---|---|
| Budgetberekenaar | Leennormen 2026 + NHG (open, hard geverifieerd) | – |
| Hypotheekrentes | DNB-gemiddelden per bucket + maandlasten-calculator | per-verstrekker-tabel (partner/betaald) |
| WOZ-check | eigen invoer + (na aansluiting) gratis Kadaster-WOZ | Altum WOZ per call |
| Woningwaarde | eigen AVM + CBS-prijsindex; koopsommen à €0,45 bij verdieping | Kadaster Koopsom API / Altum AVM |
| Verduurzaming | EP-Online-label (gratis key) + ISDE 2026 + kentallen + leennormen-extra | Altum verduurzamings-API |
| Makelaars | OSM/Overpass (ODbL, met attributie) + verkoop-funnel | curated register |
| Biedadvies | bestaande marktsignalen + CBS | echte transacties |

## Acties voor Mitch (allebei gratis, self-service)
1. EP-Online API-key aanvragen op apikey.ep-online.nl (persoonsgebonden, gratis) en
   als `EPONLINE_API_KEY` aanleveren.
2. Later, voor echte koopsommen/WOZ: Mijn Kadaster-aansluiting uitzoeken.
