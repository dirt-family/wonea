import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * Tests voor de buurtpagina-datalaag (lib/buurt-data.ts): vindBuurtMetGemeente,
 * kerncijfers (met het 12-maandenvenster en suppressie), woningen-in-buurt
 * (recentste schatting, suppressie), recente verkopen (invariant: seed nooit
 * met adres_id), vergelijkbare buurten (dichtstbijzijnde m2-prijs) en de
 * karakteristiek-zin (alleen uit data, anders null). Via de gedeelde
 * testdatabase (wonea_test), dynamische imports NA maakTestDb.
 */

let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let bd: typeof import("@/lib/buurt-data");

/** ISO-datum n maanden geleden, op de 15e (geen maandoverloop-randgevallen). */
function maandenGeledenIso(maanden: number): string {
  const d = new Date();
  d.setDate(15);
  d.setMonth(d.getMonth() - maanden);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  bd = await import("@/lib/buurt-data");

  await db.insert(schema.municipalities).values([
    { code: "GM0001", naam: "Testdorp", slug: "testdorp" },
    { code: "GM0002", naam: "Anderstad", slug: "anderstad" },
  ]);

  await db.insert(schema.neighborhoods).values([
    { buurtCode: "BU1", naam: "Akkerwijk", slug: "akkerwijk", gemeenteCode: "GM0001", gemWoz: 300000, ankerM2Prijs: 3000 },
    { buurtCode: "BU2", naam: "Beemdhof", slug: "beemdhof", gemeenteCode: "GM0001", ankerM2Prijs: 3400 },
    { buurtCode: "BU3", naam: "Ceintuur", slug: "ceintuur", gemeenteCode: "GM0001", ankerM2Prijs: 2500 },
    { buurtCode: "BU4", naam: "Duinzicht", slug: "duinzicht", gemeenteCode: "GM0001", ankerM2Prijs: 3100 },
    { buurtCode: "BU5", naam: "Esdoorn", slug: "esdoorn", gemeenteCode: "GM0001" }, // geen m2-prijs
    // andere gemeente, m2-prijs vlakbij BU1: mag NOOIT als vergelijkbare buurt opduiken
    { buurtCode: "BU9", naam: "Overkant", slug: "overkant", gemeenteCode: "GM0002", ankerM2Prijs: 3050 },
  ]);

  const basisAdres = {
    straat: "Teststraat",
    postcode: "1234AB",
    plaats: "Testdorp",
    buurtCode: "BU1",
    bouwjaar: 1930,
    oppervlakteM2: 100,
    woningtype: "tussenwoning" as const,
  };
  const adressen = await db
    .insert(schema.addresses)
    .values([
      // BU1: 4x tussenwoning + 1 appartement (dominant type 5/6 actief incl. nr 7)
      { ...basisAdres, huisnummer: 1, nummerslug: "1", bouwjaar: 1928, oppervlakteM2: 100, energielabel: "C", energielabelBron: "indicatie" as const },
      { ...basisAdres, huisnummer: 2, nummerslug: "2", bouwjaar: 1934, oppervlakteM2: 110, energielabel: "A", energielabelBron: "echt" as const },
      { ...basisAdres, huisnummer: 3, nummerslug: "3", bouwjaar: 1936, oppervlakteM2: 90 },
      { ...basisAdres, huisnummer: 4, nummerslug: "4", bouwjaar: 1930, oppervlakteM2: 120 },
      { ...basisAdres, huisnummer: 5, nummerslug: "5", bouwjaar: 1990, oppervlakteM2: 70, woningtype: "appartement" as const },
      // opted_out: telt nergens mee
      { ...basisAdres, huisnummer: 6, nummerslug: "6", bouwjaar: 1955, oppervlakteM2: 200, woningtype: "vrijstaand" as const, status: "opted_out" as const },
      // actief maar gesupprimeerd via een bevestigde opt-out (rij hieronder)
      { ...basisAdres, huisnummer: 7, nummerslug: "7", bouwjaar: 1926, oppervlakteM2: 100 },
      // BU2: te weinig adressen voor een karakteristiek
      { ...basisAdres, huisnummer: 8, nummerslug: "8", buurtCode: "BU2" },
      { ...basisAdres, huisnummer: 9, nummerslug: "9", buurtCode: "BU2" },
      // BU3: 6 adressen zonder dominant type (3 om 3)
      { ...basisAdres, huisnummer: 10, nummerslug: "10", buurtCode: "BU3" },
      { ...basisAdres, huisnummer: 11, nummerslug: "11", buurtCode: "BU3" },
      { ...basisAdres, huisnummer: 12, nummerslug: "12", buurtCode: "BU3" },
      { ...basisAdres, huisnummer: 13, nummerslug: "13", buurtCode: "BU3", woningtype: "appartement" as const },
      { ...basisAdres, huisnummer: 14, nummerslug: "14", buurtCode: "BU3", woningtype: "appartement" as const },
      { ...basisAdres, huisnummer: 15, nummerslug: "15", buurtCode: "BU3", woningtype: "appartement" as const },
    ])
    .returning({ id: schema.addresses.id, nummerslug: schema.addresses.nummerslug });
  const adresId = (slug: string) => adressen.find((a) => a.nummerslug === slug)!.id;

  await db.insert(schema.optouts).values({
    adresId: adresId("7"),
    postcode: "1234AB",
    nummerslug: "7",
    token: "test-token-7",
    aangevraagdAt: "2026-06-01T10:00:00.000Z",
    bevestigdAt: "2026-06-01T11:00:00.000Z",
  });

  await db.insert(schema.sales).values([
    // seed-verkopen: NOOIT een adres_id (CONTRACTS.md regel 4)
    { buurtCode: "BU1", straat: "Teststraat", adresId: null, datum: maandenGeledenIso(2), prijs: 410000, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "seed" },
    // ouder dan 12 maanden: telt niet mee in de kerncijfers, staat wel in de lijst
    { buurtCode: "BU1", straat: "Dwarsstraat", adresId: null, datum: maandenGeledenIso(13), prijs: 395000, oppervlakteM2: 95, woningtype: "tussenwoning", bron: "seed" },
    // kadaster-verkoop aan een niet-gesupprimeerd adres: blijft zichtbaar
    { buurtCode: "BU1", straat: "Teststraat", adresId: adresId("2"), datum: maandenGeledenIso(1), prijs: 425000, oppervlakteM2: 110, woningtype: "tussenwoning", bron: "kadaster" },
    // kadaster-verkoop aan het gesupprimeerde adres: moet overal wegvallen
    { buurtCode: "BU1", straat: "Teststraat", adresId: adresId("7"), datum: maandenGeledenIso(0), prijs: 999999, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "kadaster" },
    // andere buurt: hoort niet bij BU1
    { buurtCode: "BU2", straat: "Beemdlaan", adresId: null, datum: maandenGeledenIso(1), prijs: 520000, oppervlakteM2: 130, woningtype: "vrijstaand", bron: "seed" },
  ]);

  const basisValuation = { intervalLaag: 380000, intervalHoog: 440000, confidence: "middel" as const, nComparables: 6, modelVersie: "test-1", inputsJson: "{}" };
  await db.insert(schema.valuations).values([
    // adres 1: twee schattingen; alleen de recentste mag terugkomen
    { ...basisValuation, adresId: adresId("1"), datum: maandenGeledenIso(2), waarde: 400000 },
    { ...basisValuation, adresId: adresId("1"), datum: maandenGeledenIso(1), waarde: 410000 },
    { ...basisValuation, adresId: adresId("2"), datum: maandenGeledenIso(1), waarde: 405000 },
    // opted_out en gesupprimeerd: mogen NOOIT terugkomen
    { ...basisValuation, adresId: adresId("6"), datum: maandenGeledenIso(1), waarde: 111111 },
    { ...basisValuation, adresId: adresId("7"), datum: maandenGeledenIso(1), waarde: 222222 },
  ]);

  await db.insert(schema.marketStats).values([
    { buurtCode: "BU1", maand: "2026-01", mediaanPrijs: 400000, bron: "seed" },
    { buurtCode: "BU1", maand: "2026-02", mediaanPrijs: 405000, bron: "seed" },
    { buurtCode: "BU1", maand: "2026-03", mediaanPrijs: null, volume: 3, bron: "seed" }, // maand zonder mediaan
    { buurtCode: "BU1", maand: "2026-04", mediaanPrijs: 412000, bron: "seed" },
    // BU2: 1 maand is geen reeks
    { buurtCode: "BU2", maand: "2026-04", mediaanPrijs: 500000, bron: "seed" },
  ]);
});

