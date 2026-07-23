import { describe, expect, it } from "vitest";
import {
  AFM_TOETSRENTE_KORTER_DAN_10JR,
  ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING,
  NHG_GRENS_2026,
  NHG_GRENS_EBV_2026,
  NHG_PROVISIE_PCT,
  RENTEBANDEN,
  TABELLEN,
  VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING,
  vindFinancieringslastPct,
  type Renteband,
  type TabelNaam,
} from "@/lib/normen/leennormen-2026";

/**
 * Steekproeven letterlijk vergeleken met de primaire bron:
 * Wijzigingsregeling hypothecair krediet 2026, Staatscourant 2025, 36471
 * (zoek.officielebekendmakingen.nl/stcrt-2025-36471.html), bijlage 1.
 * Elke steekproef noemt tabel, rij en kolom zoals ze in de publicatie staan.
 */

/** Leest een cel direct uit de tabel: de rij met exact dit inkomenVanaf. */
function cel(tabel: TabelNaam, inkomenVanaf: number, band: Renteband): number {
  const rij = TABELLEN[tabel].rijen.find((r) => r.inkomenVanaf === inkomenVanaf);
  if (!rij) throw new Error(`geen rij met inkomenVanaf ${inkomenVanaf} in ${tabel}`);
  return rij.percentages[band];
}

describe("leennormen 2026: steekproefcellen tegen de bron", () => {
  it("Tabel 1 (AOW-leeftijd nog niet bereikt)", () => {
    // Tabel 1, rij "–" (eerste rij), kolom "<= 1,500%": 15,5%
    expect(cel("totAow", 0, "<= 1,500%")).toBe(15.5);
    // Tabel 1, rij "€ 30.000", kolom ">= 6,501%": 23,7%
    expect(cel("totAow", 30000, ">= 6,501%")).toBe(23.7);
    // Tabel 1, rij "€ 50.000", kolom "3,501-4,000%": 22,6%
    expect(cel("totAow", 50000, "3,501-4,000%")).toBe(22.6);
    // Tabel 1, rij "€ 80.000", kolom "2,001-2,500%": 22,2%
    expect(cel("totAow", 80000, "2,001-2,500%")).toBe(22.2);
    // Tabel 1, rij "€ 125.000" (laatste rij), kolom "<= 1,500%": 22,2%
    expect(cel("totAow", 125000, "<= 1,500%")).toBe(22.2);
    // Tabel 1, rij "€ 125.000" (laatste rij), kolom ">= 6,501%": 32,2%
    expect(cel("totAow", 125000, ">= 6,501%")).toBe(32.2);
  });

  it("Tabel 2 (AOW-leeftijd reeds bereikt)", () => {
    // Tabel 2, rij "–" (eerste rij), kolom "<= 1,500%": 18,5%
    expect(cel("vanafAow", 0, "<= 1,500%")).toBe(18.5);
    // Tabel 2, rij "€ 29.000", kolom "<= 1,500%": 18,5% (gelijk aan de "–"-rij)
    expect(cel("vanafAow", 29000, "<= 1,500%")).toBe(18.5);
    // Tabel 2, rij "€ 70.000", kolom "4,501-5,000%": 36,9%
    expect(cel("vanafAow", 70000, "4,501-5,000%")).toBe(36.9);
    // Tabel 2, rij "€ 110.000" (laatste rij), kolom ">= 6,501%": 41,7%
    expect(cel("vanafAow", 110000, ">= 6,501%")).toBe(41.7);
  });

  it("Tabel 3 (niet fiscaal aftrekbaar, AOW-leeftijd nog niet bereikt)", () => {
    // Tabel 3, rij "–" (eerste rij), kolom "<= 1,500%": 14,0%
    expect(cel("nietAftrekbaarTotAow", 0, "<= 1,500%")).toBe(14.0);
    // Tabel 3, rij "€ 40.000", kolom "2,001-2,500%": 16,4%
    expect(cel("nietAftrekbaarTotAow", 40000, "2,001-2,500%")).toBe(16.4);
    // Tabel 3, rij "€ 125.000" (laatste rij), kolom ">= 6,501%": 24,0%
    expect(cel("nietAftrekbaarTotAow", 125000, ">= 6,501%")).toBe(24.0);
  });

  it("Tabel 4 (niet fiscaal aftrekbaar, AOW-leeftijd reeds bereikt)", () => {
    // Tabel 4, rij "–" (eerste rij), kolom "<= 1,500%": 17,9%
    expect(cel("nietAftrekbaarVanafAow", 0, "<= 1,500%")).toBe(17.9);
    // Tabel 4, rij "€ 60.000", kolom "5,001-5,500%": 26,0%
    expect(cel("nietAftrekbaarVanafAow", 60000, "5,001-5,500%")).toBe(26.0);
    // Tabel 4, rij "€ 110.000" (laatste rij), kolom ">= 6,501%": 30,6%
    expect(cel("nietAftrekbaarVanafAow", 110000, ">= 6,501%")).toBe(30.6);
  });
});

