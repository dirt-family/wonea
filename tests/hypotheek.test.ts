import { describe, expect, it } from "vitest";
import {
  annuiteitMaandlast,
  maandlastenOverzicht,
  maximaleHypotheek,
  TOETS_LOOPTIJD_MAANDEN,
  type MaximaleHypotheekInput,
} from "@/lib/hypotheek";
import { AFM_TOETSRENTE_KORTER_DAN_10JR, vindFinancieringslastPct } from "@/lib/normen/leennormen-2026";

/**
 * Pure rekenlogica: deze tests raken de database niet (geen maakTestDb nodig).
 * De verwachte percentages komen letterlijk uit bijlage 1 van de
 * Wijzigingsregeling hypothecair krediet 2026 (Staatscourant 2025, 36471),
 * via lib/normen/leennormen-2026.ts (daar al cel voor cel getest).
 */

describe("annuiteitMaandlast: met de hand narekenbaar", () => {
  it("100.000 euro tegen 6% over 360 maanden is 599,55 per maand", () => {
    // Handberekening: i = 6 / 100 / 12 = 0,005 per maand, n = 360.
    // (1,005)^360 = 6,022575...; (1,005)^-360 = 0,166042...
    // maandlast = 100.000 * 0,005 / (1 - 0,166042) = 500 / 0,833958 = 599,5505...
    // Dit is het klassieke schoolvoorbeeld: 100k, 6%, 30 jaar = 599,55.
    expect(annuiteitMaandlast(100_000, 6, 360)).toBeCloseTo(599.55, 2);
  });

  it("1.000 euro tegen 12% over 12 maanden is 88,85 per maand", () => {
    // Handberekening: i = 12 / 100 / 12 = 0,01 per maand, n = 12.
    // (1,01)^12 = 1,12682503...; (1,01)^-12 = 0,887449...
    // maandlast = 1.000 * 0,01 / (1 - 0,887449) = 10 / 0,112551 = 88,8488...
    expect(annuiteitMaandlast(1_000, 12, 12)).toBeCloseTo(88.85, 2);
  });

  it("bij rente 0 resteert lineair aflossen", () => {
    // 12.000 euro over 120 maanden zonder rente = exact 100 per maand.
    expect(annuiteitMaandlast(12_000, 0, 120)).toBe(100);
  });

  it("weigert ongeldige invoer", () => {
    expect(() => annuiteitMaandlast(-1, 4, 360)).toThrow();
    expect(() => annuiteitMaandlast(Number.NaN, 4, 360)).toThrow();
    expect(() => annuiteitMaandlast(100_000, -0.1, 360)).toThrow();
    expect(() => annuiteitMaandlast(100_000, 4, 0)).toThrow();
  });
});

// Basisinvoer voor de maximaleHypotheek-tests; per test overschreven waar nodig.
const basis: MaximaleHypotheekInput = {
  inkomen1: 40_000,
  inkomen2: 35_000,
  toetsrentePct: 4.0,
  rentevastJaren: 10,
};

describe("maximaleHypotheek: realistische casus", () => {
  it("tweeverdieners 40k + 35k, 4% rente, 10 jaar vast: rond 322.000 euro", () => {
    // Aannames van de casus (gedocumenteerd):
    // - toetsinkomen = 40.000 + 35.000 = 75.000 (partnerinkomen telt in 2026
    //   volledig mee, art. 3 lid 6);
    // - tabel 1 (geen AOW), rij 75.000, kolom "3,501-4,000%": 24,6%;
    // - maandruimte = 75.000 / 12 * 0,246 = 1.537,50 (geen verplichtingen);
    // - hoofdsom = 1.537,50 * annuiteitenfactor bij 4% over 360 maanden
    //   (factor = (1 - 1,00333...^-360) / 0,00333... = 209,46...) = ~322.046.
    // Orde van grootte klopt met ~4,3 keer het gezamenlijke bruto inkomen.
    const uitkomst = maximaleHypotheek(basis);
    expect(uitkomst.gebruiktPct).toBe(24.6);
    expect(uitkomst.toetsrente).toBe(4.0);
    expect(uitkomst.labelExtra).toBe(0);
    expect(uitkomst.maximaal).toBeGreaterThan(310_000);
    expect(uitkomst.maximaal).toBeLessThan(335_000);
    // Consistentie: de maandlast van het maximum is precies de maandruimte
    // (op de afronding van de hoofdsom naar hele euro's na).
    expect(annuiteitMaandlast(uitkomst.maximaal, 4.0, TOETS_LOOPTIJD_MAANDEN)).toBeCloseTo(1_537.5, 1);
    expect(uitkomst.maandlast).toBe(Math.round(annuiteitMaandlast(uitkomst.maximaal, 4.0, TOETS_LOOPTIJD_MAANDEN)));
    // 322k valt binnen de NHG-kostengrens 2026 van 470.000 euro.
    expect(uitkomst.nhgMogelijk).toBe(true);
  });
});

