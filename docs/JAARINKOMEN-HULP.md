# Jaarinkomen-hulp: spec (deep-research 23-24 jul 2026)

Bouwspec voor de "bereken je jaarinkomen"-hulp in de inkomen-stap van /budget
en /hypotheek-berekenen. Onderbouwing: 19 adversarieel geverifieerde claims
(NHG V&N 2026, Regeling hypothecair krediet, Nibud-advies 2026, Staatscourant
2025-36471, bankenpagina's). De UX-vergelijking van bankmodules haalde de
verificatie deels niet (limiet); de UX-keuzes hieronder volgen daarom onze
eigen rekenmodule-conventies plus wat wel geverifieerd is.

## Geverifieerde rekenregels (bron per regel)

**Wettelijke basis**
- Toetsinkomen = uitsluitend huidige VASTE en BESTENDIGE inkomsten
  (Regeling hypothecair krediet art. 2 lid 1, wetten.overheid.nl/BWBR0032503).
- Niet-vaste inkomsten: gemiddelde over de laatste 3 kalenderjaren of 36
  maanden (art. 2 lid 2).
- De leennormen-tabellen 2026 (Staatscourant 2025-36471) definieren ZELF geen
  looncomponenten; component-regels komen uit NHG V&N 2026 en acceptatiebeleid.
- Tweede inkomen telt sinds 2023 voor 100% mee; optellen van beide bruto
  jaarinkomens is correct (Nibud-advies 2026). Onze bestaande som-aanpak klopt.

**Loondienst (NHG V&N 2026, norm C.7.4/C.7.5)**
- Bestendige inkomsten: inkomsten waarvan je kunt verwachten dat de consument
  ze houdt. Expliciet NIET: reiskostenvergoeding, pensioencompensatie en
  andere onkostenvergoedingen.
- Vaststelling via de werkgeversverklaring (NHG-model): tel de bestendige
  delen van het inkomen bij elkaar op. Componenten op dat model: bruto
  jaarsalaris, vakantietoeslag, vaste 13e maand, vaste eindejaarsuitkering,
  onregelmatigheidstoeslag/provisie/overwerk voor zover structureel.
- Flexibel budget (IKB) telt alleen mee als het in geld uitgekeerd kan worden
  (nhg.nl werkgeversverklaring-pagina).

**Flexwerk/uitzendkrachten (norm C.7.6.2/C.7.9)**
- Zonder intentieverklaring: gemiddelde bruto jaarinkomen laatste 3
  kalenderjaren, GEMAXIMEERD op het laatste kalenderjaar.
- Uitzendkrachten: Perspectiefverklaring-route (ook bij ABN AMRO bevestigd);
  Arbeidsmarktscan voor hen uitgesloten.

**Ondernemers/ZZP (norm C.7.10/C.7.15.1)**
- Minimaal 12 maanden ondernemer: Inkomensverklaring Ondernemer (IKV) door
  een NHG-geaccepteerde rekenexpert, max 6 maanden oud.
- Via aangiftes: gemiddelde laatste 3 aangiftes IB, gemaximeerd op de laatste.
- Banken wijken af (ABN: 75% na 1 jr, 90% na 2 jr, 100% vanaf 3 jr;
  loondienst+zzp zonder NHG niet optellen) → de hulp geeft de NHG-regel en
  benoemt dat geldverstrekkers eigen staffels hanteren.

## De hulp: velden en gedrag (in de bestaande rekenmodule-taal)
Uitklapbare invulhulp binnen de inkomen-stap ("Weet je je bruto jaarinkomen
niet uit je hoofd?"), per persoon, situatie-keuze eerst:

1. **Loondienst** (hoofdroute):
   - Bruto maandsalaris (excl. vakantiegeld) → x 12.
   - Vakantiegeld: standaard AAN als 8% (uitzetbaar; afwijkend bedrag invulbaar).
   - Vaste 13e maand: ja/nee → + 1 maandsalaris.
   - Vaste eindejaarsuitkering: bedrag per jaar.
   - Structurele toeslagen (ORT/provisie/overwerk, alleen indien structureel):
     bedrag per jaar, met een zin dat de werkgeversverklaring bepaalt wat
     structureel is.
   - Uitkomst: bruto jaarinkomen, live opgeteld, met de componenten zichtbaar;
     knop "gebruik dit bedrag" vult het inkomen-veld.
   - Niet-meetellers expliciet benoemd: reiskostenvergoeding en
     onkostenvergoedingen tellen niet mee.
2. **Flexwerk/uitzend**: drie jaarvelden (laatste 3 kalenderjaren) →
   gemiddelde, gemaximeerd op het laatste jaar; regel over de
   Perspectiefverklaring als alternatief.
3. **Ondernemer/ZZP**: drie winst-uit-onderneming-velden → gemiddelde,
   gemaximeerd op het laatste jaar; uitleg IKV + dat banken eigen staffels
   hanteren voor korter dan 3 jaar.

Implementatie: pure rekenlaag in lib/normen/toetsinkomen-2026.ts (constanten
VAKANTIEGELD_PCT = 8, componentnamen, bronnen + peildatum in commentaar, elke
regel herleidbaar naar dit document) + UI-component in de rekenmodule-stijl,
gedeeld door /budget en /hypotheek-berekenen. Tests: componenten-som,
3-jaars-middeling met cap, vakantiegeld aan/uit, niet-negatief klemmen.

## Disclaimers (verplicht, AFM-conform)
- "Dit is een indicatie van je toetsinkomen, geen vaststelling: bij een echte
  aanvraag bepaalt de werkgeversverklaring (of de inkomensverklaring
  ondernemer) wat meetelt."
- "Geldverstrekkers hanteren eigen acceptatiebeleid; wat structureel of
  bestendig is beoordeelt de geldverstrekker."
- Geen advies-taal; bronnen + peildatum tonen (NHG V&N 2026, Regeling
  hypothecair krediet, geraadpleegd 2026-07-23).
