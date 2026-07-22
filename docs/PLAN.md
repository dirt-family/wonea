# Wonea: implementatieplan (v2, na adversariele review)

Concept v1 is getoetst door 3 onafhankelijke reviewers (volledigheid tegen de opdracht, technische haalbaarheid, AVG/SEO-risico). Alle blockers en belangrijke punten zijn hieronder verwerkt. Dit bestand wordt bij akkoord docs/PLAN.md in het repo.

## 0. Scope-beslissingen vooraf
- Codelocatie: ~/Code/wonea, nieuw lokaal git-repo. Prive-project, bewust buiten de ZUID-vault en ZUID-repo's.
- Testgebied: gemeente Eindhoven (default, via env WONEA_GEMEENTE en WONEA_POSTCODE4 aanpasbaar).
- Geen deploy, geen DNS, geen accounts, geen betaalde API's. De Hostinger-key wordt niet gebruikt; deployment komt als document in Fase 6. Advies: key roteren, hij staat in platte tekst in de chat.
- Huispedia: feature-analyse op dossierbasis in docs/HUISPEDIA-ANALYSE.md, inclusief een expliciete mapping van featurelagen (marktanalyse par. 7) naar fases en een checklist van de par. 10-differentiatiepunten met waar elk punt in het product landt. Geen design, tekst of code overnemen; eigen visuele identiteit: licht, rustig, vertrouwen-eerst, geen groen, geen dark patterns.
- Positionering in copy, juridisch zuiver geformuleerd (reviewer-punt): niet "consent-first" claimen voor de publieke adrespagina's (die draaien op gerechtvaardigd belang met opt-out, net als elke woningdatasite). De belofte wordt: "Wij tonen alleen openbare data. Alles wat jou als persoon raakt, claim, e-mail, eigen WOZ-invoer, gebeurt alleen met jouw toestemming. Verwijderen kan altijd, in twee stappen." Opt-out/privacy-link in de sitewide footer (elke pagina), prominente verwijderknop op elke adrespagina.

## 1. Architectuur
- Next.js 15 (App Router) + TypeScript strict + Tailwind. Alles draait met npm run dev, zonder externe services.
- Database: SQLite (better-sqlite3) + Drizzle ORM. Fase 0 regelt direct: serverExternalPackages voor better-sqlite3, DB-client als globalThis-singleton, WAL-mode (anders breekt dev/HMR). Schema is SQLite-specifiek; Fase 6 documenteert de kolomtype-conversie en migratiestappen naar Postgres/Supabase.
- Auth: e-mail magic link. Tokens gehasht (sha256) in DB, eenmalig bruikbaar, 15 min geldig, rate limit per e-mailadres. Sessie via signed httpOnly cookie.
- E-mail: React Email templates naar een outbox-tabel, dev-mailbox op /dev/mail. Die route bestaat alleen bij NODE_ENV=development plus expliciete flag; in een productiebuild 404 (staat ook op de AVG-checklist en in DEPLOYMENT.md). Elk template bevat een afmeldlink.
- AVM: lib/avm.ts, deterministisch, versieveld, vitest-getest.
- Zoeken: prefix-zoeken met NOCASE-indexen (of FTS5) op straat/plaats/postcode, autocomplete API. Optionele PDOK Locatieserver achter env-flag, default uit zodat dev offline werkt.
- Suppressie centraal: lib/suppression.ts is de ene helper die elk renderpad en elke API checkt (zie par. 9).
- Admin: /admin achter basic-auth wachtwoord uit env (upgrade op livegang-TODO).
- URL-structuur: /woning/[postcode]/[nummerslug] waarbij nummerslug de toevoeging bevat (12, 12a, 12-2). Uniekheid postcode+nummerslug afgedwongen in de ingest; kale nummer-URL redirect bij precies 1 match; canonical per BAG-verblijfsobject. Buurt: /buurt/[gemeente]/[buurt-slug].
- Rendering: adres- en buurtpagina's ISR on-demand (generateStaticParams leeg, dynamicParams true), rest statisch. ISR-gedrag is alleen toetsbaar onder next build + next start; dat wordt de extra gate in Fase 5.

