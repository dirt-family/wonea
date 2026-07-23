# Rentes per geldverstrekker: crawler-runbook

De pagina /hypotheek-rentes toont naast de DNB-gemiddelden ook actuele tarieven per
geldverstrekker (10 en 20 jaar vast, met en zonder NHG). Die komen uit een maandelijkse
crawl van de eigen websites van de banken. Dit document is het runbook plus de
juridische lijn.

## De juridische lijn (niet onderhandelbaar)

1. **Uitsluitend eigen websites van geldverstrekkers.** Rentetarieven zijn feiten;
   de bank publiceert ze zelf. Feiten zijn niet auteursrechtelijk beschermd.
2. **Nooit aggregators of vergelijkers** (Independer, hypotheekrente.nl, e.d.). Op hun
   verzamelingen rust databankenrecht; daar blijven we volledig weg.
3. **robots.txt wordt per site gerespecteerd.** Het script haalt robots.txt per domein
   op en toetst de pagina tegen token `WoneaRentesCrawler` (valt vrijwel overal in de
   `*`-groep). Verbiedt robots.txt de pagina, dan valt de bank af.
4. **1 verzoek per pagina** (plus 1 voor robots.txt), met pauze tussen banken. Geen
   omwegen achter logins of botmuren: blokkeert een site (zoals ING), dan ontbreekt
   die bank eerlijk in de tabel.
5. **Nooit tarieven verzinnen of handmatig invullen.** Bij parse-twijfel of een
   percentage buiten 1-8% wordt de hele bank overgeslagen, met reden in het log en in
   het veld `overgeslagen` van de snapshot.

## Draaien (maandelijks, handmatig; launchd kan later)

```sh
cd scripts/ingest-open
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # eenmalig
.venv/bin/python -m playwright install chromium                       # eenmalig
.venv/bin/python rentes-verstrekkers.py
```

- Uitvoer: `lib/bronnen/rentes-verstrekkers-snapshot.json` (gecommit als data-bestand).
- Het script print per bank GELUKT of OVERGESLAGEN met reden. Slaagt geen enkele bank,
  dan blijft de bestaande snapshot onaangeroerd (exit 1).
- Controleer na een run kort de nieuwe snapshot (percentages, peildatum) en draai
  `npm test` (tests/rentes-verstrekkers.test.ts bewaakt de vorm en plausibiliteit).
- **Verversritme: maandelijks.** De lezer (`lib/bronnen/rentes-verstrekkers.ts`) zet
  `beschikbaar=false` zodra de snapshot ouder is dan 45 dagen; de sectie verdwijnt dan
  van de pagina. Eerlijk verouderd is niet tonen.

## Wat er per rij wordt vastgelegd

`verstrekker`, `product`, `rentevastJaren` (10/20), `nhg` (ja/nee/onbekend),
`rentePct`, `bronUrl` (de rentepagina van de bank), `peildatum` (crawldatum) en
`opmerking` (tariefklasse, kortingen, productbeperkingen, en waar leesbaar de
tariefdatum die de bank zelf noemt).

Conventie voor "zonder NHG": we nemen de hoogste reguliere tariefklasse die een
financiering rond 100% van de marktwaarde dekt (de gangbare starterssituatie). De
exacte klasse staat per rij in de opmerking. Kortingen die aan een betaalrekening
hangen laten we staan als de bank ze standaard toont, met de voorwaarde in de
opmerking (ABN AMRO toont bijvoorbeeld standaard de huisbankkorting).

## Stand per bank (2026-07-23)

| Bank | Status | Toelichting |
| --- | --- | --- |
| Rabobank | gelukt | HTML-tabel, standaardweergave annuiteiten + basisvoorwaarden |
| ABN AMRO | gelukt | tabel in iframe op eigen subdomein hypotheken.abnamro.nl; standaard Budget Hypotheek met huisbankkorting |
| Obvion | gelukt | Woon Hypotheek, annuitair |
| a.s.r. | gelukt | eerste matrix (ASR hypotheek annuitair/lineair) |
| MUNT Hypotheken | gelukt | offerterente; robots.txt verbiedt alleen hun pdf-overzicht, niet de HTML-pagina |
| Nationale-Nederlanden | gelukt | widget zonder table-element; parser leest de gerenderde cellen, standaardvorm wordt in de HTML gecontroleerd |
| Florius | gelukt, beperkt | alleen de Verduurzaam Hypotheek staat als HTML; het hoofdproduct (Compleet Hypotheek) is pdf-only |
| ING | overgeslagen | anti-bot-muur, ook voor een gewone headless browser; geen omweg gebouwd |
| SNS | overgeslagen | opgegaan in ASN Bank; site toont alleen de interactieve ASN-rentetool |
| ASN Bank | overgeslagen | tarieven alleen als pdf-download en rekentool |

a.s.r. blokkeert in robots.txt AI-trainingsbots bij naam (GPTBot, ClaudeBot, CCBot);
onze crawler is geen trainingsbot en valt onder de `*`-groep, die de rentepagina
toestaat. We herpubliceren alleen feiten met bronvermelding.

## Een bank toevoegen

1. Zoek de openbare rentepagina op de EIGEN site van de bank (nooit een vergelijker)
   en controleer robots.txt.
2. Bekijk hoe de tarieven er staan: HTML-tabel (makkelijk), client-side widget
   (parser op de gerenderde markdown/HTML) of alleen pdf (bank valt af, of bouw
   bewust een pdf-parser).
3. Schrijf in `scripts/ingest-open/rentes-verstrekkers.py` een `parse_<bank>`-functie
   die `(markdown, html) -> (productnaam, rijen)` teruggeeft. Gebruik de helpers
   (`md_tabellen`, `vind_tabel`, `matrix_rijen`) en veranker de parser aan de
   kopregel van de tabel, zodat een paginawijziging tot OVERGESLAGEN leidt en nooit
   tot verkeerde cijfers.
4. Voeg een `Bank(...)`-entry toe aan `BANKEN`. Leg vast welke standaardweergave de
   pagina toont (hypotheekvorm, kortingen) en zet dat in de opmerking.
5. Draai het script en controleer de nieuwe rijen tegen de pagina in je browser.

## Bekende breekpunten

- Banken herontwerpen hun rentepagina's regelmatig. Elke parser eist daarom de exacte
  tabelkop of een bevestigingszin; wijkt de pagina af, dan wordt de bank overgeslagen
  in plaats van fout geparset.
- De ABN-iframe-URL (`hypotheken.abnamro.nl/interest-rates/app/`) kan wijzigen; kijk
  dan in de publiekspagina naar het nieuwe iframe-adres.
- NN en de ABN-app tonen een standaardselectie; de parsers controleren die selectie
  expliciet (tekst op de pagina) en slaan de bank anders over.
