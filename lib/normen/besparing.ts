/**
 * Besparingskentallen per verduurzamingsmaatregel (Milieu Centraal).
 *
 * Dit bestand is de bron voor de app; scripts/ingest-open/
 * milieucentraal-besparing.py is het meetinstrument dat de actuele kentallen
 * van milieucentraal.nl haalt (uitvoer: scripts/ingest-open/
 * besparing-raw.json). Wijzigen de kentallen, draai dat script en werk dit
 * bestand bij.
 *
 * EERLIJKHEID (CONTRACTS): dit zijn INDICATIES voor een gemiddelde woning bij
 * gemiddeld stookgedrag. De echte besparing hangt af van de woning, de huidige
 * isolatie, het gedrag en de actuele energieprijzen. Toon in de UI altijd
 * BESPARING_DISCLAIMER plus bron en peildatum bij elk bedrag.
 */

import type { Woningtype } from "@/db/schema";

/** Datum waarop de kentallen zijn opgehaald (milieucentraal-besparing.py). */
export const BESPARING_PEILDATUM = "2026-07-23";

/**
 * Milieu Centraal rekent besparingen om naar euro's met een langetermijn-
 * gasprijs: de verwachte gemiddelde prijs voor 2026-2040. De actuele prijs
 * (januari 2026: 1,35 euro per m3) kan afwijken; de besparing dan ook.
 */
export const BESPARING_GASPRIJS_EUR_PER_M3 = 1.37;

/** Verplichte duiding bij elk getoond besparingsbedrag. */
export const BESPARING_DISCLAIMER =
  "Indicatie voor een gemiddelde woning bij gemiddeld gebruik, gerekend met een gasprijs van 1,37 euro per m3 (verwachting 2026-2040, Milieu Centraal). De echte besparing hangt af van uw woning, de huidige isolatie en uw verbruik.";

/** Woningtypen waarvoor Milieu Centraal aparte kentallen geeft (geen appartement: daarvoor is geen kental; toon dan eerlijk geen cijfer of de bandbreedte). */
export type BesparingWoningtype = Exclude<Woningtype, "appartement">;

export type BesparingPerWoningtype = Record<BesparingWoningtype, { gasM3PerJaar: number; eurPerJaar: number }>;

export type BesparingKental = {
  key: string;
  label: string;
  /** Indicatieve jaarlijkse besparing voor een gemiddelde tussenwoning (of het genoemde basisgeval). */
  eurPerJaar: number;
  /** Bijbehorende gasbesparing; null als de besparing niet (alleen) uit gas komt. */
  gasM3PerJaar: number | null;
  /** Uitsplitsing per woningtype waar Milieu Centraal die geeft. */
  perWoningtype?: BesparingPerWoningtype;
  /** Wat het basisgeval is; toon dit bij het bedrag. */
  basisgeval: string;
  bronUrl: string;
  /** "Laatst gewijzigd"-datum van de bronpagina. */
  bronGewijzigd: string;
};

// ---------------------------------------------------------------------------
// Isolatie. Bron: milieucentraal.nl, pagina's "Laatst gewijzigd: 8 juli 2026",
// opgehaald 2026-07-23. Besparing gaat uit van een hr-combiketel en isoleren
// waar nog geen isolatie zit.
// ---------------------------------------------------------------------------

export const BESPARING_SPOUWMUUR: BesparingKental = {
  key: "spouwmuurisolatie",
  label: "Spouwmuurisolatie",
  eurPerJaar: 240, // tussenwoning; bron: milieucentraal.nl/energie-besparen/isoleren-en-besparen/spouwmuurisolatie/ (8 juli 2026)
  gasM3PerJaar: 180,
  perWoningtype: {
    tussenwoning: { gasM3PerJaar: 180, eurPerJaar: 240 },
    hoekwoning: { gasM3PerJaar: 400, eurPerJaar: 575 },
    "twee-onder-een-kap": { gasM3PerJaar: 400, eurPerJaar: 575 },
    vrijstaand: { gasM3PerJaar: 600, eurPerJaar: 800 },
  },
  basisgeval: "gemiddelde tussenwoning met ongeïsoleerde spouwmuur",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/isoleren-en-besparen/spouwmuurisolatie/",
  bronGewijzigd: "2026-07-08",
};

