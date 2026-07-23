import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * Dossier-datafuncties van Mijn woning:
 * - pure functies (components/dossier/data.ts): overwaarde, oversluit-signaal,
 *   marktschatting per jaar, WOZ-reductie per peiljaar;
 * - database (components/dossier/woz-data.ts): WOZ-per-jaar-upsert die ALLEEN
 *   op een eigen, actieve claim werkt en suppressie respecteert.
 */

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let data: typeof import("@/components/dossier/data");
let wozData: typeof import("@/components/dossier/woz-data");
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;

let adresId: number;
let anderAdresId: number;
let eigenaarId: number;
let anderUserId: number;
let eigenClaimId: number;
let andermansClaimId: number;
let beeindigdeClaimId: number;

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  data = await import("@/components/dossier/data");
  wozData = await import("@/components/dossier/woz-data");
  ({ eq, and } = await import("drizzle-orm"));

  await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" });

  adresId = (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Dossierstraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 120, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
  )[0].id;
  anderAdresId = (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Buurstraat", huisnummer: 3, toevoeging: null, nummerslug: "3", postcode: "5611CD", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1975, oppervlakteM2: 95, woningtype: "hoekwoning", energielabel: "D",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
  )[0].id;

  // Pre-cleanup: na een eerder afgebroken run kunnen deze vaste adressen nog
  // bestaan (duplicate-key); idempotent opruimen voor de insert.
  const { inArray: inArrayUsers } = await import("drizzle-orm");
  await db.delete(schema.users).where(inArrayUsers(schema.users.email, ["eigenaar@voorbeeld.nl", "ander@voorbeeld.nl"]));

  eigenaarId = (
    await db
      .insert(schema.users)
      .values({ email: "eigenaar@voorbeeld.nl", verifiedAt: "2026-07-23", createdAt: "2026-07-23" })
      .returning({ id: schema.users.id })
  )[0].id;
  anderUserId = (
    await db
      .insert(schema.users)
      .values({ email: "ander@voorbeeld.nl", verifiedAt: "2026-07-23", createdAt: "2026-07-23" })
      .returning({ id: schema.users.id })
  )[0].id;

  eigenClaimId = (
    await db
      .insert(schema.claims)
      .values({ userId: eigenaarId, adresId, rol: "eigenaar", createdAt: "2026-07-23" })
      .returning({ id: schema.claims.id })
  )[0].id;
  andermansClaimId = (
    await db
      .insert(schema.claims)
      .values({ userId: anderUserId, adresId: anderAdresId, rol: "eigenaar", createdAt: "2026-07-23" })
      .returning({ id: schema.claims.id })
  )[0].id;
  beeindigdeClaimId = (
    await db
      .insert(schema.claims)
      .values({ userId: eigenaarId, adresId: anderAdresId, rol: "bewoner", createdAt: "2026-07-23", endedAt: "2026-07-23T10:00:00Z" })
      .returning({ id: schema.claims.id })
  )[0].id;
});

// ---------------------------------------------------------------------------
// Pure functies
// ---------------------------------------------------------------------------

describe("berekenOverwaarde", () => {
  it("trekt het restant van waarde en bandbreedte af", () => {
    const o = data.berekenOverwaarde({ waarde: 400_000, intervalLaag: 370_000, intervalHoog: 430_000 }, 250_000);
    expect(o).toEqual({ midden: 150_000, laag: 120_000, hoog: 180_000 });
  });

  it("kan negatief zijn (onderwaarde) en blijft eerlijk", () => {
    const o = data.berekenOverwaarde({ waarde: 300_000, intervalLaag: 280_000, intervalHoog: 320_000 }, 350_000);
    expect(o).toEqual({ midden: -50_000, laag: -70_000, hoog: -30_000 });
  });

  it("geeft null zonder waardeschatting of zonder bruikbaar restant", () => {
    expect(data.berekenOverwaarde(null, 250_000)).toBeNull();
    expect(data.berekenOverwaarde({ waarde: 400_000, intervalLaag: 370_000, intervalHoog: 430_000 }, null)).toBeNull();
    expect(data.berekenOverwaarde({ waarde: 400_000, intervalLaag: 370_000, intervalHoog: 430_000 }, -1)).toBeNull();
    expect(data.berekenOverwaarde({ waarde: 400_000, intervalLaag: 370_000, intervalHoog: 430_000 }, Number.NaN)).toBeNull();
  });
});

