import { describe, expect, it } from "vitest";
import { berekenWaarde, MODEL_VERSIE } from "@/lib/avm";
import type { Comparable } from "@/lib/comparables";

function comp(prijs: number, opp: number, id = 1): Comparable {
  return { id, buurtCode: "BU1", straat: "Teststraat", datum: "2026-05-01", prijs, oppervlakteM2: opp, woningtype: "tussenwoning", bron: "seed" };
}

const basis = { oppervlakteM2: 100, bouwjaar: 1990, woningtype: "tussenwoning" as const, energielabel: "C" };

describe("AVM v1", () => {
  it("geeft null zonder comparables en zonder anker (eerlijk: geen schatting)", () => {
    expect(berekenWaarde({ ...basis, comparables: [], ankerM2Prijs: null })).toBeNull();
  });

  it("valt terug op het buurt-anker met confidence laag en maximale marge", () => {
    const r = berekenWaarde({ ...basis, comparables: [], ankerM2Prijs: 4000 });
    expect(r).not.toBeNull();
    expect(r!.confidence).toBe("laag");
    expect(r!.uitleg.basisBron).toBe("buurt_anker");
    expect(r!.uitleg.intervalPct).toBeCloseTo(0.15);
    expect(r!.waarde).toBe(400000); // 4000 x 100, factoren 1990/tussenwoning/C zijn allemaal 1.0
  });

  it("geeft een smalle marge bij veel gelijkende verkopen", () => {
    const comps = Array.from({ length: 12 }, (_, i) => comp(400000 + i * 1000, 100, i));
    const r = berekenWaarde({ ...basis, comparables: comps });
    expect(r!.confidence).toBe("hoog");
    expect(r!.uitleg.intervalPct).toBeCloseTo(0.05);
  });

  it("capt de marge op 15 procent bij extreme spreiding", () => {
    const comps = [comp(200000, 100, 1), comp(300000, 100, 2), comp(500000, 100, 3), comp(900000, 100, 4), comp(1200000, 100, 5)];
    const r = berekenWaarde({ ...basis, comparables: comps });
    expect(r!.uitleg.intervalPct).toBe(0.15);
    expect(r!.intervalHoog).toBeGreaterThan(r!.waarde);
    expect(r!.intervalLaag).toBeLessThan(r!.waarde);
  });

  it("is monotoon in oppervlakte", () => {
    const comps = Array.from({ length: 8 }, (_, i) => comp(400000, 100, i));
    const klein = berekenWaarde({ ...basis, oppervlakteM2: 80, comparables: comps })!;
    const groot = berekenWaarde({ ...basis, oppervlakteM2: 140, comparables: comps })!;
    expect(groot.waarde).toBeGreaterThan(klein.waarde);
  });

  it("waardeert label A hoger dan label G bij gelijke rest", () => {
    const comps = Array.from({ length: 8 }, (_, i) => comp(400000, 100, i));
    const a = berekenWaarde({ ...basis, energielabel: "A", comparables: comps })!;
    const g = berekenWaarde({ ...basis, energielabel: "G", comparables: comps })!;
    expect(a.waarde).toBeGreaterThan(g.waarde);
  });

  it("rondt af op duizendtallen en zet de modelversie", () => {
    const comps = Array.from({ length: 5 }, (_, i) => comp(417777, 93, i));
    const r = berekenWaarde({ ...basis, comparables: comps })!;
    expect(r.waarde % 1000).toBe(0);
    expect(r.intervalLaag % 1000).toBe(0);
    expect(r.intervalHoog % 1000).toBe(0);
    expect(r.modelVersie).toBe(MODEL_VERSIE);
  });

  it("hanteert de confidence-drempels 8 en 4", () => {
    const maak = (n: number) => Array.from({ length: n }, (_, i) => comp(400000, 100, i));
    expect(berekenWaarde({ ...basis, comparables: maak(8) })!.confidence).toBe("hoog");
    expect(berekenWaarde({ ...basis, comparables: maak(7) })!.confidence).toBe("middel");
    expect(berekenWaarde({ ...basis, comparables: maak(4) })!.confidence).toBe("middel");
    expect(berekenWaarde({ ...basis, comparables: maak(3), ankerM2Prijs: 4000 })!.confidence).toBe("laag");
  });
});
