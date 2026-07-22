# CONTRACTS.md: werkafspraken voor iedereen die aan Wonea bouwt

Lees dit VOLLEDIG voordat je code schrijft. docs/PLAN.md is het goedgekeurde plan.

## Stack en conventies
- Next.js 15 App Router, TypeScript strict, Tailwind v4 (tokens in app/globals.css), SQLite via lib/db.ts (singleton, nooit zelf een Database-instantie maken).
- Imports altijd via alias: `@/lib/...`, `@/db/schema`, `@/components/ui`.
- Server components default; "use client" alleen waar interactie het vereist.
- Datums als ISO-strings (helpers in lib/util.ts). Geld in hele euro's (formatEuro).
- Zod voor alle API-input-validatie.
- Tests met vitest in tests/*.test.ts. Testlogica raakt de database alleen via een eigen tijdelijke db (zet env WONEA_DB_PATH naar een tempfile VOOR de eerste import van lib/db).

## Harde regels
1. package.json is verboden terrein: GEEN dependencies toevoegen of scripts wijzigen. Mis je iets, meld het in je eindrapport.
2. Blijf binnen je toegewezen bestanden/mappen (staat in je opdracht). Gedeelde bestanden (schema.ts, lib/db.ts, lib/util.ts, components/ui.tsx, app/layout.tsx, app/globals.css) zijn read-only tenzij expliciet aan jou toegewezen.
3. Suppressie: ELK pad dat adresdata toont checkt lib/suppression.ts (isSuppressed / isAddressIdSuppressed). Geen uitzonderingen: ook API's, og-images, lijsten en e-mails.
4. Synthetische verkopen (bron=seed) hebben NOOIT een adres_id en worden op de pagina gelabeld met VoorbeelddataLabel uit components/ui.tsx.
5. Seed-WOZ en energielabel-indicaties altijd met bronlabel tonen (BronLabel).
6. E-mail: alleen via lib/email/send.ts (queueEmail) + emails/layout.ts (emailLayout). Elke mail heeft een afmeld-/beheerlink. Nooit echt versturen.
7. Consent: elke e-mailcapture of lead-verzending logt een rij in consents met letterlijke tekstversie; checkboxes nooit vooraangevinkt; service (alerts) en marketing altijd gescheiden.
8. Geen dark patterns: geen popups, geen countdown-timers, geen verplichte accounts voor gratis features, geen vooraangevinkte opties.

## Copy (consumententeksten)
- Nederlands, eerlijk, helder, niet opdringerig. Geen emoji. Geen em-dashes (gebruik komma's of dubbele punt).
- Merkbelofte exact zo gebruiken: wij tonen openbare data; alles wat jou als persoon raakt gebeurt alleen met jouw toestemming; verwijderen kan altijd, in twee stappen.
- NIET claimen: "nauwkeurigste", "consent-first platform", of zekerheid die het model niet heeft. Waarde ALTIJD met bandbreedte en confidence tonen ("op basis van N verkopen").
- Bij funnels staat voor de verzendknop expliciet aan welk type partij de lead wordt doorgegeven.

## UI
- Gebruik de tokens (kleuren: achtergrond, paneel, inkt, inkt-zacht, gedempt, lijn, merk, merk-licht, merk-wash, accent, accent-wash, positief, negatief) en componenten uit components/ui.tsx. Geen nieuwe hexcodes.
- Koppen zijn serif (automatisch via h1/h2/h3), UI-tekst sans. Max-breedte via `max-w-5xl mx-auto px-5`.
- Rustig en licht. Geen groen als merkkleur (dat is de concurrent), geen gradients-feest, geen glassmorphism.

## SEO (tot Fase 5)
- Root-layout staat op noindex. Laat dat zo; Fase 5 bouwt gating die per adrespagina beslist.

## Kwaliteit
- Na jouw werk moet `npm run typecheck` en `npm run test` groen zijn voor jouw bestanden.
- Je eindrapport: wat gebouwd, welke bestanden, aannames, wat je NIET deed (TODO-kandidaten).
