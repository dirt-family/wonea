import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
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

/**
 * Batch-variant van isSuppressed: één query voor meerdere adressen, geeft de
 * set "postcode|nummerslug"-sleutels terug die een BEVESTIGDE opt-out hebben.
 * Voor lijstpaden (zoeken, rijen) zodat er geen N losse roundtrips ontstaan;
 * deze module blijft de enige toegangslaag voor suppressie.
 */
export async function suppressedKeySet(
  adressen: readonly { postcode: string; nummerslug: string }[],
): Promise<Set<string>> {
  if (adressen.length === 0) return new Set();
  const rows = await db
    .select({ postcode: optouts.postcode, nummerslug: optouts.nummerslug })
    .from(optouts)
    .where(
      and(
        isNotNull(optouts.bevestigdAt),
        or(...adressen.map((a) => and(eq(optouts.postcode, a.postcode), eq(optouts.nummerslug, a.nummerslug)))),
      ),
    );
  return new Set(rows.map((r) => `${r.postcode}|${r.nummerslug}`));
}

/** Batch-variant op adres-id: 1 query, geeft de set onderdrukte ids terug. */
export async function suppressedAdresIdSet(adresIds: readonly number[]): Promise<Set<number>> {
  const uniek = [...new Set(adresIds)];
  if (uniek.length === 0) return new Set();
  const rows = await db
    .select({ adresId: optouts.adresId })
    .from(optouts)
    .where(and(isNotNull(optouts.bevestigdAt), inArray(optouts.adresId, uniek)));
  return new Set(rows.map((r) => r.adresId));
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
