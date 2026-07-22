import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let logic: typeof import("@/app/premium/logic");
let premium: typeof import("@/lib/premium");
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;

let userId: number;

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  logic = await import("@/app/premium/logic");
  premium = await import("@/lib/premium");
  ({ eq, and } = await import("drizzle-orm"));

  userId = db
    .insert(schema.users)
    .values({ email: "koper@voorbeeld.nl", verifiedAt: "2026-07-22", createdAt: "2026-07-22" })
    .returning({ id: schema.users.id })
    .get().id;
});

describe("koopPremium", () => {
  it("maakt een actieve entitlement aan met mock-betaalreferentie en zet hasEntitlement op true", () => {
    expect(premium.hasEntitlement(userId, "biedadvies")).toBe(false);

    const resultaat = logic.koopPremium(userId, "biedadvies");
    expect(resultaat.status).toBe("gekocht");
    if (resultaat.status !== "gekocht") throw new Error("onbereikbaar");
    // Gemockte checkout: referentie is herkenbaar nep ("mock-" + randomToken(8)).
    expect(resultaat.mockPaymentRef).toMatch(/^mock-[A-Za-z0-9_-]+$/);

    const rij = db
      .select()
      .from(schema.premiumEntitlements)
      .where(and(eq(schema.premiumEntitlements.userId, userId), eq(schema.premiumEntitlements.product, "biedadvies")))
      .get();
    expect(rij).toBeDefined();
    expect(rij!.status).toBe("actief");
    expect(rij!.mockPaymentRef).toBe(resultaat.mockPaymentRef);

    expect(premium.hasEntitlement(userId, "biedadvies")).toBe(true);
    // Het andere product blijft los: niet gekocht, dus geen toegang.
    expect(premium.hasEntitlement(userId, "marktanalyse")).toBe(false);
  });

  it("meldt al_gekocht bij een tweede aankoop en maakt geen duplicaat", () => {
    const resultaat = logic.koopPremium(userId, "biedadvies");
    expect(resultaat.status).toBe("al_gekocht");

    const rijen = db
      .select()
      .from(schema.premiumEntitlements)
      .where(and(eq(schema.premiumEntitlements.userId, userId), eq(schema.premiumEntitlements.product, "biedadvies")))
      .all();
    expect(rijen).toHaveLength(1);
  });

  it("houdt gebruikers gescheiden: aankoop van de een geeft de ander niets", () => {
    const andereUserId = db
      .insert(schema.users)
      .values({ email: "ander@voorbeeld.nl", verifiedAt: "2026-07-22", createdAt: "2026-07-22" })
      .returning({ id: schema.users.id })
      .get().id;

    expect(premium.hasEntitlement(andereUserId, "biedadvies")).toBe(false);

    const resultaat = logic.koopPremium(andereUserId, "marktanalyse");
    expect(resultaat.status).toBe("gekocht");
    expect(premium.hasEntitlement(andereUserId, "marktanalyse")).toBe(true);
    expect(premium.hasEntitlement(userId, "marktanalyse")).toBe(false);
  });
});

describe("veiligeVanUrl", () => {
  it("accepteert alleen relatieve paden binnen Wonea", () => {
    expect(logic.veiligeVanUrl("/woning/5611AB/12")).toBe("/woning/5611AB/12");
    expect(logic.veiligeVanUrl("/buurt/eindhoven/testbuurt?tab=markt")).toBe("/buurt/eindhoven/testbuurt?tab=markt");
  });

  it("weigert absolute urls, protocol-relatieve urls en backslash-trucs", () => {
    expect(logic.veiligeVanUrl("https://kwaad.nl/phish")).toBeNull();
    expect(logic.veiligeVanUrl("//kwaad.nl")).toBeNull();
    expect(logic.veiligeVanUrl("/\\kwaad.nl")).toBeNull();
    expect(logic.veiligeVanUrl("woning/5611AB/12")).toBeNull();
    expect(logic.veiligeVanUrl("")).toBeNull();
    expect(logic.veiligeVanUrl(undefined)).toBeNull();
    expect(logic.veiligeVanUrl(`/${"a".repeat(600)}`)).toBeNull();
  });
});
