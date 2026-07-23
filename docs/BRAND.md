# Wonea huisstijl en designsysteem v2

Design read: consumenten-woningplatform, trust-first maar wel een merk met smaak.
Dials (taste-skill): DESIGN_VARIANCE 5 · MOTION_INTENSITY 4 · VISUAL_DENSITY 4.
Kalm en betrouwbaar, nooit saai; beweging alleen met een reden.

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
