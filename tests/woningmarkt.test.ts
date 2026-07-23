import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * Tests voor de woningmarkt-datalaag (lib/woningmarkt.ts): plaatsSlug,
 * tellingen per plaats, buurten, recente verkopen (met de harde invariant
 * dat seed-verkopen nooit een adres_id hebben), woningen-met-waarde en
 * marktcijfers. Alles via de gedeelde testdatabase (wonea_test), dynamische
 * imports NA maakTestDb (zie tests/helpers.ts).
 */

let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let wm: typeof import("@/lib/woningmarkt");

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  wm = await import("@/lib/woningmarkt");

  await db.insert(schema.municipalities).values([
    { code: "GM0001", naam: "Testdorp", slug: "testdorp" },
    { code: "GM0002", naam: "Anderstad", slug: "anderstad" },
  ]);

  await db.insert(schema.neighborhoods).values([
    { buurtCode: "BU1", naam: "Akkerwijk", slug: "akkerwijk", gemeenteCode: "GM0001", gemWoz: 300000, ankerM2Prijs: 3000, inwoners: 1000 },
    { buurtCode: "BU2", naam: "Beemdhof", slug: "beemdhof", gemeenteCode: "GM0001", gemWoz: 400000, inwoners: 2000 },
    { buurtCode: "BU3", naam: "Centrum", slug: "centrum", gemeenteCode: "GM0002" },
  ]);

  const basisAdres = {
    straat: "Teststraat",
    postcode: "1234AB",
    plaats: "Testdorp",
    buurtCode: "BU1",
    bouwjaar: 1990,
    oppervlakteM2: 100,
    woningtype: "tussenwoning" as const,
  };
  const adressen = await db
    .insert(schema.addresses)
    .values([
      { ...basisAdres, huisnummer: 1, nummerslug: "1" },
      { ...basisAdres, huisnummer: 2, nummerslug: "2" },
      { ...basisAdres, huisnummer: 3, nummerslug: "3", buurtCode: "BU2" },
      { ...basisAdres, huisnummer: 4, nummerslug: "4", buurtCode: "BU3", plaats: "Anderstad", postcode: "5678CD" },
      // opted_out: telt nergens mee
      { ...basisAdres, huisnummer: 5, nummerslug: "5", status: "opted_out" as const },
      // actief maar gesupprimeerd via een bevestigde opt-out (rij hieronder)
      { ...basisAdres, huisnummer: 6, nummerslug: "6" },
    ])
    .returning({ id: schema.addresses.id, nummerslug: schema.addresses.nummerslug });
  const adresId = (slug: string) => adressen.find((a) => a.nummerslug === slug)!.id;

  await db.insert(schema.optouts).values({
    adresId: adresId("6"),
    postcode: "1234AB",
    nummerslug: "6",
    token: "test-token-6",
    aangevraagdAt: "2026-06-01T10:00:00.000Z",
    bevestigdAt: "2026-06-01T11:00:00.000Z",
  });

  await db.insert(schema.sales).values([
    // seed-verkopen: NOOIT een adres_id (CONTRACTS.md regel 4)
    { buurtCode: "BU1", straat: "Teststraat", adresId: null, datum: "2026-06-10", prijs: 410000, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "seed" },
    { buurtCode: "BU1", straat: "Dwarsstraat", adresId: null, datum: "2026-05-20", prijs: 395000, oppervlakteM2: 95, woningtype: "tussenwoning", bron: "seed" },
    { buurtCode: "BU2", straat: "Beemdlaan", adresId: null, datum: "2026-04-01", prijs: 520000, oppervlakteM2: 130, woningtype: "vrijstaand", bron: "seed" },
    // kadaster-verkoop aan een niet-gesupprimeerd adres: blijft zichtbaar
    { buurtCode: "BU1", straat: "Teststraat", adresId: adresId("2"), datum: "2026-06-15", prijs: 425000, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "kadaster" },
    // kadaster-verkoop aan het gesupprimeerde adres: moet wegvallen
    { buurtCode: "BU1", straat: "Teststraat", adresId: adresId("6"), datum: "2026-06-20", prijs: 999999, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "kadaster" },
    // andere gemeente: hoort niet bij Testdorp
    { buurtCode: "BU3", straat: "Centrumstraat", adresId: null, datum: "2026-06-18", prijs: 300000, oppervlakteM2: 80, woningtype: "appartement", bron: "seed" },
  ]);

  const basisValuation = { intervalLaag: 380000, intervalHoog: 440000, confidence: "middel" as const, nComparables: 6, modelVersie: "test-1", inputsJson: "{}" };
  await db.insert(schema.valuations).values([
    // adres 1: twee schattingen; alleen de recentste mag terugkomen
    { ...basisValuation, adresId: adresId("1"), datum: "2026-06-01", waarde: 400000 },
    { ...basisValuation, adresId: adresId("1"), datum: "2026-07-01", waarde: 410000 },
    { ...basisValuation, adresId: adresId("2"), datum: "2026-06-15", waarde: 405000 },
    // opted_out en gesupprimeerd: mogen NOOIT terugkomen
    { ...basisValuation, adresId: adresId("5"), datum: "2026-07-01", waarde: 111111 },
    { ...basisValuation, adresId: adresId("6"), datum: "2026-07-01", waarde: 222222 },
  ]);

  await db.insert(schema.marketStats).values([
    { buurtCode: "BU1", maand: "2026-05", volume: 5, mediaanPrijs: 400000, bron: "seed" },
    { buurtCode: "BU1", maand: "2026-06", volume: 4, mediaanPrijs: 410000, bron: "seed" },
    { buurtCode: "BU2", maand: "2026-06", volume: 3, mediaanPrijs: 500000, bron: "seed" },
  ]);
});

