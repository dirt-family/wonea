/**
 * Rekenkern voor de budget- en rentetools: pure functies, geen database,
 * geen UI. Bouwt op lib/normen/leennormen-2026.ts (financieringslast-
 * percentages, energielabelbedragen, NHG-grenzen, AFM-toetsrente).
 *
 * BRONNEN (peildata):
 * - Tijdelijke regeling hypothecair krediet, geconsolideerd geldend vanaf
 *   01-01-2026 (wetten.overheid.nl/BWBR0032503/2026-01-01), artikelen 3 en 4;
 *   nagelezen 2026-07-23.
 * - Wijzigingsregeling hypothecair krediet 2026 (Staatscourant 2025, 36471),
 *   bijlage 1: de percentagetabellen in lib/normen/leennormen-2026.ts.
 * - NHG-kostengrens 2026: nhg.nl, zie docs/DATABRONNEN.md (2026-07-23).
 *
 * REKENREGELS UIT DE BRON (waarom de berekening zo loopt):
 * - Art. 3, tweede en vierde lid: de financieringslast is het bruto jaarbedrag
 *   aan rente en aflossing van een 30-jarige annuiteit, maandelijks achteraf
 *   betaald. Daarom rekenen we hier met maandtermijnen over 360 maanden.
 * - Art. 3, vijfde lid: toegestane financieringslast = toetsinkomen maal het
 *   financieringslastpercentage uit bijlage 1.
 * - Art. 3, zesde lid (partnerinkomen 2026, nagelezen in de geconsolideerde
 *   tekst op 2026-07-23): "Indien een hypothecair krediet bedoeld is voor
 *   meerdere consumenten, wordt het financieringslastpercentage gehanteerd dat
 *   behoort bij het gezamenlijke toetsinkomen." Het tweede inkomen telt in
 *   2026 dus VOLLEDIG mee (de oudere regel waarbij het lagere inkomen maar
 *   voor een deel meetelde bestaat niet meer in deze tekst); toetsinkomen =
 *   inkomen1 + inkomen2.
 * - Art. 3, negende lid onderdeel c en tiende lid: bij een rentevastperiode
 *   korter dan tien jaar toetst de aanbieder op de door de AFM gepubliceerde
 *   gemiddelde debetrentevoet (minimaal vijf procent), of de geoffreerde rente
 *   als die hoger is. Bij tien jaar of langer geldt de geoffreerde rente.
 * - Art. 4, derde lid: per energielabel mag een vast bedrag buiten beschouwing
 *   blijven bij het vaststellen van de financieringslast; dat bedrag komt
 *   bovenop het uit het inkomen berekende maximum.
 * - Art. 4, vierde lid: bij een krediet voor energiebesparende voorzieningen
 *   mag daarbovenop een extra bedrag per label buiten beschouwing blijven.
 *
 * BEWUSTE VEREENVOUDIGINGEN (documenteer in de methode-uitleg van de tool):
 * - We gebruiken tabel 1 en 2 (fiscaal aftrekbare rente, de normale situatie
 *   bij een nieuwe annuiteitenhypotheek). Tabel 3 en 4 (niet-aftrekbare
 *   kredietdelen) vallen buiten deze eenvoudige budgettool.
 * - Bestaande maandelijkse verplichtingen gaan van de maandelijkse leenruimte
 *   af (de regeling verlaagt de toegestane financieringslast met bestaande
 *   financiele verplichtingen; wij rekenen dat per maand).
 * - De uitkomst is een indicatie op basis van de wettelijke normen, geen
 *   offerte: aanbieders hanteren eigen acceptatiebeleid.
 */

import {
  AFM_TOETSRENTE_KORTER_DAN_10JR,
  ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING,
  NHG_GRENS_2026,
  NHG_GRENS_EBV_2026,
  VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING,
  vindFinancieringslastPct,
} from "@/lib/normen/leennormen-2026";

/** Looptijd waarop de regeling de financieringslast berekent (art. 3 lid 2). */
export const TOETS_LOOPTIJD_MAANDEN = 360;

/** Energielabelklasse zoals de regeling die groepeert (art. 4, derde lid). */
export type EnergielabelKlasse = keyof typeof ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING;

/**
 * Art. 4, vierde lid groepeert A+++ en beter samen (alle drie 0 euro extra);
 * deze mapping vertaalt de labelklasse van lid 3 naar de rij van lid 4.
 */
const VERDUURZAMING_KLASSE: Record<EnergielabelKlasse, keyof typeof VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING> = {
  EFG: "EFG",
  CD: "CD",
  AB: "AB",
  APlus_APlusPlus: "APlus_APlusPlus",
  A3Plus: "A3PlusEnBeter",
  A4Plus: "A3PlusEnBeter",
  A4PlusGarantie: "A3PlusEnBeter",
};

