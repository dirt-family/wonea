# Data-ingest (Fase 5.1): CBS-buurten en BAG-adressen

Twee scripts vullen de database met echte openbare data. Ze zijn ontworpen om
heel Nederland aan te kunnen (gemeente voor gemeente, begrensd en gecapt),
maar lokaal draaien we alleen het testgebied. **Expliciete noot: het
heel-NL-pad is ontworpen maar niet lokaal getest; alleen het testgebied
(Eindhoven) is end-to-end geverifieerd.**

- `scripts/ingest-cbs.ts`: CBS StatLine "Kerncijfers wijken en buurten" (KWB)
  voor een gemeente: buurtcode, buurtnaam, gemiddelde WOZ-waarde, inwoners.
  Upsert in `neighborhoods` (+ gemeente in `municipalities`).
- `scripts/ingest-bag.ts`: PDOK BAG-verblijfsobjecten voor een begrensd
  gebied, gemapt naar `addresses` (bron `bag`).

Beide zijn keyless en gratis. Draai ze in deze volgorde (de BAG-ingest
koppelt aan buurten die de CBS-ingest aanmaakt):

```bash
npx tsx scripts/ingest-cbs.ts
npx tsx scripts/ingest-bag.ts
```

## Een nieuwe gemeente draaien

1. **CBS-buurten**: `WONEA_GEMEENTE="Utrecht" npx tsx scripts/ingest-cbs.ts`
   De gemeentenaam moet exact de CBS-schrijfwijze zijn (bv. "'s-Gravenhage").
   Niet gevonden = nette melding, niets gewijzigd.
2. **Gebied bepalen voor BAG**: een bbox in RD-coordinaten (EPSG:28992,
   `minx,miny,maxx,maxy`). Opzoeken kan op bv. pdok.nl (kaartviewer) of via
   een RD-coordinatenpicker. Optioneel begrens je daarbinnen op postcode4.
3. **BAG-adressen**:
   `WONEA_BBOX="136000,455000,138500,457500" WONEA_MAX_OBJECTEN=5000 npx tsx scripts/ingest-bag.ts`
4. Herhalen is altijd veilig: beide scripts zijn idempotent (2x draaien = 0
   nieuwe rijen; live bewezen in het testgebied: run 1 voegde 2.657 adressen
   toe, run 2 exact 0).

## Environment-variabelen

| Variabele | Default | Betekenis |
| --- | --- | --- |
| `WONEA_GEMEENTE` | `Eindhoven` | Gemeentenaam voor de CBS-ingest |
| `WONEA_KWB_DATASET` | `86165NED` | StatLine-dataset-id (KWB 2025) |
| `WONEA_BBOX` | Eindhoven-centrum (`160000,382000,162600,384600`) | RD-bbox voor de BAG-ingest |
| `WONEA_POSTCODE4` | leeg | Kommalijst (`5611,5612`); filtert de opgehaalde features |
| `WONEA_MAX_OBJECTEN` | `3000` | Cap op het aantal *opgehaalde* verblijfsobjecten (niet: ingevoegde woningen) |
| `WONEA_BAG_URL` | PDOK BAG WFS | Override van de WFS-basis-URL (tests/fallback) |
| `WONEA_SKIP_KOPPELTABEL` | uit | `1` = sla de CBS-koppeltabel over (forceert de postcode4-fallback) |
| `WONEA_KOPPELTABEL_URL` / `WONEA_KOPPELTABEL_ZIP` | CBS-download / `data/koppeltabel/` | Alternatieve bron of lokaal pad voor de koppeltabel-zip |

Het KWB-dataset-id per jaar vind je in de StatLine OData-catalogus:
`https://opendata.cbs.nl/ODataCatalog/Tables?$format=json&$filter=substringof('Kerncijfers wijken',Title)`
(nieuw jaar = nieuw id; zet het in `WONEA_KWB_DATASET`).

## Hoe het werkt

### CBS (StatLine OData v3)

