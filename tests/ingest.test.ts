import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";
// Pure modules (geen lib/db-import): veilig om statisch te importeren.
import {
  combineerToevoeging,
  energielabelIndicatie,
  mapVerblijfsobject,
  telVbosPerPand,
  woningtypeHeuristiek,
  type BagFeature,
} from "@/lib/ingest/bag";
import { mapKwbBuurt, wozNaarEuro } from "@/lib/ingest/cbs";
import { koppeltabelKey, modaleBuurtPerPostcode4, parseKoppeltabelCsv, parseKoppeltabelRegel } from "@/lib/ingest/koppeltabel";
import { capFeatures } from "@/lib/ingest/snapshot";

function bagFeature(overrides?: {
  properties?: Partial<BagFeature["properties"]>;
  geometry?: BagFeature["geometry"];
}): BagFeature {
  return {
    geometry: overrides?.geometry !== undefined ? overrides.geometry : { type: "Point", coordinates: [5.478, 51.44] },
    properties: {
      identificatie: "0772010000000001",
      oppervlakte: 95,
      status: "Verblijfsobject in gebruik",
      gebruiksdoel: "woonfunctie",
      openbare_ruimte: "Kleine Berg",
      huisnummer: 12,
      huisletter: "",
      toevoeging: "",
      postcode: "5611JV",
      woonplaats: "Eindhoven",
      bouwjaar: 1962,
      pandidentificatie: "0772100000000001",
      pandstatus: "Pand in gebruik",
      ...overrides?.properties,
    },
  };
}

describe("BAG-mapper: verblijfsobject naar adresrij", () => {
  it("mapt een woonfunctie-verblijfsobject volledig", () => {
    const rij = mapVerblijfsobject(bagFeature({ properties: { huisletter: "A" } }), 1);
    expect(rij).not.toBeNull();
    expect(rij!.bagId).toBe("0772010000000001");
    expect(rij!.straat).toBe("Kleine Berg");
    expect(rij!.huisnummer).toBe(12);
    expect(rij!.toevoeging).toBe("A");
    expect(rij!.nummerslug).toBe("12a");
    expect(rij!.postcode).toBe("5611JV");
    expect(rij!.plaats).toBe("Eindhoven");
    expect(rij!.bouwjaar).toBe(1962);
    expect(rij!.oppervlakteM2).toBe(95);
    expect(rij!.woningtype).toBe("tussenwoning");
    // GeoJSON is [lon, lat]: lat/lon niet verwisselen.
    expect(rij!.lat).toBeCloseTo(51.44);
    expect(rij!.lon).toBeCloseTo(5.478);
    expect(["D", "E"]).toContain(rij!.energielabel); // bouwjaarklasse 1960-1979
  });

  it("slaat niet-woningen en onbruikbare rijen over", () => {
    expect(mapVerblijfsobject(bagFeature({ properties: { gebruiksdoel: "kantoorfunctie" } }), 1)).toBeNull();
    expect(mapVerblijfsobject(bagFeature({ properties: { status: "Verblijfsobject ingetrokken" } }), 1)).toBeNull();
    expect(mapVerblijfsobject(bagFeature({ properties: { postcode: "" } }), 1)).toBeNull();
    expect(mapVerblijfsobject(bagFeature({ properties: { oppervlakte: 1 } }), 1)).toBeNull(); // BAG-placeholder
    expect(mapVerblijfsobject(bagFeature({ properties: { oppervlakte: 999999 } }), 1)).toBeNull();
    expect(mapVerblijfsobject(bagFeature({ properties: { bouwjaar: null } }), 1)).toBeNull();
  });

  it("accepteert een gemengd gebruiksdoel met woonfunctie en mist geometrie netjes", () => {
    const rij = mapVerblijfsobject(bagFeature({ properties: { gebruiksdoel: "woonfunctie, winkelfunctie" }, geometry: null }), 1);
    expect(rij).not.toBeNull();
    expect(rij!.lat).toBeNull();
    expect(rij!.lon).toBeNull();
  });

  it("combineert huisletter en toevoeging tot een nummerslug", () => {
    expect(combineerToevoeging("", "")).toBeNull();
    expect(combineerToevoeging("A", "")).toBe("A");
    expect(combineerToevoeging("", "2")).toBe("2");
    expect(combineerToevoeging("A", "2")).toBe("A2");
    const rij = mapVerblijfsobject(bagFeature({ properties: { huisletter: "", toevoeging: "2" } }), 1);
    expect(rij!.nummerslug).toBe("12-2");
  });
});