describe("plaatsSlug", () => {
  it("maakt kebab-case van een gemeentenaam", () => {
    expect(wm.plaatsSlug("Den Bosch")).toBe("den-bosch");
    expect(wm.plaatsSlug("Eindhoven")).toBe("eindhoven");
  });

  it("verwerkt apostrofs en accenten", () => {
    expect(wm.plaatsSlug("'s-Hertogenbosch")).toBe("s-hertogenbosch");
    expect(wm.plaatsSlug("Súdwest-Fryslân")).toBe("sudwest-fryslan");
  });
});

describe("allePlaatsen", () => {
  it("geeft alle gemeenten met tellingen, gesorteerd op naam", async () => {
    const plaatsen = await wm.allePlaatsen();
    expect(plaatsen.map((p) => p.naam)).toEqual(["Anderstad", "Testdorp"]);

    const testdorp = plaatsen.find((p) => p.slug === "testdorp")!;
    expect(testdorp.aantalBuurten).toBe(2);
    // adressen 1, 2, 3 en 6 zijn actief; 5 is opted_out en telt niet mee
    expect(testdorp.aantalWoningen).toBe(4);
    expect(testdorp.gemWoz).toBe(350000); // gemiddelde van 300000 en 400000
  });

  it("laat gemWoz null wanneer geen enkele buurt een CBS-cijfer heeft", async () => {
    const plaatsen = await wm.allePlaatsen();
    const anderstad = plaatsen.find((p) => p.slug === "anderstad")!;
    expect(anderstad.gemWoz).toBeNull();
    expect(anderstad.aantalBuurten).toBe(1);
    expect(anderstad.aantalWoningen).toBe(1);
  });
});

describe("vindPlaats", () => {
  it("vindt een gemeente op slug, ongeacht hoofdletters", async () => {
    expect((await wm.vindPlaats("testdorp"))?.code).toBe("GM0001");
    expect((await wm.vindPlaats("TESTDORP"))?.code).toBe("GM0001");
  });

  it("geeft null bij een onbekende slug", async () => {
    expect(await wm.vindPlaats("bestaat-niet")).toBeNull();
  });
});

describe("plaatsKerncijfers", () => {
  it("telt woningen, buurten, gemiddelde WOZ en inwoners", async () => {
    const cijfers = await wm.plaatsKerncijfers("GM0001");
    expect(cijfers).toEqual({ aantalWoningen: 4, aantalBuurten: 2, gemWoz: 350000, inwoners: 3000 });
  });

  it("geeft null-cijfers zonder CBS-data", async () => {
    const cijfers = await wm.plaatsKerncijfers("GM0002");
    expect(cijfers.gemWoz).toBeNull();
    expect(cijfers.inwoners).toBeNull();
  });
});

