/**
 * ISDE 2026: subsidiebedragen per maatregel (RVO).
 *
 * Dit bestand is de bron voor de app; scripts/ingest-open/isde-rvo.py is het
 * meetinstrument dat de actuele bedragen van de RVO-site en de openbare
 * meldcodelijsten haalt (uitvoer: scripts/ingest-open/isde-raw.json). Wijzigt
 * RVO de bedragen, draai dat script en werk dit bestand bij.
 *
 * UI-regels (CONTRACTS): elk getoond bedrag met bron + peildatum; apparaat-
 * bedragen zijn INDICATIES (het echte bedrag hangt af van het gekozen
 * apparaat) en worden zo gelabeld.
 */

// ---------------------------------------------------------------------------
// Peildatum en bronnen
// ---------------------------------------------------------------------------

/** Datum waarop de bedragen van de RVO-bronnen zijn opgehaald (isde-rvo.py). */
export const ISDE_PEILDATUM = "2026-07-23";

export const ISDE_BRONNEN = {
  isolatie: "https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen", // pagina gecontroleerd 26 juni 2026
  warmtepompen: "https://www.rvo.nl/subsidies-financiering/isde/meldcodelijsten/warmtepompen", // pagina gecontroleerd 9 juli 2026
  zonneboilers: "https://www.rvo.nl/subsidies-financiering/isde/meldcodelijsten/zonneboilers",
  woningeigenaren: "https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren",
} as const;

// ---------------------------------------------------------------------------
// Isolatie: bedrag per m2 (regeling voor uitvoering in 2025 of later; dit is
// de regeling die in 2026 geldt). Bron: ISDE_BRONNEN.isolatie, 2026-07-23.
// Het bedrag per m2 VERDUBBELT bij 2 of meer maatregelen (isolatie
// gecombineerd met een andere isolatiemaatregel, warmtepomp, zonneboiler of
// warmtenet-aansluiting, binnen 24 maanden). De biobased-bonus verdubbelt niet.
// ---------------------------------------------------------------------------

export type IsolatieMaatregelKey =
  | "dakisolatie"
  | "zoldervloerisolatie"
  | "gevelisolatie"
  | "spouwmuurisolatie"
  | "vloerisolatie"
  | "bodemisolatie";

export type IsolatieSubsidie = {
  key: IsolatieMaatregelKey;
  label: string;
  /** Basisbedrag per m2 bij 1 maatregel; bij 2+ maatregelen geldt 2x dit bedrag. */
  eurPerM2: number;
  /** Minimaal te isoleren oppervlak om subsidie te krijgen. */
  minM2: number;
  /** Maximaal aantal m2 waarover subsidie wordt uitgekeerd. */
  maxM2: number;
  /** Extra bonus per m2 bij biobased isolatiemateriaal (verdubbelt niet). */
  biobasedBonusEurPerM2: number;
};

/** Bedragen per m2, uitvoering 2025 of later. Bron: RVO isolatiemaatregelen-pagina, peildatum 2026-07-23. */
export const ISDE_ISOLATIE: readonly IsolatieSubsidie[] = [
  { key: "dakisolatie", label: "Dakisolatie", eurPerM2: 16.25, minM2: 20, maxM2: 200, biobasedBonusEurPerM2: 5 },
  { key: "zoldervloerisolatie", label: "Zolder- of vlieringvloerisolatie", eurPerM2: 4, minM2: 20, maxM2: 200, biobasedBonusEurPerM2: 1.5 },
  { key: "gevelisolatie", label: "Gevelisolatie", eurPerM2: 20.25, minM2: 10, maxM2: 170, biobasedBonusEurPerM2: 6 },
  { key: "spouwmuurisolatie", label: "Spouwmuurisolatie", eurPerM2: 5.25, minM2: 10, maxM2: 170, biobasedBonusEurPerM2: 1.5 },
  { key: "vloerisolatie", label: "Vloerisolatie", eurPerM2: 5.5, minM2: 20, maxM2: 130, biobasedBonusEurPerM2: 2 },
  { key: "bodemisolatie", label: "Bodemisolatie", eurPerM2: 3, minM2: 20, maxM2: 130, biobasedBonusEurPerM2: 1 },
] as const;

/**
 * Glas, panelen en deuren (uitvoering vanaf 1-1-2025). Voor alle
 * glasmaatregelen samen: minimaal 3 m2, maximaal 45 m2.
 * Bron: RVO isolatiemaatregelen-pagina, peildatum 2026-07-23.
 */
export const ISDE_GLAS = {
  minM2Totaal: 3,
  maxM2Totaal: 45,
  tarieven: [
    { key: "hrpp_glas", label: "HR++ glas, tripleglas of vacuumglas (bestaande kozijnen)", eurPerM2: 25 },
    { key: "triple_nieuw_kozijn", label: "Tripleglas of vacuumglas in nieuwe kozijnen", eurPerM2: 111 },
    { key: "paneel", label: "Isolerend paneel in kozijnen (U tussen 0,7 en 1,2)", eurPerM2: 10 },
    { key: "paneel_nieuw_kozijn", label: "Isolerend paneel in nieuwe kozijnen (U maximaal 0,7)", eurPerM2: 45 },
    { key: "deur", label: "Isolerende deur (U tussen 1,0 en 1,5)", eurPerM2: 25 },
    { key: "deur_nieuw_kozijn", label: "Isolerende deur in nieuwe kozijnen (U maximaal 1,0)", eurPerM2: 111 },
  ],
} as const;

