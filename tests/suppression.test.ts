import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let suppression: typeof import("@/lib/suppression");

let adresId: number;

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  suppression = await import("@/lib/suppression");

  await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" });
  adresId = (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Teststraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
  )[0].id;

  const userId = (await db.insert(schema.users).values({ email: "test@voorbeeld.nl", verifiedAt: "2026-01-01", createdAt: "2026-01-01" }).returning({ id: schema.users.id }))[0].id;
  const claimId = (await db.insert(schema.claims).values({ userId, adresId, rol: "eigenaar", createdAt: "2026-01-01" }).returning({ id: schema.claims.id }))[0].id;
  await db.insert(schema.alertSubscriptions).values({ claimId, actief: true });
  await db.insert(schema.sharedReports).values({ token: "deel-token", claimId, adresId, createdAt: "2026-01-01" });
});

describe("opt-out-cascade (de merkbelofte)", () => {
  it("is voor bevestiging nergens actief", async () => {
    await db
      .insert(schema.optouts)
      .values({ adresId, postcode: "5611AB", nummerslug: "12", email: "test@voorbeeld.nl", token: "optout-token", aangevraagdAt: "2026-07-22" });
    expect(await suppression.isSuppressed("5611AB", "12")).toBe(false);
  });

  it("onderdrukt overal na bevestiging en cascade", async () => {
    const { eq } = await import("drizzle-orm");
    await db.update(schema.optouts).set({ bevestigdAt: "2026-07-22T12:00:00Z" }).where(eq(schema.optouts.token, "optout-token"));
    await suppression.applyOptoutCascade(adresId);

    expect(await suppression.isSuppressed("5611AB", "12")).toBe(true);
    expect(await suppression.isAddressIdSuppressed(adresId)).toBe(true);

    const adres = (await db.select().from(schema.addresses).where(eq(schema.addresses.id, adresId)).limit(1))[0];
    expect(adres!.status).toBe("opted_out");

    const rapport = (await db.select().from(schema.sharedReports).where(eq(schema.sharedReports.adresId, adresId)).limit(1))[0];
    expect(rapport!.revokedAt).not.toBeNull();

    const claim = (await db.select().from(schema.claims).where(eq(schema.claims.adresId, adresId)).limit(1))[0];
    expect(claim!.endedAt).not.toBeNull();

    const alert = (await db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, claim!.id)).limit(1))[0];
    expect(alert!.actief).toBe(false);

    const mail = (await db.select().from(schema.emailsOutbox)).find((m) => m.type === "claim_beeindigd");
    expect(mail).toBeDefined();
    expect(mail!.to).toBe("test@voorbeeld.nl");
  });

  it("overleeft her-ingest: het adres komt nooit terug op actief", async () => {
    const { eq } = await import("drizzle-orm");
    // Simuleert exact wat scripts/seed.ts en de ingest doen: eerst de
    // suppressielijst checken, dan pas upserten met onConflictDoNothing.
    const zouIngesten = !(await suppression.isSuppressed("5611AB", "12"));
    expect(zouIngesten).toBe(false);

    if (zouIngesten) {
      await db
        .insert(schema.addresses)
        .values({
          straat: "Teststraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
          buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
          energielabelBron: "indicatie", bron: "seed", status: "actief",
        })
        .onConflictDoNothing();
    }
    const adres = (await db.select().from(schema.addresses).where(eq(schema.addresses.id, adresId)).limit(1))[0];
    expect(adres!.status).toBe("opted_out");
  });
});
