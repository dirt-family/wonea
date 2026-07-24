# Prototype-oogst (23 jul 2026)

Mitch leverde een eerder gebouwd HTML-prototype aan (8 pagina's: index, zoeken, woning,
buurt, vergelijken, verduurzamen, rekenhulpen, mijn-woning). Dit document is de
gedestilleerde oogst: wat we overnemen, wat bewust niet, en waar het landt.
De prototype-HTML zelf staat niet in de repo; dit document is de bron voor de bouwers.

## Huid-besluit
- **Structuur, modules, IA en copy-voice: overnemen.** Dat is de waarde van het prototype.
- **Huisstijl: NIET overnemen.** Het prototype is paars + Plus Jakarta Sans; onze huid
  (BRAND.md: diep blauw #16324f, Source Serif 4 + Inter, warm licht) staat vast en is live.
- Wel overgenomen stijl-lessen (huid-neutraal): tabular-nums op alle cijfers
  (Tailwind-utility `tabular-nums`), delta-pills op/neer/vlak, energielabel-badges in de
  EU-kleuren, kleine module-tags op kaartkoppen, feitenlijst 2-koloms, disclaimer-blok.
  Deze bestaan nu als componenten in `components/ui.tsx` (DeltaPil, EnergieLabelBadge,
  ModuleTag, FeitenLijst) — gebruik die, bouw ze niet opnieuw.

## Copy-voice (overal toepassen, dit is het merk)
Gewone taal, eerlijk, rustig, anti-druk. Letterlijke zinnen uit het prototype die we
(vrijwel) zo hergebruiken:
- "Het is een indicatie, geen taxatie, dus zie het als een goed startpunt voor je
  gesprek of je bod."
- "Eerlijk: niemand kan je vertellen wat het exact wordt, en wees voorzichtig met
  sites die dat wel beloven. Wat we wel kunnen: laten zien wat vergelijkbare huizen
  in de buurt echt opbrachten."
- "Zodat je rustig een keuze maakt, niet onder druk."
- "Concreet, geen verkooppraatje."
- "We delen je gegevens alleen met jouw toestemming."
- "Zij betalen ons voor de introductie. Zo simpel is het." (bij adviseur-matching)
- "Bedoeld om je een gevoel te geven, niet om op te baseren." (rekenhulpen-disclaimer)
- Nav-label voor de tools-hub: **"Rekenhulpen"** (consumententaal), route blijft /tools.

## Per pagina: wat we overnemen

### Woningpagina (app/woning/[postcode]/[nummerslug]) — verrijken
Prototype-opbouw die we volgen (met alleen-echte-data-toets per module):
1. Broodkruimel Home / Plaats / Buurt / Adres (buurt linkt naar onze buurtpagina).
2. Titelblok: adres + "postcode plaats, buurt · type · m² · bouwjaar" + rechts
   geschatte waarde groot met DeltaPil (jaarontwikkeling uit valuationHistorie).
3. Kerncijfer-strip (4 StatTegels): WOZ (laatste jaar, +% t.o.v. vorig), prijs per m²
   (+ buurtgemiddelde als sub), energielabel (EnergieLabelBadge + bron echt/indicatie),
   waarde-bandbreedte. GEEN vraagprijs (hebben we niet).
4. "Wat is dit huis waard?" — uitlegkaart in gewone taal (copy-voice hierboven) +
   twee subkaarten: waardeontwikkeling (Sparkline/staafjes uit valuations-historie) en
   "WOZ door de jaren" (regel per jaar uit wozValues).
5. "Wat zou je kunnen bieden?" — de eerlijke biedmodule: comparables-lijst (adres,
   m², verkoopmaand, prijs) uit onze sales op buurtniveau + link naar /biedadvies.
   GEEN "+X% boven vraag" (geen vraagprijsdata).
6. "Energie en verduurzamen" — label-badge + besparingsindicatie uit lib/normen/besparing
   + knop naar /verduurzamen/advies.
7. WOZ-check-module: vergelijk WOZ met buurtgemiddelde (gemWoz); wijkt hij duidelijk af,
   zeg dat eerlijk + leg uit dat bezwaar GRATIS via de eigen gemeente kan (geen
   no-cure-no-pay-partner pushen; wij hebben er geen).
8. Inline maandlast-minirekenhulp met sliders (bod + rente), annuiteit 30 jaar, met
   onze echte lib/hypotheek-functies; DNB-gemiddelde als default-rente.
9. Kenmerken-FeitenLijst (type, bouwjaar, oppervlak, label; alleen velden die we hebben).
10. Sticky sidebar: waarde + "Indicatie, geen taxatie" + knop "Volg dit huis" (claim-flow)
    + "Deel rapport" (bestaande shared-report-flow) + hulp-kaart met de introductie-copy.
NIET: interesse/populariteit-module (geen kijkcijfers), omgevingsrisico (geen bron
gekoppeld; backlog), fotogallerij (geen foto's; geen placeholder-nep).

### Buurtpagina (app/buurt/[gemeente]/[buurt]) — verrijken
1. Broodkruimel + titel + één zin karakteristiek ALLEEN als die uit data volgt (anders
   weglaten; geen verzonnen "rustige jaren-30 buurt").
2. Stats-rij: gem. m²-prijs (ankerM2Prijs, met delta indien historie), gem. WOZ (gemWoz),
   aantal woningen in ons bestand, aantal recente verkopen.
3. Prijsontwikkeling-staafgrafiek (marketStats/valuations per jaar; alleen met echte reeks).
4. "Woningen in <buurt>" — kaartenrij uit onze adressen met valuation, link naar
   woningpagina's, VoorbeelddataLabel waar van toepassing.
5. Recente verkopen (buurtniveau, sales) met maand + prijs.
6. "Vergelijkbare buurten" — 3 kaarten: zelfde gemeente, dichtstbijzijnde m²-prijs,
   met m²-prijs als subregel. Linkt naar die buurtpagina's.
7. "Volg deze buurt" knop → alertSubscriptions-flow indien aanwezig, anders weglaten.
NIET: voorzieningen (scholen/OV/huisarts) en "wie wonen er" (CBS kerncijfers niet
geïngest; backlog met bronvermelding CBS/DUO/OSM), veiligheidsscore (geen bron).

### Zoeken (app/zoeken — NIEUW)
Zoekresultaten + filters op onze eigen adressen-db:
- Zoekbalk (q → straat/postcode/plaats, ilike) + filters: woningtype, energielabel,
  min. oppervlak, gemeente. Server-side via searchParams (geen client state nodig).
- Resultaten als woningkaarten (adres, plaats, m² · type · bouwjaar, waarde +
  bandbreedte klein, EnergieLabelBadge), linkend naar de woningpagina.
- "Vergelijk"-checkbox per kaart met vaste vergelijk-balk onderaan (max 3), die naar
  /vergelijken?w=slug1,slug2 gaat. Kleine client-component voor de selectie is ok.
- Lege staat: LegeStaat met eerlijke uitleg (testgebied).
- Noindex (adresdiepe pagina's zijn gated). GEEN kaart/map (geen coordinaten; backlog).

### Vergelijken (app/vergelijken — NIEUW)
2-3 woningen naast elkaar via ?w=slug,slug,slug (server-side):
- Per kolom: adres, plaats · type, FeitenLijst-rijen: geschatte waarde, bandbreedte,
  WOZ, prijs per m², oppervlak, bouwjaar, EnergieLabelBadge, indicatieve maandlast
  (lib/hypotheek, DNB-gemiddelde, 30 jr) — allemaal echte data.
- Middelste/beste kolom NIET highlighten op "beste" (wij vellen geen oordeel);
  wel een "Wat valt op?"-kaart eronder die feitelijke verschillen benoemt in gewone
  taal (grootste/kleinste, zuinigste label, hoogste m²-prijs) — puur uit data afgeleid.
- Lege/1-woning-staat: uitleg + link naar /zoeken.
- Disclaimerregel over indicatieve maandlast (aannames benoemen).

### Rekenhulpen — 2 nieuwe tools
1. **Kosten koper / eigen geld** (app/kosten-koper): koopsom-slider, starterscheckbox,
   uitkomst: overdrachtsbelasting + indicatie bijkomende kosten + minimaal eigen geld.
   De 2026-parameters (tarief 2%, startersvrijstelling: leeftijdsgrens + woningwaardegrens,
   beleggerstarief) EERST verifiëren op een primaire bron (belastingdienst.nl /
   wetten.overheid.nl) en vastleggen in lib/normen/overdrachtsbelasting-2026.ts met bron
   + peildatum, zoals lib/normen/leennormen-2026.ts. Lukt harde verificatie niet:
   de tool NIET shippen (geen gegokte belastingregels).
2. **Overbieden** (app/overbieden): vraagprijs + %-overbod-sliders → jouw bod + "deel
   mogelijk uit eigen zak" (boven getaxeerde waarde; taxatie = eigen invoerveld, GEEN
   aanname dat taxatie X% boven vraagprijs ligt — dat was in het prototype een verzonnen
   3,8%-aanname en die nemen we niet over). Uitleg dat banken tot de getaxeerde waarde
   financieren. Kruislinks met /budget en /biedadvies.
Beide: zelfde patroon als bestaande tools (stepper of één scherm, UitkomstKaart,
UitklapUitleg "zo rekenen we", BronLabel, noindex tot gating? nee: rekenhulpen zonder
adresdata zijn indexeerbaar, zelfde als /budget).

### Mijn Woning (dashboard) — NIET in deze wave
Alerts-feed ("X is verkocht", "WOZ staat online", waarde-delta's), overwaarde-indicatie
(waarde minus restschuld uit mortgageInfo): mooie verrijkingen, maar app/dashboard is
eigendom van de nog lopende Wave B/C. Oogst geparkeerd; oppakken na oplevering B/C.

## Bewust NIET overgenomen (met reden)
- Paarse huisstijl, Plus Jakarta Sans, "wonea."-wordmark met punt → eigen huid staat.
- Interesse-module (1.240x bekeken, 14 bezichtigingen) → verzonnen; geen tracking-bron.
- "+7% boven vraagprijs" → geen vraagprijsdata; komt terug zodra er een listings-bron is.
- Omgevingsrisico (overstroming/hitte/fundering) → echte bron (Klimaateffectatlas/PDOK)
  nog niet gekoppeld; op TODO als ingest-kandidaat, niet faken.
- Voorzieningen + bewoners-statistieken per buurt → CBS kerncijfers wijken/buurten +
  DUO + OSM zijn echte open bronnen; aparte ingest-klus, op TODO.
- WOZ-bezwaar via no-cure-no-pay-partner → geen partner; wij leggen uit dat bezwaar
  gratis via de gemeente kan (past beter bij de merkbelofte).
- Nepkaart-placeholders en placeholder-huisillustraties als "foto" → geen nep-media.
- Vuistregel "4,5x inkomen" voor maximale hypotheek → wij hebben de echte leennormen-
  tabellen; altijd lib/normen/leennormen-2026.ts gebruiken.

## Levendigheids-patronen uit het prototype (addendum 23 jul, avond)
Mitch leverde het prototype opnieuw als levendigheids-referentie plus een NIEUW
logo-concept (gekozen richting: navy #1E293B naar amber #F59E0B gradient; staat
in components/logo.tsx en public/icon.svg). De patronen die het prototype
levend maken en die de huisstijl v3 in Wonea-vorm moet dragen:
- **Hero met gradient-wash bovenin** (tint-50 naar transparant) in plaats van
  een vlak paneel; zoekbalk als zwevend element met gelaagde schaduw en een
  focus-ring in de merkkleur.
- **Pill/badge-systeem overal**: merk-wash-pills met rand, neutrale pills,
  delta-pills op/neer met eigen washes, "tag"-microlabels op kaartkoppen.
- **Energielabels in de echte EU-labelkleuren** (A groen t/m G rood) als
  vierkante badges; overal identiek.
- **Stat-tiles op tint** (achtergrond-tint, geen witte kaart) met klein label,
  groot tabular getal en een subregel.
- **Gelaagde zachte schaduwen** (sm/md/lg) voor zweefgevoel op kaarten en de
  zoekbalk; hover tilt de schaduw een laag omhoog + translateY(-2px).
- **Alert/lijst-rijen met kleurdot** voor feeds en keuzelijsten.
- **Donkere band (radius 20) met witte kop + pills** als afsluitende CTA-sectie.
- **CSS-staafgrafiekjes** met de merkkleur voor "nu" en tint voor historie.
- **Sticky sidebar-kaarten** op detailpagina's.
- De prototype-PAARSE kleur vervalt: de gekozen richting is navy naar amber.