describe("woningtype-heuristiek", () => {
  it("meerdere verblijfsobjecten in een pand = appartement", () => {
    expect(woningtypeHeuristiek(95, 5)).toBe("appartement");
    expect(woningtypeHeuristiek(200, 2)).toBe("appartement");
  });

  it("verdeelt op oppervlakte bij een eigen pand", () => {
    expect(woningtypeHeuristiek(200, 1)).toBe("vrijstaand");
    expect(woningtypeHeuristiek(160, 1)).toBe("vrijstaand");
    expect(woningtypeHeuristiek(159, 1)).toBe("twee-onder-een-kap");
    expect(woningtypeHeuristiek(120, 1)).toBe("twee-onder-een-kap");
    expect(woningtypeHeuristiek(119, 1)).toBe("tussenwoning");
    expect(woningtypeHeuristiek(45, 1)).toBe("tussenwoning");
  });

  it("telt verblijfsobjecten per pand", () => {
    const telling = telVbosPerPand([
      bagFeature(),
      bagFeature({ properties: { identificatie: "x2" } }),
      bagFeature({ properties: { identificatie: "x3", pandidentificatie: "ander-pand" } }),
    ]);
    expect(telling.get("0772100000000001")).toBe(2);
    expect(telling.get("ander-pand")).toBe(1);
  });
});

describe("energielabel-indicatie (zelfde bouwjaarklassen als de seed-generator)", () => {
  it("is deterministisch per BAG-id (idempotentie-eis)", () => {
    expect(energielabelIndicatie(1962, "abc")).toBe(energielabelIndicatie(1962, "abc"));
    expect(energielabelIndicatie(2020, "0772010000000001")).toBe(energielabelIndicatie(2020, "0772010000000001"));
  });

  it("volgt de bouwjaarklassen", () => {
    expect(["A", "B"]).toContain(energielabelIndicatie(2020, "id1"));
    expect(["B", "C"]).toContain(energielabelIndicatie(2005, "id2"));
    expect(["C", "D"]).toContain(energielabelIndicatie(1985, "id3"));
    expect(["D", "E"]).toContain(energielabelIndicatie(1965, "id4"));
    expect(["E", "F"]).toContain(energielabelIndicatie(1935, "id5"));
    expect(["F", "G"]).toContain(energielabelIndicatie(1900, "id6"));
  });
});

describe("CBS-mapper", () => {
  it("mapt een KWB-rij en trimt gepadde codes", () => {
    const buurt = mapKwbBuurt(
      { Key: "BU07721110", Title: "Binnenstad  " },
      { WijkenEnBuurten: "BU07721110", AantalInwoners_5: 4000, GemiddeldeWOZWaardeVanWoningen_39: 372 },
    );
    expect(buurt).toEqual({ buurtCode: "BU07721110", naam: "Binnenstad", gemWoz: 372000, inwoners: 4000 });
  });

  it("houdt ontbrekende cijfers null (WOZ staat in duizenden euro's)", () => {
    expect(wozNaarEuro(398)).toBe(398000);
    expect(wozNaarEuro(null)).toBeNull();
    const buurt = mapKwbBuurt({ Key: "BU07721120", Title: "Bergen" }, undefined);
    expect(buurt.gemWoz).toBeNull();
    expect(buurt.inwoners).toBeNull();
  });
});

describe("buurt-koppeling", () => {
  it("parseert koppeltabel-regels (inclusief alfanumerieke buurtcodes)", () => {
    expect(parseKoppeltabelRegel("5611AA;1;07721110;077211;0772")).toEqual({ postcode: "5611AA", huisnummer: 1, buurtCode: "BU07721110" });
    expect(parseKoppeltabelRegel("1011AB;99;0363AF01;0363AF;0363")).toEqual({ postcode: "1011AB", huisnummer: 99, buurtCode: "BU0363AF01" });
    expect(parseKoppeltabelRegel("PC6;Huisnummer;Buurt2025;Wijk2025;Gemeente2025")).toBeNull();
    expect(parseKoppeltabelRegel("")).toBeNull();
  });

  it("filtert de csv op postcode4", () => {
    const csv = ["PC6;Huisnummer;Buurt2025;Wijk2025;Gemeente2025", "5611AA;1;07721110;077211;0772", "1011AB;99;0363AF01;0363AF;0363"].join("\n");
    const map = parseKoppeltabelCsv(csv, new Set(["5611"]));
    expect(map.size).toBe(1);
    expect(map.get(koppeltabelKey("5611AA", 1))).toBe("BU07721110");
  });

  it("fallback: modale buurt per postcode4, deterministisch bij gelijke stand", () => {
    const map = modaleBuurtPerPostcode4([
      { postcode: "5611AA", buurtCode: "BU1" },
      { postcode: "5611AB", buurtCode: "BU1" },
      { postcode: "5611AC", buurtCode: "BU2" },
      { postcode: "5612AA", buurtCode: "BU3" },
      { postcode: "5613AA", buurtCode: "BU9" },
      { postcode: "5613AB", buurtCode: "BU4" }, // gelijke stand: laagste code wint
    ]);
    expect(map.get("5611")).toBe("BU1");
    expect(map.get("5612")).toBe("BU3");
    expect(map.get("5613")).toBe("BU4");
    expect(map.get("9999")).toBeUndefined();
  });
});

