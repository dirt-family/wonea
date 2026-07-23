import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * Indexatie-gating (Fase 5): whitelist, datadiepte, suppressie-wint en de
 * sitemap-opbouw tegen een echte testdatabase.
 */

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let gating: typeof import("@/lib/seo/gating");
let sitemap: typeof import("@/lib/seo/sitemap");

type AdresRij = typeof import("@/db/schema").addresses.$inferSelect;

// a1: 3 comps, verder niets. a2: geen diepte (alleen seed-WOZ). a3: eigenaar-
// WOZ. a4: echt energielabel. a5: 3 comps maar bevestigde opt-out. a6: 3 comps
// in een buurt zonder whitelist (later via postcode4 vrijgegeven). a7: status
// opted_out.
let a1: AdresRij, a2: AdresRij, a3: AdresRij, a4: AdresRij, a5: AdresRij, a6: AdresRij, a7: AdresRij;

function isoMaandenGeleden(maanden: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - maanden);
  return d.toISOString().slice(0, 10);
}

const valuationDatum = isoMaandenGeleden(1);

async function maakAdres(overrides: Partial<typeof schema.addresses.$inferInsert> & { nummerslug: string }): Promise<AdresRij> {
  return (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Teststraat",
        huisnummer: Number(overrides.nummerslug.replace(/[^0-9]/g, "")) || 1,
        toevoeging: null,
        postcode: "5611AB",
        plaats: "Test",
        buurtCode: "BU00000001",
        bouwjaar: 1990,
        oppervlakteM2: 100,
        woningtype: "tussenwoning",
        energielabel: "C",
        energielabelBron: "indicatie",
        bron: "seed",
        status: "actief",
        ...overrides,
      })
      .returning()
  )[0];
}

beforeAll(async () => {
  await maakTestDb();
  // Pin de basis-URL zodat de absolute-URL-asserties hieronder stabiel zijn.
  process.env.WONEA_BASE_URL = "http://localhost:4123";
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  gating = await import("@/lib/seo/gating");
  sitemap = await import("@/lib/seo/sitemap");

  await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU00000001", naam: "Whitelistbuurt", slug: "whitelistbuurt", gemeenteCode: "GM0000" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU00000002", naam: "Andere buurt", slug: "andere-buurt", gemeenteCode: "GM0000" });

  a1 = await maakAdres({ nummerslug: "1" });
  a2 = await maakAdres({ nummerslug: "3", woningtype: "vrijstaand", oppervlakteM2: 160 });
  a3 = await maakAdres({ nummerslug: "5", woningtype: "vrijstaand", oppervlakteM2: 160 });
  a4 = await maakAdres({ nummerslug: "7", woningtype: "vrijstaand", oppervlakteM2: 160, energielabel: "A", energielabelBron: "echt" });
  a5 = await maakAdres({ nummerslug: "9" });
  a6 = await maakAdres({ nummerslug: "2", postcode: "5622XX", buurtCode: "BU00000002" });
  a7 = await maakAdres({ nummerslug: "11", status: "opted_out" });

  // 3 recente verkopen per buurt die matchen op woningtype tussenwoning en
  // oppervlakteklasse (0,7x-1,4x van 100 m2): comps voor a1, a5, a6 en a7.
  for (const [buurtCode, straat] of [
    ["BU00000001", "Teststraat"],
    ["BU00000002", "Anderestraat"],
  ] as const) {
    for (let i = 0; i < 3; i++) {
      await db
        .insert(schema.sales)
        .values({ buurtCode, straat, adresId: null, datum: isoMaandenGeleden(i + 1), prijs: 400000 + i * 10000, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "seed" });
    }
  }

  // Seed-WOZ telt NIET als datadiepte (a2); eigenaar-WOZ wel (a3).
  await db.insert(schema.wozValues).values({ adresId: a2.id, peiljaar: 2025, waarde: 380000, bron: "seed" });
  await db.insert(schema.wozValues).values({ adresId: a3.id, peiljaar: 2025, waarde: 410000, bron: "eigenaar" });

  // Valuation voor a1: bepaalt de lastmod in de sitemap-shard.
  await db
    .insert(schema.valuations)
    .values({ adresId: a1.id, datum: valuationDatum, waarde: 420000, intervalLaag: 400000, intervalHoog: 440000, confidence: "middel", nComparables: 3, modelVersie: "test", inputsJson: "{}" });

  // Bevestigde opt-out voor a5: suppressie wint altijd.
  await db
    .insert(schema.optouts)
    .values({ adresId: a5.id, postcode: a5.postcode, nummerslug: a5.nummerslug, token: "optout-a5", aangevraagdAt: "2026-07-01", bevestigdAt: "2026-07-02" });
});