Twee live geverifieerde StatLine-eigenaardigheden bepalen de opzet:
de `TypedDataSet` accepteert **alleen eq-filters** (functies als
`startswith` worden stil genegeerd), en codes/namen zijn met spaties gepad.
Daarom: (1) gemeentenaam naar GM-code via de dimensietabel
`WijkenEnBuurten`, (2) buurtcodes + -namen via `Municipality eq 'GM....'`,
(3) cijfers per batch van 20 buurten met eq-or-filters, met een kleine delay.
De WOZ-waarde staat in de bron in duizenden euro's en wordt naar hele euro's
omgerekend. Buurten zonder cijfers (CBS-geheimhouding) houden `null`; een
null overschrijft nooit een eerder bekende waarde.

Slugs: bestaande buurten houden hun slug (URL-stabiliteit). Botst een
buurtnaam binnen de gemeente (echte CBS-buurt "Binnenstad" naast de
seed-buurt "Binnenstad"), dan krijgt de nieuwe een deterministisch suffix
uit de buurtcode (`binnenstad-1110`).

### BAG (PDOK)

Het plan noemde de "BAG OGC API Features" op `api.pdok.nl/lv/bag/ogc/v1`,
maar die API serveert (geverifieerd 2026-07-22) alleen vector-tiles en
styles, geen features. Daarom gebruiken we de eveneens keyless **PDOK BAG
WFS 2.0** (`service.pdok.nl/lv/bag/wfs/v2_0`), die dezelfde BAG-data als
GeoJSON levert en de pand-join al ingebakken heeft: elk verblijfsobject
draagt zelf `bouwjaar`, `pandidentificatie` en `pandstatus`, dus een aparte
panden-opvraag is niet nodig. Paging via `startIndex`/`count` (500 per
pagina, 300 ms delay per request: nette burger), uitvoer in WGS84.

Gemapt worden alleen verblijfsobjecten met gebruiksdoel `woonfunctie`
(gemengd gebruik telt mee) en status "in gebruik", met een geldige postcode,
oppervlakte 10-1500 m2 (BAG kent placeholder-waarden als 1 en 999999) en
bouwjaar 1500-2035.

### Woningtype-heuristiek (gedocumenteerd, bewust simpel)

BAG kent geen woningtype. De afleiding:

1. meer dan 1 verblijfsobject in hetzelfde pand: **appartement**;
2. anders op oppervlakte: >= 160 m2 **vrijstaand**, 120-159 m2
   **twee-onder-een-kap**, daaronder **tussenwoning**.

Beperkingen: **hoekwoning** is uit BAG-attributen niet af te leiden en wordt
door de ingest nooit toegekend. De pand-telling ziet alleen de in deze run
opgehaalde features; een pand dat op de rand van de bbox of de max-cap valt
kan te laag geteld worden (dan wordt een appartement als grondgebonden
gezien). Vrijstaand vs. twee-onder-een-kap op oppervlakte is een grove
benadering.

### Energielabel

Indicatie op bouwjaarklasse, met exact dezelfde klassen en verdeling als de
seed-generator (`db/seed/generator.ts`), maar deterministisch per BAG-id
(zelfde adres krijgt elke run hetzelfde label; idempotentie).
`energielabel_bron` blijft `indicatie`; echte labels via EP-Online (gratis
RVO-key) staan op de livegang-TODO.

### Buurt-koppeling

Primair: de **CBS-koppeltabel** postcode+huisnummer naar buurt
(`download.cbs.nl/postcode/2025-cbs-pc6huisnr20250801_buurt.zip`, keyless,
~22 MB). De zip wordt eenmalig gecachet in `data/koppeltabel/` en per gebied
streamend gefilterd (systeem-`unzip` vereist; geen npm-dependency) naar een
klein JSON-cachebestand. In het testgebied kreeg 100% van de adressen zo een
exacte buurt.

Fallback (eerlijk benoemd als **beperking**): lukt de koppeltabel niet (geen
netwerk, geen `unzip`, of `WONEA_SKIP_KOPPELTABEL=1`), dan koppelen we op
**postcode4 naar de meest voorkomende bestaande buurt** in dat
postcode4-gebied (deterministisch bij gelijke stand). Dat is aantoonbaar
grover dan de echte CBS-koppeling: een postcode4-gebied overlapt meerdere
buurten, dus buurtstatistieken op de adrespagina kunnen dan naast de
werkelijke buurt zitten. Adressen zonder enige koppeling worden overgeslagen
en geteld in het eindrapport. Let op: de koppeltabel-jaargang (2025) hoort
bij de KWB-jaargang (86165NED); wissel je van jaar, wissel dan beide.