describe("leennormen 2026: structuur van de tabellen", () => {
  it("heeft de juiste aantallen rijen en banden", () => {
    // Bron: 96 eurorijen (30.000 t/m 125.000) plus de "–"-rij = 97 (tot AOW),
    // 82 eurorijen (29.000 t/m 110.000) plus de "–"-rij = 83 (vanaf AOW).
    expect(TABELLEN.totAow.rijen).toHaveLength(97);
    expect(TABELLEN.vanafAow.rijen).toHaveLength(83);
    expect(TABELLEN.nietAftrekbaarTotAow.rijen).toHaveLength(97);
    expect(TABELLEN.nietAftrekbaarVanafAow.rijen).toHaveLength(83);
    expect(RENTEBANDEN).toHaveLength(12);
  });

  it("heeft per rij 12 percentages, oplopende inkomens en plausibele waarden", () => {
    for (const { rijen } of Object.values(TABELLEN)) {
      expect(rijen[0]!.inkomenVanaf).toBe(0);
      for (let i = 1; i < rijen.length; i++) {
        expect(rijen[i]!.inkomenVanaf).toBeGreaterThan(rijen[i - 1]!.inkomenVanaf);
      }
      for (const rij of rijen) {
        const waarden = RENTEBANDEN.map((band) => rij.percentages[band]);
        expect(waarden).toHaveLength(12);
        for (const w of waarden) {
          expect(w).toBeGreaterThan(5);
          expect(w).toBeLessThan(50);
          // Bron rondt af op 0,1 procentpunt (toelichting par. 3.3).
          expect(Math.round(w * 10)).toBeCloseTo(w * 10, 10);
        }
      }
    }
  });
});