/**
 * Indicatieve subsidie voor een isolatiemaatregel: m2 begrensd op min/max,
 * bedrag per m2 verdubbeld bij 2 of meer maatregelen. Biobased-bonus bewust
 * niet meegerekend (die hangt af van het materiaal). Afgerond op hele euro's.
 * Geeft 0 als het oppervlak onder het minimum ligt.
 */
export function berekenIsolatieSubsidie(key: IsolatieMaatregelKey, m2: number, meerdereMaatregelen: boolean): number {
  const maatregel = ISDE_ISOLATIE.find((m) => m.key === key);
  if (!maatregel || m2 < maatregel.minM2) return 0;
  const subsidiabel = Math.min(m2, maatregel.maxM2);
  const tarief = meerdereMaatregelen ? maatregel.eurPerM2 * 2 : maatregel.eurPerM2;
  return Math.round(subsidiabel * tarief);
}

// ---------------------------------------------------------------------------
// Warmtepompen: indicatief, berekend uit de volledige openbare meldcodelijst
// (3.246 apparaten, opgehaald 2026-07-23 door isde-rvo.py). Het exacte bedrag
// staat per apparaat op de meldcodelijst; deze cijfers zijn er de statistiek
// van. RVO garandeert minimaal 500 euro voor een (hybride) warmtepomp.
// Let op: de meldcodelijst splitst hybride niet uit (hybride valt onder
// Lucht-Water); lucht-luchtwarmtepompen vallen niet meer onder de ISDE.
// TODO: aparte hybride-indicatie zodra RVO die uitsplitst.
// ---------------------------------------------------------------------------

export type ApparaatIndicatie = {
  categorie: string;
  label: string;
  /** Aantal apparaten in de meldcodelijst waarop deze indicatie is gebaseerd. */
  nApparaten: number;
  minEur: number;
  maxEur: number;
  /** Rekenkundig gemiddelde over alle apparaten in de categorie. */
  gemiddeldEur: number;
  /** Mediaan: representatiever dan het gemiddelde (dure uitschieters). */
  mediaanEur: number;
};

/** Bron: meldcodelijst warmtepompen (ISDE_BRONNEN.warmtepompen), peildatum 2026-07-23. */
export const ISDE_WARMTEPOMPEN: readonly ApparaatIndicatie[] = [
  { categorie: "Lucht-Water", label: "Lucht-waterwarmtepomp (ook hybride)", nApparaten: 2566, minEur: 1250, maxEur: 16325, gemiddeldEur: 3722, mediaanEur: 3250 },
  { categorie: "Grond-Water", label: "Grond-waterwarmtepomp (bodembron)", nApparaten: 227, minEur: 4200, maxEur: 13275, gemiddeldEur: 5351, mediaanEur: 4650 },
  { categorie: "Water-Water", label: "Water-waterwarmtepomp", nApparaten: 82, minEur: 4200, maxEur: 13125, gemiddeldEur: 6191, mediaanEur: 4425 },
  { categorie: "Warmtepompboiler", label: "Warmtepompboiler", nApparaten: 371, minEur: 500, maxEur: 950, gemiddeldEur: 737, mediaanEur: 725 },
] as const;

/** RVO: "U ontvangt altijd minimaal 500 euro subsidie voor een (hybride) warmtepomp." Peildatum 2026-07-23. */
export const ISDE_WARMTEPOMP_MINIMUM_EUR = 500;

// ---------------------------------------------------------------------------
// Zonneboilers: indicatief, berekend uit de volledige openbare meldcodelijst
// (525 apparaten, opgehaald 2026-07-23 door isde-rvo.py). Het bedrag hangt af
// van collectoroppervlak en voorraadvat.
// TODO: de RVO-woningeigenaren-pagina noemt "gemiddeld tussen 300 en 1.750
// euro" (gecontroleerd 3 juni 2026); de actuele meldcodelijst ligt daar deels
// boven. Wij tonen de lijst-statistiek (harder), met deze afwijking benoemd.
// ---------------------------------------------------------------------------

/** Bron: meldcodelijst zonneboilers (ISDE_BRONNEN.zonneboilers), peildatum 2026-07-23. */
export const ISDE_ZONNEBOILERS: readonly ApparaatIndicatie[] = [
  { categorie: "Tot en met 5m2", label: "Zonneboiler met collector tot en met 5 m2", nApparaten: 247, minEur: 591, maxEur: 3182, gemiddeldEur: 1701, mediaanEur: 1789 },
  { categorie: "5 tot en met 10m2", label: "Zonneboiler met collector van 5 tot en met 10 m2", nApparaten: 278, minEur: 1004, maxEur: 2177, gemiddeldEur: 1816, mediaanEur: 1846 },
] as const;

/**
 * Verdubbelingsregel (voor de UI-uitleg): het subsidiebedrag voor een
 * isolatiemaatregel verdubbelt bij 2 of meer maatregelen binnen 24 maanden;
 * dat geldt ook bij combinatie met een warmtepomp, zonneboiler of
 * warmtenet-aansluiting. Bron: ISDE_BRONNEN.isolatie, peildatum 2026-07-23.
 */
export const ISDE_VERDUBBELING_UITLEG =
  "Voert u 2 of meer maatregelen uit binnen 24 maanden? Dan verdubbelt het subsidiebedrag per m2 voor isolatie. Dat geldt ook als u isolatie combineert met een warmtepomp, zonneboiler of aansluiting op een warmtenet.";
