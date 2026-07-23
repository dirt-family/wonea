import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { premiumEntitlements } from "@/db/schema";

export type PremiumProduct = "biedadvies" | "marktanalyse";

/** Premium-prijzen in euro (eenmalig, gemockte checkout tot livegang). */
export const PREMIUM_PRIJZEN: Record<PremiumProduct, number> = {
  biedadvies: 29,
  marktanalyse: 19,
};

export async function hasEntitlement(userId: number, product: PremiumProduct): Promise<boolean> {
  const rows = await db
    .select({ id: premiumEntitlements.id })
    .from(premiumEntitlements)
    .where(and(eq(premiumEntitlements.userId, userId), eq(premiumEntitlements.product, product), eq(premiumEntitlements.status, "actief")))
    .limit(1);
  return rows.length > 0;
}
