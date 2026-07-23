import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _wisMakelaarsCache,
  bouwOverpassQuery,
  CACHE_TTL_MS,
  normaliseerPlaats,
  OVERPASS_URL,
  parseOverpassRespons,
  zoekMakelaars,
} from "@/lib/bronnen/makelaars";

/**
 * Makelaars via OpenStreetMap/Overpass (lib/bronnen/makelaars.ts).
 * Er wordt nooit echt gefetcht: globalThis.fetch is gestubd (patroon van
 * tests/energielabel.test.ts). Geen database nodig: de module is puur
 * fetch + parsen + in-memory cache.
 */

function fetchMock(status: number, json: unknown) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => json }) as unknown as Response);
}

/** Realistische Overpass-respons: node + way (met center) + randgevallen. */
const FIXTURE = {
  version: 0.6,
  generator: "Overpass API",
  osm3s: { timestamp_osm_base: "2026-07-23T10:00:00Z", copyright: "The data included in this document is from www.openstreetmap.org." },
  elements: [
    {
      type: "node",
      id: 1,
      lat: 51.4381,
      lon: 5.4752,
      tags: {
        office: "estate_agent",
        name: "Van der Berg Makelaardij",
        "addr:street": "Stratumseind",
        "addr:housenumber": "12",
        "addr:postcode": "5611 ET",
        "addr:city": "Eindhoven",
        website: "https://www.vdberg-makelaars.nl/",
        phone: "+31 40 1234567",
      },
    },
    {
      // way zonder volledig adres, website als kaal domein, contact:-varianten
      type: "way",
      id: 2,
      center: { lat: 51.44, lon: 5.48 },
      tags: {
        office: "estate_agent",
        name: "Aalders Wonen",
        "addr:city": "Eindhoven",
        "contact:website": "aalders-wonen.nl",
        "contact:phone": "040-7654321",
      },
    },
    {
      // duplicaat van de node (OSM heeft vaak punt EN gebouw): ontdubbelen
      type: "way",
      id: 3,
      center: { lat: 51.4381, lon: 5.4752 },
      tags: {
        office: "estate_agent",
        name: "Van der Berg Makelaardij",
        "addr:street": "Stratumseind",
        "addr:housenumber": "12",
        "addr:postcode": "5611 ET",
        "addr:city": "Eindhoven",
      },
    },
    {
      // naamloos punt: onbruikbaar voor bezoekers, wordt overgeslagen
      type: "node",
      id: 4,
      lat: 51.45,
      lon: 5.49,
      tags: { office: "estate_agent" },
    },
    {
      // onveilige website-waarde: link wordt weggelaten, kantoor blijft staan
      type: "node",
      id: 5,
      lat: 51.46,
      lon: 5.5,
      tags: { office: "estate_agent", name: "Zuiderhuis Makelaars", website: "javascript:alert(1)", phone: "geen" },
    },
  ],
};