describe("buurtenVanPlaats", () => {
  it("geeft de buurten van de gemeente met gemWoz en ankerM2Prijs, op naam", async () => {
    const buurten = await wm.buurtenVanPlaats("GM0001");
    expect(buurten.map((b) => b.naam)).toEqual(["Akkerwijk", "Beemdhof"]);
    expect(buurten[0]).toMatchObject({ buurtCode: "BU1", slug: "akkerwijk", gemWoz: 300000, ankerM2Prijs: 3000 });
    expect(buurten[1]).toMatchObject({ buurtCode: "BU2", gemWoz: 400000, ankerM2Prijs: null });
  });
});

describe("recenteVerkopenVanPlaats", () => {
  it("geeft alleen verkopen van de eigen gemeente, nieuwste eerst", async () => {
    const verkopen = await wm.recenteVerkopenVanPlaats("GM0001");
    expect(verkopen.length).toBe(4);
    expect(verkopen.every((v) => ["Akkerwijk", "Beemdhof"].includes(v.buurtNaam))).toBe(true);
    const datums = verkopen.map((v) => v.datum);
    expect([...datums].sort().reverse()).toEqual(datums);
  });

  it("invariant: seed-verkopen hebben nooit een adres_id", async () => {
    const verkopen = await wm.recenteVerkopenVanPlaats("GM0001");
    expect(verkopen.filter((v) => v.bron === "seed").every((v) => v.adresId === null)).toBe(true);
  });

  it("filtert kadaster-verkopen van gesupprimeerde adressen weg", async () => {
    const verkopen = await wm.recenteVerkopenVanPlaats("GM0001");
    // de verkoop van 999999 hangt aan het gesupprimeerde adres 6
    expect(verkopen.some((v) => v.prijs === 999999)).toBe(false);
    // de kadaster-verkoop aan het niet-gesupprimeerde adres 2 blijft staan
    expect(verkopen.some((v) => v.prijs === 425000 && v.bron === "kadaster")).toBe(true);
  });

  it("respecteert de limiet", async () => {
    const verkopen = await wm.recenteVerkopenVanPlaats("GM0001", 2);
    expect(verkopen.length).toBe(2);
    expect(verkopen[0].datum).toBe("2026-06-15"); // 2026-06-20 is gesupprimeerd
  });
});

describe("woningenMetWaarde", () => {
  it("geeft 1 rij per adres, met de recentste schatting", async () => {
    const woningen = await wm.woningenMetWaarde("GM0001");
    const nummers = woningen.map((w) => w.nummerslug);
    expect(new Set(nummers).size).toBe(nummers.length);
    const adres1 = woningen.find((w) => w.nummerslug === "1")!;
    expect(adres1.waarde).toBe(410000); // de rij van 2026-07-01, niet die van 2026-06-01
    expect(adres1.datum).toBe("2026-07-01");
    expect(adres1.intervalLaag).toBe(380000);
    expect(adres1.intervalHoog).toBe(440000);
  });

  it("sluit opted_out en gesupprimeerde adressen uit", async () => {
    const woningen = await wm.woningenMetWaarde("GM0001");
    expect(woningen.some((w) => w.nummerslug === "5")).toBe(false); // opted_out
    expect(woningen.some((w) => w.nummerslug === "6")).toBe(false); // bevestigde opt-out
    expect(woningen.some((w) => w.waarde === 111111 || w.waarde === 222222)).toBe(false);
  });

  it("geeft leeg voor een gemeente zonder schattingen", async () => {
    expect(await wm.woningenMetWaarde("GM0002")).toEqual([]);
  });
});

describe("marktcijfersVanPlaats", () => {
  it("sommeert de volumes van de recentste maand over de buurten", async () => {
    const cijfers = await wm.marktcijfersVanPlaats("GM0001");
    expect(cijfers).toEqual({ maand: "2026-06", volumeTotaal: 7, buurtenMetCijfers: 2, heeftSeed: true });
  });

  it("geeft null zonder marktcijfers", async () => {
    expect(await wm.marktcijfersVanPlaats("GM0002")).toBeNull();
  });
});
