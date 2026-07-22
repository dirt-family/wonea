import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let suppression: typeof import("@/lib/suppression");

let adresId: number;

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  suppression = await import("@/lib/suppression");

  db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" }).run();
  db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" }).run();
  adresId = db
    .insert(schema.addresses)
    .values({
      straat: "Teststraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
      buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
      energielabelBron: "indicatie", bron: "seed", status: "actief",
    })
    .returning({ id: schema.addresses.id })
    .get().id;

  const userId = db.insert(schema.users).values({ email: "test@voorbeeld.nl", verifiedAt: "2026-01-01", createdAt: "2026-01-01" }).returning({ id: schema.users.id }).get().id;
  const claimId = db.insert(schema.claims).values({ userId, adresId, rol: "eigenaar", createdAt: "2026-01-01" }).returning({ id: schema.claims.id }).get().id;
  db.insert(schema.alertSubscriptions).values({ claimId, actief: true }).run();
  db.insert(schema.sharedReports).values({ token: "deel-token", claimId, adresId, createdAt: "2026-01-01" }).run();
});

describe("opt-out-cascade (de merkbelofte)", () => {
  it("is voor bevestiging nergens actief", () => {
    db.insert(schema.optouts)
      .values({ adresId, postcode: "5611AB", nummerslug: "12", email: "test@voorbeeld.nl", token: "optout-token", aangevraagdAt: "2026-07-22" })
      .run();
    expect(suppression.isSuppressed("5611AB", "12")).toBe(false);
  });

  it("onderdrukt overal na bevestiging en cascade", async () => {
    const { eq } = await import("drizzle-orm");
    db.update(schema.optouts).set({ bevestigdAt: "2026-07-22T12:00:00Z" }).where(eq(schema.optouts.token, "optout-token")).run();
    suppression.applyOptoutCascade(adresId);

    expect(suppression.isSuppressed("5611AB", "12")).toBe(true);
    expect(suppression.isAddressIdSuppressed(adresId)).toBe(true);

    const adres = db.select().from(schema.addresses).where(eq(schema.addresses.id, adresId)).get();
    expect(adres!.status).toBe("opted_out");

    const rapport = db.select().from(schema.sharedReports).where(eq(schema.sharedReports.adresId, adresId)).get();
    expect(rapport!.revokedAt).not.toBeNull();

    const claim = db.select().from(schema.claims).where(eq(schema.claims.adresId, adresId)).get();
    expect(claim!.endedAt).not.toBeNull();

    const alert = db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, claim!.id)).get();
    expect(alert!.actief).toBe(false);

    const mail = db.select().from(schema.emailsOutbox).all().find((m) => m.type === "claim_beeindigd");
    expect(mail).toBeDefined();
    expect(mail!.to).toBe("test@voorbeeld.nl");
  });

  it("overleeft her-ingest: het adres komt nooit terug op actief", async () => {
    const { eq } = await import("drizzle-orm");
    // Simuleert exact wat scripts/seed.ts en de ingest doen: eerst de
    // suppressielijst checken, dan pas upserten met onConflictDoNothing.
    const zouIngesten = !suppression.isSuppressed("5611AB", "12");
    expect(zouIngesten).toBe(false);

    if (zouIngesten) {
      db.insert(schema.addresses)
        .values({
          straat: "Teststraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
          buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
          energielabelBron: "indicatie", bron: "seed", status: "actief",
        })
        .onConflictDoNothing()
        .run();
    }
    const adres = db.select().from(schema.addresses).where(eq(schema.addresses.id, adresId)).get();
    expect(adres!.status).toBe("opted_out");
  });
});