## 2. Datamodel (Drizzle, kernvelden)
- municipalities: code, naam
- neighborhoods: buurt_code, naam, gemeente_code, gem_woz (CBS KWB), gem_oppervlakte (uit eigen BAG-rijen), anker_m2_prijs (afgeleide: gem_woz / gem_oppervlakte, gelabeld als afgeleide), inwoners
- addresses: id, bag_id?, straat, huisnummer, toevoeging?, nummerslug, postcode, plaats, buurt_code, lat/lon, bouwjaar, oppervlakte_m2, woningtype, energielabel, energielabel_bron (echt/indicatie), bron (bag/seed), status (actief/opted_out)
- sales: id, buurt_code, straat?, datum, prijs, oppervlakte_m2, woningtype, bron (seed/kadaster). Bewust GEEN adres_id bij bron=seed: synthetische verkopen hangen nooit aan een echt adres (reviewer-blocker), alleen aan buurt/straatniveau.
- valuations: adres_id, datum, waarde, interval_laag, interval_hoog, confidence, n_comparables, model_versie, inputs_json
- woz_values: adres_id, peiljaar, waarde, bron (eigenaar/seed)
- users, sessions, magic_tokens (token_hash, expires_at, used_at)
- claims: user_id, adres_id, rol (zelfverklaring, niet geverifieerd; meerdere claims per adres mogelijk), created
- mortgage_info: claim_id, restant_eur, rente_pct?, rentevast_tot (voedt de hypotheek-triggers)
- consents: id, user_id/email, doel (alerts/marketing/widget/lead-doorgifte), tekstversie, bron, consented_at, revoked_at (art. 7: toestemming aantoonbaar)
- alert_subscriptions: claim_id, frequentie, laatst_verzonden
- emails_outbox: to, subject, html, type, status, created (retentie 90 dagen)
- leads: id, type (hypotheek/makelaar/taxatie/verduurzaming), subtype (bv. zonnepanelen/warmtepomp/isolatie), adres_id?, user_id?, antwoorden_json, status (nieuw/gekwalificeerd/doorgestuurd/gesloten/afgewezen), est_value_eur, created, retentie_tot
- lead_events: lead_id, event, ts
- optouts: adres_id, email?, reden?, token, bevestigd_at. Werkt als centrale suppressielijst, leidend boven alle bronnen en her-ingests.
- premium_entitlements: user_id, product (biedadvies/marktanalyse), status, mock_payment_ref
- widget_captures: email, adres_id?, bron_domein, consent_id, bevestigd_at (double opt-in; onbevestigd na 30 dagen gepurged)
- index_gating: buurt_code/postcode4, indexeerbaar, reden
- market_stats: buurt_code, maand, mediaan_prijs, doorlooptijd_dagen, overbieding_pct, volume, bron (seed)

## 3. Mappenstructuur
```
wonea/
  app/
    (site)/
      page.tsx                          # home: zoekbalk + merkbelofte
      woning/[postcode]/[nummerslug]/page.tsx
      buurt/[gemeente]/[buurt]/page.tsx
      woz-check/  biedadvies/[postcode]/[nummerslug]/
      hypotheek/ verkopen/ taxatierapport/ verduurzamen/   # leadfunnels
      claim/ dashboard/ premium/
      rapport/[token]/                  # deel-je-rapport
      methode/ over-ons/ privacy/ verwijderen/[token]/
      widget/                           # iframe-target, stateless
    api/  search/ valuation/ leads/ optout/ claim/ alerts/ widget/ og/
    admin/  leads/ outbox/ gating/ purge/
    dev/mail/                           # alleen development
    sitemap.xml/route.ts  sitemaps/[id]/route.ts  robots.ts
  lib/   avm.ts comparables.ts biedadvies.ts suppression.ts seo/ auth/ email/ db/ config/leadwaarde.ts
  db/    schema.ts migrations/ seed/ (gecommitte snapshots testgebied)
  scripts/ ingest-bag.ts ingest-cbs.ts generate-sales.ts market-drift.ts seed.ts purge.ts smoke.ts widget-demo-host.mjs
  emails/  alert, magic-link, optout-bevestiging, lead-bevestiging, widget-double-optin (alle met afmeldlink)
  public/  widget.js  fonts/ (lokaal, ook voor og-images)
  docs/   PLAN.md HUISPEDIA-ANALYSE.md DEPLOYMENT.md AVG-CHECKLIST.md TODO.md
```

