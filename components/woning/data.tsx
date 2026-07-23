import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { normalizePostcode } from "@/lib/util";

/**
 * Data- en rekenlaag van de woningpagina (v2, module-opbouw uit
 * docs/PROTOTYPE-OOGST.md). Pure functies staan bewust los van de UI zodat
 * tests/woning-v2.test.ts ze direct kan toetsen. Alles wat data mist geeft
 * null terug: de pagina laat die module dan eerlijk weg (nooit verzinnen).
 */

// ---------------------------------------------------------------------------
// Adres opzoeken (suppressie is leidend: opted-out of gesupprimeerd = null)
// ---------------------------------------------------------------------------

export type WoningParams = { postcode: string; nummerslug: string };

export async function vindWoningAdres(params: WoningParams) {
  const postcode = normalizePostcode(params.postcode);
  if (!postcode) return null;
  const nummerslug = params.nummerslug.toLowerCase();
  const adres = (
    await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
      .limit(1)
  )[0];
  if (!adres) return null;
  if (adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug))) return null;
  return adres;
}

// ---------------------------------------------------------------------------
// Percentages en richtingen
// ---------------------------------------------------------------------------

/** Onder een half procent noemen we een ontwikkeling vlak. */
export function deltaRichting(pct: number): "op" | "neer" | "vlak" {
  if (pct >= 0.5) return "op";
  if (pct <= -0.5) return "neer";
  return "vlak";
}

/** "+4,2%" in NL-notatie; 0 zonder plusteken. */
export function formatPct(pct: number): string {
  const getal = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(pct);
  return `${getal}%`;
}

// ---------------------------------------------------------------------------
// Jaarontwikkeling uit de valuation-historie
// ---------------------------------------------------------------------------

export type HistoriePunt = { datum: string; waarde: number };

/** Maximale afstand (in dagen) tot "een jaar geleden" waarbij we een meetpunt nog als jaarreferentie accepteren. */
export const JAARDELTA_TOLERANTIE_DAGEN = 62;

/**
 * Jaarontwikkeling in procenten: de huidige waarde vergeleken met het
 * historiepunt dat het dichtst bij twaalf maanden geleden ligt. Is er geen
 * meetpunt binnen ongeveer twee maanden rond die datum, dan geven we null
 * terug en toont de pagina geen pil: liever geen cijfer dan een gerekt cijfer.
 */
export function jaarDelta(historie: HistoriePunt[], huidigeWaarde: number, vandaag: Date = new Date()): number | null {
  if (!Number.isFinite(huidigeWaarde) || huidigeWaarde <= 0) return null;
  const doel = new Date(vandaag);
  doel.setMonth(doel.getMonth() - 12);
  const doelMs = doel.getTime();
  const tolerantieMs = JAARDELTA_TOLERANTIE_DAGEN * 24 * 60 * 60 * 1000;

  let beste: HistoriePunt | null = null;
  let besteAfstand = Number.POSITIVE_INFINITY;
  for (const punt of historie) {
    const tijd = new Date(punt.datum).getTime();
    if (!Number.isFinite(tijd)) continue;
    const afstand = Math.abs(tijd - doelMs);
    if (afstand < besteAfstand) {
      beste = punt;
      besteAfstand = afstand;
    }
  }
  if (!beste || besteAfstand > tolerantieMs || beste.waarde <= 0) return null;
  return ((huidigeWaarde - beste.waarde) / beste.waarde) * 100;
}

/**
 * Zet de valuation-historie om naar maandpunten voor de staafjes: per maand
 * het laatste meetpunt, maximaal maxMaanden maanden (nieuwste rechts).
 */
export type MaandPunt = { maand: string; waarde: number };

export function maandPunten(historie: HistoriePunt[], maxMaanden = 12): MaandPunt[] {
  const perMaand = new Map<string, number>();
  for (const punt of [...historie].sort((a, b) => a.datum.localeCompare(b.datum))) {
    perMaand.set(punt.datum.slice(0, 7), punt.waarde);
  }
  return [...perMaand.entries()].map(([maand, waarde]) => ({ maand, waarde })).slice(-maxMaanden);
}

// ---------------------------------------------------------------------------
// WOZ door de jaren
// ---------------------------------------------------------------------------

export type WozRij = { peiljaar: number; waarde: number; bron: "eigenaar" | "seed" };
export type WozReeksRij = WozRij & { deltaPct: number | null };

/** Sorteert op peiljaar (oplopend) en rekent per jaar de verandering t.o.v. het vorige peiljaar. */
export function wozReeks(rijen: WozRij[]): WozReeksRij[] {
  const gesorteerd = [...rijen].sort((a, b) => a.peiljaar - b.peiljaar);
  return gesorteerd.map((rij, i) => {
    const vorige = gesorteerd[i - 1];
    const deltaPct = vorige && vorige.waarde > 0 ? ((rij.waarde - vorige.waarde) / vorige.waarde) * 100 : null;
    return { ...rij, deltaPct };
  });
}

// ---------------------------------------------------------------------------
// WOZ vergeleken met het buurtgemiddelde (de WOZ-check-module)
// ---------------------------------------------------------------------------

/** Pas boven deze afwijking (in procenten) noemen we een WOZ duidelijk hoger of lager dan de buurt. */
export const WOZ_AFWIJKING_DREMPEL_PCT = 10;

export type WozBuurtVergelijk = {
  /** per_m2 = eerlijkste vergelijking (WOZ per m2 tegen het buurtanker); absoluut = terugvaloptie op gemWoz. */
  basis: "per_m2" | "absoluut";
  verschilPct: number;
  richting: "hoger" | "lager" | "in_lijn";
  eigenPerM2: number | null;
  buurtPerM2: number | null;
};

function richtingBijDrempel(pct: number): WozBuurtVergelijk["richting"] {
  if (pct > WOZ_AFWIJKING_DREMPEL_PCT) return "hoger";
  if (pct < -WOZ_AFWIJKING_DREMPEL_PCT) return "lager";
  return "in_lijn";
}

/**
 * Vergelijkt de WOZ van dit adres met het buurtgemiddelde. Voorkeur: per m2
 * (WOZ / oppervlakte tegen ankerM2Prijs, dat is gemWoz / gemiddelde
 * oppervlakte van de buurt), omdat een absolute vergelijking vooral grootte
 * meet. Ontbreekt het anker, dan absoluut tegen gemWoz. Ontbreekt ook dat:
 * null, en de pagina laat de module weg.
 */
export function wozBuurtVergelijk(input: {
  wozWaarde: number;
  oppervlakteM2: number;
  gemWoz: number | null;
  ankerM2Prijs: number | null;
}): WozBuurtVergelijk | null {
  if (!Number.isFinite(input.wozWaarde) || input.wozWaarde <= 0) return null;

  if (input.ankerM2Prijs && input.ankerM2Prijs > 0 && input.oppervlakteM2 > 0) {
    const eigenPerM2 = input.wozWaarde / input.oppervlakteM2;
    const verschilPct = ((eigenPerM2 - input.ankerM2Prijs) / input.ankerM2Prijs) * 100;
    return { basis: "per_m2", verschilPct, richting: richtingBijDrempel(verschilPct), eigenPerM2, buurtPerM2: input.ankerM2Prijs };
  }

  if (input.gemWoz && input.gemWoz > 0) {
    const verschilPct = ((input.wozWaarde - input.gemWoz) / input.gemWoz) * 100;
    return { basis: "absoluut", verschilPct, richting: richtingBijDrempel(verschilPct), eigenPerM2: null, buurtPerM2: null };
  }

  return null;
}
