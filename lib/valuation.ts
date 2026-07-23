import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighborhoods, valuations, type addresses } from "@/db/schema";
import { berekenWaarde, type AvmResult } from "@/lib/avm";
import { findComparables, type ComparablesResult } from "@/lib/comparables";
import { todayIso } from "@/lib/util";

export type Adres = typeof addresses.$inferSelect;

export type ValuationView = {
  valuation: typeof valuations.$inferSelect | null;
  comparables: ComparablesResult;
  buurt: typeof neighborhoods.$inferSelect | null;
};

/**
 * Waarde van vandaag voor een adres: bestaande rij uit valuations of vers
 * berekend en opgeslagen. De historie in valuations maakt waardeontwikkeling
 * uitlegbaar (anti "onverklaard schommelen") en voedt de waarde-alerts.
 */
export async function getOrCreateValuation(adres: Adres): Promise<ValuationView> {
  const buurtRows = await db.select().from(neighborhoods).where(eq(neighborhoods.buurtCode, adres.buurtCode)).limit(1);
  const buurt = buurtRows[0] ?? null;

  const comparables = await findComparables({
    buurtCode: adres.buurtCode,
    straat: adres.straat,
    woningtype: adres.woningtype,
    oppervlakteM2: adres.oppervlakteM2,
  });

  const vandaag = todayIso();
  const bestaandRows = await db
    .select()
    .from(valuations)
    .where(and(eq(valuations.adresId, adres.id), eq(valuations.datum, vandaag)))
    .limit(1);
  if (bestaandRows[0]) return { valuation: bestaandRows[0], comparables, buurt };

  const result: AvmResult | null = berekenWaarde({
    oppervlakteM2: adres.oppervlakteM2,
    bouwjaar: adres.bouwjaar,
    woningtype: adres.woningtype,
    energielabel: adres.energielabel,
    comparables: comparables.comparables,
    ankerM2Prijs: buurt?.ankerM2Prijs ?? null,
  });
  if (!result) return { valuation: null, comparables, buurt };

  const inserted = await db
    .insert(valuations)
    .values({
      adresId: adres.id,
      datum: vandaag,
      waarde: result.waarde,
      intervalLaag: result.intervalLaag,
      intervalHoog: result.intervalHoog,
      confidence: result.confidence,
      nComparables: result.nComparables,
      modelVersie: result.modelVersie,
      inputsJson: JSON.stringify({ uitleg: result.uitleg, niveau: comparables.niveau, comparableIds: comparables.comparables.map((c) => c.id) }),
    })
    .returning();

  return { valuation: inserted[0], comparables, buurt };
}

/** Waardehistorie voor grafieken en alerts (oudste eerst). */
export async function valuationHistorie(adresId: number) {
  return db.select().from(valuations).where(eq(valuations.adresId, adresId)).orderBy(valuations.datum);
}
