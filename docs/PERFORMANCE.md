# PERFORMANCE.md: rendering, cache en schaal (Fase 5.3)

Eigenaar van dit document: de performance-laag. Het beschrijft wat er nu staat
(geverifieerd tegen een echte productie-build op 2026-07-22), waarom elk beleid
zo gekozen is, en wat er bij NL-schaal bij moet. Voorstellen voor
schema-wijzigingen staan hier als voorstel en zijn NIET doorgevoerd.

## 1. De hete paden en hun queries

### 1.1 Adrespagina (`/woning/[postcode]/[nummerslug]`)

Per render, in volgorde:

| # | Query | Index | Status |
|---|-------|-------|--------|
| 1 | `addresses` op `(postcode, nummerslug)` | `uq_addresses_postcode_nummerslug` | gedekt |
| 2 | `optouts` op `(postcode, nummerslug)` + `bevestigd_at` (suppressie) | `uq_optouts_adres_key` | gedekt |
| 3 | `neighborhoods` op `buurt_code` | primary key | gedekt |
| 4 | comparables: `sales` op `buurt_code` + `datum >= cutoff` + `woningtype`, `ORDER BY datum DESC` | `idx_sales_buurt_datum` dekt buurt + datumbereik + sortering; `woningtype` en oppervlakteklasse worden nagefilterd | goed genoeg: per buurt blijven het tientallen rijen, ook bij NL-schaal |
| 5 | `valuations` op `(adres_id, datum)` | `idx_valuations_adres_datum` | gedekt |
| 6 | eventueel INSERT in `valuations` (zie 2.1) | n.v.t. | zie 2.1 |
| 7 | `woz_values` op `adres_id` | `idx_woz_adres` | gedekt |
| 8 | `municipalities` op `code` | primary key | gedekt |

Conclusie: het pad is index-gedekt; het punt van aandacht is niet de leessnelheid
maar de write in stap 6. Dat lost de ISR-keuze op (par. 2.1).

### 1.2 Zoeken (`/api/search`)

Drie zoekvormen, alle drie prefix-`LIKE` met `status = 'actief'`:

- postcode-prefix op `addresses.postcode`
- straat-prefix + nummerslug-prefix op `addresses.straat` / `addresses.nummerslug`
- straat- of plaats-prefix op `addresses.straat` / `addresses.plaats`

Twee problemen bij NL-schaal:

1. **De bestaande indexen worden voor deze LIKEs niet gebruikt.** SQLite's
   LIKE is standaard hoofdletter-ongevoelig, en de LIKE-optimalisatie (prefix
   via index) werkt alleen op kolommen/indexen met `COLLATE NOCASE`. De kolommen
   staan op de standaard BINARY-collatie, dus elke zoek-toetsaanslag is nu een
   volledige tabelscan. Op het testgebied (~2.000 rijen) onzichtbaar, op ~8-9
   miljoen adressen niet. PLAN.md par. 1 schrijft hier al "NOCASE-indexen (of
   FTS5)" voor; zie het voorstel in par. 4.
2. **`plaats` heeft helemaal geen index**, ook geen BINARY.

De suppressie-nacheck (max 24 puntqueries op `uq_optouts_adres_key`) is prima.

### 1.3 Sitemap-count en shards

De sitemap-routes (SEO-deel van Fase 5, parallel gebouwd) staan in
`lib/seo/sitemap.ts` + `app/sitemap.xml` + `app/sitemaps/[naam]`. De
count-query (`telIndexeerbareAdressen`) doet per adres: het
`status = 'actief'`-filter, een `NOT EXISTS` op `optouts` (gedekt door
`uq_optouts_adres_key`), een `EXISTS` op `index_gating` (gedekt door
`uq_gating_scope_code`) en een gecorreleerde comparables-count op `sales`
(gedekt door `idx_sales_buurt_datum`) plus WOZ-`EXISTS` (`idx_woz_adres`). De
shard-query herhaalt dezelfde WHERE met `ORDER BY id LIMIT ... OFFSET ...`.
De routes zijn `force-dynamic` met `Cache-Control: public, max-age=3600`,
dus de query draait hooguit ~1x per uur per (shared) cache: prima beleid.

Op het testgebied is dit allemaal mild. Twee dingen moeten anders zodra dit
NL-schaal raakt (~8-9M adressen), maar bewust NIET nu:

- **`OFFSET`-paginering vervangen** door id-vensters: `LIMIT 45000 OFFSET
  7950000` scant (en her-evalueert de gating voor) alles ervoor. Keyset
  (`WHERE a.id > @laatste ORDER BY a.id LIMIT 45000`) of vaste id-vensters
  maken elke shard even goedkoop.
- **Datadiepte vooraf berekenen.** De gecorreleerde comparables-count per adres
  is bij een count over miljoenen rijen de kostenpost. Bij ingest een
  indexeerbaar-vlag of tellerkolom bijhouden (of `index_gating` op
  adresniveau vullen) maakt count en shards triviaal. Plus de partiële index
  uit par. 4.3.

## 2. ISR-strategie (route per route)

Geverifieerd in de build-output van `next build` (legenda: ● = ISR/SSG,
ƒ = dynamic) en live via `x-nextjs-cache` MISS -> HIT.

| Route | Beleid | Waarom |
|-------|--------|--------|
| `/woning/[postcode]/[nummerslug]` | ● `revalidate = 86400`, `dynamicParams = true`, lege `generateStaticParams` | zie 2.1 |
| `/buurt/[gemeente]/[buurt]` | ● zelfde beleid | zie 2.2 |
| `/rapport/[token]` | ƒ dynamisch, bewust GEEN revalidate | zie 2.3 |
| `/`, `/methode`, `/over-ons`, `/privacy` e.d. | ○ volledig statisch | geen data of alleen build-time data |
| `/dashboard`, `/claim`, `/admin/*`, funnels met sessie | ƒ dynamisch | gebruiken cookies/sessies of `searchParams`; die horen nooit een revalidate te krijgen |
| `/dev/mail` | ƒ + harde guard | bestaat alleen bij `NODE_ENV=development` + `WONEA_DEV_MAIL=1`; in productie 404 (bewaakt door scripts/prodcheck.ts) |

### 2.1 Adrespagina: ISR gaat samen met de valuation-write, en is de veiligste variant

`getOrCreateValuation` schrijft bij render maximaal 1 rij per adres per dag in
`valuations` (bestaat de rij van vandaag al, dan alleen lezen). De afweging:

- **Dynamisch renderen** zou betekenen: elke bezoeker een render, dus elke
  bezoeker minimaal de bestaat-al-check en op piekmomenten veel gelijktijdige
  insert-pogingen door SQLite's ene writer heen.
- **ISR (gekozen)** betekent: de render, en dus de write, gebeurt alleen bij
  (re)generatie, hooguit ~1x per 24 uur per adres. De write is idempotent van
  aard (zelfde adres + zelfde datum levert dezelfde waarde op) en de
  waardehistorie blijft exact wat het plan wil: een rustige, dagelijkse reeks.
  Minder writes, zelfde uitkomst; daarom is dit de veiligste variant.

Randvoorwaarden die dit kloppend houden:

- **Lege `generateStaticParams`**: er wordt niets geprerenderd bij `next
  build`, dus de build doet geen DB-writes en heeft geen gevulde database
  nodig.
- **Opt-out blijft direct**: de verwijderflow (`app/verwijderen/[token]`) roept
  al `revalidatePath('/woning/<postcode>/<nummerslug>')` aan bij bevestiging.
  De gecachte pagina wordt dus meteen gepurged; de eerstvolgende request
  rendert opnieuw, ziet de suppressie en cachet de notFound.
- **Bekende race, klein**: twee gelijktijdige eerste requests naar een nog niet
  gecachte pagina kunnen allebei renderen en dezelfde `(adres_id, datum)`
  dubbel inserten; de index daarop is niet uniek. Onschuldig (beide rijen zijn
  identiek), maar het voorstel in par. 4 maakt er een unique index van zodat de
  invariant "1 valuation per adres per dag" ook in het schema staat.
- Een gecachte pagina kan een valuation van gisteren tonen tot de revalidate.
  Dat is eerlijk en gewenst: de waarde is een dagsnapshot, geen live koers.

### 2.2 Buurtpagina: puur leeswerk, 24 uur

