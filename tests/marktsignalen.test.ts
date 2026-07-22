import { describe, expect, it } from "vitest";
import { berekenMarktsignalen, formatDoorlooptijd, type MarktStatMaand } from "@/lib/marktsignalen";

/**
 * Pure tests: lib/marktsignalen.ts raakt bewust geen database, dus hier is
 * geen testdatabase nodig. Maandreeks start op 2025-08 (index 0).
 */

function maandCode(i: number): string {
  return new Date(Date.UTC(2025, 7 + i, 1)).toISOString().slice(0, 7);
}

function rij(i: number, deel: Partial<MarktStatMaand> = {}): MarktStatMaand {
  return { maand: maandCode(i), mediaanPrijs: null, doorlooptijdDagen: null, overbiedingPct: null, volume: null, ...deel };
}

function reeks(prijzen: (number | null)[], extra?: (i: number) => Partial<MarktStatMaand>): MarktStatMaand[] {
  return prijzen.map((p, i) => rij(i, { mediaanPrijs: p, ...(extra ? extra(i) : {}) }));
}

const VLAK_12M = Array.from({ length: 12 }, () => 300000);

describe("berekenMarktsignalen: geen data = null", () => {
  it("geeft null zonder rijen", () => {
    expect(berekenMarktsignalen([])).toBeNull();
  });

  it("geeft null bij minder dan 6 maanden met mediaanprijs", () => {
    expect(berekenMarktsignalen(reeks([300000, 300000, 300000, 300000, 300000]))).toBeNull();
  });

  it("telt maanden zonder bruikbare mediaanprijs (null of 0) niet mee", () => {
    const rijen = reeks([300000, 300000, 300000, null, 0, 300000, 300000]); // 5 bruikbare maanden
    expect(berekenMarktsignalen(rijen)).toBeNull();
  });
});

describe("momentum: laatste 3 maanden vs de 3 ervoor, drempel 1,5%", () => {
  it("stijgend boven de drempel", () => {
    const s = berekenMarktsignalen(reeks([100000, 100000, 100000, 101600, 101600, 101600]));
    expect(s).not.toBeNull();
    expect(s!.momentum).toBe("stijgend");
    expect(s!.momentumPct).toBeCloseTo(1.6, 5);
  });

  it("vlak op de drempel zelf (1,5% is niet erboven)", () => {
    expect(berekenMarktsignalen(reeks([100000, 100000, 100000, 101500, 101500, 101500]))!.momentum).toBe("vlak");
  });

  it("vlak binnen de drempel, beide kanten op", () => {
    expect(berekenMarktsignalen(reeks([100000, 100000, 100000, 101400, 101400, 101400]))!.momentum).toBe("vlak");
    expect(berekenMarktsignalen(reeks([100000, 100000, 100000, 98600, 98600, 98600]))!.momentum).toBe("vlak"); // -1,4%
  });

  it("dalend onder min de drempel", () => {
    const s = berekenMarktsignalen(reeks([100000, 100000, 100000, 98000, 98000, 98000]))!;
    expect(s.momentum).toBe("dalend");
    expect(s.momentumPct).toBeCloseTo(-2, 5);
  });
});

describe("prijsontwikkeling12mPct", () => {
  it("vergelijkt de eerste met de laatste prijsmaand in het venster", () => {
    const prijzen = Array.from({ length: 12 }, (_, i) => 300000 + i * 2000); // 300000 -> 322000
    const s = berekenMarktsignalen(reeks(prijzen))!;
    expect(s.prijsontwikkeling12mPct).toBe(7.3); // 22000/300000, afgerond op 1 decimaal
  });

  it("gebruikt alleen de laatste 12 maanden, ook bij ongesorteerde invoer", () => {
    const oud = [rij(0, { mediaanPrijs: 500000 }), rij(1, { mediaanPrijs: 500000 }), rij(2, { mediaanPrijs: 500000 })];
    const recent = Array.from({ length: 12 }, (_, i) => rij(3 + i, { mediaanPrijs: 100000 + i * 1000 })); // 100000 -> 111000
    const s = berekenMarktsignalen([...recent.slice(6), ...oud, ...recent.slice(0, 6)])!;
    expect(s.prijsontwikkeling12mPct).toBe(11);
    expect(s.prijsReeks).toHaveLength(12);
    expect(s.prijsReeks[0]).toEqual({ maand: maandCode(3), mediaan: 100000 });
    expect(s.prijsReeks[11]).toEqual({ maand: maandCode(14), mediaan: 111000 });
  });
});

