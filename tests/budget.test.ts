import { describe, expect, it } from "vitest";
import {
  berekenBudget,
  ENERGIELABEL_OPTIES,
  INDICATIE_MARGE_PCT,
  RENTEVAST_BUCKET,
  RENTEVAST_KEUZES,
  type BudgetInvoer,
} from "@/app/budget/berekening";
import { getRenteBucket } from "@/lib/bronnen/rentes";
import { annuiteitMaandlast, maximaleHypotheek, TOETS_LOOPTIJD_MAANDEN } from "@/lib/hypotheek";
import { ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING, NHG_GRENS_2026, NHG_PROVISIE_PCT } from "@/lib/normen/leennormen-2026";

/**
 * Budgetberekenaar (app/budget): pure mapping-laag, geen database nodig.
 * Kernbewering: de zichtbare rekenuitkomst van de tool is exact de uitkomst
 * van lib/hypotheek.ts; app/budget/berekening.ts voegt alleen afgeleiden toe
 * (indicatiemarge, toetsinkomen, NHG-constanten) en mag zelf geen rekenregels
 * introduceren (geen UI-drift).
 */

// De casus zoals een bezoeker hem invult: tweeverdieners, rentevast 10 jaar
// met de DNB-voorinvulling die de UI toont, 250 euro verplichtingen, label A/B.
const dnbRente10Jaar = getRenteBucket(RENTEVAST_BUCKET[10])!.rentePct;
const casus: BudgetInvoer = {
  inkomen1: 48_000,
  inkomen2: 42_000,
  rentevastJaren: 10,
  rentePct: dnbRente10Jaar,
  verplichtingenPerMaand: 250,
  aowLeeftijdBereikt: false,
  energielabelKlasse: "AB",
};

describe("berekenBudget: zichtbare uitkomst == lib/hypotheek (geen UI-drift)", () => {
  it("geeft voor de casus exact de kernuitkomst van maximaleHypotheek door", () => {
    const zichtbaar = berekenBudget(casus);
    const kern = maximaleHypotheek({
      inkomen1: casus.inkomen1,
      inkomen2: casus.inkomen2,
      toetsrentePct: casus.rentePct,
      rentevastJaren: casus.rentevastJaren,
      energielabelKlasse: casus.energielabelKlasse,
      aowLeeftijdBereikt: casus.aowLeeftijdBereikt,
      verplichtingenPerMaand: casus.verplichtingenPerMaand,
    });

    // De cijfers die de UI toont, ongewijzigd uit de rekenkern.
    expect(zichtbaar.maximaal).toBe(kern.maximaal);
    expect(zichtbaar.maandlast).toBe(kern.maandlast);
    expect(zichtbaar.gebruiktPct).toBe(kern.gebruiktPct);
    expect(zichtbaar.toetsrente).toBe(kern.toetsrente);
    expect(zichtbaar.labelExtra).toBe(kern.labelExtra);
    expect(zichtbaar.nhgMogelijk).toBe(kern.nhgMogelijk);

    // Afgeleiden van de tool: alleen presentatie, herleidbaar uit de kern.
    expect(zichtbaar.toetsinkomen).toBe(90_000);
    expect(zichtbaar.laag).toBe(Math.round(kern.maximaal * (1 - INDICATIE_MARGE_PCT / 100)));
    expect(zichtbaar.hoog).toBe(Math.round(kern.maximaal * (1 + INDICATIE_MARGE_PCT / 100)));
    // Rentevast 10 jaar: geen AFM-override, dus geen aparte eigen-rente-maandlast.
    expect(zichtbaar.toetsrente).toBe(casus.rentePct);
    expect(zichtbaar.maandlastBijEigenRente).toBeNull();
    // NHG-weergave gebruikt de normconstanten zelf, geen kopie.
    expect(zichtbaar.nhgGrens).toBe(NHG_GRENS_2026);
    expect(zichtbaar.nhgProvisiePct).toBe(NHG_PROVISIE_PCT);
    // Sanity: de casus levert een echt bedrag op met label-extra erin.
    expect(zichtbaar.maximaal).toBeGreaterThan(0);
    expect(zichtbaar.labelExtra).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.AB);
  });

  it("past bij rentevast korter dan 10 jaar de AFM-toetsrente toe en toont de eigen-rente-maandlast apart", () => {
    const dnbRente5Jaar = getRenteBucket(RENTEVAST_BUCKET[5])!.rentePct;
    // De DNB-voorinvulling ligt onder de 5%: de wet toetst dan op 5,0%.
    expect(dnbRente5Jaar).toBeLessThan(5);
    const u = berekenBudget({ ...casus, rentevastJaren: 5, rentePct: dnbRente5Jaar });
    expect(u.toetsrente).toBe(5.0);
    expect(u.maandlastBijEigenRente).toBe(
      Math.round(annuiteitMaandlast(u.maximaal, dnbRente5Jaar, TOETS_LOOPTIJD_MAANDEN)),
    );
    // Bij de lagere eigen rente is de maandlast lager dan bij de toetsrente.
    expect(u.maandlastBijEigenRente!).toBeLessThan(u.maandlast);
  });

  it("is eerlijk bij nul leenruimte: alles nul en geen eigen-rente-maandlast", () => {
    const u = berekenBudget({ ...casus, verplichtingenPerMaand: 10_000 });
    expect(u.maximaal).toBe(0);
    expect(u.maandlast).toBe(0);
    expect(u.laag).toBe(0);
    expect(u.hoog).toBe(0);
    expect(u.labelExtra).toBe(0);
    expect(u.maandlastBijEigenRente).toBeNull();
  });
});

