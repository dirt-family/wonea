import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, wozValues } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { normalizePostcode } from "@/lib/util";
import type { WozAdresResultaat } from "./berekening";

/**
 * Serverkant van de adres-zoekstap in de WOZ-check. Eén plek voor de lookup,
 * gebruikt door zowel de pagina (deep-links met ?postcode&nummer) als de
 * route-handler (zoeken vanuit de stepper). Suppressie is hier verplicht:
 * een onderdrukt adres bestaat voor deze check simpelweg niet.
 */
export async function zoekWozAdres(postcodeRaw: string, nummerRaw: string): Promise<WozAdresResultaat | null> {
  const postcode = normalizePostcode(postcodeRaw);
  const nummerslug = nummerRaw.toLowerCase().replace(/\s+/g, "");
  if (!postcode || !/^[a-z0-9-]{1,12}$/.test(nummerslug)) return null;

  const adres = (
    await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
      .limit(1)
  )[0];
  if (!adres || adres.status !== "actief" || (await isSuppressed(adres.postcode, adres.nummerslug))) return null;

  const { valuation } = await getOrCreateValuation(adres);
  const woz = (await db.select().from(wozValues).where(eq(wozValues.adresId, adres.id)).orderBy(wozValues.peiljaar)).at(-1);

  return {
    naam: `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.postcode} ${adres.plaats}`,
    postcode: adres.postcode,
    nummerslug: adres.nummerslug,
    schatting: valuation
      ? {
          waarde: valuation.waarde,
          laag: valuation.intervalLaag,
          hoog: valuation.intervalHoog,
          confidence: valuation.confidence,
          nComparables: valuation.nComparables,
          datum: valuation.datum,
        }
      : null,
    bekendeWoz: woz ? { waarde: woz.waarde, peiljaar: woz.peiljaar, bron: woz.bron } : null,
  };
}
