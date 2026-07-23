import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims, consents, users } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { nowIso } from "@/lib/util";
import { consentTekstversie } from "@/app/claim/consent-teksten";

export type VerzilverInput = {
  userId: number;
  postcode: string; // genormaliseerd, bv. "5611AB"
  nummerslug: string; // bv. "12", "12a", "12-2"
  rol: "eigenaar" | "bewoner";
  alerts: boolean;
  marketing: boolean;
};

/**
 * Kern van de claim-verzilvering, los van Next-request-context zodat het
 * testbaar is. Aangeroepen NA consumeMagicToken (e-mail is dan bewezen).
 *
 * - Adres moet bestaan en niet gesuppresseerd zijn (opt-out is leidend).
 * - Claim is een zelfverklaring; bestaande actieve claim van deze user op
 *   dit adres wordt hergebruikt, nooit gedupliceerd.
 * - Elke aangevinkte checkbox wordt als consent-rij gelogd met de
 *   letterlijke tekstversie en bron "claim-flow" (AVG art. 7).
 * - Alerts aangevinkt: alert_subscription aan (upsert op claim).
 */
export async function verzilverClaim(input: VerzilverInput): Promise<{ claimId: number; adresId: number } | null> {
  const adres = (
    await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.postcode, input.postcode), eq(addresses.nummerslug, input.nummerslug)))
      .limit(1)
  )[0];
  if (!adres) return null;
  if (adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug))) return null;

  const user = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
  if (!user) return null;

  const now = nowIso();

  const bestaandeClaim = (
    await db
      .select()
      .from(claims)
      .where(and(eq(claims.userId, user.id), eq(claims.adresId, adres.id), isNull(claims.endedAt)))
      .limit(1)
  )[0];
  const claimId = bestaandeClaim
    ? bestaandeClaim.id
    : (
        await db
          .insert(claims)
          .values({ userId: user.id, adresId: adres.id, rol: input.rol, createdAt: now })
          .returning({ id: claims.id })
      )[0].id;

  // Consent per aangevinkt doel: elke toestemmingshandeling wordt gelogd.
  for (const doel of ["alerts", "marketing"] as const) {
    const aangevinkt = doel === "alerts" ? input.alerts : input.marketing;
    if (!aangevinkt) continue;
    await db.insert(consents).values({
      userId: user.id,
      email: user.email,
      doel,
      tekstversie: consentTekstversie(doel),
      bron: "claim-flow",
      consentedAt: now,
    });
  }

  if (input.alerts) {
    const bestaandAbonnement = (
      await db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claimId)).limit(1)
    )[0];
    if (bestaandAbonnement) {
      await db.update(alertSubscriptions).set({ actief: true }).where(eq(alertSubscriptions.id, bestaandAbonnement.id));
    } else {
      await db.insert(alertSubscriptions).values({ claimId, frequentie: "maandelijks", actief: true });
    }
  }

  return { claimId, adresId: adres.id };
}
