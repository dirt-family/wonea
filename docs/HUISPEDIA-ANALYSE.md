# Huispedia: feature-analyse en waar Wonea afwijkt

Intern document. Bron: research-dossier 2026-07-06 (deep-dive, bronnen in het origineel). De live site is
Cloudflare-beschermd en wordt niet gescrapet. We nemen GEEN design, teksten of code over.

## 1. Wat Huispedia is
Gratis consumentenplatform met een profiel voor vrijwel elke NL-woning (~8M), ook niet-te-koop. Housepedia B.V.
(Amsterdam, 2018, founders Bours en Noordeloos), bootstrapped, 10-20 FTE, omzetbracket 500K-1M (SaaS100 2022).
Traffic ~2,0-2,6M bezoeken/maand (schattingen; zelf claimen ze 3,8M), ~99,8% organisch. Model: mensen googelen hun
eigen adres, landen op de woningpagina en worden de funnel in getrokken.

## 2. Paginatypes en datavelden
| Paginatype | Datavelden/inhoud | Wonea-equivalent |
|---|---|---|
| Woningpagina per adres | AVM-waarde (1 getal), kenmerken, verkoop-/prijshistorie, buurtdata, vergelijkbare verkopen | app/woning/[postcode]/[nummerslug]: waarde MET bandbreedte + confidence + comparables-tabel + methode-link |
| WOZ-check | WOZ in ~10 sec, framing "te hoog? maak bezwaar" | app/woz-check: vergelijking met marktschatting, bezwaar-uitleg zonder doorverkoop aan NCNP-bureaus |
| Mijn Woning / claim | eigenaar volgt waarde | Fase 2: claim + dashboard + alerts, met gescheiden consent (service vs marketing) |
| Koopwoningen-aanbod | listings-laag (Funda-concurrent) | BEWUST NIET: wij vechten niet om listings-supply (NVM/brainbay-moat) |
| Huispedia Plus (~49 euro) | biedadvies, winnende-bod-data, biedgedrag, forecast | Fase 3: basis-biedcontext GRATIS, verdieping premium |
| Makelaars/leads | "Tinder met makelaars", leadverkoop | Fase 4: funnels die vooraf benoemen aan wie de aanvraag gaat, consent gelogd |
| B2B API's | Woningwaarde API, kenmerken API, datadiensten | Later-item (docs/TODO.md), geen V1 |

## 3. Funnels van Huispedia
1. SEO-adrespagina naar gratis waarde naar makelaarslead ("wil je een bod ontvangen?").
2. WOZ-check naar bezwaar-framing.
3. Waarde naar Plus-paywall (biedadvies).
4. Advertenties (banken, energie) en dataverkoop als derde/vierde poot.

## 4. Zwaktes en hoe Wonea elk punt beantwoordt
| Huispedia-zwakte (dossier) | Wonea's antwoord (concreet) |
|---|---|
| Taxaties schommelen >100k, identieke huizen heel verschillend | Bandbreedte + confidence (lib/avm.ts), valuations-historie per adres zodat elke verandering herleidbaar is, comparables zichtbaar op de pagina |
| Privacy-backlash: listing zonder toestemming, AP-klacht over genegeerde verwijderverzoeken | Verwijderflow in 2 stappen zonder account (app/verwijderen), suppressielijst die ELK pad afdekt en her-imports overleeft (lib/suppression.ts, getest in tests/suppression.test.ts) |
| Trustpilot 2,9, support zwak, onduidelijke auto-verlenging | Geen abonnement-verrassingen; premium is eenmalig en gemockt tot livegang; rustige UX zonder dark patterns (CONTRACTS.md) |
| Agressieve leadverkoop, voelt als verkocht worden | Funnels benoemen VOOR de verzendknop aan welk type partij de lead gaat; consent met tekstversie gelogd (consents-tabel); succes-fee-model boven lead-dumping |
| Black-box getal | app/methode: alle factoren en drempels met echte getallen uit de code |
| Biedadvies volledig achter paywall | Basis-biedcontext gratis (Fase 3), verdieping premium |
| Matige pagina-diepte (SEO-risico) | Fase 5: datadiepte-gating, dunne pagina's noindex en uit de sitemap |

## 5. Featurelagen (marktanalyse par. 7) naar Wonea-fases
- Laag 0 SEO-magneet: adrespagina, WOZ-check, comparables (Fase 1); indexatie-gating (Fase 5)
- Laag 1 vertrouwen: bandbreedte, methode, verwijderflow (Fase 1)
- Laag 2 groei-loops: claim, alerts, widget, deel-rapport, buurtpagina (Fase 2)
- Laag 3 beslis-moment: biedadvies, timing/marktsignalen (Fase 3)
- Laag 4 monetisatie: 4 leadfunnels, premium, admin (Fase 4)

## 6. Wat we bewust NIET overnemen
- Het design, de teksten en de code (juridisch en principieel).
- De listings-laag: dat gevecht om supply verliezen we van NVM/Funda en het verwatert de propositie.
- De 1-getal-presentatie van waarde: onze kernpropositie is de eerlijke bandbreedte.
- Leadverkoop zonder expliciete, gelogde toestemming en zonder ontvanger-transparantie.
- WOZ-bezwaar als verdienmodel: alleen een gratis haak, de markt is politiek afgeknepen.