describe("snapshot-cap", () => {
  it("capt een featurelijst op bytes en blijft deterministisch", () => {
    const features = Array.from({ length: 100 }, (_, i) => ({ i, vulling: "x".repeat(100) }));
    const gecapt = capFeatures(features, 2000);
    expect(gecapt.length).toBeLessThan(features.length);
    expect(gecapt.length).toBeGreaterThan(0);
    expect(JSON.stringify(gecapt).length).toBeLessThanOrEqual(2400); // cap is een nette benadering
    expect(gecapt[0]).toEqual(features[0]);
    expect(capFeatures(features, 2000)).toEqual(gecapt);
  });
});

describe("upsert respecteert de suppressielijst (harde regel)", () => {
  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/db/schema");
  let upsert: typeof import("@/lib/ingest/upsert");
  let adresId: number;

  const rij = () => ({
    bagId: "0772010000000009",
    straat: "Teststraat",
    huisnummer: 12,
    toevoeging: null,
    nummerslug: "12",
    postcode: "5611AB",
    plaats: "Eindhoven",
    lat: null,
    lon: null,
    bouwjaar: 1990,
    oppervlakteM2: 100,
    woningtype: "tussenwoning" as const,
    energielabel: "C",
  });

  beforeAll(async () => {
    await maakTestDb();
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    upsert = await import("@/lib/ingest/upsert");

    await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
    await db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000", gemWoz: 400000 });
  });

  it("voegt een nieuw adres toe en is daarna idempotent", async () => {
    expect(await upsert.upsertAdres(rij(), "BU1")).toBe("toegevoegd");
    expect(await upsert.upsertAdres(rij(), "BU1")).toBe("bestond_al");
    const alle = await db.select().from(schema.addresses);
    expect(alle.length).toBe(1);
    expect(alle[0].bron).toBe("bag");
    adresId = alle[0].id;
  });

  it("slaat een adres met bevestigde opt-out over (suppressielijst wint altijd)", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .insert(schema.optouts)
      .values({ adresId, postcode: "5611AB", nummerslug: "12", token: "t1", aangevraagdAt: "2026-07-22", bevestigdAt: "2026-07-22T12:00:00Z" });
    await db.update(schema.addresses).set({ status: "opted_out" }).where(eq(schema.addresses.id, adresId));

    expect(await upsert.upsertAdres(rij(), "BU1")).toBe("onderdrukt");

    // Her-ingest zet het adres nooit terug op actief.
    const adres = (await db.select().from(schema.addresses).where(eq(schema.addresses.id, adresId)).limit(1))[0];
    expect(adres!.status).toBe("opted_out");
  });

  it("een onbevestigde opt-out onderdrukt niet", async () => {
    const nieuweRij = { ...rij(), bagId: "x", huisnummer: 14, nummerslug: "14", postcode: "5611AB" };
    await db.insert(schema.optouts).values({ adresId, postcode: "5611AB", nummerslug: "14", token: "t2", aangevraagdAt: "2026-07-22" });
    expect(await upsert.upsertAdres(nieuweRij, "BU1")).toBe("toegevoegd");
  });

  it("kiest botsingsvrije buurt-slugs en werkt buurten idempotent bij", async () => {
    // Zelfde naam als bestaande buurt in dezelfde gemeente: suffix uit de code.
    expect(await upsert.upsertBuurt("GM0000", { buurtCode: "BU07720099", naam: "Testbuurt", gemWoz: 300000, inwoners: 100 })).toBe("toegevoegd");
    const nieuwe = (await db.select().from(schema.neighborhoods)).find((b) => b.buurtCode === "BU07720099");
    expect(nieuwe!.slug).toBe("testbuurt-0099");
    // Tweede run: bijgewerkt, slug blijft staan, null overschrijft niets.
    expect(await upsert.upsertBuurt("GM0000", { buurtCode: "BU07720099", naam: "Testbuurt", gemWoz: null, inwoners: null })).toBe("bijgewerkt");
    const na = (await db.select().from(schema.neighborhoods)).find((b) => b.buurtCode === "BU07720099");
    expect(na!.slug).toBe("testbuurt-0099");
    expect(na!.gemWoz).toBe(300000);
  });

  it("herberekent buurt-ankers uit eigen adresrijen (afgeleide)", async () => {
    await upsert.herberekenBuurtAnkers(["BU1"]);
    const buurt = (await db.select().from(schema.neighborhoods)).find((b) => b.buurtCode === "BU1");
    expect(buurt!.gemOppervlakte).toBe(100); // 2 adressen van 100 m2
    expect(buurt!.ankerM2Prijs).toBeCloseTo(400000 / 100);
  });
});