Geen writes, geen cookies, en de bronnen (`market_stats`, CBS-cijfers,
seed-verkopen) veranderen hooguit maandelijks. 24 uur cache is ruim aan de
veilige kant. Eén aandachtspunt: de buurtpagina filtert kadaster-verkopen van
gesupprimeerde adressen weg, maar wordt bij een opt-out NIET gerevalidate. Nu
kan daar niets lekken (alle verkopen zijn seed en hebben per harde regel nooit
een `adres_id`); zodra er echte kadaster-verkopen met `adres_id` bestaan, moet
`applyOptoutCascade` ook de buurtpagina van dat adres revalidaten. Staat als
follow-up hieronder (par. 6).

### 2.3 Rapportpagina: bewust dynamisch

`/rapport/[token]` krijgt GEEN revalidate, om drie redenen:

1. **Intrekken moet per direct werken.** Een token kan door de claimer worden
   ingetrokken en de opt-out-cascade revoceert alle rapporten van een adres.
   Er bestaat geen `revalidatePath` per token in die flows; een 24-uurs cache
   zou een ingetrokken rapport tot een dag lang blijven serveren en dat breekt
   de merkbelofte.
2. **Tokens zijn een onbegrensde sleutelruimte.** Elke verzonnen token-URL zou
   een cache-entry (van de notFound) worden; dynamisch renderen houdt de route
   cache-vrij.
3. Het verkeer op deelrapporten is laag; hier valt niets te winnen.

### 2.4 On-demand revalidatie: wat er is en wat de grens is

- **Bestaat al**: opt-out purget de adrespagina via `revalidatePath` (zie 2.1).
- **Harde grens om te kennen**: `revalidatePath` werkt alleen binnen het
  draaiende Next-proces. De scripts (`scripts/seed.ts`, `market-drift.ts`,
  toekomstige `ingest-*.ts`) draaien via tsx BUITEN Next en kunnen de
  ISR-cache dus niet purgen. Na een her-seed of ingest is de site maximaal 24
  uur oud; dat is nu acceptabel. Wil je het sneller, dan is de nette route een
  interne revalidate-API (POST met secret, roept `revalidatePath`/
  `revalidateTag` aan) die de scripts na afloop aanroepen. Livegang-TODO, niet
  nu bouwen.

## 3. Cache-beleid (headers)

| Wat | Header | Waarom |
|-----|--------|--------|
| ISR-HTML (adres, buurt) | door Next gezet, `s-maxage=86400, stale-while-revalidate`, plus `x-nextjs-cache` | volgt uit `revalidate = 86400`, niets zelf te beheren |
| `/api/og` zonder of met ongeldig token (generieke afbeelding) | `Cache-Control: public, max-age=86400` | statische inhoud, satori-rendering is relatief duur |
| `/api/og` met geldig token | `Cache-Control: public, max-age=3600` | bevat adres + waarde; er is geen on-demand purge voor deze route, dus de korte TTL is de bovengrens op hoe lang een afbeelding na intrekken/opt-out nog uit (shared) caches kan komen. Bewust geen `stale-while-revalidate`: dat zou die grens weer oprekken. Kanttekening: social platforms cachen og-afbeeldingen aan hun kant toch weken; onze TTL begrenst alleen wat wij serveren. |
| `/widget.js` | `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` (via `headers()` in next.config.ts) | embed-script, wordt door externe sites per paginaweergave geladen; zonder deze header serveert Next public/-bestanden met `max-age=0`. Een nieuwe versie stroomt binnen een dag door. Breaking wijziging: versioneer de bestandsnaam (`widget-v2.js`) in plaats van op cache-verval te wachten. |
| `/api/search` | geen cache-header | autocomplete op elke toetsaanslag; resultaten moeten suppressie direct volgen. Eventueel later `s-maxage=60` als de zoek-QPS het eerste knelpunt wordt, maar pas na de NOCASE/FTS5-fix (par. 1.2), niet als pleister erop. |

## 4. Indexen: wat er staat en wat er bij NL-schaal bij moet

### 4.1 Bestaande indexen (db/schema.ts, volledig)