describe("bepaalOversluitSignaal", () => {
  const vandaag = "2026-07-23";

  it("signaleert een einddatum binnen 12 maanden, met resterende maanden", () => {
    expect(data.bepaalOversluitSignaal("2027-01-23", vandaag)).toEqual({ status: "binnen_12_maanden", maandenResterend: 6 });
    expect(data.bepaalOversluitSignaal("2026-08-01", vandaag)).toEqual({ status: "binnen_12_maanden", maandenResterend: 0 });
  });

  it("signaleert een verlopen rentevaste periode", () => {
    expect(data.bepaalOversluitSignaal("2026-07-23", vandaag)).toEqual({ status: "verlopen", maandenResterend: 0 });
    expect(data.bepaalOversluitSignaal("2020-01-01", vandaag)).toEqual({ status: "verlopen", maandenResterend: 0 });
  });

  it("geeft geen signaal bij 12 maanden of verder weg, of zonder datum", () => {
    expect(data.bepaalOversluitSignaal("2027-07-23", vandaag)).toBeNull();
    expect(data.bepaalOversluitSignaal("2030-01-01", vandaag)).toBeNull();
    expect(data.bepaalOversluitSignaal(null, vandaag)).toBeNull();
    expect(data.bepaalOversluitSignaal("volgend jaar", vandaag)).toBeNull();
  });

  it("telt hele maanden: net geen 12 maanden is nog een signaal", () => {
    expect(data.bepaalOversluitSignaal("2027-07-22", vandaag)).toEqual({ status: "binnen_12_maanden", maandenResterend: 11 });
  });
});

describe("marktschattingPerJaar", () => {
  it("kiest per kalenderjaar de laatste schatting, oplopend gesorteerd", () => {
    const historie = [
      { datum: "2026-03-01", waarde: 410_000, intervalLaag: 390_000, intervalHoog: 430_000 },
      { datum: "2025-11-10", waarde: 395_000, intervalLaag: 375_000, intervalHoog: 415_000 },
      { datum: "2025-02-01", waarde: 380_000, intervalLaag: 360_000, intervalHoog: 400_000 },
      { datum: "2026-07-23", waarde: 420_000, intervalLaag: 400_000, intervalHoog: 440_000 },
    ];
    const perJaar = data.marktschattingPerJaar(historie);
    expect(perJaar).toEqual([
      { jaar: 2025, waarde: 395_000, intervalLaag: 375_000, intervalHoog: 415_000, datum: "2025-11-10" },
      { jaar: 2026, waarde: 420_000, intervalLaag: 400_000, intervalHoog: 440_000, datum: "2026-07-23" },
    ]);
  });

  it("geeft een lege lijst bij lege historie", () => {
    expect(data.marktschattingPerJaar([])).toEqual([]);
  });
});

