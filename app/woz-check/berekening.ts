import type { Confidence } from "@/db/schema";

/**
 * WOZ-check: pure vergelijk- en parseerlaag, geen React en geen database.
 * De vergelijkregels komen 1-op-1 uit de eerdere WozVergelijker (client) en
 * mogen hier niet stilletjes veranderen; tests/woz-check.test.ts bewaakt dat.
 * De marktschatting zelf komt uit lib/avm.ts via lib/valuation.ts (server);
 * deze laag vergelijkt alleen en rekent het OZB-voorbeeld door.
 */

/** Ondergrens voor een serieuze WOZ-invoer (zelfde grens als de oude check). */
export const MIN_WOZ = 10_000;

/** Vroegste peiljaar dat we accepteren; de WOZ bestaat sinds de Wet WOZ 1994. */
export const PEILJAAR_MIN = 2000;

/**
 * Voorbeeldtarief OZB in procenten voor het rekenvoorbeeld. Bewust een
 * voorbeeld: het echte tarief verschilt per gemeente en staat op de aanslag.
 */
export const OZB_VOORBEELD_TARIEF_PCT = 0.1;

export type WozCategorie = "boven" | "onder" | "binnen";

export type WozVergelijk = {
  categorie: WozCategorie;
  /** WOZ minus marktschatting, in euro's (negatief = WOZ lager). */
  verschil: number;
  /** Verschil als afgerond percentage van de marktschatting (kan negatief zijn). */
  verschilPct: number;
};

/**
 * Vergelijkt een WOZ-waarde met de marktschatting en diens bandbreedte.
 * Alleen buiten de hele bandbreedte spreken we van een duidelijke afwijking;
 * binnen de bandbreedte is het verschil kleiner dan de onzekerheid van elke
 * schatting, en zeggen we eerlijk dat bezwaar dan weinig oplevert.
 */
export function vergelijkWoz(woz: number, marktwaarde: number, intervalLaag: number, intervalHoog: number): WozVergelijk {
  const verschil = woz - marktwaarde;
  const verschilPct = Math.round((verschil / marktwaarde) * 100);
  const categorie: WozCategorie = woz > intervalHoog ? "boven" : woz < intervalLaag ? "onder" : "binnen";
  return { categorie, verschil, verschilPct };
}

/**
 * OZB-rekenvoorbeeld: wat een correctie van `bedrag` euro per jaar scheelt bij
 * het voorbeeldtarief. Zelfde som als de oude check (0,1% van het verschil).
 */
export function ozbVoorbeeldPerJaar(bedrag: number): number {
  return Math.round((bedrag * OZB_VOORBEELD_TARIEF_PCT) / 100);
}

/** Leest een euro-invoer ("425.000" of "425000"); null onder de ondergrens. */
export function parseWozBedrag(s: string): number | null {
  const cijfers = s.replace(/[^\d]/g, "");
  if (!cijfers) return null;
  const n = Number(cijfers);
  return Number.isFinite(n) && n > MIN_WOZ ? n : null;
}

/** Leest het peiljaar van de beschikking; alleen een geldig jaartal telt. */
export function parsePeiljaar(s: string, huidigJaar: number): number | null {
  const t = s.trim();
  if (!/^\d{4}$/.test(t)) return null;
  const jaar = Number(t);
  return jaar >= PEILJAAR_MIN && jaar <= huidigJaar ? jaar : null;
}

/* -------------------------------------------------------------------------
 * Adresresultaat: het serialiseerbare antwoord van de adres-zoekstap.
 * Gemaakt op de server (zoek.ts), gebruikt door de client-stepper en, via
 * sessionStorage-herstel, ook gelezen uit onbetrouwbare data. Daarom staat
 * de strenge lees-functie hier, puur en testbaar.
 * ---------------------------------------------------------------------- */

export type WozAdresResultaat = {
  /** Leesbare adresregel: "Straat 12, 1234 AB Plaats". */
  naam: string;
  postcode: string;
  nummerslug: string;
  /** Marktschatting van vandaag; null als er geen eerlijke schatting kan. */
  schatting: {
    waarde: number;
    laag: number;
    hoog: number;
    confidence: Confidence;
    nComparables: number;
    /** ISO-datum waarop de schatting is berekend. */
    datum: string;
  } | null;
  /** Laatst bekende WOZ op Wonea, alleen ter context; seed = voorbeeldwaarde. */
  bekendeWoz: { waarde: number; peiljaar: number; bron: "eigenaar" | "seed" } | null;
};

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function eindigGetal(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/**
 * Leest een WozAdresResultaat uit onbetrouwbare data (sessionStorage of een
 * API-antwoord). Elk veld wordt op type gecontroleerd en het object wordt
 * opnieuw opgebouwd, zodat er nooit vreemde velden meeliften. Ongeldig = null.
 */
export function leesAdresResultaat(data: unknown): WozAdresResultaat | null {
  if (!isObject(data)) return null;
  const { naam, postcode, nummerslug, schatting, bekendeWoz } = data;
  if (typeof naam !== "string" || !naam.trim()) return null;
  if (typeof postcode !== "string" || !postcode.trim()) return null;
  if (typeof nummerslug !== "string" || !nummerslug.trim()) return null;

  let schattingUit: WozAdresResultaat["schatting"] = null;
  if (schatting !== null && schatting !== undefined) {
    if (!isObject(schatting)) return null;
    const { waarde, laag, hoog, confidence, nComparables, datum } = schatting;
    if (!eindigGetal(waarde) || !eindigGetal(laag) || !eindigGetal(hoog)) return null;
    if (confidence !== "hoog" && confidence !== "middel" && confidence !== "laag") return null;
    if (!eindigGetal(nComparables) || typeof datum !== "string") return null;
    schattingUit = { waarde, laag, hoog, confidence, nComparables, datum };
  }

  let wozUit: WozAdresResultaat["bekendeWoz"] = null;
  if (bekendeWoz !== null && bekendeWoz !== undefined) {
    if (!isObject(bekendeWoz)) return null;
    const { waarde, peiljaar, bron } = bekendeWoz;
    if (!eindigGetal(waarde) || !eindigGetal(peiljaar)) return null;
    if (bron !== "eigenaar" && bron !== "seed") return null;
    wozUit = { waarde, peiljaar, bron };
  }

  return { naam, postcode, nummerslug, schatting: schattingUit, bekendeWoz: wozUit };
}