## 4. Paginalijst (consument, NL)
1. Home: adres-zoekbalk centraal, merkbelofte, hoe-het-werkt, geen popups.
2. Adrespagina: waarde + interval + confidence, bouwjaar, oppervlakte, type, energielabel met bronlabel, buurtstats, comparables-blok ("gebaseerd op deze recente verkopen in jouw buurt", met zichtbaar voorbeelddata-label zolang bron=seed), WOZ-blok (alleen eigenaar-invoer of gelabelde seed), buurttrend, claim-CTA, biedadvies-teaser, verduurzaam-blok bij label D of lager, verwijderknop, methode-link.
3. WOZ-check flow: adres, WOZ tonen of zelf invoeren, vergelijking met marktwaarde, uitleg bezwaar (gratis haak).
4. Methode-pagina: hoe het model rekent, waarom een interval, de universele ~7% fout, comparables-keuze (straat als er genoeg zijn, anders buurt; expliciet uitgelegd), bronnen.
5. Over ons: het waarom-Wonea verhaal.
6. Privacy + verwijderflow: 2 stappen met e-mailbevestiging.
7. Claim + dashboard: magic link, mijn woning, waardehistorie, hypotheekgegevens invullen (voedt triggers), alerts aan/uit (aparte checkbox voor aanbiedingen, niet vooraangevinkt), deel rapport, funnel-ingangen.
8. Buurtpagina: stats, recente verkopen (seed-gelabeld), trend, doorlooptijden.
9. Biedadvies: gratis basisrange + onderbouwing; premium verdieping.
10. Vier leadfunnels als steppers met kwalificatievragen; per funnel staat er VOOR de verzendknop aan welk type partij de lead wordt doorgegeven, met consent-vastlegging.
11. Rapport-delen: publieke read-only pagina, alleen data die ook op de publieke adrespagina staat, alleen op initiatief van de claimer, token intrekbaar.
12. Widget: embed-snippet + stateless iframe, e-mailcapture met consent-checkbox + doeltekst + double opt-in.
13. Admin: leads per type/status met leadwaarde, outbox, gating, datastatus, purge.

## 5. AVM v1
- Comparables: eerst zelfde straat (als >= 5 bruikbaar), anders buurt; zelfde type en oppervlakteklasse, laatste 24 mnd. Minder dan 5: terugvallen op buurt-anker (gem. WOZ per buurt uit CBS KWB gedeeld door gemiddelde oppervlakte uit eigen BAG-rijen; gelabeld als afgeleide).
- Correctiefactoren: bouwjaarklasse, woningtype, energielabel-indicatie.
- Interval: IQR-gebaseerd uit spreiding comps, min +-5%, max +-15%. Confidence hoog >= 8 comps, middel 4-7, laag < 4; bij laag expliciet in UI.
- Output altijd met comps-lijst, n, model_versie. Historie in valuations: waarde schommelt nooit onverklaard.
- Vitest: 0 comps, uitschieters, extreme oppervlaktes, monotonie, en de opt-out-regressietest (par. 9).

## 6. Data en bronnen (Fase 1)
- BAG: via de keyless PDOK BAG OGC API Features (bbox/postcode4-gebied, verblijfsobject + pand join voor bouwjaar), 5-10k adressen voor het testgebied. Het heel-NL Kadaster-extract is lokaal onwerkbaar en vervalt. Primair offline pad: gecommitte seed-snapshot (>= 2.000 adressen testgebied); netwerkfout = stil terugvallen op snapshot.
- Buurt-koppeling: CBS-koppeltabel buurt/wijk/gemeente per postcode-huisnummer (keyless download, gefilterd op testgebied); seed kent buurt_code direct toe.
- CBS KWB (StatLine OData, keyless) voor gem. WOZ per buurt; snapshot gecommit.
- Verkopen: synthetisch per buurt rond het anker (generate-sales.ts), nooit gekoppeld aan een echt adres, zichtbaar gelabeld op de pagina. Echte koopsommen (Kadaster, betaald) op TODO.
- Waardeontwikkeling voor alerts: scripts/market-drift.ts simuleert maanddrift per buurt (nieuwe synthetische verkopen), eerlijk gelabeld; zo heeft de maandelijkse alert echt iets te melden.
- Energielabel: indicatie op bouwjaar, gelabeld; EP-Online-key (gratis, RVO) op TODO.
- WOZ: eigenaar vult eigen beschikking in (claim/WOZ-check); seed alleen met label.

## 7. Bouwvolgorde
- Fase 0 (scaffold): repo, Next+TS+Tailwind+Drizzle+SQLite (incl. native-module-config en singleton), design tokens, basislayout met sitewide footer (privacy/opt-out-link), seed-pipeline, smoke-script, docs/HUISPEDIA-ANALYSE.md met laag-naar-fase-mapping en par. 10-checklist.
- Fase 1: home, adrespagina, WOZ-check, verwijderflow + suppressie-helper, methode, over-ons, AVM v1 + tests, ingest/seed.
- Fase 2: claim + dashboard (incl. hypotheekgegevens-invoer), alerts (templates + outbox + admin-maandrun + market-drift + cron-doc), widget (stateless iframe + consent + double opt-in + demo-hostpagina op tweede poort via scripts/widget-demo-host.mjs, geen frame-ancestors op /widget), deel-je-rapport (publieke-data-only, intrekbaar token) + buurtpagina. og-images met lokaal gecommitte fonts/logo.
- Fase 3: biedadvies (gratis basis, premium verdieping) en marktsignalen op buurt- en adrespagina, met expliciete gratis/premium-splitsing: gratis = biedrange, onderbouwing, prijsontwikkeling; premium = verdieping (winnende-bod-analyse, momentum-detail, doorloop-vergelijking) onder producten biedadvies en marktanalyse. market_stats seed.
- Fase 4: de vier funnels.
  - Hypotheek met drie expliciete triggers: overwaarde (geschatte waarde minus ingevuld hypotheekrestant boven drempel), oversluiten (rentevast_tot binnen 12 mnd), aankoopintentie (biedadvies-gebruik of funnel-entry vanaf een niet-geclaimd adres). Laatste stap van de hypotheekfunnel = taxatierapport-upsell met placeholder checkout (NWWI-context 450-800 euro).
  - Makelaar: verkoopintentie-flow vanaf adrespagina en dashboard.
  - Verduurzaming: gekoppeld aan energielabel, subtypes zonnepanelen/warmtepomp/isolatie met eigen kwalificatievragen en eigen leadwaarde.
  - Premium-gating met gemockte checkout.
  - Admin-dashboard met leadwaarde per type/subtype/status uit lib/config/leadwaarde.ts (bedragen uit het verdienmodel; gesloten hypotheek registreert succes-fee-waarde).
