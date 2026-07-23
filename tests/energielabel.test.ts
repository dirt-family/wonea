import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * EP-Online energielabels (lib/bronnen/energielabel.ts).
 * Er wordt nooit echt gefetcht: zonder key stopt de module voor de fetch,
 * met key stubben we globalThis.fetch. De module importeert lib/db, dus
 * dynamisch importeren na maakTestDb (patroon van de andere tests).
 */

let energielabel: typeof import("@/lib/bronnen/energielabel");
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let drizzle: typeof import("drizzle-orm");

const oudeKey = process.env.EPONLINE_API_KEY;
const oudeUrl = process.env.EPONLINE_API_URL;

function fetchMock(status: number, json: unknown) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => json }) as unknown as Response);
}

function registratie(overrides?: Record<string, unknown>) {
  return {
    Energieklasse: "B",
    Registratiedatum: "2021-05-04T00:00:00",
    Geldig_tot: "2031-05-04T00:00:00",
    Gebouwklasse: "W",
    ...overrides,
  };
}

beforeAll(async () => {
  delete process.env.EPONLINE_API_KEY;
  delete process.env.EPONLINE_API_URL;
  await maakTestDb();
  energielabel = await import("@/lib/bronnen/energielabel");
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  drizzle = await import("drizzle-orm");

  await db.insert(schema.municipalities).values({ code: "GM0772", naam: "Eindhoven", slug: "eindhoven" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0772" });
  await db.insert(schema.addresses).values([
    {
      straat: "Teststraat",
      huisnummer: 12,
      toevoeging: "a",
      nummerslug: "12a",
      postcode: "5611AB",
      plaats: "Eindhoven",
      buurtCode: "BU1",
      bouwjaar: 1962,
      oppervlakteM2: 95,
      woningtype: "tussenwoning",
      energielabel: "D",
      energielabelBron: "indicatie",
    },
    {
      straat: "Teststraat",
      huisnummer: 14,
      toevoeging: null,
      nummerslug: "14",
      postcode: "5611AB",
      plaats: "Eindhoven",
      buurtCode: "BU1",
      bouwjaar: 1990,
      oppervlakteM2: 110,
      woningtype: "hoekwoning",
      energielabel: "C",
      energielabelBron: "indicatie",
    },
    {
      straat: "Teststraat",
      huisnummer: 16,
      toevoeging: null,
      nummerslug: "16",
      postcode: "5611AB",
      plaats: "Eindhoven",
      buurtCode: "BU1",
      bouwjaar: 1990,
      oppervlakteM2: 110,
      woningtype: "hoekwoning",
      energielabel: "C",
      energielabelBron: "indicatie",
    },
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EPONLINE_API_KEY;
});

afterAll(() => {
  if (oudeKey === undefined) delete process.env.EPONLINE_API_KEY;
  else process.env.EPONLINE_API_KEY = oudeKey;
  if (oudeUrl === undefined) delete process.env.EPONLINE_API_URL;
  else process.env.EPONLINE_API_URL = oudeUrl;
});

describe("splitsToevoeging: gecombineerde kolom terug naar EP-Online-parameters", () => {
  it("splitst huisletter en huisnummertoevoeging", () => {
    expect(energielabel.splitsToevoeging(null)).toEqual({});
    expect(energielabel.splitsToevoeging("")).toEqual({});
    expect(energielabel.splitsToevoeging("a")).toEqual({ huisletter: "a" });
    expect(energielabel.splitsToevoeging("2")).toEqual({ huisnummertoevoeging: "2" });
    expect(energielabel.splitsToevoeging("A2")).toEqual({ huisletter: "A", huisnummertoevoeging: "2" });
    expect(energielabel.splitsToevoeging(" a ")).toEqual({ huisletter: "a" });
  });

  it("geeft null bij waarden die niet in de parameters passen (geen call naar een verkeerd adres)", () => {
    expect(energielabel.splitsToevoeging("1-2")).toBeNull();
    expect(energielabel.splitsToevoeging("abcdef")).toBeNull();
    expect(energielabel.splitsToevoeging("2 hoog")).toBeNull();
  });
});

describe("parseEpOnlineRespons: kiest het bruikbare label uit de API-respons", () => {
  it("parseert een normale woningregistratie inclusief peildatums", () => {
    expect(energielabel.parseEpOnlineRespons([registratie()])).toEqual({
      label: "B",
      registratiedatum: "2021-05-04",
      geldigTot: "2031-05-04",
    });
  });

  it("normaliseert de labelletter en accepteert plus-labels", () => {
    expect(energielabel.parseEpOnlineRespons([registratie({ Energieklasse: " b " })])?.label).toBe("B");
    expect(energielabel.parseEpOnlineRespons([registratie({ Energieklasse: "A++++" })])?.label).toBe("A++++");
  });

  it("verwerpt rommel in plaats van een verzonnen label te tonen", () => {
    expect(energielabel.parseEpOnlineRespons(null)).toBeNull();
    expect(energielabel.parseEpOnlineRespons({})).toBeNull();
    expect(energielabel.parseEpOnlineRespons([])).toBeNull();
    expect(energielabel.parseEpOnlineRespons([registratie({ Energieklasse: "X" })])).toBeNull();
    expect(energielabel.parseEpOnlineRespons([registratie({ Energieklasse: null })])).toBeNull();
    expect(energielabel.parseEpOnlineRespons([registratie({ Registratiedatum: null, Geldig_tot: "geen datum" })])).toEqual({
      label: "B",
      registratiedatum: null,
      geldigTot: null,
    });
  });

  it("verkiest een woninglabel boven een utiliteitslabel en de recentste registratie", () => {
    const respons = [
      registratie({ Energieklasse: "C", Gebouwklasse: "U", Registratiedatum: "2024-01-01T00:00:00" }),
      registratie({ Energieklasse: "D", Registratiedatum: "2019-03-01T00:00:00" }),
      registratie({ Energieklasse: "A+", Registratiedatum: "2023-06-15T00:00:00" }),
    ];
    expect(energielabel.parseEpOnlineRespons(respons)).toEqual({
      label: "A+",
      registratiedatum: "2023-06-15",
      geldigTot: "2031-05-04",
    });
  });
});

describe("getEnergielabel zonder key", () => {
  it("geeft null zonder crash en raakt het netwerk niet aan", async () => {
    const mock = fetchMock(200, [registratie()]);
    vi.stubGlobal("fetch", mock);
    expect(await energielabel.getEnergielabel("5611AB", 12, "a")).toBeNull();
    expect(mock).not.toHaveBeenCalled();
    // De bouwjaar-indicatie blijft onaangeroerd staan.
    const adres = (await db.select().from(schema.addresses).where(drizzle.eq(schema.addresses.nummerslug, "12a")))[0];
    expect(adres.energielabel).toBe("D");
    expect(adres.energielabelBron).toBe("indicatie");
  });
});

describe("getEnergielabel met key (gestubde fetch)", () => {
  it("haalt het label op, bouwt de juiste request en cachet in addresses als bron 'echt'", async () => {
    process.env.EPONLINE_API_KEY = "test-key";
    const mock = fetchMock(200, [registratie()]);
    vi.stubGlobal("fetch", mock);

    const resultaat = await energielabel.getEnergielabel("5611 ab", 12, "a");
    expect(resultaat).toEqual({ label: "B", registratiedatum: "2021-05-04", geldigTot: "2031-05-04", uitCache: false });

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/v5/PandEnergielabel/Adres?");
    expect(url).toContain("postcode=5611AB");
    expect(url).toContain("huisnummer=12");
    expect(url).toContain("huisletter=a");
    expect(url).not.toContain("huisnummertoevoeging");
    expect((init.headers as Record<string, string>).Authorization).toBe("test-key");

    const adres = (await db.select().from(schema.addresses).where(drizzle.eq(schema.addresses.nummerslug, "12a")))[0];
    expect(adres.energielabel).toBe("B");
    expect(adres.energielabelBron).toBe("echt");
  });

  it("serveert een eerdere hit uit de cache zonder nieuwe API-call", async () => {
    process.env.EPONLINE_API_KEY = "test-key";
    const mock = fetchMock(200, [registratie()]);
    vi.stubGlobal("fetch", mock);

    const resultaat = await energielabel.getEnergielabel("5611AB", 12, "a");
    expect(resultaat).toEqual({ label: "B", registratiedatum: null, geldigTot: null, uitCache: true });
    expect(mock).not.toHaveBeenCalled();
  });

  it("404 (geen label geregistreerd) geeft null en laat de indicatie staan", async () => {
    process.env.EPONLINE_API_KEY = "test-key";
    const mock = fetchMock(404, { detail: "Geen informatie gevonden." });
    vi.stubGlobal("fetch", mock);

    expect(await energielabel.getEnergielabel("5611AB", 14)).toBeNull();
    const adres = (await db.select().from(schema.addresses).where(drizzle.eq(schema.addresses.nummerslug, "14")))[0];
    expect(adres.energielabel).toBe("C");
    expect(adres.energielabelBron).toBe("indicatie");
  });

  it("een API-fout geeft null via getEnergielabel; fetchEnergielabel gooit hem wel door voor de ingest", async () => {
    process.env.EPONLINE_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetchMock(500, {}));
    expect(await energielabel.getEnergielabel("5611AB", 14)).toBeNull();

    await expect(energielabel.fetchEnergielabel({ postcode: "5611AB", huisnummer: 14 })).rejects.toMatchObject({
      name: "EpOnlineFout",
      status: 500,
    });
  });

  it("suppressie wint: bevestigde opt-out betekent geen API-call en geen cache", async () => {
    process.env.EPONLINE_API_KEY = "test-key";
    const adres = (await db.select().from(schema.addresses).where(drizzle.eq(schema.addresses.nummerslug, "16")))[0];
    await db.insert(schema.optouts).values({
      adresId: adres.id,
      postcode: "5611AB",
      nummerslug: "16",
      token: "t-energielabel",
      aangevraagdAt: "2026-07-23",
      bevestigdAt: "2026-07-23T10:00:00Z",
    });

    const mock = fetchMock(200, [registratie()]);
    vi.stubGlobal("fetch", mock);
    expect(await energielabel.getEnergielabel("5611AB", 16)).toBeNull();
    expect(mock).not.toHaveBeenCalled();
    const na = (await db.select().from(schema.addresses).where(drizzle.eq(schema.addresses.nummerslug, "16")))[0];
    expect(na.energielabelBron).toBe("indicatie");
  });
});