describe("wozPerPeiljaar en wozVerschilPct", () => {
  it("laat eigen invoer winnen van voorbeelddata voor hetzelfde peiljaar", () => {
    const rijen = data.wozPerPeiljaar([
      { id: 1, peiljaar: 2025, waarde: 350_000, bron: "seed" },
      { id: 2, peiljaar: 2025, waarde: 342_000, bron: "eigenaar" },
      { id: 3, peiljaar: 2024, waarde: 330_000, bron: "seed" },
    ]);
    expect(rijen).toEqual([
      { id: 3, peiljaar: 2024, waarde: 330_000, bron: "seed" },
      { id: 2, peiljaar: 2025, waarde: 342_000, bron: "eigenaar" },
    ]);
  });

  it("houdt eigen invoer ook vast als de seed-rij nieuwer is (hoger id)", () => {
    const rijen = data.wozPerPeiljaar([
      { id: 1, peiljaar: 2025, waarde: 342_000, bron: "eigenaar" },
      { id: 9, peiljaar: 2025, waarde: 355_000, bron: "seed" },
    ]);
    expect(rijen).toEqual([{ id: 1, peiljaar: 2025, waarde: 342_000, bron: "eigenaar" }]);
  });

  it("rekent het verschil in procenten van de marktschatting, 1 decimaal", () => {
    expect(data.wozVerschilPct(420_000, 400_000)).toBe(5);
    expect(data.wozVerschilPct(390_000, 400_000)).toBe(-2.5);
    expect(data.wozVerschilPct(400_000, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// WOZ-upsert: alleen op een eigen, actieve claim
// ---------------------------------------------------------------------------

describe("upsertEigenWoz", () => {
  it("voegt een eigenaar-rij toe op de eigen claim", async () => {
    const resultaat = await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: eigenClaimId, peiljaar: 2025, waarde: 342_000 });
    expect(resultaat).toEqual({ ok: true, actie: "toegevoegd", adresId });

    const rijen = await db
      .select()
      .from(schema.wozValues)
      .where(and(eq(schema.wozValues.adresId, adresId), eq(schema.wozValues.peiljaar, 2025)));
    expect(rijen).toHaveLength(1);
    expect(rijen[0].waarde).toBe(342_000);
    expect(rijen[0].bron).toBe("eigenaar");
  });

  it("werkt dezelfde peiljaar-rij bij in plaats van te dupliceren", async () => {
    const resultaat = await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: eigenClaimId, peiljaar: 2025, waarde: 351_000 });
    expect(resultaat).toEqual({ ok: true, actie: "bijgewerkt", adresId });

    const rijen = await db
      .select()
      .from(schema.wozValues)
      .where(and(eq(schema.wozValues.adresId, adresId), eq(schema.wozValues.peiljaar, 2025), eq(schema.wozValues.bron, "eigenaar")));
    expect(rijen).toHaveLength(1);
    expect(rijen[0].waarde).toBe(351_000);
  });

  it("laat een seed-rij voor hetzelfde jaar staan; het dossier toont de eigen invoer", async () => {
    await db.insert(schema.wozValues).values({ adresId, peiljaar: 2024, waarde: 500_000, bron: "seed" });
    const resultaat = await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: eigenClaimId, peiljaar: 2024, waarde: 325_000 });
    expect(resultaat).toEqual({ ok: true, actie: "toegevoegd", adresId });

    const alle = await db
      .select()
      .from(schema.wozValues)
      .where(and(eq(schema.wozValues.adresId, adresId), eq(schema.wozValues.peiljaar, 2024)));
    expect(alle).toHaveLength(2); // seed blijft, eigenaar erbij

    const dossier = await wozData.wozDossierVoorAdres(adresId);
    const rij2024 = dossier.find((r) => r.peiljaar === 2024);
    expect(rij2024).toMatchObject({ waarde: 325_000, bron: "eigenaar" });
  });

  it("weigert andermans claim: geen rij, reden claim", async () => {
    const resultaat = await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: andermansClaimId, peiljaar: 2025, waarde: 300_000 });
    expect(resultaat).toEqual({ ok: false, reden: "claim" });

    const rijen = await db.select().from(schema.wozValues).where(eq(schema.wozValues.adresId, anderAdresId));
    expect(rijen).toHaveLength(0);
  });

  it("weigert een beeindigde claim, ook van de gebruiker zelf", async () => {
    const resultaat = await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: beeindigdeClaimId, peiljaar: 2025, waarde: 300_000 });
    expect(resultaat).toEqual({ ok: false, reden: "claim" });

    const rijen = await db.select().from(schema.wozValues).where(eq(schema.wozValues.adresId, anderAdresId));
    expect(rijen).toHaveLength(0);
  });

  it("weigert een onbestaande claim", async () => {
    const resultaat = await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: 99_999, peiljaar: 2025, waarde: 300_000 });
    expect(resultaat).toEqual({ ok: false, reden: "claim" });
  });

  it("valideert peiljaar en waarde voor er iets wordt opgeslagen", async () => {
    expect(await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: eigenClaimId, peiljaar: 1999, waarde: 300_000 })).toEqual({
      ok: false,
      reden: "peiljaar",
    });
    expect(
      await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: eigenClaimId, peiljaar: new Date().getFullYear() + 1, waarde: 300_000 }),
    ).toEqual({ ok: false, reden: "peiljaar" });
    expect(await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: eigenClaimId, peiljaar: 2025, waarde: 5_000 })).toEqual({
      ok: false,
      reden: "waarde",
    });
    expect(await wozData.upsertEigenWoz({ userId: eigenaarId, claimId: eigenClaimId, peiljaar: 2025, waarde: 300_000.5 })).toEqual({
      ok: false,
      reden: "waarde",
    });
  });

  it("weigert een gesuppresseerd adres (opt-out is leidend)", async () => {
    const suppressedAdresId = (
      await db
        .insert(schema.addresses)
        .values({
          straat: "Wegstraat", huisnummer: 8, toevoeging: null, nummerslug: "8", postcode: "5611EF", plaats: "Test",
          buurtCode: "BU1", bouwjaar: 1985, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
          energielabelBron: "indicatie", bron: "seed", status: "actief",
        })
        .returning({ id: schema.addresses.id })
    )[0].id;
    const claimId = (
      await db
        .insert(schema.claims)
        .values({ userId: eigenaarId, adresId: suppressedAdresId, rol: "eigenaar", createdAt: "2026-07-23" })
        .returning({ id: schema.claims.id })
    )[0].id;
    await db.insert(schema.optouts).values({
      adresId: suppressedAdresId, postcode: "5611EF", nummerslug: "8", token: "optout-dossier-test",
      aangevraagdAt: "2026-07-23", bevestigdAt: "2026-07-23T09:00:00Z",
    });

    const resultaat = await wozData.upsertEigenWoz({ userId: eigenaarId, claimId, peiljaar: 2025, waarde: 300_000 });
    expect(resultaat).toEqual({ ok: false, reden: "adres" });

    const rijen = await db.select().from(schema.wozValues).where(eq(schema.wozValues.adresId, suppressedAdresId));
    expect(rijen).toHaveLength(0);
  });
});
