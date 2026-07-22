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

export function isSuppressed(postcode: string, nummerslug: string): boolean {
  const row = db
    .select({ id: optouts.id })
    .from(optouts)
    .where(and(eq(optouts.postcode, postcode), eq(optouts.nummerslug, nummerslug), isNotNull(optouts.bevestigdAt)))
    .get();
  return !!row;
}

export function isAddressIdSuppressed(adresId: number): boolean {
  const row = db
    .select({ id: optouts.id })
    .from(optouts)
    .where(and(eq(optouts.adresId, adresId), isNotNull(optouts.bevestigdAt)))
    .get();
  return !!row;
}

/**
 * Voert de volledige opt-out-cascade uit voor een adres (na e-mailbevestiging):
 * status opted_out, deel-rapporten ingetrokken, claims beeindigd, alerts uit,
 * nette afmeldmail naar claimers. Sitemap/noindex volgen automatisch omdat
 * die paden isSuppressed checken.
 */
export function applyOptoutCascade(adresId: number): void {
  const now = nowIso();

  db.update(addresses).set({ status: "opted_out" }).where(eq(addresses.id, adresId)).run();

  db.update(sharedReports).set({ revokedAt: now }).where(and(eq(sharedReports.adresId, adresId))).run();

  const adresClaims = db.select().from(claims).where(eq(claims.adresId, adresId)).all();
  for (const claim of adresClaims) {
    if (!claim.endedAt) {
      db.update(claims).set({ endedAt: now }).where(eq(claims.id, claim.id)).run();
    }
    db.update(alertSubscriptions).set({ actief: false }).where(eq(alertSubscriptions.claimId, claim.id)).run();

    const user = db.select().from(usersTable).where(eq(usersTable.id, claim.userId)).get();
    if (user) {
      db.insert(emailsOutbox)
        .values({
          to: user.email,
          subject: "Je woning is verwijderd van Wonea",
          html: `<p>De woningpagina die je had geclaimd is op verzoek verwijderd van Wonea. Je claim en waarde-alerts voor dit adres zijn stopgezet.</p><p>Vragen? Antwoord op deze mail.</p>`,
          type: "claim_beeindigd",
          status: "queued",
          createdAt: now,
        })
        .run();
    }
  }
}
