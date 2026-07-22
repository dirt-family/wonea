# Deployment: van lokaal naar wonea.nl

Stap-voor-stap-handleiding om Wonea live te zetten op Vercel met het domein wonea.nl. Geschreven om zelf uit te voeren, elk begrip wordt in een zin uitgelegd.

> **Status: er is NIETS gedeployed.**
> In de bouwsessies is niet gedeployed, er zijn geen accounts aangemaakt en er zijn geen DNS-wijzigingen gedaan. Alles hieronder is nog te doen.
>
> **Hostinger-API-key: eerst roteren.** De eerder gedeelde Hostinger-API-key is bewust niet gebruikt (hij stond in platte tekst in de chat en is daarmee als gelekt te beschouwen). Genereer in het Hostinger-panel een nieuwe key en trek de oude in voordat je iets met Hostinger doet. De DNS-stappen hieronder lopen via het panel, niet via de API.

## 0. Uitgangssituatie (wat er nu echt staat)

- Wonea draait volledig lokaal: `npm run dev` op poort 4123, database is een SQLite-bestand (`data/wonea.db`), e-mail wordt niet echt verstuurd (outbox-tabel, leesbaar op `/dev/mail`).
- De SEO-laag (Fase 5) staat er: `app/robots.ts`, sitemap-index plus shards (`app/sitemap.xml/`, `app/sitemaps/`) en indexatie-gating per pagina (`lib/seo/gating.ts`). **Default is alles noindex**: de whitelist (tabel `index_gating`) is na de seed leeg, dus geen enkele pagina mag de index in tot je bewust gebieden vrijgeeft met `scripts/gating.ts`. Live gaan volgens dit document levert dus een werkende maar nog onvindbare site op; dat is de juiste volgorde, want indexeren mag pas na de AVG-checklist en een gevulde whitelist (Ahrefs-input, docs/TODO.md).
- Testdata: adressen zijn synthetische seed-data voor Eindhoven, verkopen zijn gelabelde voorbeelddata. Echte bronnen (BAG-ingest, Kadaster, EP-Online) staan op docs/TODO.md.

Volgorde van de hele deployment: **1 database, 2 Vercel, 3 DNS, 4 e-mail, 5 checks**. Niet omdraaien: zonder database valt er niets te deployen.

## 1. Database: van SQLite naar Postgres

### Waarom SQLite niet op Vercel kan

SQLite is een database die in een gewoon bestand op schijf leeft (`data/wonea.db`). Vercel draait je site "serverless": elke bezoeker kan op een andere, tijdelijke server terechtkomen, en het bestandssysteem daarvan is wegwerpbaar. Een SQLite-bestand zou dus per server verschillen en bij elke deploy verdwijnen. Daarom moet de data naar een losse databaseserver die altijd aan staat: Postgres.

### Stap 1a: kies een Postgres-host

Postgres is een gratis, open-source databaseserver; je huurt hem als dienst. Twee goede opties met een gratis instapniveau:

- **Supabase** (supabase.com): Postgres plus extra's (die we niet nodig hebben). Kies bij het aanmaken regio **EU (Frankfurt)**: persoonsgegevens blijven dan in de EU, dat scheelt op de AVG-checklist.
- **Neon** (neon.tech): kale Postgres, ook met EU-regio.

Maak een account, maak een project/database aan en kopieer de **connection string**: een adresregel die begint met `postgresql://...` waarmee de app inlogt op de database. Die wordt straks de omgevingsvariabele `DATABASE_URL`. Behandel hem als een wachtwoord.

### Stap 1b: kolomtype-conversie voor ons schema

Drizzle (onze database-laag, zie `db/schema.ts`) heeft aparte kolomtypes per database. Dit is de volledige vertaling voor ons schema; er komen geen andere types in voor:

| Nu (drizzle-orm/sqlite-core) | Gebruikt voor | Straks (drizzle-orm/pg-core) |
| --- | --- | --- |
| `text(...)` | namen, codes, postcodes, e-mail, HTML, JSON-strings en alle ISO-datums | `text(...)` |
| `integer(...).primaryKey({ autoIncrement: true })` | alle `id`-kolommen | `serial(...).primaryKey()` |
| `integer(...)` (gewone getallen) | prijs, bouwjaar, oppervlakte_m2, gem_woz, inwoners, peiljaar, est_value_eur, restant_eur | `integer(...)` |
| `real(...)` | lat, lon, gem_oppervlakte, anker_m2_prijs, rente_pct, overbieding_pct | `doublePrecision(...)` |
| `integer(..., { mode: "boolean" })` | actief (alert_subscriptions), indexeerbaar (index_gating) | `boolean(...)` |
| `sqliteTable`, `index`, `uniqueIndex` | tabellen en indexen | `pgTable`, `index`, `uniqueIndex` (zelfde namen, andere import) |

Bewuste keuze: datums blijven in de eerste migratie ISO-strings in `text`-kolommen, want zo verwacht alle code ze (helpers in `lib/format.ts`). Overstappen op echte `timestamptz`-kolommen kan later als aparte verbetering.

### Stap 1c: wat er in de code verandert

1. **`drizzle.config.ts`**: `dialect: "sqlite"` wordt `dialect: "postgresql"` en `dbCredentials` wijst naar `process.env.DATABASE_URL` in plaats van het bestandspad.
2. **`db/schema.ts`**: imports van `drizzle-orm/sqlite-core` naar `drizzle-orm/pg-core`, plus de typevertaling uit de tabel hierboven.
3. **`lib/db.ts`**: de `better-sqlite3`-client wordt een Postgres-client (bijvoorbeeld het npm-pakket `postgres` met `drizzle-orm/postgres-js`). Dat is een **nieuwe dependency**; die is bewust nog niet toegevoegd (package.json was tijdens de bouw bevroren).
4. **De grootste stap: alles wordt async.** better-sqlite3 is synchroon: de code staat vol `.get()`, `.all()` en `.run()` zonder `await`. Postgres werkt asynchroon: elke databankaanroep krijgt `await` en elke functie eromheen wordt `async`. Dit raakt vrijwel elke pagina, elke API-route, `lib/suppression.ts`, `lib/valuation.ts`, `lib/leads.ts` en de scripts. Reken hiervoor op een dagdeel tot een dag geconcentreerd werk plus een volledige testronde; dit is geen zoek-en-vervang-klusje.
5. **`sqlite.transaction(...)`** in `scripts/seed.ts` en `scripts/market-drift.ts` wordt `db.transaction(async (tx) => ...)`.
6. **`tests/helpers.ts`** zet nu `WONEA_DB_PATH` naar een tijdelijk SQLite-bestand; voor Postgres is een testdatabase-strategie nodig (bijvoorbeeld een aparte test-database of SQLite in tests houden en alleen de query-laag delen).

### Stap 1d: volgorde van uitvoeren

1. Postgres-project aanmaken (stap 1a), `DATABASE_URL` in je lokale `.env` zetten.
2. Code-migratie (stap 1c) op een aparte git-branch.
3. `npm run db:push`: Drizzle maakt de tabellen aan in de nieuwe database.
4. `npm run seed` voor testdata.
5. Lokaal alles bewijzen tegen Postgres: `npm run typecheck`, `npm run test`, app starten en `npm run smoke`.
6. Pas als dit groen is: door naar Vercel.

## 2. Vercel

Vercel is het hostingplatform van de makers van Next.js; het bouwt en serveert de site automatisch bij elke git-push.

### Stap 2a: project aanmaken

1. Account op vercel.com (inloggen met GitHub is het makkelijkst).
2. Zet de Wonea-repo op GitHub (privé kan): `git push` naar een nieuwe privé-repo.
3. In Vercel: "Add New Project", kies de repo. Vercel herkent Next.js vanzelf; framework-preset, build command (`next build`) en output hoef je niet aan te passen. De lokale poort 4123 is hier niet relevant, Vercel regelt zijn eigen poorten.

### Stap 2b: omgevingsvariabelen