describe("vindFinancieringslastPct: rij- en bandkeuze", () => {
  it("kiest bij een inkomen tussen twee rijen de naastgelegen lagere rij", () => {
    // Tabel 2: rij "€ 29.000" heeft 18,5% en rij "€ 30.000" heeft 19,2% in
    // kolom "<= 1,500%"; € 29.500 valt trapsgewijs op de 29.000-rij.
    expect(vindFinancieringslastPct("vanafAow", 29500, 1.2)).toBe(18.5);
    // Tabel 1: rij "€ 33.000" heeft 17,1% en rij "€ 34.000" heeft 17,3% in
    // kolom "<= 1,500%"; € 33.999 hoort nog bij de 33.000-rij.
    expect(vindFinancieringslastPct("totAow", 33999, 1.0)).toBe(17.1);
    expect(vindFinancieringslastPct("totAow", 34000, 1.0)).toBe(17.3);
  });

  it('valt onder de laagste eurorij terug op de "–"-rij', () => {
    // Tabel 1, rij "–", kolom "<= 1,500%": 15,5%
    expect(vindFinancieringslastPct("totAow", 20000, 1.0)).toBe(15.5);
    expect(vindFinancieringslastPct("totAow", 0, 1.0)).toBe(15.5);
  });

  it("gebruikt boven de hoogste rij de hoogste rij", () => {
    // Tabel 1, rij "€ 125.000", kolom "<= 1,500%": 22,2%
    expect(vindFinancieringslastPct("totAow", 200000, 1.0)).toBe(22.2);
    // Tabel 2, rij "€ 110.000", kolom ">= 6,501%": 41,7%
    expect(vindFinancieringslastPct("vanafAow", 150000, 7.0)).toBe(41.7);
  });

  it("legt een toetsrente exact op de bandgrens in de juiste band", () => {
    // Kolommen: "<= 1,500%" en "1,501-2,000%"; rij "€ 50.000" van Tabel 1
    // heeft daar 17,4% respectievelijk 18,5%.
    expect(vindFinancieringslastPct("totAow", 50000, 1.5)).toBe(17.4);
    expect(vindFinancieringslastPct("totAow", 50000, 1.501)).toBe(18.5);
    expect(vindFinancieringslastPct("totAow", 50000, 2.0)).toBe(18.5);
    // Kolommen "6,001-6,500%" (27,3%) en ">= 6,501%" (28,1%) op dezelfde rij.
    expect(vindFinancieringslastPct("totAow", 50000, 6.5)).toBe(27.3);
    expect(vindFinancieringslastPct("totAow", 50000, 6.501)).toBe(28.1);
    expect(vindFinancieringslastPct("totAow", 50000, 12)).toBe(28.1);
  });

  it("gebruikt de AFM-toetsrente van 5,0% in kolom 4,501-5,000%", () => {
    // Tabel 1, rij "€ 50.000", kolom "4,501-5,000%": 24,6%
    expect(vindFinancieringslastPct("totAow", 50000, AFM_TOETSRENTE_KORTER_DAN_10JR)).toBe(24.6);
  });

  it("weigert ongeldige invoer", () => {
    expect(() => vindFinancieringslastPct("totAow", -1, 4)).toThrow();
    expect(() => vindFinancieringslastPct("totAow", Number.NaN, 4)).toThrow();
    expect(() => vindFinancieringslastPct("totAow", 50000, -0.5)).toThrow();
    expect(() => vindFinancieringslastPct("totAow", 50000, Number.NaN)).toThrow();
  });
});

describe("constanten uit de regeling en NHG", () => {
  it("energielabelbedragen artikel 4, derde lid", () => {
    // Bron: "E, F, G € 0 · C, D € 5.000 · A, B € 10.000 · A+, A++ € 20.000 ·
    // A+++ € 25.000 · A++++ € 30.000 · A++++ (met een energieprestatiegarantie
    // afgegeven voor een periode van ten minste tien jaar) € 40.000".
    expect(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING).toEqual({
      EFG: 0,
      CD: 5000,
      AB: 10000,
      APlus_APlusPlus: 20000,
      A3Plus: 25000,
      A4Plus: 30000,
      A4PlusGarantie: 40000,
    });
  });

  it("verduurzamingsbedragen artikel 4, vierde lid", () => {
    // Bron: "E, F, G € 20.000 · C, D € 15.000 · A, B € 10.000 ·
    // A+, A++ € 10.000 · A+++ € 0 · A++++ € 0 · A++++ (met garantie) € 0".
    expect(VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING).toEqual({
      EFG: 20000,
      CD: 15000,
      AB: 10000,
      APlus_APlusPlus: 10000,
      A3PlusEnBeter: 0,
    });
  });

  it("NHG 2026 en AFM-toetsrente", () => {
    expect(NHG_GRENS_2026).toBe(470000);
    expect(NHG_GRENS_EBV_2026).toBe(498200);
    expect(NHG_PROVISIE_PCT).toBe(0.4);
    expect(AFM_TOETSRENTE_KORTER_DAN_10JR).toBe(5.0);
  });
});