describe("default: alles noindex (lege whitelist)", () => {
  it("laat zonder whitelist niets indexeren, hoeveel comparables er ook zijn", async () => {
    expect(await gating.isAdresIndexeerbaar(a1, { nComparables: 10 })).toBe(false);
    expect(await gating.isBuurtIndexeerbaar("BU00000001")).toBe(false);
  });

  it("telt 0 indexeerbare adressen en zet geen adres-shard in de sitemap-index", async () => {
    expect(await sitemap.telIndexeerbareAdressen()).toBe(0);
    const index = await sitemap.bouwSitemapIndexXml();
    expect(index).toContain("/sitemaps/statisch.xml");
    expect(index).not.toContain("adressen-");
  });
});

describe("niveau 1 (gebiedswhitelist) + niveau 2 (datadiepte)", () => {
  it("maakt een buurt indexeerbaar via allow", async () => {
    await gating.setGating("buurt", "BU00000001", true, "testcase");
    expect(await gating.isBuurtIndexeerbaar("BU00000001")).toBe(true);
    expect(await gating.isBuurtIndexeerbaar("BU00000002")).toBe(false);
  });

  it("indexeert bij 3 comparables, niet bij 2 (drempel)", async () => {
    expect(await gating.isAdresIndexeerbaar(a1, { nComparables: 3 })).toBe(true);
    expect(await gating.isAdresIndexeerbaar(a1, { nComparables: 2 })).toBe(false);
    expect(await gating.isAdresIndexeerbaar(a1, { nComparables: 0 })).toBe(false);
  });

  it("telt seed-WOZ en indicatie-label niet als datadiepte", async () => {
    expect(await gating.isAdresIndexeerbaar(a2, { nComparables: 0 })).toBe(false);
  });

  it("indexeert op eigenaar-WOZ zonder comparables", async () => {
    expect(await gating.isAdresIndexeerbaar(a3, { nComparables: 0 })).toBe(true);
  });

  it("indexeert op echt energielabel zonder comparables", async () => {
    expect(await gating.isAdresIndexeerbaar(a4, { nComparables: 0 })).toBe(true);
  });

  it("blokkeert een adres buiten elk gewhitelist gebied, ook met genoeg comparables", async () => {
    expect(await gating.isAdresIndexeerbaar(a6, { nComparables: 3 })).toBe(false);
  });

  it("maakt een gebied ook via postcode4 indexeerbaar", async () => {
    await gating.setGating("postcode4", "5622", true, "testcase pc4");
    expect(await gating.isAdresIndexeerbaar(a6, { nComparables: 3 })).toBe(true);
  });
});

describe("suppressie wint altijd", () => {
  it("blokkeert een bevestigde opt-out ondanks whitelist en comparables", async () => {
    expect(await gating.isAdresIndexeerbaar(a5, { nComparables: 3 })).toBe(false);
  });

  it("blokkeert status opted_out ondanks whitelist en comparables", async () => {
    expect(await gating.isAdresIndexeerbaar(a7, { nComparables: 3 })).toBe(false);
  });
});