Omgevingsvariabelen (env-variabelen) zijn instellingen die buiten de code leven; lokaal staan ze in `.env`, op Vercel zet je ze onder Project, Settings, Environment Variables. Neem ze over uit `.env.example` met deze productiewaarden:

| Variabele | Wat het is | Waarde in productie |
| --- | --- | --- |
| `DATABASE_URL` | connection string van je Postgres (stap 1) | uit Supabase/Neon; bestaat lokaal nog niet, staat dus ook nog niet in `.env.example` |
| `WONEA_BASE_URL` | absolute basis voor links in e-mails en widget-embeds | `https://wonea.nl` |
| `WONEA_ADMIN_PASSWORD` | wachtwoord voor `/admin` (basic-auth, gebruiker `admin`) en voor de `x-admin-password`-header op `POST /api/alerts` | lang en uniek uit je wachtwoordmanager; nooit het dev-wachtwoord `wonea-dev` |
| `WONEA_SESSION_SECRET` | geheime sleutel die inlogsessie-cookies ondertekent | lang en willekeurig, bv. uitkomst van `openssl rand -base64 32` |
| `WONEA_DEV_MAIL` | zet de dev-mailbox op `/dev/mail` aan | **NOOIT ZETTEN IN PRODUCTIE.** Laat de variabele helemaal weg. De pagina heeft een dubbele guard (vereist ook `NODE_ENV=development`, zie `app/dev/mail/page.tsx`), maar de afspraak is: niet op vertrouwen, gewoon weglaten. |
| `WONEA_GEMEENTE`, `WONEA_POSTCODE4` | testgebied voor seed/ingest-scripts | zelfde als lokaal; wordt pas belangrijk bij de generieke ingest (Fase 5) |
| `WONEA_PDOK_SUGGEST` | adres-suggesties via de externe PDOK-dienst (0 = lokaal zoeken) | `0` is prima; `1` mag |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | zet Plausible-analytics aan (`components/analytics.tsx`) | leeg laten tot er een Plausible-account is (docs/TODO.md); daarna `wonea.nl`. Let op: `NEXT_PUBLIC_`-variabelen worden bij de build ingebakken, dus na wijzigen opnieuw deployen. |
| `WONEA_DB_PATH` | pad naar het lokale SQLite-bestand (alleen door tests gebruikt) | vervalt met Postgres; niet zetten |

### Stap 2c: eerste deploy

Klik "Deploy". Vercel draait `npm install` en `next build`; slaagt de build, dan staat de site op een `*.vercel.app`-adres. Test daar eerst (stap 5) voordat je het echte domein koppelt.

## 3. DNS bij Hostinger: wonea.nl naar Vercel

DNS is het adresboek van internet: het vertelt browsers welk serveradres bij wonea.nl hoort. Het domein staat bij Hostinger, de site straks bij Vercel; die twee koppel je met twee DNS-records.

1. In Vercel: Project, Settings, Domains, voeg `wonea.nl` en `www.wonea.nl` toe. Vercel toont dan precies welke records het wil zien. **Die getoonde waarden zijn leidend**; de waarden hieronder zijn de gangbare Vercel-waarden op moment van schrijven.
2. In het Hostinger-panel (hpanel.hostinger.com): Domeinen, wonea.nl, DNS / Nameservers.
3. Pas aan (record-types uitgelegd: een A-record wijst een naam naar een IP-adres, een CNAME-record wijst een naam naar een andere naam):
   - **A-record** voor naam `@` (dat betekent: het kale domein wonea.nl) naar `76.76.21.21`.
   - **CNAME-record** voor naam `www` naar `cname.vercel-dns.com`.
   - Verwijder bestaande A-, AAAA- of CNAME-records op `@` en `www` die naar Hostinger-parking of -hosting wijzen; anders wijst het domein naar twee plekken tegelijk.
   - Laat MX-records (e-mailontvangst) met rust als het domein ergens mail ontvangt.
4. Wachten: DNS-wijzigingen hebben minuten tot een paar uur nodig. In Vercel wordt het domein groen zodra het klopt; het HTTPS-certificaat regelt Vercel automatisch.

## 4. E-mail: van mock-outbox naar echte verzending

