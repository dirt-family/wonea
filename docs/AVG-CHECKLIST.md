# AVG-checklist voor livegang

Afvinkbare lijst. Per punt staat de **status nu** (wat er in de code staat en aantoonbaar is) en **wat er voor livegang nog moet**. Een punt is pas af te vinken als beide kanten kloppen en het bewijs benoemd is.

> **Harde eindvoorwaarde:** een Nederlandse privacyjurist beoordeelt het geheel en tekent voor livegang (punt 12). Zonder die handtekening gaat Wonea niet live, hoe groen de rest ook is.

- [ ] **1. Opt-out-cascade werkt overal en overleeft her-ingest**
  - Status nu: **gebouwd en aangetoond.** `lib/suppression.ts` is de centrale suppressielijst; `applyOptoutCascade` zet het adres op opted_out, trekt deel-rapporten in, beëindigt claims, zet alerts uit en stuurt een nette afmeldmail. `tests/suppression.test.ts` bewijst de hele cascade, inclusief de her-ingest-test ("overleeft her-ingest: het adres komt nooit terug op actief") die exact het gedrag van `scripts/seed.ts` naspeelt. De suppressie-check zit in alle renderende paden: adrespagina, buurt- en verkooppagina's, biedadvies, claim- en dashboard-flows, alle funnels, og-images, rapport-, search-, widget- en alerts-API's (grep op `isSuppressed` levert ruim 20 bestanden).
  - Voor livegang: dezelfde cascade eenmalig end-to-end aantonen op de productie-omgeving (opt-out aanvragen, bevestigen, controleren dat pagina, zoekresultaten en gedeelde rapporten weg zijn).

- [ ] **2. Grondslag vastgelegd plus LIA geschreven**
  - Status nu: de grondslag (gerechtvaardigd belang, artikel 6 lid 1f AVG) staat benoemd in het privacyverklaring-concept op `/privacy` (`app/privacy/page.tsx`). De bijbehorende belangenafweging (LIA: het document dat op papier afweegt waarom ons belang zwaarder mag wegen dan dat van de bewoner) **bestaat nog niet**.
  - Voor livegang: LIA schrijven en laten toetsen door de jurist. Sterke punten om in te brengen: alleen openbare bronnen, bandbreedte in plaats van schijnzekerheid, werkende tweestaps-verwijderflow, suppressielijst die her-imports overleeft.

