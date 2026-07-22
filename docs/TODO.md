# TODO voor livegang: alles wat accounts, API-keys of geld vereist

Bewust buiten de bouw gehouden (afspraak in docs/PLAN.md: geen accounts, geen betaalde API's, geen deploy). Per item: waarom, en waar het in de code landt.

## Data

- [ ] **EP-Online-key (RVO, gratis)**: echte energielabels in plaats van de bouwjaar-indicatie. Nu: indicatie via `labelVoorBouwjaar` in `db/seed/generator.ts`, gelabeld via `addresses.energielabel_bron` ("indicatie"); met de key wordt de bron "echt".
- [ ] **Kadaster-koopsommen (betaald)**: echte verkoopprijzen in plaats van synthetische buurtverkopen. Nu: alle `sales`-rijen hebben bron "seed" en nooit een `adres_id`; het schema (`db/schema.ts`) heeft bron "kadaster" en de `adres_id`-kolom al klaarstaan.
- [ ] **CBS-koppeltabel-verificatie (keyless, wel werk)**: echte buurtcodes per adres in plaats van de seed-toewijzing. Nu: `BUURTEN` in `db/seed/generator.ts` zijn seed-data in CBS-formaat; de generieke ingest (`scripts/ingest-cbs.ts` uit Fase 5) bestaat nog niet.
- [ ] **Ahrefs-keywordexport (betaald) voor de gating-whitelist**: onderbouwen welke gebieden zoekvolume hebben en dus indexatie verdienen. De hele machinerie staat er al: `index_gating`-tabel, admin-scherm (`app/admin/gating/page.tsx`), per-pagina gating (`lib/seo/gating.ts`, default alles noindex) en een CSV-import in `scripts/gating.ts` (kolommen scope,code,zoekvolume). Alleen de echte input ontbreekt: een Ahrefs-export, handmatig terug te brengen tot dat CSV-formaat.

## Infra

- [ ] **Vercel-account plus project**: de hosting zelf; stappen in docs/DEPLOYMENT.md par. 2.
- [ ] **Postgres (Supabase of Neon, EU-regio)**: SQLite kan niet op Vercel; conversietabel en migratiestappen in docs/DEPLOYMENT.md par. 1. Raakt `db/schema.ts`, `drizzle.config.ts`, `lib/db.ts` en maakt alle db-aanroepen async.
- [ ] **Domein/DNS wonea.nl bij Hostinger**: A-record en CNAME naar Vercel; stappen in docs/DEPLOYMENT.md par. 3.
- [ ] **E-mailprovider (Postmark of Resend)**: de outbox is mock; echte verzending komt op precies een plek, `queueEmail` in `lib/email/send.ts` (docs/DEPLOYMENT.md par. 4). Inclusief SPF/DKIM-records en verwerkersovereenkomst.
- [ ] **Plausible-account**: privacyvriendelijke analytics. De integratie staat klaar in `components/analytics.tsx` en is uit zolang `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` leeg is; account aanmaken, domein zetten, deployen.
- [ ] **Cron voor alerts, market-drift en purge**: maandelijks `POST /api/alerts` (met `x-admin-password`-header), en periodiek `scripts/purge.ts` voor de bewaartermijnen; beide hebben in productie een cron-route of externe scheduler nodig (Vercel Cron doet alleen GET zonder eigen headers). `scripts/market-drift.ts` is testdata-gereedschap en vervalt zodra echte koopsommen binnenkomen.

## Juridisch

- [ ] **Nederlandse privacyjurist**: beoordeelt en tekent voor livegang; de harde eindgate van docs/AVG-CHECKLIST.md (punt 12).
- [ ] **LIA (belangenafweging gerechtvaardigd belang)**: schriftelijk document achter de grondslag die `/privacy` noemt; bestaat nog niet (AVG-checklist punt 2).
- [ ] **DPIA-beoordeling**: schriftelijk vaststellen of een DPIA verplicht is bij opschalen; nog niet gedaan (AVG-checklist punt 4).
- [ ] **Algemene voorwaarden**: bestaan nog niet; nodig zodra premium (`app/premium/`, nu gemockte checkout) echt geld aanneemt en voor de leadfunnels.

## Product (later, na livegang)

- [ ] **Claim-verificatie (iDIN of WOZ-beschikking)**: claims zijn nu zelfverklaringen (alleen e-mail bewezen, zie commentaar bij `claims` in `db/schema.ts`); verificatie voorkomt dat een vreemde jouw woning claimt.
- [ ] **Echte 410-route voor verwijderde adressen**: een opted-out adres geeft nu `notFound()` (404) op `app/woning/[postcode]/[nummerslug]/page.tsx`; een echte 410 ("Gone") vertelt zoekmachines definitiever dat de pagina bewust weg is (docs/PLAN.md par. 9).
- [ ] **B2B data/AVM-API**: woningwaarde-API als extra verdienmodel (docs/PLAN.md par. 11, verdienmodel punt 6); niets van gebouwd, bewust.
- [ ] **Admin-auth-upgrade**: basic-auth in `middleware.ts` vervangen door echte accounts met 2FA; de admin toont persoonsgegevens (AVG-checklist punt 10).
- [ ] **Rate-limit-store**: `lib/ratelimit.ts` is in-memory en reset bij elke serverless-start; productie vraagt een gedeelde store (bv. Upstash Redis, weer een account).

## Beheer

- [ ] **Hostinger-API-key roteren**: de eerder gedeelde key stond in platte tekst in de chat en is bewust nergens gebruikt; nieuwe key genereren en de oude intrekken voordat er iets met Hostinger gebeurt (zie ook de kop van docs/DEPLOYMENT.md).
- [ ] **Secrets-hygiëne bij livegang**: sterke waarden voor `WONEA_ADMIN_PASSWORD` en `WONEA_SESSION_SECRET`, `WONEA_DEV_MAIL` nooit in productie (env-tabel in docs/DEPLOYMENT.md par. 2b).
