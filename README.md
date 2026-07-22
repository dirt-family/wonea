# Wonea

Wonea is een Nederlands woningwaardeplatform dat het eerlijk aanpakt: elke woning krijgt een geschatte waarde met een expliciete bandbreedte en betrouwbaarheid, de verkopen waarop die schatting is gebaseerd staan op de pagina, en de methode is volledig uitgelegd. Alles wat een bezoeker als persoon raakt (claimen, alerts, doorsturen van aanvragen) gebeurt alleen met vastgelegde toestemming, en een woning verwijderen kan altijd, in twee stappen, zonder account. Het project draait nu volledig lokaal op synthetische testdata voor Eindhoven; er is niets gedeployed.

## Quickstart

Vereist: Node 20 of nieuwer en npm.

```bash
npm install
cp .env.example .env     # lokale instellingen; werkt zonder aanpassingen
mkdir -p data            # map voor het SQLite-bestand (staat niet in git)
npm run setup            # maakt de database (db:push) en vult testdata (seed)
npm run dev              # start op http://localhost:4123
```

Poort 4123 is bewust (3000 en 3100 zijn op deze machine bezet); ook `npm run start` gebruikt hem.

Daarna te proberen:

- **Zoeken**: op de homepage, bijvoorbeeld "Kleine Berg".
- **Admin**: `http://localhost:4123/admin`, gebruiker `admin`, wachtwoord uit `WONEA_ADMIN_PASSWORD` in je `.env` (default `wonea-dev`).
- **Dev-mailbox**: `http://localhost:4123/dev/mail` toont alle "verstuurde" mail (er wordt niets echt verstuurd) en maakt magic links klikbaar. Vereist `WONEA_DEV_MAIL=1` (staat in `.env.example`); in productie bestaat deze pagina niet.
- **Widget-demo**: `npm run widget-demo` start een fictieve makelaarssite op poort 4199 die de Wonea-widget cross-origin embedt (laat `npm run dev` in een andere terminal draaien).

## Scripts

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | ontwikkelserver op poort 4123 |
| `npm run build` / `npm run start` | productiebuild maken / serveren (ook op 4123) |
| `npm run typecheck` | TypeScript-check zonder build |
| `npm run test` | vitest-suite (AVM, suppressie-cascade, funnels, consent, admin) |
| `npm run db:push` | schema (`db/schema.ts`) naar de database zetten |
| `npm run seed` | deterministische testdata voor Eindhoven (idempotent, 2x draaien = 0 verschil) |
| `npm run setup` | db:push plus seed in een keer |
| `npm run smoke` | kernroutes checken tegen een lopende server (`BASE_URL` instelbaar) |
| `npm run purge` | bewaartermijnen handhaven (outbox 90d, onbevestigde captures 30d, verlopen leads/tokens/sessies) |
| `npm run widget-demo` | demo-hostpagina voor de widget op poort 4199 |
| `npx tsx scripts/market-drift.ts` | simuleert maandelijkse marktontwikkeling zodat waarde-alerts iets te melden hebben |
| `npx tsx scripts/gating.ts` | beheert de indexatie-whitelist (allow/disallow/list/import); default is alles noindex |
| `npx tsx scripts/prodcheck.ts` | checkt een lopende productie-build (home, adrespagina, og-image, `/dev/mail` moet 404 zijn) |

## Documentatie

- `docs/PLAN.md`: het goedgekeurde implementatieplan (architectuur, datamodel, fases).
- `docs/CONTRACTS.md`: werkafspraken voor iedereen die meebouwt; eerst lezen, dan pas code schrijven.
- `docs/HUISPEDIA-ANALYSE.md`: feature-analyse van de concurrent en waar Wonea bewust afwijkt.
- `docs/PERFORMANCE.md`: rendering-, cache- en schaalbeleid (Fase 5), geverifieerd tegen een productie-build.
- `docs/DEPLOYMENT.md`: stap voor stap live gaan (Postgres-migratie, Vercel, DNS, e-mail, checks); er is nog niets gedeployed.
- `docs/AVG-CHECKLIST.md`: privacy-checklist voor livegang, met per punt de huidige status; een privacyjurist tekent voor livegang.
- `docs/TODO.md`: alles wat accounts, API-keys of geld vereist, gegroepeerd, met de plek in de code.

## Kern van de codebase

- `lib/avm.ts` plus `lib/comparables.ts`: het waardemodel (deterministisch, getest, met versieveld).
- `lib/suppression.ts`: de centrale suppressielijst; elke pagina en API die adresdata toont checkt hier (de verwijderbelofte).
- `lib/db.ts`: SQLite-singleton via Drizzle; nooit zelf een database-instantie maken.
- `lib/util.ts` is server-only (crypto); client components importeren `lib/format.ts`.
- `emails/` plus `lib/email/send.ts`: outbox-patroon, elke mail met afmeldlink.
