import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims, emailsOutbox, optouts, sharedReports, users as usersTable } from "@/db/schema";
import { nowIso } from "@/lib/util";

/**
 * Centrale suppressielijst. Een bevestigde opt-out is LEIDEND boven elke
 * databron en elk feature-pad. Alle render- en API-paden die adresdata tonen
 * horen via deze module te checken:
 * adrespagina, og-images, deel-rapporten, comparables van buurpanden,
 * buurt-verkopenlijsten, search-/valuation-API's, widget, sitemaps, alerts.
 * Her-ingest (scripts/ingest-*) checkt isSuppressed voor elke upsert.
 */

export async function isSuppressed(postcode: string, nummerslug: string): Promise<boolean> {
  const rows = await db
    .select({ id: optouts.id })
    .from(optouts)
    .where(and(eq(optouts.postcode, postcode), eq(optouts.nummerslug, nummerslug), isNotNull(optouts.bevestigdAt)))
    .limit(1);
  return rows.length > 0;
}

export async function isAddressIdSuppressed(adresId: number): Promise<boolean> {
  const rows = await db
    .select({ id: optouts.id })
    .from(optouts)
    .where(and(eq(optouts.adresId, adresId), isNotNull(optouts.bevestigdAt)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Voert de volledige opt-out-cascade uit voor een adres (na e-mailbevestiging):
 * status opted_out, deel-rapporten ingetrokken, claims beeindigd, alerts uit,
 * nette afmeldmail naar claimers. Sitemap/noindex volgen automatisch omdat
 * die paden isSuppressed checken.
 */
export async function applyOptoutCascade(adresId: number): Promise<void> {
  const now = nowIso();

  await db.update(addresses).set({ status: "opted_out" }).where(eq(addresses.id, adresId));

  await db.update(sharedReports).set({ revokedAt: now }).where(eq(sharedReports.adresId, adresId));

  const adresClaims = await db.select().from(claims).where(eq(claims.adresId, adresId));
  for (const claim of adresClaims) {
    if (!claim.endedAt) {
      await db.update(claims).set({ endedAt: now }).where(eq(claims.id, claim.id));
    }
    await db.update(alertSubscriptions).set({ actief: false }).where(eq(alertSubscriptions.claimId, claim.id));

    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, claim.userId)).limit(1);
    const user = userRows[0];
    if (user) {
      await db.insert(emailsOutbox).values({
        to: user.email,
        subject: "Je woning is verwijderd van Wonea",
        html: `<p>De woningpagina die je had geclaimd is op verzoek verwijderd van Wonea. Je claim en waarde-alerts voor dit adres zijn stopgezet.</p><p>Vragen? Antwoord op deze mail.</p>`,
        type: "claim_beeindigd",
        status: "queued",
        createdAt: now,
      });
    }
  }
}