describe("vindBuurtMetGemeente", () => {
  it("vindt gemeente + buurt op slugs, ongeacht hoofdletters", async () => {
    const data = await bd.vindBuurtMetGemeente("TESTDORP", "AKKERWIJK");
    expect(data?.gemeente.code).toBe("GM0001");
    expect(data?.buurt.buurtCode).toBe("BU1");
  });

  it("geeft null bij een onbekende gemeente of buurt, en bij een verkeerde combinatie", async () => {
    expect(await bd.vindBuurtMetGemeente("bestaat-niet", "akkerwijk")).toBeNull();
    expect(await bd.vindBuurtMetGemeente("testdorp", "bestaat-niet")).toBeNull();
    // "overkant" bestaat, maar in Anderstad
    expect(await bd.vindBuurtMetGemeente("testdorp", "overkant")).toBeNull();
  });
});

describe("buurtKerncijfers", () => {
  it("telt alleen actieve adressen", async () => {
    const cijfers = await bd.buurtKerncijfers("BU1");
    // adressen 1 t/m 5 en 7 zijn actief; 6 is opted_out
    expect(cijfers.aantalWoningen).toBe(6);
  });

  it("telt recente verkopen binnen 12 maanden, zonder gesupprimeerde rijen", async () => {
    const cijfers = await bd.buurtKerncijfers("BU1");
    // seed van 2 maanden geleden + kadaster aan adres 2; de rij van 13 maanden
    // geleden valt buiten het venster en de verkoop aan adres 7 is gesupprimeerd
    expect(cijfers.aantalRecenteVerkopen).toBe(2);
  });

  it("geeft nullen voor een lege buurt", async () => {
    expect(await bd.buurtKerncijfers("BU5")).toEqual({ aantalWoningen: 0, aantalRecenteVerkopen: 0 });
  });
});