export interface MaximaleHypotheekInput {
  /** Bruto toetsinkomen aanvrager 1, hele euro's per jaar. */
  inkomen1: number;
  /** Bruto toetsinkomen aanvrager 2; telt in 2026 volledig mee (art. 3 lid 6). */
  inkomen2?: number;
  /** Geoffreerde of verwachte hypotheekrente in procenten, bv. 3.8. */
  toetsrentePct: number;
  /** Rentevastperiode in jaren; korter dan 10 activeert de AFM-toetsrente. */
  rentevastJaren: number;
  /** Energielabelklasse van de woning; onbekend = geen labelbedrag erbij. */
  energielabelKlasse?: EnergielabelKlasse;
  /** True als het krediet mede voor energiebesparende voorzieningen is (art. 4 lid 4). */
  verduurzamingsBudget?: boolean;
  /** True als de consument de AOW-leeftijd heeft bereikt (tabel 2 in plaats van tabel 1). */
  aowLeeftijdBereikt?: boolean;
  /** Bestaande maandelijkse verplichtingen (alimentatie, leningen), hele euro's. */
  verplichtingenPerMaand?: number;
}

export interface MaximaleHypotheekUitkomst {
  /** Maximale hypotheek in hele euro's (naar beneden afgerond), inclusief labelExtra. */
  maximaal: number;
  /**
   * Bruto maandlast bij de gebruikte toetsrente over het volledige maximum,
   * 30 jaar annuitair, hele euro's. De werkelijke maandlast bij de geoffreerde
   * rente kan lager uitvallen als de AFM-toetsrente is toegepast; gebruik
   * maandlastenOverzicht voor maandlasten bij concrete rentes.
   */
  maandlast: number;
  /** Gebruikt financieringslastpercentage uit bijlage 1, procentpunten. */
  gebruiktPct: number;
  /** Gebruikte toetsrente in procenten (geoffreerd, of de AFM-ondergrens bij rentevast < 10 jaar). */
  toetsrente: number;
  /** Bedrag dat op grond van art. 4 (lid 3 en eventueel lid 4) bovenop het inkomensdeel komt. */
  labelExtra: number;
  /**
   * Indicatie of NHG binnen bereik ligt: het berekende maximum past binnen de
   * NHG-kostengrens 2026 (met energiebesparende voorzieningen geldt de hogere
   * EBV-grens). NHG toetst formeel op de koopsom of marktwaarde van de woning;
   * die kent deze tool niet, dus dit is een indicatie op het geleende bedrag.
   */
  nhgMogelijk: boolean;
}

function checkGetal(naam: string, waarde: number, min: number): void {
  if (!Number.isFinite(waarde) || waarde < min) {
    throw new Error(`hypotheek: ${naam} moet een getal >= ${min} zijn, kreeg ${waarde}`);
  }
}

/**
 * Bruto maandlast van een annuiteitenhypotheek: het vaste maandbedrag (rente
 * plus aflossing samen) dat de hoofdsom in looptijdMaanden precies aflost.
 *
 * Standaardformule met i = maandrente (jaarrentePct / 100 / 12) en
 * n = looptijdMaanden:
 *
 *   maandlast = hoofdsom * i / (1 - (1 + i)^-n)
 *
 * Bij rente 0 vervalt de formule (deling door nul) en resteert lineair
 * aflossen: hoofdsom / n. Geeft het onafgeronde bedrag terug; afronden op
 * hele euro's gebeurt bij de presentatie (formatEuro-conventie).
 */
export function annuiteitMaandlast(hoofdsom: number, jaarrentePct: number, looptijdMaanden: number): number {
  checkGetal("hoofdsom", hoofdsom, 0);
  checkGetal("jaarrentePct", jaarrentePct, 0);
  checkGetal("looptijdMaanden", looptijdMaanden, 1);
  const i = jaarrentePct / 100 / 12;
  if (i === 0) return hoofdsom / looptijdMaanden;
  return (hoofdsom * i) / (1 - Math.pow(1 + i, -looptijdMaanden));
}

/**
 * Hoofdsom die bij een gegeven maandlast hoort: de inverse van
 * annuiteitMaandlast. Intern gebruikt om de maandelijkse leenruimte terug te
 * rekenen naar de maximale hypotheek.
 */
function hoofdsomBijMaandlast(maandlast: number, jaarrentePct: number, looptijdMaanden: number): number {
  const i = jaarrentePct / 100 / 12;
  if (i === 0) return maandlast * looptijdMaanden;
  return (maandlast * (1 - Math.pow(1 + i, -looptijdMaanden))) / i;
}