export const BESPARING_DAK: BesparingKental = {
  key: "dakisolatie",
  label: "Dakisolatie (schuin dak)",
  eurPerJaar: 460, // tussenwoning; bron: milieucentraal.nl/energie-besparen/isoleren-en-besparen/dakisolatie/ (8 juli 2026)
  gasM3PerJaar: 320,
  perWoningtype: {
    tussenwoning: { gasM3PerJaar: 320, eurPerJaar: 460 },
    hoekwoning: { gasM3PerJaar: 340, eurPerJaar: 480 },
    "twee-onder-een-kap": { gasM3PerJaar: 360, eurPerJaar: 510 },
    vrijstaand: { gasM3PerJaar: 550, eurPerJaar: 750 },
  },
  basisgeval: "gemiddelde tussenwoning met ongeïsoleerd schuin dak",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/isoleren-en-besparen/dakisolatie/",
  bronGewijzigd: "2026-07-08",
};

export const BESPARING_VLOER: BesparingKental = {
  key: "vloerisolatie",
  label: "Vloerisolatie",
  eurPerJaar: 110, // tussenwoning; bron: milieucentraal.nl/energie-besparen/isoleren-en-besparen/vloerisolatie/ (8 juli 2026)
  gasM3PerJaar: 80,
  perWoningtype: {
    tussenwoning: { gasM3PerJaar: 80, eurPerJaar: 110 },
    hoekwoning: { gasM3PerJaar: 130, eurPerJaar: 180 },
    "twee-onder-een-kap": { gasM3PerJaar: 170, eurPerJaar: 230 },
    vrijstaand: { gasM3PerJaar: 250, eurPerJaar: 340 },
  },
  basisgeval: "gemiddelde tussenwoning met ongeïsoleerde vloer",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/isoleren-en-besparen/vloerisolatie/",
  bronGewijzigd: "2026-07-08",
};

/**
 * Glasisolatie: heel huis van enkelglas naar hr++-glas in bestaande kozijnen.
 * Andere varianten (dubbel naar hr++: 90 euro; dubbel naar triple: 145 euro;
 * enkel naar triple: 390 euro per jaar voor een tussenwoning) staan in
 * besparing-raw.json. Kental per m2 raam ten opzichte van enkelglas:
 * hr++ 12 m3, triple/vacuum 14 m3, dubbel 9 m3 gas per jaar.
 */
export const BESPARING_GLAS: BesparingKental = {
  key: "glasisolatie",
  label: "HR++ glas (in plaats van enkelglas)",
  eurPerJaar: 350, // tussenwoning; bron: milieucentraal.nl/.../dubbel-glas-hr-glas-en-triple-glas/ (8 juli 2026)
  gasM3PerJaar: 250,
  perWoningtype: {
    tussenwoning: { gasM3PerJaar: 250, eurPerJaar: 350 },
    hoekwoning: { gasM3PerJaar: 260, eurPerJaar: 350 },
    "twee-onder-een-kap": { gasM3PerJaar: 290, eurPerJaar: 400 },
    vrijstaand: { gasM3PerJaar: 370, eurPerJaar: 500 },
  },
  basisgeval: "al het enkelglas in huis vervangen door hr++-glas",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/isoleren-en-besparen/dubbel-glas-hr-glas-en-triple-glas/",
  bronGewijzigd: "2026-07-08",
};

// ---------------------------------------------------------------------------
// Verwarming en warm water.
// ---------------------------------------------------------------------------

/**
 * Hybride warmtepomp (4 kW naast de hr-ketel): van 1.360 m3 gas + 310 kWh
 * naar 680 m3 gas + 1.925 kWh; 1.950 naar 1.350 euro per jaar.
 */