describe("recenteVerkopenInBuurt", () => {
  it("geeft alleen verkopen van de eigen buurt, nieuwste eerst", async () => {
    const verkopen = await bd.recenteVerkopenInBuurt("BU1");
    expect(verkopen.length).toBe(3);
    const datums = verkopen.map((v) => v.datum);
    expect([...datums].sort().reverse()).toEqual(datums);
    expect(verkopen.some((v) => v.prijs === 520000)).toBe(false); // BU2
  });

  it("invariant: seed-verkopen hebben nooit een adres_id", async () => {
    const verkopen = await bd.recenteVerkopenInBuurt("BU1");
    expect(verkopen.filter((v) => v.bron === "seed").every((v) => v.adresId === null)).toBe(true);
  });

  it("filtert kadaster-verkopen van gesupprimeerde adressen weg", async () => {
    const verkopen = await bd.recenteVerkopenInBuurt("BU1");
    expect(verkopen.some((v) => v.prijs === 999999)).toBe(false);
    expect(verkopen.some((v) => v.prijs === 425000 && v.bron === "kadaster")).toBe(true);
  });

  it("respecteert de limiet, na suppressie-filtering", async () => {
    const verkopen = await bd.recenteVerkopenInBuurt("BU1", 1);
    expect(verkopen.length).toBe(1);
    expect(verkopen[0].prijs).toBe(425000); // de gesupprimeerde recentste (999999) telt niet
  });
});

describe("woningenInBuurt", () => {
  it("geeft 1 rij per adres met de recentste schatting en de adreskenmerken", async () => {
    const woningen = await bd.woningenInBuurt("BU1");
    const nummers = woningen.map((w) => w.nummerslug);
    expect(new Set(nummers).size).toBe(nummers.length);

    const adres1 = woningen.find((w) => w.nummerslug === "1")!;
    expect(adres1.waarde).toBe(410000); // recentste, niet 400000
    expect(adres1.energielabel).toBe("C");
    expect(adres1.energielabelBron).toBe("indicatie");
    expect(adres1.bouwjaar).toBe(1928);

    const adres2 = woningen.find((w) => w.nummerslug === "2")!;
    expect(adres2.energielabel).toBe("A");
    expect(adres2.energielabelBron).toBe("echt");
  });

  it("sluit opted_out en gesupprimeerde adressen uit", async () => {
    const woningen = await bd.woningenInBuurt("BU1");
    expect(woningen.some((w) => w.nummerslug === "6")).toBe(false); // opted_out
    expect(woningen.some((w) => w.nummerslug === "7")).toBe(false); // bevestigde opt-out
    expect(woningen.some((w) => w.waarde === 111111 || w.waarde === 222222)).toBe(false);
  });

  it("respecteert de limiet en geeft leeg zonder schattingen", async () => {
    expect((await bd.woningenInBuurt("BU1", 1)).length).toBe(1);
    expect(await bd.woningenInBuurt("BU2")).toEqual([]);
  });
});

