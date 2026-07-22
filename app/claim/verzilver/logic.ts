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
export function verzilverClaim(input: VerzilverInput): { claimId: number; adresId: number } | null {
  const adres = db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, input.postcode), eq(addresses.nummerslug, input.nummerslug)))
    .get();
  if (!adres) return null;
  if (adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) return null;

  const user = db.select().from(users).where(eq(users.id, input.userId)).get();
  if (!user) return null;

  const now = nowIso();

  const bestaandeClaim = db
    .select()
    .from(claims)
    .where(and(eq(claims.userId, user.id), eq(claims.adresId, adres.id), isNull(claims.endedAt)))
    .get();
  const claimId = bestaandeClaim
    ? bestaandeClaim.id
    : db
        .insert(claims)
        .values({ userId: user.id, adresId: adres.id, rol: input.rol, createdAt: now })
        .returning({ id: claims.id })
        .get().id;

  // Consent per aangevinkt doel: elke toestemmingshandeling wordt gelogd.
  for (const doel of ["alerts", "marketing"] as const) {
    const aangevinkt = doel === "alerts" ? input.alerts : input.marketing;
    if (!aangevinkt) continue;
    db.insert(consents)
      .values({
        userId: user.id,
        email: user.email,
        doel,
        tekstversie: consentTekstversie(doel),
        bron: "claim-flow",
        consentedAt: now,
      })
      .run();
  }

  if (input.alerts) {
    const bestaandAbonnement = db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claimId)).get();
    if (bestaandAbonnement) {
      db.update(alertSubscriptions).set({ actief: true }).where(eq(alertSubscriptions.id, bestaandAbonnement.id)).run();
    } else {
      db.insert(alertSubscriptions).values({ claimId, frequentie: "maandelijks", actief: true }).run();
    }
  }

  return { claimId, adresId: adres.id };
}
