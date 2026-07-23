import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, claims, wozValues } from "@/db/schema";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { valideerWozInvoer, wozPerPeiljaar, type WozRij } from "@/components/dossier/data";

/**
 * Database-kant van het WOZ-dossier. De harde regel: eigen WOZ-invoer
 * (bron "eigenaar") kan ALLEEN via een eigen, actieve claim op het adres.
 * Iedere aanroep verifieert dat opnieuw; een claimId uit een formulier is
 * nooit te vertrouwen. Suppressie wint altijd: voor een verwijderd adres
 * wordt niets opgeslagen.
 */

export type WozUpsertInput = {
  userId: number;
  claimId: number;
  peiljaar: number;
  waarde: number;
};

export type WozUpsertResultaat =
  | { ok: true; actie: "toegevoegd" | "bijgewerkt"; adresId: number }
  | { ok: false; reden: "claim" | "adres" | "peiljaar" | "waarde" };

/**
 * Slaat de WOZ-waarde van een eigen beschikking op voor een peiljaar, of
 * werkt de eerdere eigen invoer voor dat jaar bij (1 eigenaar-rij per
 * adres en peiljaar). Seed-rijen blijven staan: die zijn gelabelde
 * voorbeelddata; in de weergave wint de eigenaar-rij (wozPerPeiljaar).
 */
export async function upsertEigenWoz(input: WozUpsertInput): Promise<WozUpsertResultaat> {
  const invoerFout = valideerWozInvoer(input.peiljaar, input.waarde);
  if (invoerFout) return { ok: false, reden: invoerFout };

  const claim = (
    await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, input.claimId), eq(claims.userId, input.userId), isNull(claims.endedAt)))
      .limit(1)
  )[0];
  if (!claim) return { ok: false, reden: "claim" };

  const adres = (await db.select().from(addresses).where(eq(addresses.id, claim.adresId)).limit(1))[0];
  if (!adres || adres.status === "opted_out" || (await isAddressIdSuppressed(adres.id))) {
    return { ok: false, reden: "adres" };
  }

  const bestaand = (
    await db
      .select()
      .from(wozValues)
      .where(and(eq(wozValues.adresId, adres.id), eq(wozValues.peiljaar, input.peiljaar), eq(wozValues.bron, "eigenaar")))
      .limit(1)
  )[0];

  if (bestaand) {
    await db.update(wozValues).set({ waarde: input.waarde }).where(eq(wozValues.id, bestaand.id));
    return { ok: true, actie: "bijgewerkt", adresId: adres.id };
  }

  await db.insert(wozValues).values({ adresId: adres.id, peiljaar: input.peiljaar, waarde: input.waarde, bron: "eigenaar" });
  return { ok: true, actie: "toegevoegd", adresId: adres.id };
}

/** Alle WOZ-rijen van een adres, gereduceerd tot 1 rij per peiljaar (eigenaar wint). */
export async function wozDossierVoorAdres(adresId: number): Promise<WozRij[]> {
  const rijen = await db
    .select({ id: wozValues.id, peiljaar: wozValues.peiljaar, waarde: wozValues.waarde, bron: wozValues.bron })
    .from(wozValues)
    .where(eq(wozValues.adresId, adresId));
  return wozPerPeiljaar(rijen);
}
