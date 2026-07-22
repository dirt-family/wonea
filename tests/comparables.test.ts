import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let comparables: typeof import("@/lib/comparables");

function maandenGeleden(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  comparables = await import("@/lib/comparables");

  db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" }).run();
  db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" }).run();

  const rows: Array<{ straat: string; maanden: number; opp: number; type: "tussenwoning" | "appartement"; prijs: number }> = [
    // 6 passende verkopen in de doelstraat, recent
    ...Array.from({ length: 6 }, (_, i) => ({ straat: "Doelstraat", maanden: i + 1, opp: 100, type: "tussenwoning" as const, prijs: 400000 })),
    // 4 in een andere straat, zelfde buurt
    ...Array.from({ length: 4 }, (_, i) => ({ straat: "Anderestraat", maanden: i + 2, opp: 105, type: "tussenwoning" as const, prijs: 410000 })),
    // buiten het 24-maandenvenster
    { straat: "Doelstraat", maanden: 30, opp: 100, type: "tussenwoning", prijs: 350000 },
    // verkeerd type
    { straat: "Doelstraat", maanden: 3, opp: 100, type: "appartement", prijs: 300000 },
    // buiten de oppervlakteklasse (0,7x-1,4x van 100)
    { straat: "Doelstraat", maanden: 3, opp: 250, type: "tussenwoning", prijs: 900000 },
  ];
  for (const r of rows) {
    db.insert(schema.sales)
      .values({ buurtCode: "BU1", straat: r.straat, adresId: null, datum: maandenGeleden(r.maanden), prijs: r.prijs, oppervlakteM2: r.opp, woningtype: r.type, bron: "seed" })
      .run();
  }
});

describe("comparables-selectie", () => {
  const doel = { buurtCode: "BU1", straat: "Doelstraat", woningtype: "tussenwoning" as const, oppervlakteM2: 100 };

  it("kiest straatniveau bij 5 of meer passende verkopen in de straat", () => {
    const r = comparables.findComparables(doel);
    expect(r.niveau).toBe("straat");
    expect(r.comparables).toHaveLength(6);
    expect(r.comparables.every((c) => c.straat === "Doelstraat")).toBe(true);
  });

  it("filtert venster, type en oppervlakteklasse", () => {
    const r = comparables.findComparables(doel);
    expect(r.comparables.every((c) => c.woningtype === "tussenwoning")).toBe(true);
    expect(r.comparables.every((c) => c.oppervlakteM2 >= 70 && c.oppervlakteM2 <= 140)).toBe(true);
    expect(r.comparables.every((c) => c.prijs !== 350000)).toBe(true); // de oude verkoop
  });

  it("valt terug op buurtniveau bij te weinig straat-verkopen", () => {
    const r = comparables.findComparables({ ...doel, straat: "Legestraat" });
    expect(r.niveau).toBe("buurt");
    expect(r.comparables.length).toBeGreaterThanOrEqual(10);
  });
});
