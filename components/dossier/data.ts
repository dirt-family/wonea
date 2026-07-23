/**
 * Pure datafuncties voor het woningdossier (Mijn woning). Geen database,
 * geen Next: alles hier is los testbaar (tests/dashboard-dossier.test.ts).
 * De database-kant (WOZ-upsert op eigen claim) staat in woz-data.ts.
 */

import { todayIso } from "@/lib/format";

// ---------------------------------------------------------------------------
// Overwaarde
// ---------------------------------------------------------------------------

export type OverwaardeIndicatie = {
  /** Modelwaarde min hypotheekrestant, hele euro's. Kan negatief zijn. */
  midden: number;
  /** Ondergrens: interval_laag min restant. */
  laag: number;
  /** Bovengrens: interval_hoog min restant. */
  hoog: number;
};

/**
 * Overwaarde-indicatie: geschatte woningwaarde min het hypotheekrestant,
 * met dezelfde bandbreedte als de waardeschatting zelf (de onzekerheid van
 * het model verdwijnt niet door er een restant vanaf te trekken). Geen
 * taxatie; de UI labelt dat expliciet. Zonder waardeschatting of zonder
 * restant is er geen eerlijke indicatie: dan null.
 */
export function berekenOverwaarde(
  valuation: { waarde: number; intervalLaag: number; intervalHoog: number } | null | undefined,
  restantEur: number | null | undefined,
): OverwaardeIndicatie | null {
  if (!valuation || restantEur == null || !Number.isFinite(restantEur) || restantEur < 0) return null;
  return {
    midden: valuation.waarde - restantEur,
    laag: valuation.intervalLaag - restantEur,
    hoog: valuation.intervalHoog - restantEur,
  };
}

// ---------------------------------------------------------------------------
// Oversluit-signaal
// ---------------------------------------------------------------------------

export type OversluitSignaal = {
  status: "verlopen" | "binnen_12_maanden";
  /** Hele maanden tot rentevast_tot; 0 bij verlopen of minder dan een maand. */
  maandenResterend: number;
};

/**
 * Signaleert of de rentevaste periode afloopt: binnen 12 maanden of al
 * verlopen. Geen datum of een datum verder weg dan 12 maanden geeft null
 * (geen signaal). Datums als ISO yyyy-mm-dd; ongeldige invoer geeft null.
 */
export function bepaalOversluitSignaal(
  rentevastTot: string | null | undefined,
  vandaagIso: string = todayIso(),
): OversluitSignaal | null {
  if (!rentevastTot || !/^\d{4}-\d{2}-\d{2}$/.test(rentevastTot)) return null;
  const einde = new Date(`${rentevastTot}T00:00:00Z`);
  const vandaag = new Date(`${vandaagIso}T00:00:00Z`);
  if (Number.isNaN(einde.getTime()) || Number.isNaN(vandaag.getTime())) return null;

  if (einde.getTime() <= vandaag.getTime()) return { status: "verlopen", maandenResterend: 0 };

  const maanden =
    (einde.getUTCFullYear() - vandaag.getUTCFullYear()) * 12 +
    (einde.getUTCMonth() - vandaag.getUTCMonth()) -
    (einde.getUTCDate() < vandaag.getUTCDate() ? 1 : 0);
  if (maanden >= 12) return null;
  return { status: "binnen_12_maanden", maandenResterend: Math.max(0, maanden) };
}

// ---------------------------------------------------------------------------
// Marktschatting per jaar (voor de WOZ-vergelijking)
// ---------------------------------------------------------------------------

export type JaarSchatting = {
  jaar: number;
  waarde: number;
  intervalLaag: number;
  intervalHoog: number;
  /** Datum van de gebruikte schatting binnen dat jaar (de laatste). */
  datum: string;
};

/**
 * Kiest per kalenderjaar de laatste waardeschatting uit de valuation-historie
 * (oplopend of willekeurig aangeleverd; er wordt op datum gesorteerd). Zo is
 * er per WOZ-peiljaar een eerlijk vergelijkbare marktschatting; jaren zonder
 * schatting ontbreken gewoon in het resultaat.
 */