describe("maximaleHypotheek: consistentie-eigenschappen", () => {
  it("hoger inkomen geeft een hogere maximale hypotheek", () => {
    const laag = maximaleHypotheek({ ...basis, inkomen1: 40_000, inkomen2: undefined });
    const midden = maximaleHypotheek({ ...basis, inkomen1: 60_000, inkomen2: undefined });
    const hoog = maximaleHypotheek({ ...basis, inkomen1: 80_000, inkomen2: undefined });
    expect(midden.maximaal).toBeGreaterThan(laag.maximaal);
    expect(hoog.maximaal).toBeGreaterThan(midden.maximaal);
  });

  it("een slechter energielabel geeft nooit een hogere maximale hypotheek", () => {
    // Van slechtst naar best; de bedragen van art. 4 lid 3 lopen mee op.
    const volgorde = ["EFG", "CD", "AB", "APlus_APlusPlus", "A3Plus", "A4Plus", "A4PlusGarantie"] as const;
    const zonderLabel = maximaleHypotheek(basis);
    let vorige = zonderLabel.maximaal;
    for (const klasse of volgorde) {
      const met = maximaleHypotheek({ ...basis, energielabelKlasse: klasse });
      expect(met.maximaal).toBeGreaterThanOrEqual(vorige);
      vorige = met.maximaal;
    }
    // E/F/G kent een bedrag van 0 euro: gelijk aan geen label opgeven.
    expect(maximaleHypotheek({ ...basis, energielabelKlasse: "EFG" }).maximaal).toBe(zonderLabel.maximaal);
    // A++++ met garantie: exact 40.000 euro bovenop het inkomensdeel (art. 4 lid 3).
    const beste = maximaleHypotheek({ ...basis, energielabelKlasse: "A4PlusGarantie" });
    expect(beste.maximaal - zonderLabel.maximaal).toBe(40_000);
    expect(beste.labelExtra).toBe(40_000);
  });

  it("verduurzamingsbudget telt het bedrag van art. 4 lid 4 op bij het labelbedrag", () => {
    // E/F/G: 0 (lid 3) + 20.000 (lid 4) = 20.000; A+++: 25.000 + 0 = 25.000.
    expect(maximaleHypotheek({ ...basis, energielabelKlasse: "EFG", verduurzamingsBudget: true }).labelExtra).toBe(20_000);
    expect(maximaleHypotheek({ ...basis, energielabelKlasse: "A3Plus", verduurzamingsBudget: true }).labelExtra).toBe(25_000);
    // Zonder bekend label geen labelbedrag, ook niet met verduurzamingsbudget.
    expect(maximaleHypotheek({ ...basis, verduurzamingsBudget: true }).labelExtra).toBe(0);
  });

  it("rentevast 5 jaar toetst op minstens de AFM-toetsrente van 5,0%", () => {
    // Geoffreerd 3,8% maar rentevast korter dan 10 jaar: toetsrente wordt 5,0%
    // en het percentage komt uit de kolom "4,501-5,000%" (rij 75.000: 26,4%).
    const kort = maximaleHypotheek({ ...basis, toetsrentePct: 3.8, rentevastJaren: 5 });
    expect(kort.toetsrente).toBe(AFM_TOETSRENTE_KORTER_DAN_10JR);
    expect(kort.gebruiktPct).toBe(26.4);
    // Geoffreerd boven de AFM-rente: dan geldt de geoffreerde rente (art. 3 lid 9c).
    const duur = maximaleHypotheek({ ...basis, toetsrentePct: 6.0, rentevastJaren: 5 });
    expect(duur.toetsrente).toBe(6.0);
    // Rentevast 10 jaar of langer: gewoon de geoffreerde rente.
    const lang = maximaleHypotheek({ ...basis, toetsrentePct: 3.8, rentevastJaren: 10 });
    expect(lang.toetsrente).toBe(3.8);
  });

  it("maandelijkse verplichtingen verlagen de maximale hypotheek", () => {
    const zonder = maximaleHypotheek(basis);
    const met = maximaleHypotheek({ ...basis, verplichtingenPerMaand: 500 });
    expect(met.maximaal).toBeLessThan(zonder.maximaal);
    // Verplichtingen groter dan de ruimte: eerlijk nul, ook het labelbedrag vervalt.
    const geenRuimte = maximaleHypotheek({
      ...basis,
      verplichtingenPerMaand: 10_000,
      energielabelKlasse: "A4PlusGarantie",
    });
    expect(geenRuimte.maximaal).toBe(0);
    expect(geenRuimte.maandlast).toBe(0);
    expect(geenRuimte.labelExtra).toBe(0);
  });

  it("gebruikt tabel 2 vanaf de AOW-leeftijd", () => {
    // Rij 50.000, kolom "3,501-4,000%": tabel 1 geeft 22,6%, tabel 2 geeft 28,6%.
    const invoer: MaximaleHypotheekInput = { inkomen1: 50_000, toetsrentePct: 4.0, rentevastJaren: 10 };
    expect(maximaleHypotheek(invoer).gebruiktPct).toBe(vindFinancieringslastPct("totAow", 50_000, 4.0));
    const aow = maximaleHypotheek({ ...invoer, aowLeeftijdBereikt: true });
    expect(aow.gebruiktPct).toBe(vindFinancieringslastPct("vanafAow", 50_000, 4.0));
    expect(aow.gebruiktPct).toBe(28.6);
  });

  it("nhgMogelijk is false boven de kostengrens", () => {
    // Toetsinkomen 150.000 bij 4%: ruim boven de 470.000 euro kostengrens.
    const hoog = maximaleHypotheek({ ...basis, inkomen1: 150_000, inkomen2: undefined });
    expect(hoog.maximaal).toBeGreaterThan(470_000);
    expect(hoog.nhgMogelijk).toBe(false);
  });

  it("weigert ongeldige invoer", () => {
    expect(() => maximaleHypotheek({ ...basis, inkomen1: -1 })).toThrow();
    expect(() => maximaleHypotheek({ ...basis, inkomen2: Number.NaN })).toThrow();
    expect(() => maximaleHypotheek({ ...basis, toetsrentePct: Number.NaN })).toThrow();
    expect(() => maximaleHypotheek({ ...basis, rentevastJaren: 0 })).toThrow();
    expect(() => maximaleHypotheek({ ...basis, verplichtingenPerMaand: -5 })).toThrow();
  });
});

describe("maandlastenOverzicht", () => {
  it("geeft per rente de afgeronde bruto maandlast over 30 jaar", () => {
    const regels = maandlastenOverzicht(300_000, [
      { label: "1 tot en met 5 jaar rentevast", pct: 3.5 },
      { label: "10 jaar rentevast", pct: 4.0 },
    ]);
    expect(regels).toHaveLength(2);
    expect(regels[0]).toEqual({
      label: "1 tot en met 5 jaar rentevast",
      pct: 3.5,
      maandlast: Math.round(annuiteitMaandlast(300_000, 3.5, TOETS_LOOPTIJD_MAANDEN)),
    });
    // Hogere rente betekent een hogere maandlast.
    expect(regels[1]!.maandlast).toBeGreaterThan(regels[0]!.maandlast);
  });

  it("respecteert een afwijkende looptijd en rente 0", () => {
    // 120.000 euro zonder rente over 240 maanden = exact 500 per maand.
    const [regel] = maandlastenOverzicht(120_000, [{ label: "test", pct: 0 }], 240);
    expect(regel!.maandlast).toBe(500);
  });

  it("geeft een lege lijst bij nul rentes", () => {
    expect(maandlastenOverzicht(300_000, [])).toEqual([]);
  });
});
