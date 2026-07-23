import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * Woningpagina v2 (module-opbouw uit docs/PROTOTYPE-OOGST.md): de pure
 * rekenhelpers (jaarontwikkeling, WOZ-reeks, WOZ-versus-buurt) en de
 * adres-query met suppressie. Kern: een opted-out of gesupprimeerd adres
 * geeft null, dus de pagina blijft daar een 404.
 */

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let woning: typeof import("@/components/woning/data");

type AdresRij = typeof import("@/db/schema").addresses.$inferSelect;

let actief: AdresRij, gesupprimeerd: AdresRij, onbevestigd: AdresRij;

async function maakAdres(overrides: Partial<typeof schema.addresses.$inferInsert> & { nummerslug: string }): Promise<AdresRij> {
  return (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Modulestraat",
        huisnummer: Number(overrides.nummerslug.replace(/[^0-9]/g, "")) || 1,
        toevoeging: null,
        postcode: "5611AB",
        plaats: "Eindhoven",
        buurtCode: "BU00000101",
        bouwjaar: 1975,
        oppervlakteM2: 100,
        woningtype: "tussenwoning",
        energielabel: "D",
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
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  woning = await import("@/components/woning/data");

  await db.insert(schema.municipalities).values({ code: "GM0772", naam: "Eindhoven", slug: "eindhoven" });
  await db
    .insert(schema.neighborhoods)
    .values({ buurtCode: "BU00000101", naam: "Modulebuurt", slug: "modulebuurt", gemeenteCode: "GM0772", gemWoz: 380000, gemOppervlakte: 100, ankerM2Prijs: 3800 });

  actief = await maakAdres({ nummerslug: "1" });
  await maakAdres({ nummerslug: "3", status: "opted_out" });
  gesupprimeerd = await maakAdres({ nummerslug: "5" });
  onbevestigd = await maakAdres({ nummerslug: "7" });

  // Bevestigde opt-out: suppressie is leidend, ook al staat het adres op actief.
  await db.insert(schema.optouts).values({
    adresId: gesupprimeerd.id,
    postcode: gesupprimeerd.postcode,
    nummerslug: gesupprimeerd.nummerslug,
    token: "optout-bevestigd",
    aangevraagdAt: "2026-07-01",
    bevestigdAt: "2026-07-02",
  });
  // Onbevestigde aanvraag supprimeert nog NIET (pas na de bevestigingsstap).
  await db.insert(schema.optouts).values({
    adresId: onbevestigd.id,
    postcode: onbevestigd.postcode,
    nummerslug: onbevestigd.nummerslug,
    token: "optout-onbevestigd",
    aangevraagdAt: "2026-07-01",
    bevestigdAt: null,
  });
});

describe("vindWoningAdres: suppressie is leidend (404 blijft 404)", () => {
  it("vindt een actief adres, ook met spaties en kleine letters in de postcode", async () => {
    const gevonden = await woning.vindWoningAdres({ postcode: "5611 ab", nummerslug: "1" });
    expect(gevonden?.id).toBe(actief.id);
  });

  it("geeft null voor een adres met status opted_out", async () => {
    expect(await woning.vindWoningAdres({ postcode: "5611AB", nummerslug: "3" })).toBeNull();
  });

  it("geeft null voor een adres met een bevestigde opt-out", async () => {
    expect(await woning.vindWoningAdres({ postcode: "5611AB", nummerslug: "5" })).toBeNull();
  });

  it("laat een adres met alleen een ONbevestigde aanvraag gewoon zien", async () => {
    const gevonden = await woning.vindWoningAdres({ postcode: "5611AB", nummerslug: "7" });
    expect(gevonden?.id).toBe(onbevestigd.id);
  });

  it("geeft null bij een ongeldige postcode", async () => {
    expect(await woning.vindWoningAdres({ postcode: "abc", nummerslug: "1" })).toBeNull();
  });
});

describe("jaarDelta: jaarontwikkeling uit de valuation-historie", () => {
  const vandaag = new Date("2026-07-23T12:00:00Z");

  it("rekent de ontwikkeling tegen het meetpunt van ongeveer een jaar geleden", () => {
    const historie = [
      { datum: "2025-07-23", waarde: 400000 },
      { datum: "2026-07-23", waarde: 420000 },
    ];
    expect(woning.jaarDelta(historie, 420000, vandaag)).toBeCloseTo(5, 5);
  });

  it("accepteert een meetpunt binnen de tolerantie rond een jaar geleden", () => {
    const historie = [{ datum: "2025-06-25", waarde: 400000 }];
    expect(woning.jaarDelta(historie, 410000, vandaag)).toBeCloseTo(2.5, 5);
  });

  it("geeft null als de historie te kort is (geen punt rond een jaar geleden)", () => {
    const historie = [
      { datum: "2026-06-01", waarde: 400000 },
      { datum: "2026-07-01", waarde: 405000 },
    ];
    expect(woning.jaarDelta(historie, 410000, vandaag)).toBeNull();
  });

  it("geeft null bij een lege historie of een waarde van nul", () => {
    expect(woning.jaarDelta([], 410000, vandaag)).toBeNull();
    expect(woning.jaarDelta([{ datum: "2025-07-23", waarde: 400000 }], 0, vandaag)).toBeNull();
  });
});