- [ ] **3. Informatieplicht artikel 14 AVG**
  - Status nu: **niet ingevuld.** Artikel 14 eist dat je mensen informeert als je gegevens over hen verwerkt die je niet bij henzelf hebt verzameld (precies wat adrespagina's doen). Er is nu alleen de publieke privacypagina.
  - Voor livegang: met de jurist bepalen hoe Wonea hieraan voldoet (doorgaans: een duidelijke, vindbare privacyverklaring plus laagdrempelige verwijdermogelijkheid; eventueel aanvullende maatregelen). Vastleggen welke uitzonderingsgrond of invulling van toepassing is.

- [ ] **4. DPIA-beoordeling**
  - Status nu: **niet gedaan.** Een DPIA (Data Protection Impact Assessment) is een verplichte risico-analyse bij waarschijnlijk hoog risico, bijvoorbeeld grootschalige verwerking. Bij opschalen naar heel Nederland (miljoenen adressen met waardeschattingen) is dat aannemelijk.
  - Voor livegang: schriftelijk beoordelen (met de jurist) of een DPIA verplicht is; zo ja, uitvoeren voordat er opgeschaald wordt. De uitkomst gedateerd bewaren.

- [ ] **5. Consent-register (artikel 7: toestemming aantoonbaar)**
  - Status nu: **aanwezig en in gebruik.** De `consents`-tabel (`db/schema.ts`) logt per toestemming doel, letterlijke tekstversie, bron, datum en eventuele intrekking. De checkbox-teksten staan als versies in de code (`app/claim/consent-teksten.ts`, `app/hypotheek/consent-tekst.ts`, `app/taxatierapport/consent-teksten.ts`, `app/verkopen/consent-teksten.ts`, `app/widget/consent.ts`). Checkboxes zijn nooit vooraangevinkt; service (alerts) en marketing zijn gescheiden keuzes; de widget werkt met double opt-in.
  - Voor livegang: niets bouwen; wel de teksten mee laten lezen door de jurist en afspreken dat elke tekstwijziging een nieuw versienummer krijgt.

- [ ] **6. Bewaartermijnen gedefinieerd en gehandhaafd**
  - Status nu: **aanwezig als script.** `scripts/purge.ts` handhaaft: outbox-mails 90 dagen, onbevestigde widget-aanmeldingen 30 dagen, leads tot hun `retentie_tot` (12 maanden na afronding), verlopen magic-tokens en sessies; optouts worden bewust nooit gewist (de verwijderlijst moet blijven). De termijnen staan ook consumentleesbaar op `/privacy`.
  - Voor livegang: het script periodiek laten draaien in productie (cron of purge-route, zie docs/DEPLOYMENT.md stap 5.6 en docs/TODO.md); nu draait het alleen handmatig via `npm run purge`.

- [ ] **7. Datalek-procedure**
  - Status nu: **bestaat niet.** Vereist is een korte werkinstructie: hoe herkennen we een datalek, wie beoordeelt, wanneer melden we bij de Autoriteit Persoonsgegevens (binnen 72 uur) en wanneer informeren we betrokkenen.
  - Voor livegang: procedure schrijven (een A4 volstaat voor deze schaal), jurist laten meelezen, vindplaats afspreken.

- [ ] **8. Verwerkersovereenkomsten (DPA's)**
  - Status nu: **geen enkele afgesloten**, logisch want er zijn nog geen accounts (zie docs/DEPLOYMENT.md). Nodig met elke partij die persoonsgegevens voor Wonea verwerkt.
  - Voor livegang: DPA sluiten met minimaal hosting (Vercel), de Postgres-host (Supabase of Neon) en de e-mailprovider (Postmark of Resend). Plausible is cookieloos en verwerkt geen persoonsgegevens voor ons doel, maar check dit bij de jurist zodra analytics aangaat.

- [ ] **9. Dev-mailbox uitgesloten van productie**
  - Status nu: **guard aanwezig en dubbel.** `/dev/mail` (`app/dev/mail/page.tsx`) rendert alleen bij `NODE_ENV=development` EN `WONEA_DEV_MAIL=1`; anders `notFound()`. In een productiebuild bestaat de pagina dus niet.
  - Voor livegang: `WONEA_DEV_MAIL` niet zetten op Vercel en na elke deploy de 404-check draaien (docs/DEPLOYMENT.md stap 5.2).

- [ ] **10. Admin-auth op productieniveau**
  - Status nu: basic-auth via `middleware.ts` (gebruiker `admin`, wachtwoord uit `WONEA_ADMIN_PASSWORD`), afdoende voor lokaal. Geen accounts, geen 2FA, geen lockout, geen auditlog.
  - Voor livegang minimaal: sterk uniek wachtwoord. Kort daarna: echte admin-auth (staat op docs/TODO.md), want de admin toont leads en outbox-mails, dus persoonsgegevens.

- [ ] **11. Privacyverklaring definitief**
  - Status nu: **concept, staat live in de app** op `/privacy`, inclusief eerlijke "Concept"-banner, grondslag, toestemmings-scheiding, bewaartermijnen en rechten. Het contact-e-mailadres is nog een invulplek.
  - Voor livegang: contactadres invullen, concept-banner weg, tekst definitief maken samen met punt 2, 3 en 12.

- [ ] **12. HARD: handtekening Nederlandse privacyjurist**
  - Status nu: niet gebeurd.
  - Voor livegang: jurist beoordeelt grondslag plus LIA (2), artikel 14-invulling (3), DPIA-beslissing (4), consent-teksten (5), bewaartermijnen (6), datalek-procedure (7) en de definitieve privacyverklaring (11), en tekent schriftelijk af. Dit is de laatste gate voor livegang; plan de jurist vroeg in, niet als sluitstuk.

## Al geregeld in de bouw (geen actie, wel bewijs)

- Elke mail bevat een afmeld-/beheerlink via de gedeelde template `emails/layout.ts`.
- Widget-e-mailcapture werkt met double opt-in (`app/widget/`, onbevestigd na 30 dagen gepurged).
- Synthetische verkopen hangen nooit aan een echt adres (`sales.adres_id` is null bij bron seed, afgedwongen in `scripts/seed.ts` en `scripts/market-drift.ts`) en worden op de pagina gelabeld als voorbeelddata.
- Rate limiting plus honeypot op de publieke formulieren (`lib/ratelimit.ts`; in-memory, productie-store staat op docs/TODO.md).
- Geen dark patterns: geen vooraangevinkte checkboxes, geen popups, geen verplicht account voor gratis features (afspraak in docs/CONTRACTS.md).
