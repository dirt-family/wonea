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
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  logic = await import("@/app/premium/logic");
  premium = await import("@/lib/premium");
  ({ eq, and } = await import("drizzle-orm"));

  userId = (
    await db
      .insert(schema.users)
      .values({ email: "koper@voorbeeld.nl", verifiedAt: "2026-07-22", createdAt: "2026-07-22" })
      .returning({ id: schema.users.id })
  )[0].id;
});

describe("koopPremium", () => {
  it("maakt een actieve entitlement aan met mock-betaalreferentie en zet hasEntitlement op true", async () => {
    expect(await premium.hasEntitlement(userId, "biedadvies")).toBe(false);

    const resultaat = await logic.koopPremium(userId, "biedadvies");
    expect(resultaat.status).toBe("gekocht");
    if (resultaat.status !== "gekocht") throw new Error("onbereikbaar");
    // Gemockte checkout: referentie is herkenbaar nep ("mock-" + randomToken(8)).
    expect(resultaat.mockPaymentRef).toMatch(/^mock-[A-Za-z0-9_-]+$/);

    const rij = (
      await db
        .select()
        .from(schema.premiumEntitlements)
        .where(and(eq(schema.premiumEntitlements.userId, userId), eq(schema.premiumEntitlements.product, "biedadvies")))
        .limit(1)
    )[0];
    expect(rij).toBeDefined();
    expect(rij!.status).toBe("actief");
    expect(rij!.mockPaymentRef).toBe(resultaat.mockPaymentRef);

    expect(await premium.hasEntitlement(userId, "biedadvies")).toBe(true);
    // Het andere product blijft los: niet gekocht, dus geen toegang.
    expect(await premium.hasEntitlement(userId, "marktanalyse")).toBe(false);
  });

  it("meldt al_gekocht bij een tweede aankoop en maakt geen duplicaat", async () => {
    const resultaat = await logic.koopPremium(userId, "biedadvies");
    expect(resultaat.status).toBe("al_gekocht");

    const rijen = await db
      .select()
      .from(schema.premiumEntitlements)
      .where(and(eq(schema.premiumEntitlements.userId, userId), eq(schema.premiumEntitlements.product, "biedadvies")));
    expect(rijen).toHaveLength(1);
  });

  it("houdt gebruikers gescheiden: aankoop van de een geeft de ander niets", async () => {
    const andereUserId = (
      await db
        .insert(schema.users)
        .values({ email: "ander@voorbeeld.nl", verifiedAt: "2026-07-22", createdAt: "2026-07-22" })
        .returning({ id: schema.users.id })
    )[0].id;

    expect(await premium.hasEntitlement(andereUserId, "biedadvies")).toBe(false);

    const resultaat = await logic.koopPremium(andereUserId, "marktanalyse");
    expect(resultaat.status).toBe("gekocht");
    expect(await premium.hasEntitlement(andereUserId, "marktanalyse")).toBe(true);
    expect(await premium.hasEntitlement(userId, "marktanalyse")).toBe(false);
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