describe("deltaRichting en formatPct", () => {
  it("noemt kleine bewegingen vlak en grotere op of neer", () => {
    expect(woning.deltaRichting(0.4)).toBe("vlak");
    expect(woning.deltaRichting(-0.4)).toBe("vlak");
    expect(woning.deltaRichting(0.6)).toBe("op");
    expect(woning.deltaRichting(-1.2)).toBe("neer");
  });

  it("formatteert percentages in NL-notatie met plusteken, behalve bij nul", () => {
    expect(woning.formatPct(4.2)).toBe("+4,2%");
    expect(woning.formatPct(0)).toBe("0,0%");
    expect(woning.formatPct(-2.5)).toMatch(/2,5%$/);
    expect(woning.formatPct(-2.5)).not.toContain("+");
  });
});

describe("wozReeks: WOZ door de jaren met jaar-op-jaar-delta", () => {
  it("sorteert op peiljaar en rekent de delta tegen het vorige jaar", () => {
    const reeks = woning.wozReeks([
      { peiljaar: 2026, waarde: 410000, bron: "seed" },
      { peiljaar: 2024, waarde: 380000, bron: "seed" },
      { peiljaar: 2025, waarde: 400000, bron: "seed" },
    ]);
    expect(reeks.map((rij) => rij.peiljaar)).toEqual([2024, 2025, 2026]);
    expect(reeks[0].deltaPct).toBeNull();
    expect(reeks[1].deltaPct).toBeCloseTo((20000 / 380000) * 100, 5);
    expect(reeks[2].deltaPct).toBeCloseTo(2.5, 5);
  });

  it("geeft een lege reeks terug voor een adres zonder WOZ", () => {
    expect(woning.wozReeks([])).toEqual([]);
  });
});

describe("maandPunten: valuation-historie naar maandstaafjes", () => {
  it("houdt per maand het laatste meetpunt en maximaal twaalf maanden", () => {
    const historie = [
      { datum: "2026-05-01", waarde: 400000 },
      { datum: "2026-05-20", waarde: 402000 },
      { datum: "2026-06-10", waarde: 405000 },
    ];
    expect(woning.maandPunten(historie)).toEqual([
      { maand: "2026-05", waarde: 402000 },
      { maand: "2026-06", waarde: 405000 },
    ]);

    const veertienMaanden = Array.from({ length: 14 }, (_, i) => ({
      datum: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-15`,
      waarde: 400000 + i * 1000,
    }));
    expect(woning.maandPunten(veertienMaanden)).toHaveLength(12);
  });
});

describe("wozBuurtVergelijk: WOZ tegen het buurtgemiddelde", () => {
  it("vergelijkt per m2 als het buurtanker er is", () => {
    const uitkomst = woning.wozBuurtVergelijk({ wozWaarde: 400000, oppervlakteM2: 100, gemWoz: 380000, ankerM2Prijs: 3500 });
    expect(uitkomst?.basis).toBe("per_m2");
    expect(uitkomst?.verschilPct).toBeCloseTo((500 / 3500) * 100, 5);
    expect(uitkomst?.richting).toBe("hoger");
  });

  it("noemt een afwijking binnen de drempel in lijn", () => {
    const uitkomst = woning.wozBuurtVergelijk({ wozWaarde: 400000, oppervlakteM2: 100, gemWoz: null, ankerM2Prijs: 3800 });
    expect(uitkomst?.richting).toBe("in_lijn");
  });

  it("herkent een duidelijk lagere WOZ", () => {
    const uitkomst = woning.wozBuurtVergelijk({ wozWaarde: 300000, oppervlakteM2: 100, gemWoz: null, ankerM2Prijs: 3500 });
    expect(uitkomst?.richting).toBe("lager");
  });

  it("valt zonder anker terug op de absolute vergelijking met gemWoz", () => {
    const uitkomst = woning.wozBuurtVergelijk({ wozWaarde: 400000, oppervlakteM2: 100, gemWoz: 380000, ankerM2Prijs: null });
    expect(uitkomst?.basis).toBe("absoluut");
    expect(uitkomst?.richting).toBe("in_lijn");
  });

  it("geeft null zonder buurtgemiddelde of zonder bruikbare WOZ (module wordt weggelaten)", () => {
    expect(woning.wozBuurtVergelijk({ wozWaarde: 400000, oppervlakteM2: 100, gemWoz: null, ankerM2Prijs: null })).toBeNull();
    expect(woning.wozBuurtVergelijk({ wozWaarde: 0, oppervlakteM2: 100, gemWoz: 380000, ankerM2Prijs: 3800 })).toBeNull();
  });
});