export function marktschattingPerJaar(
  historie: { datum: string; waarde: number; intervalLaag: number; intervalHoog: number }[],
): JaarSchatting[] {
  const perJaar = new Map<number, JaarSchatting>();
  const gesorteerd = [...historie].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  for (const v of gesorteerd) {
    const jaar = Number(v.datum.slice(0, 4));
    if (!Number.isInteger(jaar)) continue;
    // Gesorteerd oplopend: elke latere datum binnen het jaar overschrijft, dus de laatste wint.
    perJaar.set(jaar, { jaar, waarde: v.waarde, intervalLaag: v.intervalLaag, intervalHoog: v.intervalHoog, datum: v.datum });
  }
  return [...perJaar.values()].sort((a, b) => a.jaar - b.jaar);
}

// ---------------------------------------------------------------------------
// WOZ-rijen per peiljaar (eigen invoer wint van voorbeelddata)
// ---------------------------------------------------------------------------

export type WozRij = {
  id: number;
  peiljaar: number;
  waarde: number;
  bron: "eigenaar" | "seed";
};

/**
 * Reduceert woz_values-rijen tot 1 rij per peiljaar: een eigenaar-invoer wint
 * altijd van een seed-rij; binnen dezelfde bron wint de nieuwste rij (hoogste
 * id). Resultaat oplopend op peiljaar, voor de dossiertabel.
 */
export function wozPerPeiljaar(rijen: WozRij[]): WozRij[] {
  const perJaar = new Map<number, WozRij>();
  for (const rij of rijen) {
    const bestaand = perJaar.get(rij.peiljaar);
    if (!bestaand) {
      perJaar.set(rij.peiljaar, rij);
      continue;
    }
    const bestaandWintOpBron = bestaand.bron === "eigenaar" && rij.bron === "seed";
    const rijWintOpBron = rij.bron === "eigenaar" && bestaand.bron === "seed";
    if (rijWintOpBron || (!bestaandWintOpBron && rij.id > bestaand.id)) {
      perJaar.set(rij.peiljaar, rij);
    }
  }
  return [...perJaar.values()].sort((a, b) => a.peiljaar - b.peiljaar);
}

/**
 * Verschil tussen WOZ en marktschatting in procenten van de marktschatting,
 * afgerond op 1 decimaal. Positief = WOZ hoger dan de schatting. Null bij een
 * marktschatting van 0 (geen deling door nul).
 */
export function wozVerschilPct(woz: number, marktschatting: number): number | null {
  if (!Number.isFinite(marktschatting) || marktschatting <= 0) return null;
  return Math.round(((woz - marktschatting) / marktschatting) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Invoergrenzen voor de eigen WOZ-invoer (gedeeld door action en woz-data.ts)
// ---------------------------------------------------------------------------

/** Vroegste peiljaar dat we accepteren; ver genoeg terug voor oude beschikkingen. */
export const WOZ_PEILJAAR_MIN = 2000;

/** Laatste peiljaar dat we accepteren: het lopende jaar (beschikkingen lopen niet vooruit). */
export function wozPeiljaarMax(vandaagIso: string = todayIso()): number {
  return Number(vandaagIso.slice(0, 4));
}

export const WOZ_WAARDE_MIN = 10_000;
export const WOZ_WAARDE_MAX = 10_000_000;

/** Valideert peiljaar en waarde voor eigen WOZ-invoer. Geeft de foutreden of null. */
export function valideerWozInvoer(
  peiljaar: number,
  waarde: number,
  vandaagIso: string = todayIso(),
): "peiljaar" | "waarde" | null {
  if (!Number.isInteger(peiljaar) || peiljaar < WOZ_PEILJAAR_MIN || peiljaar > wozPeiljaarMax(vandaagIso)) return "peiljaar";
  if (!Number.isInteger(waarde) || waarde < WOZ_WAARDE_MIN || waarde > WOZ_WAARDE_MAX) return "waarde";
  return null;
}