- Fase 5: ingest generiek per gemeente (idempotent: 2x draaien = 0 diff; hervatbaar; batch-transacties; respecteert optouts altijd), gating op twee niveaus: gebiedswhitelist (buurt/postcode4, zoekvraag-input handmatig of via Ahrefs-export, TODO) EN paginaniveau-datadiepte (index alleen bij >= 3 comparables of echte WOZ/label plus buurtstats, anders noindex; noindex-pagina's nooit in de sitemap). Eigen sitemap-index + shards (max 50k) via route handlers. Meta-templates. Schema.org: BreadcrumbList, Organization, WebSite, Residence + PropertyValue; harde regel in lib/seo: nooit Product/Offer/price-markup op waardeschattingen. Performance expliciet: revalidate-beleid (24u + on-demand revalidation bij data-updates), cache-headers, DB-indexen (postcode+nummerslug, buurt_code, sales op buurt+datum), notitie wanneer SQLite naar Postgres moet bij NL-schaal. Extra gate: next build + next start rooktest met revalidate-check.
- Fase 6: .env.example, docs/DEPLOYMENT.md (Vercel + wonea.nl DNS bij Hostinger, SQLite-naar-Postgres conversietabel en stappen, /dev/mail-uitsluiting als harde livegang-check), Plausible achter env-flag (uit), docs/AVG-CHECKLIST.md (grondslag/LIA voor gerechtvaardigd belang, art. 14-informatieplicht, DPIA-noodzaak, consent-register, retentie, opt-out-cascade getest, jurist tekent voor livegang) + privacyverklaring-concept, docs/TODO.md.
- Na elke fase: kort rapport, npm run dev + typecheck + vitest + smoke groen, direct door.

## 8. Kwaliteit
- vitest voor AVM, biedadvies, gating, suppressie (incl. her-ingest-test), consent-flows. scripts/smoke.ts checkt kernroutes en de opt-out-cascade. Lint + typecheck per fase. Rate limiting (in-memory) + honeypot op lead/optout/widget/claim endpoints. scripts/purge.ts handhaaft retentie (outbox 90d, onbevestigde captures 30d, gesloten leads 12 mnd; optouts blijven altijd).

## 9. Opt-out-cascade (kern van de merkbelofte, was reviewer-blocker)
Een opt-out is pas klaar als het adres nergens meer opduikt. lib/suppression.ts wordt gecheckt door: adrespagina (v1: notFound + noindex + uit sitemap; echte 410 via route-handler-rewrite staat als verbetering in Fase 5, we beloven in copy "verwijderd", geen statuscode), rapport-tokens (ingetrokken), og-endpoint, comparables van buurpanden, buurt-verkopenlijsten, search- en valuation-API's, widget, sitemaps. Opt-out beeindigt claims en alerts met nette afmeldmail en overleeft elke her-ingest (vitest-regressietest). Smoke-test: na opt-out levert geen enkel pad nog adresdata.

## 10. Open keuzes (defaults gekozen, akkoord volstaat)
1. Codelocatie ~/Code/wonea.
2. Testgemeente Eindhoven.
3. SQLite lokaal; Postgres pas bij deploy.

## 11. TODO-kandidaten voor livegang (accounts/keys/geld, groeit tijdens de bouw)
E-mailprovider, EP-Online-key, echte koopsommen (Kadaster), Ahrefs-keywordvalidatie voor de gating-whitelist, Plausible-key, Vercel + Postgres, DNS wonea.nl, claim-verificatie (WOZ-beschikking/iDIN), admin-auth-upgrade, echte 410-statusroute, AVG-jurist-signoff, DPIA, B2B data/AVM-API (later, verdienmodel punt 6), Hostinger-key roteren.
