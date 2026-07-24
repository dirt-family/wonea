# Wonea huisstijl en designsysteem v2

Design read: consumenten-woningplatform, trust-first maar wel een merk met smaak.
Dials (taste-skill): DESIGN_VARIANCE 5 · MOTION_INTENSITY 4 · VISUAL_DENSITY 4.
Kalm en betrouwbaar, nooit saai; beweging alleen met een reden.
> **LET OP: de kleur- en levendigheidsregels hieronder zijn per 24 jul 2026
> vervangen door "Huisstijl v3: navy naar amber (definitief)" onderaan dit
> document. v2 blijft gelden waar v3 niets anders zegt (structuur, copy,
> taste-regels).**

## Identiteit
- **Belofte:** eerlijk inzicht zonder schijnzekerheid. Elk ontwerp-besluit moet die
  belofte zichtbaar maken: bandbreedtes in plaats van 1 getal, bronnen in beeld,
  rust in plaats van druk.
- **Kleur:** achtergrond #faf9f7 · paneel #ffffff · inkt #1f2733 · merk #16324f
  (diep blauw, met tintenschaal merk-50..900) · accent #b4740f (amber, spaarzaam:
  max 1 accent-moment per sectie) · positief #2f6f4f · negatief #9b3535.
  GEEN groen als merk (concurrent), geen gradients als vlakvulling, geen paars.
- **Typografie:** Source Serif 4 voor display/koppen (bewuste, gedocumenteerde
  serif-keuze: notarieel vertrouwen; dit is het merk, niet een gril), Inter voor
  UI en body. Emphasis binnen een kop = italic/bold van dezelfde familie.
- **Vormtaal:** kaarten 14px radius, knoppen pill, inputs 8px. Dat is de vaste
  drieslag; nergens andere radii. Schaduwen subtiel en getint, geen zwarte drops.
- **Grafisch motief:** de oplopende huisvorm uit het logo. Toegestaan als groot,
  zacht achtergrond-element (merk-50/merk-100, max 1 per pagina) en als
  sectie-scheider. Dit is ons antwoord op Huispedia's chevrons: eigen vorm.
  Gedocumenteerde uitzondering (geformaliseerd 24 jul): op een amber-wash
  sectie mag het grote achtergrond-motief in accent-200, zodat het motief in
  de warme wash blijft in plaats van er koel doorheen te snijden (bewust
  ontwerp: components/marketing/vertrouwen.tsx, "Jouw huis, jouw data").
- **Motion:** duur-tokens uit globals.css (120/200/300ms), enters ease-uit,
  scroll-reveals subtiel en eenmalig (once), tellers en schuivende
  bandbreedte-markers alleen waar ze iets communiceren. prefers-reduced-motion
  altijd gerespecteerd. Maximaal 1 marquee op de hele site (de plaatsen-ticker).

## Structuur-blauwdruk (Huispedia als skelet, Wonea als huid)
De opbouw, paginatypes en linkstructuur volgen het bewezen skelet van de
marktleiders; expressie (kleur, type, copy, componenten) is 100% Wonea.
Letterlijk overnemen van hun teksten, kleuren of markup is verboden.

### Homepage (secties, in deze volgorde)
1. Hero: split (kop + zoekbalk links, ECHTE mini-woningwaarde-preview rechts,
   gerenderd met onze eigen componenten, geen nep-screenshot). Max 4 tekst-
   elementen, past in de viewport.
2. Twee CTA-kaarten: budget berekenen + WOZ-check.
3. Bronnenstrip (geen verzonnen social proof): "Gebouwd op open data van
   Kadaster, CBS, RVO en DNB" met logo's als tekstmerken in onze stijl.
4. Woningen-rij: horizontaal scrollende kaarten met echte adrespagina's uit het
   testgebied (waarde + bandbreedte per kaart, voorbeelddata-label zichtbaar).
5. Drie feature-kaarten met echte mini-previews van onze UI (waarde/bandbreedte,
   biedadvies, verduurzaming), elk linkend naar de tool.
6. Volle-breedte vertrouwenssectie "Jouw huis, jouw data" (het differentiator-
   verhaal: verwijderen kan altijd, methode is openbaar).
