import { db } from "@/lib/db";
import { premiumEntitlements } from "@/db/schema";
import { hasEntitlement, type PremiumProduct } from "@/lib/premium";
import { nowIso, randomToken } from "@/lib/util";

/**
 * Kern van de gemockte checkout, los van Next-request-context zodat het
 * testbaar is (tests/premium.test.ts). Aangeroepen NA de sessiecheck.
 *
 * - Er is GEEN echte betaalprovider: de "betaling" is een rij in
 *   premium_entitlements met een mock-referentie. Bewust, tot livegang.
 * - Eenmalig product: geen abonnement, geen automatische verlenging, dus
 *   ook geen verleng- of incassologica.
 * - Al gekocht (actieve entitlement) = melden, nooit een tweede rij.
 */

export type KoopResultaat = { status: "gekocht"; mockPaymentRef: string } | { status: "al_gekocht" };

export async function koopPremium(userId: number, product: PremiumProduct): Promise<KoopResultaat> {
  if (await hasEntitlement(userId, product)) return { status: "al_gekocht" };

  const mockPaymentRef = `mock-${randomToken(8)}`;
  await db
    .insert(premiumEntitlements)
    .values({ userId, product, status: "actief", mockPaymentRef, createdAt: nowIso() });

  return { status: "gekocht", mockPaymentRef };
}

/**
 * Valideert de "van"-searchParam (terug-url na aankoop). Alleen relatieve
 * paden binnen Wonea zijn toegestaan; alles wat naar een ander domein kan
 * leiden ("https://...", "//host", backslash-trucs) wordt null.
 */
export function veiligeVanUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  if (input.length > 500) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//")) return null;
  if (input.includes("\\")) return null;
  return input;
}

/** Bouwt de querystring die product + terug-url door de hele flow meeneemt. */
export function checkoutQuery(product: PremiumProduct, van: string | null): string {
  const q = new URLSearchParams({ product });
  if (van) q.set("van", van);
  return q.toString();
}