Nu is e-mail volledig mock: elke mail wordt als rij in de tabel `emails_outbox` gezet en nergens echt bezorgd (dat is het hele outbox-patroon, zie `lib/email/send.ts`). Voor productie:

1. **Kies een transactionele e-mailprovider**, bijvoorbeeld **Postmark** (sterk in bezorgbaarheid) of **Resend** (developer-vriendelijk, EU-regio beschikbaar). Transactioneel betekent: losse mails aan een persoon (magic links, bevestigingen), geen nieuwsbrieven-bulk.
2. **Verifieer het domein** bij de provider: die geeft je SPF- en DKIM-records (DNS-bewijzen dat jouw mails echt van wonea.nl mogen komen), toe te voegen bij Hostinger net als in stap 3.
3. **Sluit een verwerkersovereenkomst** (DPA) met de provider; die verwerkt e-mailadressen namens Wonea (staat ook op docs/AVG-CHECKLIST.md).
4. **De code-plek is er al**: `lib/email/send.ts` (functie `queueEmail`) is het enige punt waar alle mails doorheen gaan; alle templates in `emails/` gebruiken het. Echte verzending bouw je dus op precies een plek in: na het wegschrijven in de outbox de API van de provider aanroepen en de status van `queued` naar verzonden zetten (het schema kent nu `queued` en `sent_mock`; een echte `sent`-status is een kleine schema-uitbreiding). De outbox-tabel blijft waardevol als verzendlog, met de bestaande retentie van 90 dagen via `scripts/purge.ts`.
5. De API-key van de provider wordt een nieuwe env-variabele op Vercel (bv. `POSTMARK_TOKEN`); nooit in de code.

## 5. Checks na de deploy

In volgorde:

1. **Prodcheck**: `WONEA_BASE_URL=https://wonea.nl npx tsx scripts/prodcheck.ts`. Dat script checkt hard: homepage 200, een echte adrespagina 200 (plus cache-indicatie als info), `/api/og` als afbeelding met Cache-Control-header, en **`/dev/mail` moet 404 zijn** (de guard-check: de dev-mailbox toont e-mailinhoud inclusief magic links en mag nooit live bestaan). Let op: het script zoekt zijn testadres in de database via `lib/db.ts`, dus draai het na de Postgres-migratie met dezelfde `DATABASE_URL` als productie.
2. **Smoke-test tegen productie**: `BASE_URL=https://wonea.nl npm run smoke`. `scripts/smoke.ts` checkt de bredere routeset op status en inhoud, inclusief dat `/admin` een 401 geeft (inloggen vereist).
3. **Admin-wachtwoord sterk**: `https://wonea.nl/admin` vraagt om login; controleer dat het dev-wachtwoord `wonea-dev` NIET werkt en je sterke wachtwoord wel.
4. **Alerts-endpoint dicht**: `curl -X POST https://wonea.nl/api/alerts` zonder header hoort 401 te geven (de route vereist buiten development de `x-admin-password`-header).
5. **Indexatie-gating in de stand die je bedoelt**: `https://wonea.nl/robots.txt` moet bestaan (blokkeert `/admin`, `/dev` en `/api`) en de sitemap hoort leeg te blijven van adressen zolang de whitelist leeg is. Gebieden vrijgeven doe je bewust met `npx tsx scripts/gating.ts` (pas na de AVG-checklist).
6. **Cron-taken inregelen** (staat op docs/TODO.md, want nog niet gebouwd):
   - Maandelijks `POST /api/alerts` met de `x-admin-password`-header (waarde-alerts). Let op: Vercel Cron roept routes standaard met GET en zonder eigen headers aan, dus dit vraagt een kleine aanpassing of een externe scheduler.
   - Regelmatig (bv. dagelijks) de retentie-purge; `scripts/purge.ts` is nu een lokaal script en heeft voor productie een cron-route of aparte runner nodig.
7. **AVG-checklist afgerond**: livegang voor echte bezoekers pas als docs/AVG-CHECKLIST.md is afgevinkt, inclusief de handtekening van de privacyjurist.