7. Statistieken-band op merk-donker (merk-800/900, witte tekst): echte cijfers
   met bron (aantal woningen testgebied, 7 tools, aantal open bronnen).
8. Plaatsen-ticker (marquee, de enige) naar /woningmarkt/<plaats>.
9. Mega-footer: 4 kolommen + regel "Woningmarkt: bekijk alle plaatsen".

### Linkstructuur
- /woningmarkt = overzicht van plaatsen; /woningmarkt/[plaats] = plaatspagina
  (kerncijfers, buurten-grid, recente verkopen, tools-CTA's). Voedt interne
  linking zoals Huispedia's plaatsenstructuur. Alles noindex tot gating.
- Bestaand: /woning/[postcode]/[slug], /buurt/[gemeente]/[buurt], /tools,
   7 tool-routes, funnels, /dashboard (Mijn Woning), /account.

## Verrijking uit Mitch' prototype (23 jul, zie docs/PROTOTYPE-OOGST.md)
- **Cijfers altijd `tabular-nums`** (Tailwind-utility) zodat bedragen uitlijnen.
- **DeltaPil / EnergieLabelBadge / ModuleTag / FeitenLijst** bestaan in components/ui.tsx.
- **Copy-voice**: gewone taal, anti-druk, eerlijk over wat we niet weten. Vaste zinnen in
  de oogst ("indicatie, geen taxatie, een goed startpunt", "zodat je rustig een keuze
  maakt, niet onder druk", "zij betalen ons voor de introductie, zo simpel is het").
- **Nav-label tools-hub = "Rekenhulpen"** (route blijft /tools).
- IA-uitbreiding: /zoeken (resultaten + filters), /vergelijken (2-3 woningen naast
  elkaar), /kosten-koper, /overbieden. Woning- en buurtpagina volgen de module-opbouw
  uit de oogst.

## Componentbibliotheken van buiten (curatie, 23 jul)
Het shadcn-registry van React Bits is aangesloten (components.json + .mcp.json;
installeren kan met `npx shadcn add @react-bits/<Naam>-TS-TW`). Harde curatie:
- **Wel**: CountUp-idee (herbouwd als components/marketing/telcijfer.tsx, zonder
  dependency, reduced-motion-veilig) · AnimatedList als kandidaat voor de
  alerts-feed in Mijn Woning · verder alleen na expliciete taste-toets.
- **Niet**: alle achtergrond-effecten (Aurora, Particles, LiquidChrome, Silk...),
  tekst-effecten (GlitchText, ShinyText, DecryptedText...), cursor-effecten en
  glow/tilt-kaarten. Dat is precies de AI-slop waar de taste-regels tegen zijn;
  het merk is rustig en trust-first. Registry-code nooit raw plakken: altijd
  herbouwen op onze tokens, zonder motion/gsap-dependency tenzij bewust besloten.
- **Bklit (MIT) is geinstalleerd** als de grafieklaag: components/charts/
  (vendored via het @bklit-registry), her-skinned via de grafiek-tokens in
  globals.css (merk-tinten, amber alleen reeks 4, geen .dark). Grafieken bouwen
  = een dunne wrapper in components/grafieken/ (voorbeeld: verkopen-grafiek.tsx)
  en sober componeren: Grid + Bar/Line + as, geen effects-lagen. `motion` kwam
  als dependency mee en is daarmee de gezegende animatiebibliotheek als CSS
  niet volstaat.
- **Iconen = Lucide (ISC), uitsluitend via components/iconen.tsx** (gecureerde
  whitelist, vaste maten s/m/l, strokeWidth 1.75, aria-hidden default). Nooit
  los lucide-react importeren; nieuwe iconen alleen via de whitelist. Font
  Awesome / Material / Nerd Fonts afgewogen en afgevallen (attributie/zwaarte,
  Google-signatuur, terminal-glyphs).
- KokonutUI hooguit als patroon-inspiratie voor dashboard-kaarten, nooit 1-op-1.

## Taste-regels die hard gelden (uit de skill, mechanisch te checken)
1. **Eyebrow-restraint:** max 1 SectieLabel per 3 secties op marketingpagina's.
   De kop alleen is meestal genoeg.
2. **Layout-diversiteit:** een sectie-layout-familie (3-kaarten-grid, split,
   volle breedte, band, ticker) max 1x per pagina; min 4 families per pagina.
   Max 2 opeenvolgende beeld-tekst-splits.
3. **Echte previews:** productweergaves zijn echte mini-versies van onze UI
   (onze componenten op klein formaat), nooit div-nep-screenshots.
4. **Hero-discipline:** kop max 2 regels, subtekst max 20 woorden, CTA's boven
   de vouw, geen trust-strips ín de hero.
5. **CTA-hygiene:** 1 label per intentie op een pagina; knoptekst past op 1 regel.
6. **Statistieken zijn echt** of expliciet voorbeeld; nooit verzonnen precisie.
7. **Copy-zelfaudit** voor oplevering: elke zichtbare string hardop lezen;
   AI-poezie en kromme metaforen eruit. NL, eerlijk, geen emoji, geen em-dashes.
   Marketing-copy schrijf je met de copywriting-skill
   (.claude/skills/copywriting) plus de productcontext in
   .claude/product-marketing.md; claims alleen uit het bewijs-blok daar.
8. **Thema-slot:** de site is licht. Binnen een pagina wisselt het thema niet;
   maximaal 1 donkere band per pagina als bewuste uitzondering (op de homepage
   is dat de statistieken-band; elders mag het een andere slotband zijn).

## Dashboard-shell-patroon (flux, LETTERLIJK — besluit Mitch 24 jul)
Mitch leverde het "flux"-healthdashboard als voorbeeld en besloot daarna
expliciet: neem OOK de kleuren mee, de blokken, en de zwarte menubalk links.
Het patroon is dus geen navy-vertaling meer: de ingelogde omgeving
(app/dashboard/**, app/account/**) krijgt de flux-uitstraling zelf, op Wonea's
typografie en eerlijkheidsregels.
- **App-shell**: ZWARTE sidebar links (neutraal bijna-zwart `shell`, geen
  navy), logo bovenin (gradient-variant leest goed op zwart), navigatie met
  icoon + label, actief item als witte/lichte pill, teller-badges in lime.
  Het geheel oogt als een afgerond zwart frame (radius 24-32) op de
  achtergrond. Alleen ingelogd; de publieke site houdt de gewone header.
- **Canvas**: lichtgrijs (`canvas`) binnen het frame, met grote WITTE blokken
  (radius 24 binnen het dashboard-frame), veel lucht, kop met icoon in
  tint-rondje plus een stil overflow-menu rechts. Blokken-compositie zoals
  flux: verschillende formaten in een grid, precies een donkere tegel.
- **Grote vriendelijke cijfers**: oversized getal met kleine eenheid-suffix
  (bijv. 427.000 met "euro" klein), delta als lime-pill (positief) of
  neutrale/negatieve pill ernaast (+5%).
- **De donkere analysekaart** is shell-zwart (zoals flux' Sleep Analysis):
  de waarde-ontwikkelingsgrafiek met lime voor het actuele punt/de actieve
  staaf, lavendel voor de vergelijkingsreeks, gedempte staven voor historie,
  periode-switch als pill.
- **Speelse maar functionele datavisualisaties**: cirkel/bubble-verdeling in
  navy/lavendel/lime, dot-matrix in lavendel-tinten als intensiteitsweergave,
  voortgangsbalken per categorie met kleurpunt-legenda.
- **Eén promo/CTA-blok onderin de sidebar**: lime kaart met illustratie en
  zwarte pill-knop — maximaal 1, functioneel (bijv. "Claim je woning" of
  waarde-alerts aanzetten).
- Toegankelijkheid blijft leidend: contrastparen uit het tokenstelsel; de
  sidebar-navigatie werkt volledig met toetsenbord en zichtbare focus.
Dit patroon geldt als de lat voor app/dashboard/** en app/account/**; losse
elementen (grote cijfers + suffix, delta-pills, donkere analysekaart,
icoon-in-tint-rondje, dot-matrix) mogen ook elders terugkomen waar ze
functioneel zijn.

### Flux-kleurlaag (tokens, rollen en discipline — besluit Mitch 24 jul)

Twee kleurfamilies uit flux zijn volwaardige PRODUCT-accentkleuren, naast
zwart voor de shell. Definitieve tokens (in app/globals.css, alle ratio's
nagerekend op WCAG 2.x):

**Shell-familie** — neutraal bijna-zwart (bewust géén navy): de sidebar, de
donkere analysekaart en zwarte pill-knoppen in het dashboard.

- `shell #1b1c20` · `shell-hoog #26272d` (hover/actief-vlak) ·
  `shell-lijn #34353c` (hairlines, decoratief) · `op-shell #f4f4f5`
  (tekst op shell, 15,5:1) · `op-shell-zacht #a8a9b3` (secundaire tekst,
  7,3:1 op shell en 6,4:1 op shell-hoog) · `canvas #ececea` (het lichtgrijze
  dashboard-canvas; shell op canvas 14,4:1).

**Lime-familie** — energie en actie: positieve delta-pills, het promo-blok,
de actieve grafiekstaaf/het actuele punt, teller-badges. Anker = lime-400.

- `lime-50 #f8fbe2 (= lime-wash) · 100 #f1f8c4 · 200 #e8f596 · 300 #e1f376 ·
  400 #d9f154 (anker, alias lime) · 500 #bcd63a · 600 #7e901f ·
  700 #68781b · 800 #4f5a19 (= lime-diep) · 900 #3d4614 · 950 #2c330f`
- Nooit tekst op licht in 50-500. Tekst op lime-vlakken is shell (13,5:1 op
  het anker) of inkt (11,9:1). Kleine graphics/dots op licht: lime-600
  (3,6:1 op wit, 3,0:1 op canvas). Groot/bold of UI op licht: lime-700
  (4,9:1). Lime-TEKST op licht: lime-diep (7,5:1 op wit, 7,1:1 op de wash).

**Lavendel-familie** — de rustige datakant: tweede grafiekreeks, dot-matrix,
metriek-vlakken. Anker = lavendel-300.

- `lavendel-50 #f4f2fd (= lavendel-wash) · 100 #e9e5fb · 200 #d3ccf8 ·
  300 #b3a8f2 (anker, alias lavendel) · 400 #9c8ce9 · 500 #8371d9 ·
  600 #6d59c6 · 700 #5a47ad (= lavendel-diep) · 800 #483a8b · 900 #3a3070`
- Nooit tekst op licht in 50-400. Tekst op lavendel-vlakken is shell (7,9:1
  op het anker) of inkt (7,0:1). Grafiekreeks/graphics op licht:
  lavendel-500 (3,9:1 op wit, 3,3:1 op canvas). Lavendel-TEKST op licht:
  lavendel-diep (7,1:1 op wit, 6,5:1 op de wash); wit op een
  lavendel-diep-vlak haalt 7,1:1.

**Grafiek-tokens (aangevuld):** reeks 1 = merk, reeks 2 (`--chart-2`) =
lavendel-500, reeks 3/5 = merk-tinten (historie), reeks 4 = amber.
`--chart-actueel` = lime voor het actuele punt/de actieve staaf (op licht
lime-600, op shell het lime-anker). De klasse `chart-op-shell` (gezet door
AnalyseKaart) schakelt de hele Bklit-chartlaag naar de donkere context:
historie = gedempt wit, vergelijking = lavendel-anker, actueel = lime-anker.

**Radius:** naast band 20 bestaat `--radius-blok: 24px` voor de grote
flux-blokken BINNEN het dashboard-frame (buiten het dashboard geldt kaart 14).

Discipline (zodat het geen circus wordt):
- MERK blijft navy + amber: logo, koppen, primaire knoppen en washes op de
  publieke site veranderen niet van familie.
- In het dashboard voeren zwart + lime + lavendel de boventoon; amber alleen
  in het logo.
- Site-brede echo (Mitch: "overal laten terugkomen"): de blokken-taal en
  lime/lavendel komen ook op de publieke site terug, gedoseerd en functioneel
  — grafiekreeksen (lavendel als tweede reeks, lime als actueel accent),
  stat-tiles, delta-pills, maximaal een lime promo-moment per pagina. Naast
  navy per scherm maximaal twee accentfamilies tegelijk.

## Huisstijl v3: navy naar amber (definitief, 24 jul 2026)

Merkanker: het nieuwe logo (components/logo.tsx, public/icon.svg) — de
oplopende huizenreeks met gradient navy #1E293B naar amber #F59E0B. Alle
site-tokens zijn hierop geharmoniseerd. Dials: **DESIGN_VARIANCE 7 ·
MOTION_INTENSITY 6 · VISUAL_DENSITY 6.** De levendigheids-lat is
Huispedia-niveau (grote kleurvlakken, dramaturgie, diepte), met Wonea's eigen
middelen; hun kleuren, markup en copy blijven verboden.

### Waarom v2 saai oogde (audit 24 jul, gerenderd op /, /tools e.a.)

Vrijwel alles was wit-op-wit: een vlak wit hero-paneel op een warmwitte
pagina, kaarten met alleen een 1px-randje, nergens schaduw of diepte. De
zoekbalk (ons kernproduct-moment) zag eruit als een kaal formulierveld. Elke
sectie had dezelfde vorm: gecentreerde kolom, kop, randjes-kaarten — geen
wash-wisseling, dus geen ritme bij het scrollen. Kleur bestond alleen als
tekstkleur; de enige twee kleurmomenten (donkere band, beta-banner) waren
niet verbonden met het merk. En het nieuwe logo (navy naar amber) stond naast
tokens uit een ander palet (#16324f blauw, #b4740f los bruin), dus het merk
klopte letterlijk niet met de site. v3 lost precies dit op: diepte
(schaduwlagen), dramaturgie (washes), en één kleursysteem dat uit het logo
volgt.

### Kleursysteem (tokens in app/globals.css, allemaal gedocumenteerd)

**Navy-familie** — de hele merk-schaal is her-getint naar de slate-ondertoon
van de logo-navy (hue ~217, minder verzadigd dan v2). Besluit + motivatie:
`merk-900` schuift naar **exact #1E293B** zodat donkere vlakken (CTA-band,
statistieken-band, dashboard-sidebar) naadloos aansluiten op het donkere
logo-uiteinde; de actiekleur `merk`/`merk-800` (#253853) blijft één stap
levendiger, anders ogen knoppen grijs. Er is dus GEEN apart logo-navy-token
nodig: merk-900 ís de logo-navy.

- `merk-50 #f5f7fa · 100 #e8edf4 · 200 #cdd9e6 · 300 #a4b8cf · 400 #7d97b4 ·
  500 #587499 · 600 #415c7e · 700 #33496a (= merk-licht) · 800 #253853
  (= merk) · 900 #1e293b (logo-navy) · 950 #131b28`
- Koppen, knoppen, links: `merk`. Donkere banden/shell: `merk-900`.

**Amber-familie** — volwaardige tweede merkkleur, `accent-50..900`
geharmoniseerd rond de logo-amber (#F59E0B = accent-500) en het bestaande
#b4740f (= accent-700 = `accent`):

- `accent-50 #fdf8ed · 100 #faedd2 · 200 #f6dca6 · 300 #f2c572 · 400 #f4b03c ·
  500 #f59e0b (logo-amber) · 600 #d48806 · 700 #b4740f · 800 #8f5a10 ·
  900 #74480d`
- Rolverdeling: 500 voor badges/dots/grafiek-accenten (nooit tekst op licht),
  800/900 voor amber-tekst op licht, wash voor warme vlakken.

**Sectie-washes**: `wash-navy #eef2f7` (koele adem: data/uitleg),
`wash-amber #fdf6e9` (warme adem: mens/actie), `paneel #ffffff`. Achtergrond
blijft warm licht `#faf9f7`.

**EU-energielabelkleuren** als tokens `label-a..g`: A #2c9b45 · B #6bb23a ·
C #c7c23b · D #e7a12e · E #d26a26 · F #d9542b · G #c0392b. Overal identiek,
alleen via EnergieLabelBadge.

**Schaduwen** (gelaagd, navy-getint, nooit zwart): `shadow-zweef` (rustende
kaart) · `shadow-zweef-md` (zwevend: zoekbalk, dropdown) · `shadow-zweef-lg`
(opgetild: hover-lift, hero-preview). Hover-gedrag = klasse `til-op`:
schaduwlaag omhoog + translateY(-2px) op de motion-tokens,
reduced-motion-veilig.

**Gradients**: `--gradient-merk` (navy naar amber, 135deg) is UITSLUITEND
voor logo- en merkmomenten: het logo zelf, maximaal één klein merkaccent per
pagina (bijv. de amber-eindstand in een grafiek). NOOIT als vlakvulling van
secties, kaarten of knoppen. Eénkleurige washes die naar transparant
vervloeien (`--gradient-hero-wash`, `--gradient-hero-wash-navy`) zijn
sectie-dramaturgie en vallen niet onder die regel.

**Radius**: de drieslag blijft hard — kaart 14 / knop pill / input 8. Twee
gedocumenteerde uitzonderingen: `--radius-band: 20px` voor volle-breedte
banden en de donkere analysekaart, en het dashboard-shell-frame (24-32,
exclusief designer J5).

### Toegestane contrast-paren (hard; alles daarbuiten is een bug)

Lopende tekst (>= 4,5:1):

- Op wit/achtergrond/washes: `inkt` (15,9) · `inkt-zacht` (7,5) · `merk`
  (11,9) · `merk-600` (6,9) · `accent-800` (5,8) · `accent-900` (7,9) ·
  `positief` · `negatief`. `gedempt` (4,8) alleen voor meta/bijschriften.
- Op `merk-900`: wit (14,6) · `merk-100`/`merk-200` (>= 10).

Groot/bold (>= 18px bold of >= 24px) of UI-componenten (>= 3:1):

- `accent-700` op licht (3,9) — dé grens voor amber op wit; kleiner of
  dunner mag niet.
- `merk-500` op licht (4,8) voor korte display-tekst (bronnenstrip).
- `accent-300` op `merk-900` (9,1) — amber-accenttekst op donker.
- Knop op donker: `accent-500`-vlak met `merk-900`-tekst (6,8).

Flux-paren (lopende tekst >= 4,5:1, nagerekend 24 jul):

- Op `shell` (en `shell-hoog`): `op-shell` (15,5 / 13,5) · `op-shell-zacht`
  (7,3 / 6,4) · wit (17,0).
- Op het `lime`-anker: `shell` (13,5) · `inkt` (11,9) · `merk-900` (11,6).
- Op het `lavendel`-anker: `shell` (7,9) · `inkt` (7,0) · `merk-900` (6,8).
- Op `lime-wash`: `inkt` (14,2) · `merk` (11,2) · `lime-diep` (7,1).
- Op `lavendel-wash`: `inkt` (13,6) · `merk` (10,7) · `lavendel-diep` (6,5).
- Op wit: `lime-diep` (7,5) · `lavendel-diep` (7,1) · `lavendel-600` (5,4) ·
  `lime-700` (4,9).
- Wit of `op-shell` op een `lavendel-diep`-vlak (7,1 / 6,5).

Flux groot/bold of UI-componenten (>= 3:1):

- `lime-600` op wit (3,6), op achtergrond (3,4) en op canvas (3,0) — dé
  grens voor lime-graphics/dots op licht.
- `lavendel-500` op wit (3,9), op achtergrond (3,8) en op canvas (3,3) —
  grafiekreeks 2 en lavendel-dots op licht.
- `lime`-anker op shell (13,5) en `lavendel`-anker op shell (7,9) —
  badges/grafiekaccenten op de donkere kaart.

Verboden: amber 300-600 als tekst op licht; `merk-300/400` als tekst;
gedempt op washes voor lopende tekst; lime 50-500 en lavendel 50-400 als
tekst op licht (vlakken/graphics only); `lime-500` als losse graphic op wit
(1,6:1 — alleen als vlak- of schaalstap); `op-shell-zacht` op licht;
`shell-lijn` is decoratief (1,4:1 op shell), nooit een betekenisdragend
onderscheid.

### Wash-dramaturgie per paginafamilie

Ritme-regel: nooit twee dezelfde washes direct na elkaar; wit paneel is de
rustmaat. Maximaal 1 donkere band (merk-900) per pagina (thema-slot v2 blijft).

- **Homepage**: hero amber-wash (gradient-hero-wash) → wit → navy-wash
  (bronnen/uitleg) → wit → donkere statistieken-band → ticker.
- **Rekenhulpen (/tools, toolpagina's)**: hero navy-wash of wit; UitkomstKaart
  op merk-wash; amber alleen voor BronLabel/accenten; 1 CTA-band (merk-900)
  als slot toegestaan.
- **Woning/buurt/woningmarkt**: licht canvas; kerncijfers als stat-tiles op
  tint (merk-wash, spaarzaam accent-wash); donkere analysekaart = AnalyseKaart
  (shell-zwart, radius-band) voor de waarde-grafiek; sticky sidebar-kaarten
  met shadow-zweef.
- **Zoeken/vergelijken**: functioneel wit + navy-wash; WoningKaart-signatuur;
  geen donkere band.
- **Gids/methode/over-ons**: editoriaal rustig, amber-wash voor 1
  menselijke sectie, verder wit.
- **Dashboard/account (exclusief J5)**: zwarte flux-shell (`shell`) + grijs
  canvas + witte blokken + lime/lavendel, zie het Dashboard-shell-patroon en
  de Flux-kleurlaag hierboven.

### Anti-slop-regels die blijven gelden (uit v2, hier herbevestigd)

- Geen gradient-vlakken op secties; de merkgradient alleen voor merkmomenten.
- Geen glow, geen glassmorphism, geen achtergrond-effects (Aurora e.d.).
- Radius-drieslag 14/pill/8 (+ de twee gedocumenteerde uitzonderingen).
- Max 1 marquee op de hele site (plaatsen-ticker); max 1 donkere band per
  pagina; eyebrow-restraint (max 1 SectieLabel per 3 secties);
  layout-familie max 1x per pagina.
- Eerlijkheid boven alles: bandbreedtes, bronlabels, VoorbeelddataLabel,
  geen nep-data, eerlijk-leeg met benoemde bron.
- Merkkleur blijft navy-amber: geen andere families in logo of primaire
  knoppen. Lime en lavendel zijn per besluit Mitch (24 jul) toegestane
  PRODUCT-accentkleuren (zie Flux-kleurlaag) — gedoseerd, nooit als
  merkvervanger. Cijfers altijd tabular-nums; geen em-dashes/emoji in copy.

### Component-API v3 (components/ui.tsx, tenzij anders vermeld)

Nieuw:

- `Pil({ variant: "merk" | "amber" | "neutraal" })` — labelpill in wash met rand.
- `IcoonRondje({ naam, tint: "merk" | "amber", maat: "m" | "l" })` — icoon in tint-rondje.
- `GrootCijfer({ waarde, eenheid?, delta?, deltaRichting? })` — oversized cijfer
  met kleine eenheid + DeltaPil.
- `TintSectie({ wash: "navy" | "amber" | "paneel" | "geen" })` — sectie-wrapper
  voor de wash-dramaturgie.
- `AlertRij({ kleur: "merk" | "amber" | "positief" | "negatief", titel, meta?, href? })`
  — feed/keuzerij met kleurdot; componeer met divide-y.
- `WoningKaart({ href, adres, plaats, micro?, waarde?, bandbreedte?,
  energielabel?, illustratie?, tag? })` — de rijke woningkaart-signatuur
  (illustratie-hoek op tint, labelbadge, waarde + bandbreedte, hover-lift).
- `CtaBand({ titel, tekst?, knopTekst, href, pills? })` — donkere navy band
  (radius 20) met amber knop.

Verrijkt:

- `Kaart` draagt nu standaard `shadow-zweef`.
- `StatTegel({ ..., tint?: "paneel" | "merk" | "amber" })` — stat-tile op tint.
- `EnergieLabelBadge` op de label-tokens; tekst wit op A/E/F/G, inkt op B/C/D.
- `BronLabel` tekst naar `accent-800` (contrast).
- `Zoekbalk` (components/zoekbalk.tsx): zwevend met zoekicoon,
  `shadow-zweef-md`, merk-focusring (`ring-merk-200/60` + border-merk).
- Illustraties (public/illustraties/): her-getint naar de v3-navy-tinten;
  hero-motief kreeg het grootste huis in logo-amber als merkmoment.

Bestaand en ongewijzigd bruikbaar: KnopPrimair/KnopSecundair, Veld,
Bandbreedte, UitkomstKaart, Sparkline, StappenBalk, UitklapUitleg, LegeStaat,
LeadCta, DeltaPil, ModuleTag, FeitenLijst, VergelijkTabel, Telcijfer.

### Component-API flux-kleurlaag (24 jul; components/ui.tsx tenzij vermeld)

Nieuw:

- `PromoBlok({ titel, tekst?, knopTekst, href, illustratie?, radius?: "kaart"
  | "blok", className? })` — het flux-sidebar-promopatroon: lime kaart,
  shell-tekst, zwarte pill-knop; optionele illustratie-kop op lime-200.
  Max 1 per pagina, altijd functioneel. radius="blok" (24) alleen binnen het
  dashboard-frame.
- `AnalyseKaart({ titel, meta?, actie?, children, className? })` —
  shell-zwarte kaart op radius-band (20) met kopregel (titel + meta
  op-shell-zacht) en actie-slot rechts (bijv. periode-pill). Zet de klasse
  `chart-op-shell`, dus elke Bklit-grafiek erin kleurt automatisch donker.
  Telt als de ene donkere band per pagina.
- `DotMatrix({ waarden: number[], omschrijving, kolommen? = 7, max?,
  className? })` — stippenraster in lavendel-tinten als intensiteitsweergave
  (0 = canvas, dan lavendel-200 t/m -500). role="img"; omschrijving is de
  verplichte toegankelijke samenvatting. Lege reeks rendert niets.
- `VoortgangsBalk({ segmenten: { label, waarde, kleur?: "merk" | "lavendel" |
  "lime" | "amber" | "neutraal" }[], formatteer?, omschrijving?, className? })`
  — gestapelde categorie-balk met kleurpunt-legenda (dot + label + waarde,
  tabular-nums). Kleuren op graphics-contrast; zonder kleur een automatische
  volgorde. Totaal 0 rendert niets (aanroeper toont LegeStaat).
- `WaardeGrafiek({ data: { label, waarde }[], actueelIndex? })`
  (components/grafieken/waarde-grafiek.tsx) — staafgrafiek met gedempte
  historie en precies een actieve staaf in lime (--chart-actueel); gemaakt
  voor binnen AnalyseKaart, werkt ook op licht. actueelIndex default =
  laatste punt.

Verrijkt:

- `Pil` — varianten erbij: `"lime"` (lime-wash, tekst lime-diep) en
  `"lavendel"` (lavendel-wash, tekst lavendel-diep).
- `StatTegel` — tinten erbij: `"lime"` en `"lavendel"` = het VOLLE
  anker-vlak, alle tekst shell (delta-richting zit in de tekst). Max 1
  kleurtegel per stat-rij (flux: precies een kleurtegel).
- `DeltaPil({ richting, tint?: "wash" | "lime" })` — tint="lime" maakt
  alleen de positieve richting een vol lime-vlak met shell-tekst.
- `GrootCijfer({ ..., deltaTint?: "wash" | "lime" })` — geeft de tint door
  aan de interne DeltaPil (het flux-patroon grote-cijfer-plus-lime-delta).
- `AlertRij` — kleuren erbij: `"lime"` (dot lime-600) en `"lavendel"`
  (dot lavendel-500).
- Grafieklaag: `--chart-2` = lavendel-500 (tweede reeks; een
  enkel-reeks-grafiek gebruikt de merk-familie, zie verkopen-grafiek),
  `--chart-actueel` = lime, scope-klasse `chart-op-shell` voor de donkere
  kaart.