- `municipalities`: PK `code`, unique `slug`
- `neighborhoods`: PK `buurt_code`, `idx_neighborhoods_gemeente`, unique `(gemeente_code, slug)`
- `addresses`: unique `(postcode, nummerslug)`, `idx_addresses_buurt`, `idx_addresses_straat`, `idx_addresses_postcode`
- `sales`: `idx_sales_buurt_datum (buurt_code, datum)`, `idx_sales_straat`
- `valuations`: `idx_valuations_adres_datum (adres_id, datum)`
- `woz_values`: `idx_woz_adres`
- `users` unique `email`; `sessions` idx `user_id`; `magic_tokens` unique `token_hash`, idx `email`
- `claims` idx `user_id`, idx `adres_id`; `mortgage_info` unique `claim_id`
- `consents` idx `email`; `alert_subscriptions` unique + idx `claim_id`
- `emails_outbox` idx `created_at`; `leads` idx `(type, status)`, idx `created_at`; `lead_events` idx `lead_id`
- `premium_entitlements` idx `user_id`
- `optouts` unique `(postcode, nummerslug)`, unique `token`, `idx_optouts_adres`
- `widget_captures` unique `bevestig_token`, idx `created_at`; `shared_reports` unique `token`, idx `adres_id`
- `index_gating` unique `(scope, code)`; `market_stats` unique `(buurt_code, maand)`

Voor het testgebied is dit compleet. Voor NL-schaal (~8-9 miljoen adressen)
zijn de voorstellen hieronder nodig. **Voorstel, niet doorgevoerd**: dit zijn
schema-wijzigingen voor de schema-eigenaar, door te voeren met `npm run
db:push` in een eigen wave.

### 4.2 Voorstel A: zoekpad NOCASE of FTS5 (het grootste gat)

De prefix-zoekopdrachten gebruiken de huidige indexen niet (par. 1.2). Twee
routes, in oplopende zwaarte:

1. **NOCASE-indexen** (minimale wijziging, lost het scanprobleem op):
   in SQLite moet de collatie op de index staan. Drizzle-schema-notatie:

   ```ts
   // addresses, in de index-array:
   index("idx_addresses_straat_nocase").on(sql`${t.straat} COLLATE NOCASE`),
   index("idx_addresses_plaats_nocase").on(sql`${t.plaats} COLLATE NOCASE`),
   // postcode wordt al genormaliseerd opgeslagen ("5611AB") en de zoekquery
   // uppercased de invoer; die LIKE kan ook naar een gewone >= / < -range op
   // de bestaande idx_addresses_postcode worden herschreven.
   ```

   Plus in de zoekquery `LIKE ... COLLATE NOCASE` (of de kolommen zelf als
   `COLLATE NOCASE` definiëren, dan blijven de queries ongewijzigd). Let op:
   check of drizzle-kit push expressie-indexen aankan; anders is dit een
   handgeschreven migratie.

2. **FTS5** (de route uit PLAN.md voor echt NL-breed zoeken): een virtuele
   tabel `addresses_fts (straat, plaats, postcode)` met triggers of
   ingest-sync, prefix-matching via `straat:kle*`. Zwaarder om te onderhouden;
   pas doen als NOCASE-prefix niet meer volstaat (bijv. typo-tolerantie of
   ranking nodig).

Advies: route 1 nu inplannen, route 2 pas op bewezen behoefte.

### 4.3 Voorstel B: sitemap/count-pad

```ts
// addresses, in de index-array: partiële index, alleen actieve rijen.
// Dekt COUNT(*) voor de sitemap-index en keyset-paginering van de shards.
index("idx_addresses_actief_id").on(t.id).where(sql`${t.status} = 'actief'`),
```

Bij het testgebied overbodig; bij 8-9M rijen het verschil tussen een
milliseconden-count en een full scan per sitemap-request. (Alternatief als
partiële indexen via drizzle-kit lastig blijken: gewone index op `status`,
minder scherp maar zelfde richting.)

### 4.4 Voorstel C: kleinere aanscherpingen

```ts
// sales: comparables-query volledig index-gedekt maken
// (buurt + type + datumbereik + sortering in 1 index):
index("idx_sales_buurt_type_datum").on(t.buurtCode, t.woningtype, t.datum),

// valuations: invariant "1 per adres per dag" in het schema afdwingen
// (dekt ook de dubbele-insert-race uit par. 2.1):
uniqueIndex("uq_valuations_adres_datum").on(t.adresId, t.datum),
// Let op: vereist dat getOrCreateValuation de insert met
// onConflictDoNothing + herlezen afrondt; dat is een edit voor de
// eigenaar van lib/valuation.ts, samen met deze schemawijziging.
```

Niet voorgesteld, bewust: extra indexen op `leads`, `consents` e.d. Die tabellen
groeien met gebruikers, niet met adressen, en zijn met de bestaande indexen bij
elke realistische schaal klein.

