import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { sales, type Woningtype } from "@/db/schema";

export type Comparable = {
  id: number;
  buurtCode: string;
  straat: string | null;
  datum: string;
  prijs: number;
  oppervlakteM2: number;
  woningtype: Woningtype;
  bron: "seed" | "kadaster";
};

export type ComparablesResult = {
  comparables: Comparable[];
  /** "straat" als er genoeg verkopen in dezelfde straat zijn, anders "buurt". */
  niveau: "straat" | "buurt";
};

const MAANDEN_TERUG = 24;
const MIN_STRAAT_COMPS = 5;
const MAX_COMPS = 12;

function cutoffDatum(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - MAANDEN_TERUG);
  return d.toISOString().slice(0, 10);
}

/** Oppervlakteklasse: comps tussen 0,7x en 1,4x de doeloppervlakte. */
function inOppervlakteklasse(doel: number, comp: number): boolean {
  return comp >= doel * 0.7 && comp <= doel * 1.4;
}

/**
 * Comparables voor een woning: eerst dezelfde straat (>= 5 bruikbaar), anders
 * de buurt. Zelfde woningtype en oppervlakteklasse, laatste 24 maanden.
 * Methode-pagina beschrijft exact deze volgorde.
 */
export async function findComparables(input: {
  buurtCode: string;
  straat: string;
  woningtype: Woningtype;
  oppervlakteM2: number;
}): Promise<ComparablesResult> {
  const cutoff = cutoffDatum();

  const buurtSales = (
    await db
      .select()
      .from(sales)
      .where(and(eq(sales.buurtCode, input.buurtCode), gte(sales.datum, cutoff), eq(sales.woningtype, input.woningtype)))
      .orderBy(desc(sales.datum))
  ).filter((s) => inOppervlakteklasse(input.oppervlakteM2, s.oppervlakteM2));

  const straatSales = buurtSales.filter((s) => s.straat === input.straat);

  if (straatSales.length >= MIN_STRAAT_COMPS) {
    return { comparables: straatSales.slice(0, MAX_COMPS) as Comparable[], niveau: "straat" };
  }
  return { comparables: buurtSales.slice(0, MAX_COMPS) as Comparable[], niveau: "buurt" };
}