describe("rente-voorinvulling: rentevast-keuze naar DNB-bucket", () => {
  it("wijst elke keuze aan de juiste DNB-bucket toe", () => {
    // 5 jaar valt in "1 tot en met 5", 10 jaar in "5 tot en met 10" (de bucket
    // dekt langer dan 5 tot en met 10), 20 en 30 jaar in "langer dan 10".
    expect(RENTEVAST_BUCKET[5]).toBe("1_tot_5");
    expect(RENTEVAST_BUCKET[10]).toBe("5_tot_10");
    expect(RENTEVAST_BUCKET[20]).toBe("vanaf_10");
    expect(RENTEVAST_BUCKET[30]).toBe("vanaf_10");
  });

  it("heeft voor elke keuze een bestaande bucket met een plausibele rente in de snapshot", () => {
    for (const keuze of RENTEVAST_KEUZES) {
      const bucket = getRenteBucket(RENTEVAST_BUCKET[keuze]);
      expect(bucket, `bucket voor ${keuze} jaar`).toBeDefined();
      expect(bucket!.rentePct).toBeGreaterThan(0);
      expect(bucket!.rentePct).toBeLessThan(15);
    }
  });
});

describe("energielabel-opties in het formulier", () => {
  it("dekken elke normklasse precies een keer, met het letterlijke normbedrag", () => {
    const klassen = ENERGIELABEL_OPTIES.map((o) => o.klasse);
    expect([...klassen].sort()).toEqual(Object.keys(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING).sort());
    expect(new Set(klassen).size).toBe(klassen.length);
    for (const o of ENERGIELABEL_OPTIES) {
      expect(o.bedrag).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING[o.klasse]);
      expect(o.label.length).toBeGreaterThan(0);
    }
  });

  it("het gekozen label werkt door in de uitkomst zoals de norm voorschrijft", () => {
    const zonder = berekenBudget({ ...casus, energielabelKlasse: undefined });
    const met = berekenBudget({ ...casus, energielabelKlasse: "APlus_APlusPlus" });
    expect(met.maximaal - zonder.maximaal).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.APlus_APlusPlus);
    expect(met.labelExtra).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.APlus_APlusPlus);
  });
});