describe("vergelijkbareBuurten", () => {
  it("kiest buurten uit dezelfde gemeente, gesorteerd op dichtstbijzijnde m2-prijs", async () => {
    const buren = await bd.vergelijkbareBuurten("BU1");
    // afstanden tot 3000: Duinzicht 100, Beemdhof 400, Ceintuur 500
    expect(buren.map((b) => b.naam)).toEqual(["Duinzicht", "Beemdhof", "Ceintuur"]);
    // Overkant (andere gemeente, afstand 50) en Esdoorn (geen m2-prijs) ontbreken
    expect(buren.some((b) => b.buurtCode === "BU9" || b.buurtCode === "BU5")).toBe(false);
    // en de buurt zelf ook
    expect(buren.some((b) => b.buurtCode === "BU1")).toBe(false);
  });

  it("berekent het procentuele verschil met de eigen buurt", async () => {
    const buren = await bd.vergelijkbareBuurten("BU1");
    expect(buren.find((b) => b.naam === "Duinzicht")!.verschilPct).toBeCloseTo(3.3, 5);
    expect(buren.find((b) => b.naam === "Ceintuur")!.verschilPct).toBeCloseTo(-16.7, 5);
  });

  it("respecteert de limiet", async () => {
    expect((await bd.vergelijkbareBuurten("BU1", 2)).length).toBe(2);
  });

  it("geeft leeg zonder eigen m2-prijs: dichtstbij is dan niet te bepalen", async () => {
    expect(await bd.vergelijkbareBuurten("BU5")).toEqual([]);
  });

  it("geeft leeg voor een onbekende buurt", async () => {
    expect(await bd.vergelijkbareBuurten("BESTAAT-NIET")).toEqual([]);
  });
});

describe("buurtKarakteristiek", () => {
  it("leidt de zin af uit dominant type, mediaan bouwjaar en gemiddelde oppervlakte", async () => {
    const zin = await bd.buurtKarakteristiek("BU1");
    // actieve adressen: 5x tussenwoning + 1 appartement; mediaan bouwjaar 1934
    // rondt naar 1930; gemiddelde oppervlakte (100+110+90+120+70+100)/6 = 98
    expect(zin).toBe("In ons bestand staan hier vooral tussenwoningen van rond 1930, gemiddeld 98 m2.");
  });

  it("telt opted_out adressen niet mee", async () => {
    const zin = await bd.buurtKarakteristiek("BU1");
    // adres 6 (vrijstaand, 200 m2) is opted_out; met die rij zou het gemiddelde
    // op 113 m2 uitkomen in plaats van 98
    expect(zin).not.toContain("113");
  });

  it("geeft null bij te weinig adressen", async () => {
    expect(await bd.buurtKarakteristiek("BU2")).toBeNull(); // 2 adressen
    expect(await bd.buurtKarakteristiek("BU5")).toBeNull(); // 0 adressen
  });

  it("geeft null zonder dominant woningtype", async () => {
    expect(await bd.buurtKarakteristiek("BU3")).toBeNull(); // 3 om 3
  });

  it("bevat geen em-dashes (CONTRACTS.md: komma's of dubbele punt)", async () => {
    const zin = await bd.buurtKarakteristiek("BU1");
    expect(zin).not.toMatch(/—/);
  });
});

describe("buurtPrijsontwikkeling", () => {
  it("geeft de maanden met een mediaan, in volgorde, met seed-vlag", async () => {
    const reeks = await bd.buurtPrijsontwikkeling("BU1");
    expect(reeks).not.toBeNull();
    expect(reeks!.punten).toEqual([
      { maand: "2026-01", mediaan: 400000 },
      { maand: "2026-02", mediaan: 405000 },
      { maand: "2026-04", mediaan: 412000 }, // 2026-03 heeft geen mediaan
    ]);
    expect(reeks!.heeftSeed).toBe(true);
  });

  it("geeft null bij minder dan 2 punten: dat is geen reeks", async () => {
    expect(await bd.buurtPrijsontwikkeling("BU2")).toBeNull(); // 1 maand
    expect(await bd.buurtPrijsontwikkeling("BU3")).toBeNull(); // geen cijfers
  });
});