export const BESPARING_HYBRIDE_WARMTEPOMP: BesparingKental = {
  key: "hybride_warmtepomp",
  label: "Hybride warmtepomp",
  eurPerJaar: 600, // bron: milieucentraal.nl/.../hybride-warmtepomp/ (2 juli 2026)
  gasM3PerJaar: 680, // gasbesparing; het stroomverbruik stijgt (verrekend in het eurobedrag)
  basisgeval: "gemiddelde woning met hr-ketel, hybride warmtepomp van 4 kW erbij",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/duurzaam-verwarmen-en-koelen/hybride-warmtepomp/",
  bronGewijzigd: "2026-07-02",
};

/**
 * Volledig elektrische (all-electric) warmtepomp (8 kW, buitenunit): van
 * 950 m3 gas + 250 kWh naar 3.400 kWh, inclusief het vervallen vastrecht van
 * de gasaansluiting (360 euro per jaar).
 */
export const BESPARING_VOLLEDIGE_WARMTEPOMP: BesparingKental = {
  key: "volledige_warmtepomp",
  label: "Volledig elektrische warmtepomp",
  eurPerJaar: 1000, // bron: milieucentraal.nl/.../volledig-elektrische-warmtepomp/ (22 juli 2026)
  gasM3PerJaar: 950, // het volledige gasverbruik vervalt; stroomverbruik stijgt (verrekend)
  basisgeval: "gemiddelde woning die van hr-ketel overstapt, inclusief vervallen vastrecht gas",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/duurzaam-verwarmen-en-koelen/volledig-elektrische-warmtepomp/",
  bronGewijzigd: "2026-07-22",
};

/** Zonneboiler: 3 personen 150 m3 (180 euro), 5 personen 240 m3 (310 euro) per jaar. */
export const BESPARING_ZONNEBOILER: BesparingKental = {
  key: "zonneboiler",
  label: "Zonneboiler",
  eurPerJaar: 180, // huishouden van 3; bron: milieucentraal.nl/.../zonneboiler/ (30 juni 2026)
  gasM3PerJaar: 150,
  basisgeval: "huishouden van 3 personen; bij 5 personen ongeveer 310 euro per jaar",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/duurzaam-warm-water/zonneboiler/",
  bronGewijzigd: "2026-06-30",
};

/**
 * Zonnepanelen (8 panelen, circa 3.000 kWh per jaar, aanschaf circa 3.200
 * euro). LET OP: de salderingsregeling stopt per 2027; de jaarlijkse
 * besparing daalt dan fors. Toon beide bedragen, nooit alleen het hoge.
 * Bron: milieucentraal.nl/.../kosten-en-opbrengst-zonnepanelen/ (29 juni 2026).
 */
export const BESPARING_ZONNEPANELEN = {
  key: "zonnepanelen",
  label: "Zonnepanelen (8 panelen)",
  eurPerJaar2026: 540,
  eurPerJaarVanaf2027: 170,
  opgewekteStroomKwhPerJaar: 3000,
  aanschafEur: 3200,
  basisgeval: "8 panelen op een gemiddeld dak; besparing daalt vanaf 2027 doordat salderen stopt",
  bronUrl: "https://www.milieucentraal.nl/energie-besparen/zonnepanelen/kosten-en-opbrengst-zonnepanelen/",
  bronGewijzigd: "2026-06-29",
} as const;

/** Alle gas-gedreven kentallen bij elkaar, voor lijstweergaves in de verduurzaam-tool. */
export const BESPARING_KENTALLEN: readonly BesparingKental[] = [
  BESPARING_SPOUWMUUR,
  BESPARING_DAK,
  BESPARING_VLOER,
  BESPARING_GLAS,
  BESPARING_HYBRIDE_WARMTEPOMP,
  BESPARING_VOLLEDIGE_WARMTEPOMP,
  BESPARING_ZONNEBOILER,
] as const;