describe("doorlooptijdTrend: laatste 3 maanden vs de 3 ervoor, drempel 10%", () => {
  it("korter bij duidelijk kortere doorlooptijd", () => {
    const s = berekenMarktsignalen(reeks(VLAK_12M, (i) => ({ doorlooptijdDagen: i < 9 ? 40 : 21 })))!;
    expect(s.doorlooptijdTrend).toBe("korter");
    expect(s.doorlooptijdNu).toBe(21);
  });

  it("langer bij duidelijk langere doorlooptijd", () => {
    const s = berekenMarktsignalen(reeks(VLAK_12M, (i) => ({ doorlooptijdDagen: i < 9 ? 21 : 40 })))!;
    expect(s.doorlooptijdTrend).toBe("langer");
    expect(s.doorlooptijdNu).toBe(40);
  });

  it("gelijk binnen de drempel", () => {
    const s = berekenMarktsignalen(reeks(VLAK_12M, (i) => ({ doorlooptijdDagen: i < 9 ? 30 : 32 })))!;
    expect(s.doorlooptijdTrend).toBe("gelijk"); // +6,7% < 10%
  });

  it("gelijk en geen doorlooptijdNu zonder doorlooptijddata (geen trendclaim)", () => {
    const s = berekenMarktsignalen(reeks(VLAK_12M))!;
    expect(s.doorlooptijdTrend).toBe("gelijk");
    expect(s.doorlooptijdNu).toBeNull();
    expect(s.uitlegregels.some((r) => r.includes("verkopen hier nu"))).toBe(false);
  });
});

describe("overbiedingNu en volumeNu", () => {
  it("pakken de recentste maand waarin het gemeten is", () => {
    const s = berekenMarktsignalen(
      reeks(VLAK_12M, (i) => ({
        overbiedingPct: i === 11 ? null : i === 10 ? 3.2 : 1,
        volume: i === 11 ? null : i === 10 ? 7 : 12,
      })),
    )!;
    expect(s.overbiedingNu).toBe(3.2);
    expect(s.volumeNu).toBe(7);
  });

  it("blijven null wanneer er nooit gemeten is", () => {
    const s = berekenMarktsignalen(reeks(VLAK_12M))!;
    expect(s.overbiedingNu).toBeNull();
    expect(s.volumeNu).toBeNull();
  });
});

describe("uitlegregels: gewone taal, wat zegt dit en wat doe je", () => {
  it("benoemt stijging, doorlooptijd in weken en overbieden", () => {
    const s = berekenMarktsignalen(
      reeks([100000, 100000, 100000, 103000, 103000, 103000], () => ({ doorlooptijdDagen: 21, overbiedingPct: 3.2, volume: 8 })),
    )!;
    expect(s.uitlegregels.some((r) => r.includes("hoger dan in de drie maanden ervoor"))).toBe(true);
    expect(s.uitlegregels.some((r) => r.includes("ongeveer 3 weken"))).toBe(true);
    expect(s.uitlegregels.some((r) => r.includes("Snel beslissen loont, overhaasten niet"))).toBe(true);
    expect(s.uitlegregels.some((r) => r.includes("boven de vraagprijs"))).toBe(true);
  });

  it("waarschuwt bij weinig verkopen: richting, geen zekerheid", () => {
    const s = berekenMarktsignalen(reeks(VLAK_12M, () => ({ volume: 3 })))!;
    expect(s.uitlegregels.some((r) => r.includes("richting, niet als zekerheid"))).toBe(true);
  });

  it("bevat geen em-dashes (CONTRACTS.md: komma's of dubbele punt)", () => {
    const s = berekenMarktsignalen(
      reeks([100000, 100000, 100000, 97000, 97000, 97000], () => ({ doorlooptijdDagen: 60, overbiedingPct: -2.1, volume: 9 })),
    )!;
    for (const regel of s.uitlegregels) expect(regel).not.toMatch(/—/);
  });
});

describe("formatDoorlooptijd", () => {
  it("dagen onder de twee weken, daarboven weken", () => {
    expect(formatDoorlooptijd(9)).toBe("ongeveer 9 dagen");
    expect(formatDoorlooptijd(21)).toBe("ongeveer 3 weken");
    expect(formatDoorlooptijd(45)).toBe("ongeveer 6 weken");
  });
});