### Snapshots en offline-gedrag

Elke geslaagde volledige run schrijft een JSON-snapshot in
`db/seed/snapshots/`: `cbs-<gemeente>.json` (opgehaalde buurtrijen) en
`bag-<gebied>.json` (ruwe features, hard gecapt op ~4 MB zodat het bestand
commitbaar blijft; past de hele run niet, dan worden de eerste N features
bewaard). Bij een netwerkfout vallen beide scripts **stil terug op de
snapshot**; is die er niet, dan volgt een nette melding en exit 0. De
gecommitte seed blijft bewust de offline-basis van het project.

### Harde regels (afgedwongen in `lib/ingest/upsert.ts`, getest)

- **Suppressie wint altijd**: voor elke adres-upsert wordt
  `isSuppressed(postcode, nummerslug)` gecheckt; een bevestigde opt-out
  wordt nooit (opnieuw) toegevoegd en overleeft elke her-ingest.
- **Idempotent**: uniekheid op postcode+nummerslug, `onConflictDoNothing`,
  en de `status` van bestaande rijen wordt nooit aangeraakt (dus nooit terug
  naar `actief`). Botst een echt BAG-adres met een bestaand seed-adres, dan
  blijft de bestaande rij staan.
- **Hervatbaar**: bij een afgebroken run bewaart `data/ingest-bag-state.json`
  de laatste offset; de volgende run hervat daar. Een herstart vanaf nul is
  sowieso veilig door de idempotentie. Na een volledige run wordt de state
  opgeruimd.
- **Batch-transacties**: upserts gaan per 500 features in een
  SQLite-transactie.
- Buurt-afgeleiden (`gem_oppervlakte`, `anker_m2_prijs`) worden na elke run
  herberekend uit de eigen adresrijen, zoals de seed dat ook doet.

## Beperkingen (eerlijk lijstje)

- **Buurt-koppeling zonder koppeltabel** is postcode4-grof (zie boven).
- **Energielabels zijn indicaties** op bouwjaar, geen echte labels
  (EP-Online is een livegang-TODO).
- **Koopsommen ontbreken**: echte transactieprijzen zijn betaalde
  Kadaster-data (TODO); verkopen blijven synthetisch op buurtniveau, nooit
  aan een echt adres gekoppeld.
- **WOZ per buurt** is een gemiddelde (CBS KWB), geen WOZ per adres; kleine
  buurten kunnen door CBS-geheimhouding geen waarde hebben.
- **Woningtype is een heuristiek** (geen hoekwoningen; pand-telling begrensd
  door bbox/cap).
- **De max-cap telt opgehaalde features**, niet ingevoegde woningen: met een
  streng postcode4-filter houd je netto minder woningen over dan de cap.
- **Heel-NL is ontworpen, niet lokaal getest**: paging, caps, hervatten en
  idempotentie zijn er klaar voor, maar alleen Eindhoven-centrum is echt
  gedraaid (3.000 van de 34.758 beschikbare objecten in de test-bbox).

## Testresultaten (2026-07-22, testgebied)

- CBS: 116 echte Eindhoven-buurten, 101 met WOZ; her-run: 0 toegevoegd,
  116 bijgewerkt. Offline-fallback op snapshot geverifieerd.
- BAG run 1: 3.000 features opgehaald, 2.657 adressen toegevoegd, 323 geen
  woning/bruikbaar, 20 botsingen met bestaande (seed-)adressen, 100% via de
  koppeltabel gekoppeld aan 25 echte buurten.
- BAG run 2: **0 toegevoegd, 2.677 bestonden al** (idempotentie-bewijs).
- Offline-fallbacks (snapshot en geen-snapshot-pad) en het
  postcode4-filter live geverifieerd; suppressie-gedrag afgedekt in
  `tests/ingest.test.ts`.
