import { describe, expect, it } from "vitest";
import {
  leesAdresResultaat,
  MIN_WOZ,
  ozbVoorbeeldPerJaar,
  parsePeiljaar,
  parseWozBedrag,
  vergelijkWoz,
  type WozAdresResultaat,
} from "@/app/woz-check/berekening";

/**
 * WOZ-check (app/woz-check): pure vergelijk- en parseerlaag, geen database.
 * Kernbewering: de regels zijn exact die van de oude WozVergelijker (client):
 * alleen boven de HELE bandbreedte heet een WOZ "boven", alleen eronder
 * "onder", en het OZB-voorbeeld is 0,1% van het verschil. Geen UI-drift.
 */

const markt = { waarde: 400_000, laag: 360_000, hoog: 440_000 };

describe("vergelijkWoz: bandbreedte bepaalt de categorie", () => {
  it("boven de hele bandbreedte = categorie boven, met exact verschil en afgerond percentage", () => {
    const v = vergelijkWoz(452_000, markt.waarde, markt.laag, markt.hoog);
    expect(v.categorie).toBe("boven");
    expect(v.verschil).toBe(52_000);
    // Zelfde afronding als de oude check: Math.round((verschil / markt) * 100).
    expect(v.verschilPct).toBe(Math.round((52_000 / 400_000) * 100));
  });

  it("onder de bandbreedte = categorie onder, verschil negatief", () => {
    const v = vergelijkWoz(340_000, markt.waarde, markt.laag, markt.hoog);
    expect(v.categorie).toBe("onder");
    expect(v.verschil).toBe(-60_000);
    expect(v.verschilPct).toBe(-15);
  });

  it("precies op de grenzen valt binnen de bandbreedte (oude regel: strikt groter/kleiner)", () => {
    expect(vergelijkWoz(markt.hoog, markt.waarde, markt.laag, markt.hoog).categorie).toBe("binnen");
    expect(vergelijkWoz(markt.laag, markt.waarde, markt.laag, markt.hoog).categorie).toBe("binnen");
    expect(vergelijkWoz(markt.waarde, markt.waarde, markt.laag, markt.hoog).categorie).toBe("binnen");
  });
});

describe("ozbVoorbeeldPerJaar: zelfde som als de oude check (0,1% van het verschil)", () => {
  it("komt overeen met verschil * 0.001, afgerond", () => {
    expect(ozbVoorbeeldPerJaar(25_000)).toBe(Math.round(25_000 * 0.001));
    expect(ozbVoorbeeldPerJaar(52_000)).toBe(52);
    expect(ozbVoorbeeldPerJaar(1_499)).toBe(1);
  });
});

describe("parseWozBedrag: euro-invoer met dezelfde ondergrens als de oude check", () => {
  it("leest kale en geformatteerde bedragen", () => {
    expect(parseWozBedrag("425000")).toBe(425_000);
    expect(parseWozBedrag("425.000")).toBe(425_000);
    expect(parseWozBedrag(" 425 000 ")).toBe(425_000);
  });

  it("weigert leeg, tekst en alles tot en met de ondergrens", () => {
    expect(parseWozBedrag("")).toBeNull();
    expect(parseWozBedrag("abc")).toBeNull();
    expect(parseWozBedrag(String(MIN_WOZ))).toBeNull(); // oude regel: strikt groter dan
    expect(parseWozBedrag(String(MIN_WOZ + 1))).toBe(MIN_WOZ + 1);
  });
});

describe("parsePeiljaar: alleen een geldig jaartal", () => {
  it("accepteert een jaartal tussen de ondergrens en het huidige jaar", () => {
    expect(parsePeiljaar("2025", 2026)).toBe(2025);
    expect(parsePeiljaar("2026", 2026)).toBe(2026);
  });

  it("weigert te oud, toekomst, en niet-jaartallen", () => {
    expect(parsePeiljaar("1999", 2026)).toBeNull();
    expect(parsePeiljaar("2027", 2026)).toBeNull();
    expect(parsePeiljaar("20 25", 2026)).toBeNull();
    expect(parsePeiljaar("volgend jaar", 2026)).toBeNull();
    expect(parsePeiljaar("", 2026)).toBeNull();
  });
});

describe("leesAdresResultaat: onbetrouwbare data (sessie of API) streng inlezen", () => {
  const geldig: WozAdresResultaat = {
    naam: "Voorbeeldstraat 12, 1234AB Teststad",
    postcode: "1234AB",
    nummerslug: "12",
    schatting: { waarde: 400_000, laag: 360_000, hoog: 440_000, confidence: "middel", nComparables: 7, datum: "2026-07-23" },
    bekendeWoz: { waarde: 380_000, peiljaar: 2025, bron: "seed" },
  };

  it("geeft een geldig resultaat ongewijzigd terug (roundtrip via JSON)", () => {
    expect(leesAdresResultaat(JSON.parse(JSON.stringify(geldig)))).toEqual(geldig);
  });

  it("laat schatting en bekendeWoz null zijn", () => {
    expect(leesAdresResultaat({ ...geldig, schatting: null, bekendeWoz: null })).toEqual({
      ...geldig,
      schatting: null,
      bekendeWoz: null,
    });
  });

  it("weigert rommel: geen object, ontbrekende velden, verkeerde typen", () => {
    expect(leesAdresResultaat(null)).toBeNull();
    expect(leesAdresResultaat("tekst")).toBeNull();
    expect(leesAdresResultaat([geldig])).toBeNull();
    expect(leesAdresResultaat({ ...geldig, naam: "" })).toBeNull();
    expect(leesAdresResultaat({ ...geldig, schatting: { ...geldig.schatting, waarde: "veel" } })).toBeNull();
    expect(leesAdresResultaat({ ...geldig, schatting: { ...geldig.schatting, confidence: "enorm" } })).toBeNull();
    expect(leesAdresResultaat({ ...geldig, bekendeWoz: { waarde: 1, peiljaar: 2025, bron: "gemeente" } })).toBeNull();
  });

  it("bouwt het object opnieuw op: vreemde extra velden liften niet mee", () => {
    const metExtra = { ...JSON.parse(JSON.stringify(geldig)), kwaad: "script" };
    const uit = leesAdresResultaat(metExtra);
    expect(uit).toEqual(geldig);
    expect(uit && "kwaad" in uit).toBe(false);
  });
});