/**
 * Maximale hypotheek volgens de leennormen 2026. Stappen:
 * 1. toetsinkomen = inkomen1 + inkomen2 (volledig, art. 3 lid 6);
 * 2. toetsrente = geoffreerde rente, maar bij rentevast < 10 jaar minimaal de
 *    AFM-toetsrente van 5,0% (art. 3 lid 9c en lid 10);
 * 3. financieringslastpercentage opzoeken in tabel 1 (of tabel 2 vanaf de
 *    AOW-leeftijd) van bijlage 1;
 * 4. maandelijkse ruimte = toetsinkomen / 12 * pct - verplichtingenPerMaand;
 * 5. hoofdsom = ruimte teruggerekend via de annuiteitenformule (30 jaar);
 * 6. energielabelbedrag (art. 4 lid 3, plus lid 4 bij verduurzamingsBudget)
 *    komt daar bovenop.
 *
 * Geen ruimte (verplichtingen >= ruimte) betekent maximaal 0; we tellen dan
 * ook geen labelbedrag op, want zonder reguliere leenruimte is een krediet
 * alleen voor het labelbedrag geen eerlijke indicatie.
 * Zonder opgegeven energielabel rekenen we geen labelbedrag mee (ook niet bij
 * verduurzamingsBudget: het bedrag van art. 4 lid 4 hangt van het label af).
 */
export function maximaleHypotheek(input: MaximaleHypotheekInput): MaximaleHypotheekUitkomst {
  checkGetal("inkomen1", input.inkomen1, 0);
  if (input.inkomen2 !== undefined) checkGetal("inkomen2", input.inkomen2, 0);
  checkGetal("toetsrentePct", input.toetsrentePct, 0);
  checkGetal("rentevastJaren", input.rentevastJaren, 1);
  if (input.verplichtingenPerMaand !== undefined) checkGetal("verplichtingenPerMaand", input.verplichtingenPerMaand, 0);

  const toetsinkomen = input.inkomen1 + (input.inkomen2 ?? 0);

  const toetsrente =
    input.rentevastJaren < 10 ? Math.max(input.toetsrentePct, AFM_TOETSRENTE_KORTER_DAN_10JR) : input.toetsrentePct;

  const tabel = input.aowLeeftijdBereikt ? "vanafAow" : "totAow";
  const gebruiktPct = vindFinancieringslastPct(tabel, toetsinkomen, toetsrente);

  const ruimtePerMaand = (toetsinkomen / 12) * (gebruiktPct / 100) - (input.verplichtingenPerMaand ?? 0);

  if (ruimtePerMaand <= 0) {
    return { maximaal: 0, maandlast: 0, gebruiktPct, toetsrente, labelExtra: 0, nhgMogelijk: true };
  }

  const hoofdsom = Math.floor(hoofdsomBijMaandlast(ruimtePerMaand, toetsrente, TOETS_LOOPTIJD_MAANDEN));

  let labelExtra = 0;
  if (input.energielabelKlasse) {
    labelExtra += ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING[input.energielabelKlasse];
    if (input.verduurzamingsBudget) {
      labelExtra += VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING[VERDUURZAMING_KLASSE[input.energielabelKlasse]];
    }
  }

  const maximaal = hoofdsom + labelExtra;
  const maandlast = Math.round(annuiteitMaandlast(maximaal, toetsrente, TOETS_LOOPTIJD_MAANDEN));
  const nhgGrens = input.verduurzamingsBudget ? NHG_GRENS_EBV_2026 : NHG_GRENS_2026;

  return { maximaal, maandlast, gebruiktPct, toetsrente, labelExtra, nhgMogelijk: maximaal <= nhgGrens };
}

export interface RenteOptie {
  /** Label voor de UI, bv. "10 jaar rentevast (NHG)". */
  label: string;
  /** Jaarrente in procenten, bv. 3.79. */
  pct: number;
}

export interface MaandlastRegel extends RenteOptie {
  /** Bruto maandlast in hele euro's, 30 jaar annuitair. */
  maandlast: number;
}

/**
 * Bruto maandlast per rentestand voor een gegeven hoofdsom (de rentetool).
 * Rekent standaard met 30 jaar annuitair (zelfde uitgangspunt als de toets);
 * geef looptijdMaanden mee voor een afwijkende looptijd. Maandlasten afgerond
 * op hele euro's (formatEuro-conventie); bron en peildatum van de rentes
 * levert de aanroeper (lib/bronnen/rentes.ts) aan de UI.
 */
export function maandlastenOverzicht(
  hoofdsom: number,
  rentes: RenteOptie[],
  looptijdMaanden: number = TOETS_LOOPTIJD_MAANDEN,
): MaandlastRegel[] {
  return rentes.map((r) => ({
    label: r.label,
    pct: r.pct,
    maandlast: Math.round(annuiteitMaandlast(hoofdsom, r.pct, looptijdMaanden)),
  }));
}
