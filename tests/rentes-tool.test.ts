/**
 * Rentestanden-tool (app/hypotheek-rentes): pure rekenlogica, geen database.
 *
 * Bewaakt drie dingen:
 * 1. de maandlastentabel rekent exact volgens de annuiteitenformule (oracle-
 *    waarden onafhankelijk uitgerekend) en klemt onzinnige leenbedragen;
 * 2. de historie-parser accepteert alleen de afgesproken vorm en geeft bij
 *    twijfel een lege lijst (geen grafiek op kapotte data);
 * 3. de huidige snapshot heeft geen historie, dus de pagina toont vandaag
 *    geen sparkline (dat is bewust: liever weglaten dan verzinnen).
 */

import { describe, expect, it } from "vitest";
import { getActueleRentes } from "@/lib/bronnen/rentes";
import {
  formatPct,
  klemLeenbedrag,
  LEEN_DEFAULT,
  LEEN_MAX,
  LEEN_MIN,
  maandlastRijen,
  parseRenteHistorie,
  renteHistorie,
  sparklineReeks,
} from "@/app/hypotheek-rentes/logic";

const buckets = getActueleRentes().buckets;

describe("klemLeenbedrag", () => {
  it("laat een normaal bedrag ongemoeid en rondt op hele euro's", () => {
    expect(klemLeenbedrag(300_000)).toBe(300_000);
    expect(klemLeenbedrag(287_500.6)).toBe(287_501);
  });

  it("klemt onder- en bovengrens", () => {
    expect(klemLeenbedrag(1)).toBe(LEEN_MIN);
    expect(klemLeenbedrag(99_999_999)).toBe(LEEN_MAX);
  });

  it("maakt van niet-getallen het standaardbedrag", () => {
    expect(klemLeenbedrag(Number.NaN)).toBe(LEEN_DEFAULT);
    expect(klemLeenbedrag(Number.POSITIVE_INFINITY)).toBe(LEEN_DEFAULT);
  });
});

describe("maandlastRijen", () => {
  it("levert per DNB-bucket een rij, in dezelfde volgorde en met dezelfde rente", () => {
    const rijen = maandlastRijen(300_000, buckets);
    expect(rijen.map((r) => r.bucket)).toEqual(buckets.map((b) => b.bucket));
    expect(rijen.map((r) => r.rentePct)).toEqual(buckets.map((b) => b.rentePct));
    expect(rijen.map((r) => r.label)).toEqual(buckets.map((b) => b.label));
  });

  it("rekent de bruto maandlast exact volgens de annuiteitenformule (oracle-waarden)", () => {
    // Onafhankelijk uitgerekend: maandlast = H * i / (1 - (1+i)^-360), i = pct/100/12.
    const oracle: Record<string, number> = { "4.1": 1450, "3.79": 1396, "3.74": 1388, "3.49": 1345 };
    const rijen = maandlastRijen(
      300_000,
      [4.1, 3.79, 3.74, 3.49].map((pct, i) => ({ ...buckets[i], rentePct: pct })),
    );
    for (const rij of rijen) {
      expect(rij.maandlast).toBe(oracle[String(rij.rentePct)]);
    }
  });

  it("hogere rente betekent hogere maandlast (monotonie), en rente 0 is lineair aflossen", () => {
    const rijen = maandlastRijen(
      450_000,
      [1, 3.49, 6, 9].map((pct, i) => ({ ...buckets[i], rentePct: pct })),
    );
    for (let i = 1; i < rijen.length; i++) {
      expect(rijen[i].maandlast).toBeGreaterThan(rijen[i - 1].maandlast);
    }
    expect(rijen[1].maandlast).toBe(2018);

    const nul = maandlastRijen(100_000, [{ ...buckets[0], rentePct: 0 }]);
    expect(nul[0].maandlast).toBe(Math.round(100_000 / 360));
  });

  it("klemt het leenbedrag voordat er gerekend wordt", () => {
    expect(maandlastRijen(-5, buckets)).toEqual(maandlastRijen(LEEN_MIN, buckets));
    expect(maandlastRijen(Number.NaN, buckets)).toEqual(maandlastRijen(LEEN_DEFAULT, buckets));
  });
});

describe("formatPct", () => {
  it("gebruikt de Nederlandse komma en toont minimaal 1, maximaal 2 decimalen", () => {
    expect(formatPct(4.1)).toBe("4,1%");
    expect(formatPct(3.79)).toBe("3,79%");
    expect(formatPct(4)).toBe("4,0%");
  });
});

describe("renteHistorie (optioneel veld in de snapshot)", () => {
  const geldig = [
    { maand: "2026-05", rentes: { variabel_tot_1: 4.1, vanaf_10: 3.49 } },
    { maand: "2026-03", rentes: { variabel_tot_1: 4.2, vanaf_10: 3.55 } },
    { maand: "2026-04", rentes: { variabel_tot_1: 4.15 } },
  ];

  it("de huidige snapshot heeft geen historie: geen sparkline op de pagina", () => {
    expect(renteHistorie()).toEqual([]);
  });

  it("parseert een geldige historie en sorteert oplopend op maand", () => {
    const punten = parseRenteHistorie(geldig);
    expect(punten.map((p) => p.maand)).toEqual(["2026-03", "2026-04", "2026-05"]);
  });

  it("sparklineReeks pakt alleen de maanden waarin de bucket een waarde heeft", () => {
    const punten = parseRenteHistorie(geldig);
    expect(sparklineReeks(punten, "variabel_tot_1")).toEqual([4.2, 4.15, 4.1]);
    // april ontbreekt voor vanaf_10: reeks slaat die maand over, verzint niets
    expect(sparklineReeks(punten, "vanaf_10")).toEqual([3.55, 3.49]);
    expect(sparklineReeks(punten, "5_tot_10")).toEqual([]);
  });

  it("weigert de HELE historie zodra 1 punt ongeldig is: liever geen grafiek dan een halve", () => {
    expect(parseRenteHistorie([...geldig, { maand: "2026-13", rentes: {} }])).toEqual([]);
    expect(parseRenteHistorie([...geldig, { maand: "2026-06", rentes: { variabel_tot_1: 42 } }])).toEqual([]);
    expect(parseRenteHistorie([...geldig, { maand: "2026-06", rentes: { variabel_tot_1: 0.1 } }])).toEqual([]);
  });

  it("afwezig of een ander type: lege lijst", () => {
    expect(parseRenteHistorie(undefined)).toEqual([]);
    expect(parseRenteHistorie(null)).toEqual([]);
    expect(parseRenteHistorie("2026-05")).toEqual([]);
    expect(parseRenteHistorie({ maand: "2026-05" })).toEqual([]);
  });
});
