# Kadaster-aansluitroute: koopsommen en WOZ (onderzocht 2026-07-23)

Uitwerking van DATABRONNEN.md punt 3 ("gratis tarief zegt niets over de
toegangsroute; uitzoeken bij aansluiten"). Alles hieronder is op 2026-07-23
nagelezen op kadaster.nl; waar iets een aanname is staat dat erbij.

## Kernconclusies

1. **Koopsom API (echte transactieprijzen): wel toegankelijk, betaald.**
   De route loopt via een zakelijk Mijn Kadaster-account plus een
   Kadata Internet-abonnement. Kosten: EUR 0,45 per bevraagd adres
   (btw-vrij) plus een klein jaarabonnement. Stappenplan hieronder.
2. **Gratis WOZ-bevragingen: NIET toegankelijk voor Wonea.** De gratis
   WOZ-producten van het Kadaster (WOZ API Bevragen, Individuele bevraging,
   Massale bevraging, BevragingsApp) zijn voorbehouden aan overheden en
   afnemers met een wettelijke taak. De verwachting in DATABRONNEN.md
   ("na aansluiting gratis Kadaster-WOZ") klopt dus niet voor een commercieel
   platform; de WOZ-check blijft draaien op eigen invoer van de eigenaar,
   met een betaalde tussenpartij als latere verdieping.

## Route A: Koopsom API (EUR 0,45 per adres)

Wat het levert: de meest recente transactie (datum plus koopsom) uit de
basisregistratie Kadaster, per adres. Dit vult de sales-tabel met echte
verkopen (bron "kadaster", mag wel een adres_id hebben; zie db/schema.ts).

Stappenplan voor Mitch, in volgorde:

1. **Mijn Kadaster-account aanvragen** (zakelijk, gratis, KvK-nummer
   verplicht): kadaster.nl/zakelijk/mijn-kadaster/aanmelden-mijn-kadaster.
   Wonea heeft dus een KvK-inschrijving nodig; zonder KvK geen route.
   De eerste aangemaakte gebruiker wordt "eerste beheerder" en beheert
   vervolgaccounts en API-keys.
2. **Abonnement Kadaster-on-line plus Kadata Internet afsluiten** (alleen
   samen af te nemen). Jaarkosten: EUR 40,20 per kalenderjaar met
   automatische incasso, EUR 80,40 zonder. Dit is de toegangspoort tot de
   Kadata-API's; naast het abonnement betaal je per afgenomen product.
3. **API-key aanvragen** binnen Mijn Kadaster, onder Kadata Internet. De
   eerste beheerder doet dit (profielinstellingen, onder je naam in
   Mijn Kadaster).
4. **Koopsom API aansluiten en testen.** Technische documentatie (Swagger):
   kadatawebservice.kadaster.nl/kadastercheck/docs (Kadaster Check API,
   zelfde portaal). Tarief: EUR 0,45 per adres, btw-vrij, per bevraging
   gefactureerd. Ter vergelijking: de webwinkel-variant kost EUR 3,70 per
   postcode en is handwerk; voor het product is de API dus de juiste route.
5. **Inbouwen in Wonea** (aparte bouwtaak, nog niet gedaan):
   - nieuw `lib/bronnen/koopsom.ts` naar het patroon van
     `lib/bronnen/energielabel.ts`: key-gated, timeout, null bij fout;
   - schrijven naar `sales` met bron "kadaster" en adres_id, nooit als seed;
   - suppressie checken voor elke bevraging en elke insert
     (lib/suppression.ts), net als de labels-ingest;
   - kosten-beheersing: alleen on-demand bevragen (bij een adrespagina-bezoek
     of biedadvies), resultaat cachen in sales, en een harde maandcap in env
     (elke bevraging is echt geld);
   - UI: prijs tonen met bron ("Kadaster, transactie d.d. ...") en peildatum.

## Route B: WOZ, wat er echt kan

Bevindingen per product (kadaster.nl, 2026-07-23):

| Product | Gratis? | Wie mag afnemen | Vereisten |
|---|---|---|---|
| WOZ API Bevragen | ja | alleen gemeenten (belastingheffing, Huisvestingswet, Wet goed verhuurderschap) | OIN, PKIoverheid-certificaat, Digikoppeling |
| WOZ Massale bevraging | ja | primaire en sommige secundaire afnemers (wettelijke taak) | OIN, PKIoverheid-certificaat |
| WOZ BevragingsApp | ja | primaire, secundaire en tertiaire afnemers (wettelijke taak) | Mijn Kadaster plus eHerkenning eH3 |
| WOZ-waardeloket (wozwaardeloket.nl) | ja | iedereen, individueel raadplegen | geen, maar de voorwaarden verbieden massaal of geautomatiseerd opvragen |

Conclusie: de "gratis" WOZ-tarieven op de tarievenpagina gelden binnen een
afnemerskring waar Wonea niet in past. Een commercieel woningplatform heeft
geen wettelijke taak en komt niet door het aanvraagformulier van de LV WOZ.
Het WOZ-waardeloket scrapen is expliciet verboden in de gebruiksvoorwaarden
en doen we niet: dat zou ook de merkbelofte (alleen nette, openbare bronnen)
breken.

Wat WEL kan, in volgorde van voorkeur:

1. **Eigen invoer van de eigenaar** (bestaat al: WOZ-check en claim-flow,
   bron "eigenaar"). Blijft de gratis laag.
2. **Betaalde tussenpartij met eigen WOZ-aansluiting**, bv. Altum AI
   (docs.altum.ai/apis/woz-api, self-service key, zie DATABRONNEN.md punt 6).
   Kandidaat voor de betaalde verdieping, niet voor de gratis laag.
3. **Afwachten of WOZ echt open data wordt.** WOZ-waarden zijn sinds 2016
   openbaar, maar een landelijke open dataset vergt een wetswijziging
   (standpunt data-eigenaar op data.overheid.nl). Periodiek herchecken.

## AVG en voorwaarden (aandachtspunten, deels aanname)

- Koopsommen zijn gekoppeld aan een adres en daarmee vaak indirect
  herleidbaar tot de (ver)koper: behandelen als persoonsgegeven. Actie bij
  inbouwen: docs/AVG-CHECKLIST.md en de LIA aanvullen (grondslag
  gerechtvaardigd belang, art. 14-informatieplicht) en de opt-out-cascade
  uitbreiden naar sales-rijen met adres_id.
- Het Kadaster levert onder eigen leverings- en gebruiksvoorwaarden; wij
  worden zelf verwerkingsverantwoordelijke voor wat we afnemen en tonen.
  Een verwerkersovereenkomst met het Kadaster is naar verwachting niet aan
  de orde (het Kadaster is geen verwerker van ons), maar dit is een aanname:
  de Kadata-voorwaarden bij stap 2 echt lezen voor ondertekening, en de
  jurist-signoff uit PLAN.md par. 11 geldt ook hier.
- EP-Online (energielabels) heeft deze vragen niet: gratis, expliciet
  toegestaan voor gebruik op een woningsite, alleen de ruwe dataset
  herkenbaar doorleveren is verboden (DATABRONNEN.md punt 4).

## Actielijst Mitch

- [ ] KvK-inschrijving voor Wonea regelen (randvoorwaarde voor alles hierboven).
- [ ] Mijn Kadaster-account aanvragen (gratis, met dat KvK-nummer).
- [ ] Abonnement Kadaster-on-line plus Kadata Internet (EUR 40,20 per jaar
      met incasso) afsluiten en de Kadata-voorwaarden bewaren in archives/.
- [ ] API-key laten aanmaken (eerste beheerder) en als KADASTER_API_KEY
      aanleveren (naam-aanname; definitief bij de bouw van lib/bronnen/koopsom.ts).
- [ ] Beslissen: koopsommen alleen on-demand (per bezochte adrespagina) of
      batch voor het testgebied. Advies: on-demand met maandcap, want per
      bevraging EUR 0,45.
- [ ] EP-Online-key aanvragen op apikey.ep-online.nl (los spoor, gratis,
      persoonsgebonden) en als EPONLINE_API_KEY aanleveren; daarna
      `npx tsx --env-file=.env scripts/ingest-labels.ts` draaien.

## Bronnen (alle geraadpleegd 2026-07-23)

- kadaster.nl/zakelijk/over-ons/financieel/tarieven (Koopsom API EUR 0,45;
  WOZ-producten gratis; Kadata-abonnementsvormen)
- kadaster.nl, productpagina Koopsom API (aansluitstappen, API-key via
  Kadata Internet, Swagger-portaal)
- kadaster.nl/zakelijk/mijn-kadaster (aanmelden, KvK-vereiste, kosten
  abonnement, eerste beheerder)
- kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen
  (alleen gemeenten; OIN, PKIoverheid, Digikoppeling)
- kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-bevragingsapp en
  woz-massale-bevraging (afnemerskring, eHerkenning eH3, OIN-vereisten)
- kadaster.nl/zakelijk/registraties/landelijke-voorzieningen/woz (LV WOZ,
  afnemers met wettelijke taak)
- wozwaardeloket.nl en data.overheid.nl (individueel raadplegen, verbod op
  geautomatiseerd of massaal opvragen, open-data-status vergt wetswijziging)