## 5. SQLite naar Postgres: het omslagpunt

**De korte versie: het omslagpunt is concurrency en deployment, niet
datavolume. En voor Vercel is het geen keuze: daar kan SQLite überhaupt niet
draaien, dus deploy = Postgres vanaf dag 1.**

- **Datavolume is het probleem niet.** Heel NL (~8-9M adressen, plus verkopen
  en valuaties) is een SQLite-bestand van enkele tientallen GB; met de indexen
  uit par. 4 blijven puntqueries milliseconden. Puur lezen schaalt ver.
- **De ene writer wel.** SQLite in WAL-modus laat veel lezers toe maar precies
  1 schrijver tegelijk. Leads, claims, outbox, opt-outs en de dagelijkse
  valuation-inserts serialiseren allemaal door die ene writer. De ISR-keuze
  (par. 2.1) drukt dat sterk, maar het plafond blijft.
- **1 machine wel.** SQLite is in-process: een tweede app-instance (load
  balancing, zero-downtime deploys) kan niet veilig hetzelfde bestand
  beschrijven. Meer dan 1 instance = Postgres, punt.
- **Ingest wel.** Een heel-NL her-ingest is uren schrijven in hetzelfde bestand
  dat de site serveert: lange locks en geen nette gelijktijdigheid. Postgres
  doet dit met MVCC zonder de site te raken.
- **Vercel sowieso.** Serverless heeft geen persistent beschrijfbaar
  bestandssysteem; het SQLite-bestand zou per invocation verdwijnen. Elke
  Vercel-deploy vereist dus een externe Postgres (Supabase/Neon). De
  kolomtype-conversietabel en de migratiestappen staan in docs/DEPLOYMENT.md
  (Fase 6, docs-agent); dit document wacht daar niet op, de afspraak is dat
  DEPLOYMENT.md de uitvoering beschrijft en dit document het waarom.

Concrete triggers om te migreren (wat het eerst komt):

1. deploy naar Vercel of een andere serverless/multi-instance-omgeving;
2. een tweede app-instance om welke reden dan ook;
3. aanhoudend meer dan grofweg 1 write per seconde (leadvolume, alerts,
   valuaties samen) of merkbare `SQLITE_BUSY`/lock-wachttijden;
4. de eerste heel-NL-ingest die moet draaien terwijl de site live staat.

Tot een van die triggers zich aandient is SQLite lokaal de juiste keuze:
nul operationele lasten, en het schema is er via Drizzle op voorbereid om over
te stappen.

## 6. Follow-ups (niet in deze wave)

- **Kadaster-verkopen + opt-out**: zodra `sales` rijen met `adres_id` krijgt,
  moet `applyOptoutCascade` ook de betreffende buurtpagina revalidaten
  (eigenaar: suppression/verwijderflow). Zie 2.2.
- **Interne revalidate-API** voor scripts (ingest/market-drift), zie 2.4.
- **Schema-voorstellen par. 4** doorvoeren in een eigen wave (schema-eigenaar).
- **`npm run prodcheck`-script** in package.json (package.json is verboden
  terrein voor deze wave); tot die tijd: `npx tsx scripts/prodcheck.ts`.

## 7. De Fase-5-gate: scripts/prodcheck.ts

Naast `npm run build` is dit de gate die bewijst dat de productie-build zich
als productie gedraagt. Gebruik:

```sh
npm run build
npm run start                  # serveert op 4123
npx tsx scripts/prodcheck.ts   # exit 1 bij harde fouten
```

Checks: `/` en een echte adrespagina geven 200; een tweede request naar
dezelfde adrespagina wordt getimed en de `x-nextjs-cache`-header gelogd
(cache-indicatie, alleen informatief, timing is ruis); `/api/og` geeft een
`image/*` content-type met een Cache-Control-header; en de guard-check:
`/dev/mail` geeft 404, want de dev-mailbox mag in een productiebuild niet
bestaan. Het script start zelf geen server en draait tegen `WONEA_BASE_URL`
(default `http://localhost:4123`).

Laatste run (2026-07-22, productie-build): alles groen; adrespagina request 1
36ms (`x-nextjs-cache: MISS`), request 2 7ms (`HIT`), og `image/png` met
`public, max-age=86400`, `/dev/mail` 404.