beforeEach(() => {
  _wisMakelaarsCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("normaliseerPlaats", () => {
  it("trimt, normaliseert spaties en accepteert echte Nederlandse plaatsnamen", () => {
    expect(normaliseerPlaats("Eindhoven")).toBe("Eindhoven");
    expect(normaliseerPlaats("  Bergen  op   Zoom ")).toBe("Bergen op Zoom");
    expect(normaliseerPlaats("'s-Hertogenbosch")).toBe("'s-Hertogenbosch");
    expect(normaliseerPlaats("St. Anthonis")).toBe("St. Anthonis");
  });

  it("verwerpt lege, te lange en verdachte invoer (eerste verdediging tegen query-injectie)", () => {
    expect(normaliseerPlaats("")).toBeNull();
    expect(normaliseerPlaats("a")).toBeNull();
    expect(normaliseerPlaats("x".repeat(61))).toBeNull();
    expect(normaliseerPlaats('Eindhoven"]; out;')).toBeNull();
    expect(normaliseerPlaats("Eindhoven$^")).toBeNull();
    expect(normaliseerPlaats("5611AB")).toBeNull();
  });
});

describe("bouwOverpassQuery", () => {
  it("zoekt office=estate_agent binnen een Nederlandse bestuurlijke grens op naam", () => {
    const query = bouwOverpassQuery("Eindhoven");
    expect(query).toContain('area["ISO3166-1"="NL"]');
    expect(query).toContain('"office"="estate_agent"');
    expect(query).toContain('"name"~"^Eindhoven$",i');
    expect(query).toContain("[out:json]");
  });

  it("escapet regex-metatekens in de plaatsnaam (dubbel: voor de QL-string en voor de regex)", () => {
    // In de query staan letterlijk twee backslashes: de Overpass-stringparser
    // maakt daar \. van, de regex-engine leest dat als een letterlijke punt.
    expect(bouwOverpassQuery("St. Anthonis")).toContain('"name"~"^St\\\\. Anthonis$",i');
  });
});

describe("parseOverpassRespons", () => {
  it("parseert de fixture: ontdubbeld, naamloos eruit, alfabetisch, adres en website netjes opgebouwd", () => {
    const makelaars = parseOverpassRespons(FIXTURE);
    expect(makelaars).not.toBeNull();
    expect(makelaars!.map((m) => m.naam)).toEqual(["Aalders Wonen", "Van der Berg Makelaardij", "Zuiderhuis Makelaars"]);

    const [aalders, vdBerg, zuiderhuis] = makelaars!;
    expect(vdBerg).toEqual({
      naam: "Van der Berg Makelaardij",
      adres: "Stratumseind 12, 5611 ET Eindhoven",
      website: "https://www.vdberg-makelaars.nl/",
      telefoon: "+31 40 1234567",
    });
    // Gedeeltelijk adres blijft eerlijk gedeeltelijk; kaal domein wordt een echte link.
    expect(aalders.adres).toBe("Eindhoven");
    expect(aalders.website).toBe("https://aalders-wonen.nl/");
    expect(aalders.telefoon).toBe("040-7654321");
    // Onveilige of onzinnige waarden worden weggelaten, niet "gerepareerd".
    expect(zuiderhuis.website).toBeNull();
    expect(zuiderhuis.telefoon).toBeNull();
    expect(zuiderhuis.adres).toBeNull();
  });

  it("lege elements-lijst is een geldige, lege uitkomst (OSM kent er geen)", () => {
    expect(parseOverpassRespons({ elements: [] })).toEqual([]);
  });

  it("een respons zonder Overpass-vorm is een bronfout (null), geen lege lijst", () => {
    expect(parseOverpassRespons(null)).toBeNull();
    expect(parseOverpassRespons("<html>rate limited</html>")).toBeNull();
    expect(parseOverpassRespons({})).toBeNull();
    expect(parseOverpassRespons({ elements: "kapot" })).toBeNull();
  });
});

describe("zoekMakelaars: request en foutgedrag", () => {
  it("POST naar Overpass met User-Agent en de query in de body; resultaat compleet met peildatum", async () => {
    const mock = fetchMock(200, FIXTURE);
    vi.stubGlobal("fetch", mock);

    const resultaat = await zoekMakelaars("  Eindhoven ");
    expect(resultaat.status).toBe("ok");
    if (resultaat.status !== "ok") return;
    expect(resultaat.plaats).toBe("Eindhoven");
    expect(resultaat.makelaars).toHaveLength(3);
    expect(resultaat.opgehaaldOp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(resultaat.uitCache).toBe(false);

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OVERPASS_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("Wonea");
    expect(decodeURIComponent(String(init.body))).toContain('"office"="estate_agent"');
    expect(decodeURIComponent(String(init.body))).toContain("^Eindhoven$");
  });

  it("ongeldige plaats: geen netwerkverkeer", async () => {
    const mock = fetchMock(200, FIXTURE);
    vi.stubGlobal("fetch", mock);
    expect(await zoekMakelaars('Eindhoven"]; out;')).toEqual({ status: "ongeldige-plaats" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("HTTP-fout, netwerkfout en niet-Overpass-JSON geven allemaal bron-fout", async () => {
    vi.stubGlobal("fetch", fetchMock(504, "Gateway Timeout"));
    expect(await zoekMakelaars("Eindhoven")).toEqual({ status: "bron-fout" });

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("netwerk kapot"))));
    expect(await zoekMakelaars("Eindhoven")).toEqual({ status: "bron-fout" });

    vi.stubGlobal("fetch", fetchMock(200, { remark: "runtime error" }));
    expect(await zoekMakelaars("Eindhoven")).toEqual({ status: "bron-fout" });
  });
});

describe("zoekMakelaars: cache van 24 uur", () => {
  it("tweede zoekopdracht (ook met ander hoofdlettergebruik) komt uit de cache zonder fetch", async () => {
    const mock = fetchMock(200, FIXTURE);
    vi.stubGlobal("fetch", mock);

    const eerste = await zoekMakelaars("Eindhoven");
    const tweede = await zoekMakelaars("EINDHOVEN");
    expect(mock).toHaveBeenCalledTimes(1);
    expect(tweede.status).toBe("ok");
    if (eerste.status !== "ok" || tweede.status !== "ok") return;
    expect(tweede.uitCache).toBe(true);
    expect(tweede.makelaars).toEqual(eerste.makelaars);
    // Peildatum blijft die van het echte ophaalmoment: eerlijk over versheid.
    expect(tweede.opgehaaldOp).toBe(eerste.opgehaaldOp);
  });

  it("een andere plaats heeft een eigen cache-entry", async () => {
    const mock = fetchMock(200, FIXTURE);
    vi.stubGlobal("fetch", mock);
    await zoekMakelaars("Eindhoven");
    await zoekMakelaars("Helmond");
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("na 24 uur is de cache verlopen en wordt er opnieuw opgehaald", async () => {
    vi.useFakeTimers({ now: new Date("2026-07-23T09:00:00Z") });
    const mock = fetchMock(200, FIXTURE);
    vi.stubGlobal("fetch", mock);

    await zoekMakelaars("Eindhoven");
    // Net binnen de TTL: nog uit de cache.
    vi.setSystemTime(new Date(Date.parse("2026-07-23T09:00:00Z") + CACHE_TTL_MS - 1000));
    await zoekMakelaars("Eindhoven");
    expect(mock).toHaveBeenCalledTimes(1);
    // Voorbij de TTL: verse fetch.
    vi.setSystemTime(new Date(Date.parse("2026-07-23T09:00:00Z") + CACHE_TTL_MS + 1000));
    const vers = await zoekMakelaars("Eindhoven");
    expect(mock).toHaveBeenCalledTimes(2);
    expect(vers.status).toBe("ok");
    if (vers.status === "ok") expect(vers.uitCache).toBe(false);
  });

  it("fouten worden niet gecachet: de volgende poging probeert het gewoon opnieuw", async () => {
    vi.stubGlobal("fetch", fetchMock(500, {}));
    expect(await zoekMakelaars("Eindhoven")).toEqual({ status: "bron-fout" });

    const herstelMock = fetchMock(200, FIXTURE);
    vi.stubGlobal("fetch", herstelMock);
    const resultaat = await zoekMakelaars("Eindhoven");
    expect(herstelMock).toHaveBeenCalledTimes(1);
    expect(resultaat.status).toBe("ok");
  });
});