describe("sitemaps", () => {
  it("telt precies de adressen die door de volledige gating komen", async () => {
    // a1 (comps), a3 (eigenaar-WOZ), a4 (echt label), a6 (pc4-whitelist +
    // comps). NIET a2 (geen diepte), a5 (opt-out), a7 (opted_out).
    expect(await sitemap.telIndexeerbareAdressen()).toBe(4);
  });

  it("somt statisch- en adres-shards op in de sitemap-index", async () => {
    const index = await sitemap.bouwSitemapIndexXml();
    expect(index).toContain("/sitemaps/statisch.xml");
    expect(index).toContain("/sitemaps/adressen-1.xml");
  });

  it("zet whitelisted adressen met datadiepte in de adres-shard", async () => {
    const shard = await sitemap.bouwAdressenShardXml(1);
    expect(shard).toContain("/woning/5611AB/1");
    expect(shard).toContain("/woning/5611AB/5");
    expect(shard).toContain("/woning/5611AB/7");
    expect(shard).toContain("/woning/5622XX/2");
    expect(shard).not.toContain("/woning/5611AB/3"); // geen datadiepte
  });

  it("gebruikt de laatste valuation als lastmod, anders vandaag", async () => {
    const shard = await sitemap.bouwAdressenShardXml(1);
    const vandaag = new Date().toISOString().slice(0, 10);
    expect(shard).toContain(`<loc>http://localhost:4123/woning/5611AB/1</loc><lastmod>${valuationDatum}</lastmod>`);
    expect(shard).toContain(`<loc>http://localhost:4123/woning/5611AB/5</loc><lastmod>${vandaag}</lastmod>`);
  });

  it("zet een opted-out adres in GEEN enkele sitemap", async () => {
    const alles = [await sitemap.bouwSitemapIndexXml(), sitemap.bouwStatischeShardXml(), await sitemap.bouwAdressenShardXml(1)].join("\n");
    expect(alles).not.toContain("/woning/5611AB/9"); // bevestigde opt-out
    expect(alles).not.toContain("/woning/5611AB/11"); // status opted_out
  });

  it("bevat de vaste pagina's in de statische shard", () => {
    const statisch = sitemap.bouwStatischeShardXml();
    for (const pad of ["http://localhost:4123/", "/methode", "/over-ons", "/woz-check", "/privacy"]) {
      expect(statisch).toContain(pad);
    }
    expect(statisch).not.toContain("/woning/");
  });

  it("berekent shardnummers correct rond de maximumgrootte", () => {
    expect(sitemap.shardIndexen(0)).toEqual([]);
    expect(sitemap.shardIndexen(1)).toEqual([1]);
    expect(sitemap.shardIndexen(45000)).toEqual([1]);
    expect(sitemap.shardIndexen(45001)).toEqual([1, 2]);
    expect(sitemap.shardIndexen(5, 2)).toEqual([1, 2, 3]);
  });

  it("verdeelt adressen over shards zonder overlap (kleine shardgrootte)", async () => {
    const shard1 = await sitemap.bouwAdressenShardXml(1, 3);
    const shard2 = await sitemap.bouwAdressenShardXml(2, 3);
    const urls1 = shard1.match(/<loc>[^<]+<\/loc>/g) ?? [];
    const urls2 = shard2.match(/<loc>[^<]+<\/loc>/g) ?? [];
    expect(urls1).toHaveLength(3);
    expect(urls2).toHaveLength(1);
    for (const url of urls2) expect(urls1).not.toContain(url);
  });
});

describe("whitelist-beheer (CLI-kern)", () => {
  it("parset een zoekvraag-CSV met inclusieve drempel en slaat rommel over", () => {
    const csv = ["scope,code,zoekvolume", "buurt,BU00000009,15", "postcode4,5611,10", "buurt,BU00000008,9", "onzin,XX,5", "buurt,kapot"].join("\n");
    const { rijen, overgeslagen } = gating.parseZoekvraagCsv(csv, 10);
    expect(rijen).toEqual([
      { scope: "buurt", code: "BU00000009", zoekvolume: 15, indexeerbaar: true },
      { scope: "postcode4", code: "5611", zoekvolume: 10, indexeerbaar: true },
      { scope: "buurt", code: "BU00000008", zoekvolume: 9, indexeerbaar: false },
    ]);
    expect(overgeslagen).toHaveLength(2);
  });

  it("sluit een gebied weer uit via disallow en de sitemap volgt", async () => {
    await gating.setGating("postcode4", "5622", false, "weer dicht");
    expect(await gating.isAdresIndexeerbaar(a6, { nComparables: 3 })).toBe(false);
    expect(await sitemap.telIndexeerbareAdressen()).toBe(3);
    expect(await sitemap.bouwAdressenShardXml(1)).not.toContain("/woning/5622XX/2");
    const rijen = await gating.listGating();
    expect(rijen.find((r) => r.scope === "postcode4" && r.code === "5622")?.indexeerbaar).toBe(false);
  });
});
