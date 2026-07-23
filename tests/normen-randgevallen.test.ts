import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";
import {
  annuiteitMaandlast,
  maximaleHypotheek,
  TOETS_LOOPTIJD_MAANDEN,
  type MaximaleHypotheekInput,
} from "@/lib/hypotheek";
import {
  AFM_TOETSRENTE_KORTER_DAN_10JR,
  ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING,
  NHG_GRENS_2026,
  NHG_GRENS_EBV_2026,
  vindFinancieringslastPct,
} from "@/lib/normen/leennormen-2026";
import { berekenWaarde } from "@/lib/avm";
import type { Comparable } from "@/lib/comparables";

/**
 * Randgevallen van de rekenkern: exacte tabelgrenzen, toetsrente-banden,
 * partnerinkomen, energielabelbedragen, NHG-grenzen, annuiteit-extremen en
 * afronding (lib/hypotheek + lib/normen/leennormen-2026), plus de
 * AVM/bandbreedte-randgevallen (lib/avm, lib/comparables).
 *
 * De verwachte percentages komen letterlijk uit bijlage 1 van de
 * Wijzigingsregeling hypothecair krediet 2026 (Staatscourant 2025, 36471),
 * via lib/normen/leennormen-2026.ts; elke steekproef noemt rij en kolom.
 * Alleen het comparables-deel raakt de testdatabase (dynamische import na
 * maakTestDb); de rest is pure rekenlogica.
 */

// Dynamische import NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let comparables: typeof import("@/lib/comparables");

function maandenGeleden(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  comparables = await import("@/lib/comparables");

  await db.insert(schema.municipalities).values({ code: "GM0800", naam: "Randgeval", slug: "randgeval" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU8", naam: "Grenswijk", slug: "grenswijk", gemeenteCode: "GM0800" });

  const rows: Array<{ straat: string; maanden: number; opp: number; type: "tussenwoning" | "appartement"; prijs: number }> = [
    // Grensstraat: precies 5 passende verkopen, inclusief de exacte
    // oppervlaktegrenzen 0,7x (70) en 1,4x (140) van doeloppervlakte 100.
    { straat: "Grensstraat", maanden: 1, opp: 70, type: "tussenwoning", prijs: 280000 },
    { straat: "Grensstraat", maanden: 2, opp: 100, type: "tussenwoning", prijs: 400000 },
    { straat: "Grensstraat", maanden: 3, opp: 100, type: "tussenwoning", prijs: 405000 },
    { straat: "Grensstraat", maanden: 4, opp: 100, type: "tussenwoning", prijs: 398000 },
    { straat: "Grensstraat", maanden: 5, opp: 140, type: "tussenwoning", prijs: 560000 },
    // Net buiten de oppervlakteklasse: 69 en 141 vallen af.
    { straat: "Grensstraat", maanden: 1, opp: 69, type: "tussenwoning", prijs: 222222 },
    { straat: "Grensstraat", maanden: 1, opp: 141, type: "tussenwoning", prijs: 333333 },
    // Verkeerd type en buiten het 24-maandenvenster: vallen af.
    { straat: "Grensstraat", maanden: 2, opp: 100, type: "appartement", prijs: 444444 },
    { straat: "Grensstraat", maanden: 30, opp: 100, type: "tussenwoning", prijs: 111111 },
    // Vierstraat: 4 passende straatverkopen, net onder de drempel van 5.
    { straat: "Vierstraat", maanden: 1, opp: 100, type: "tussenwoning", prijs: 390000 },
    { straat: "Vierstraat", maanden: 2, opp: 100, type: "tussenwoning", prijs: 392000 },
    { straat: "Vierstraat", maanden: 3, opp: 100, type: "tussenwoning", prijs: 394000 },
    { straat: "Vierstraat", maanden: 4, opp: 100, type: "tussenwoning", prijs: 396000 },
  ];
  for (const r of rows) {
    await db
      .insert(schema.sales)
      .values({ buurtCode: "BU8", straat: r.straat, adresId: null, datum: maandenGeleden(r.maanden), prijs: r.prijs, oppervlakteM2: r.opp, woningtype: r.type, bron: "seed" });
  }
});

/* ------------------------------------------------------------------------- */
/* 1. Tabelgrens-inkomens: trapsgewijs, geen interpolatie (art. 3 lid 5)      */
/* ------------------------------------------------------------------------- */

describe("leennormen: exacte tabelgrens-inkomens (trapsgewijs, geen interpolatie)", () => {
  it("springt tussen twee treden pas op de trede zelf (tabel 1, 62.000 naar 63.000)", () => {
    // Tabel 1, kolom "2,501-3,000%": rij 62.000 heeft 20,7%, rij 63.000 20,9%.
    expect(vindFinancieringslastPct("totAow", 62000, 2.8)).toBe(20.7);
    expect(vindFinancieringslastPct("totAow", 62999, 2.8)).toBe(20.7);
    expect(vindFinancieringslastPct("totAow", 63000, 2.8)).toBe(20.9);
    // Precies tussenin blijft de lagere rij gelden; 20,8 (interpolatie) mag
    // nooit voorkomen, de regeling kent geen interpolatievoorschrift.
    expect(vindFinancieringslastPct("totAow", 62500, 2.8)).toBe(20.7);
    expect(vindFinancieringslastPct("totAow", 62500, 2.8)).not.toBe(20.8);
  });

  it("werkt hetzelfde door de hele keten van maximaleHypotheek", () => {
    const invoer: MaximaleHypotheekInput = { inkomen1: 62999, toetsrentePct: 2.8, rentevastJaren: 10 };
    expect(maximaleHypotheek(invoer).gebruiktPct).toBe(20.7);
    expect(maximaleHypotheek({ ...invoer, inkomen1: 63000 }).gebruiktPct).toBe(20.9);
  });

  it("hanteert de eerste eurotrede van tabel 2 (29.000 naar 30.000, vanaf AOW)", () => {
    // Tabel 2, kolom "<= 1,500%": rij 29.000 heeft 18,5%, rij 30.000 19,2%.
    const invoer: MaximaleHypotheekInput = { inkomen1: 29999, toetsrentePct: 1.2, rentevastJaren: 10, aowLeeftijdBereikt: true };
    expect(maximaleHypotheek(invoer).gebruiktPct).toBe(18.5);
    expect(maximaleHypotheek({ ...invoer, inkomen1: 30000 }).gebruiktPct).toBe(19.2);
  });

  it("gebruikt boven de hoogste rij de hoogste rij, ook via maximaleHypotheek", () => {
    // Tabel 1, rij 125.000 (hoogste), kolom "3,501-4,000%": 27,4%.
    expect(vindFinancieringslastPct("totAow", 1_000_000, 4.0)).toBe(27.4);
    expect(maximaleHypotheek({ inkomen1: 1_000_000, toetsrentePct: 4.0, rentevastJaren: 10 }).gebruiktPct).toBe(27.4);
  });
});

/* ------------------------------------------------------------------------- */
/* 2. Toetsrente-banden en de AFM-grens bij rentevast korter dan 10 jaar      */
/* ------------------------------------------------------------------------- */

describe("toetsrente-banden en de AFM-toetsrente (art. 3 lid 9c en 10)", () => {
  // Tabel 1, rij 75.000: kolommen "<= 1,500%" 19,4 · "1,501-2,000%" 20,5 ·
  // "3,501-4,000%" 24,6 · "4,501-5,000%" 26,4 · "5,001-5,500%" 27,3.
  const basis: MaximaleHypotheekInput = { inkomen1: 75_000, toetsrentePct: 3.8, rentevastJaren: 10 };

  it("rentevast precies 10 jaar gebruikt de geoffreerde rente (geen AFM-vloer)", () => {
    const uitkomst = maximaleHypotheek(basis);
    expect(uitkomst.toetsrente).toBe(3.8);
    expect(uitkomst.gebruiktPct).toBe(24.6);
  });

  it("rentevast 9 jaar (net onder 10) activeert de AFM-vloer van 5,0%", () => {
    const uitkomst = maximaleHypotheek({ ...basis, rentevastJaren: 9 });
    expect(uitkomst.toetsrente).toBe(AFM_TOETSRENTE_KORTER_DAN_10JR);
    expect(uitkomst.gebruiktPct).toBe(26.4);
  });

  it("geoffreerd precies 5,0% bij kort rentevast blijft in de band 4,501-5,000%", () => {
    // De band dekt (4,500%, 5,000%]: 5,0 hoort er nog bij, 5,001 niet meer.
    const opDeGrens = maximaleHypotheek({ ...basis, toetsrentePct: 5.0, rentevastJaren: 5 });
    expect(opDeGrens.toetsrente).toBe(5.0);
    expect(opDeGrens.gebruiktPct).toBe(26.4);
    const netErboven = maximaleHypotheek({ ...basis, toetsrentePct: 5.001, rentevastJaren: 5 });
    expect(netErboven.toetsrente).toBe(5.001);
    expect(netErboven.gebruiktPct).toBe(27.3);
  });

  it("legt bandgrenzen bij lang rentevast op (grens, grens]-conventie", () => {
    expect(maximaleHypotheek({ ...basis, toetsrentePct: 1.5 }).gebruiktPct).toBe(19.4);
    expect(maximaleHypotheek({ ...basis, toetsrentePct: 1.501 }).gebruiktPct).toBe(20.5);
  });
});

/* ------------------------------------------------------------------------- */
/* 3. Partnerinkomen telt volledig mee (art. 3 lid 6)                         */
/* ------------------------------------------------------------------------- */

describe("partnerinkomen telt volledig mee", () => {
  it("twee inkomens geven exact dezelfde uitkomst als een inkomen van de som", () => {
    const samen = maximaleHypotheek({ inkomen1: 40_000, inkomen2: 35_000, toetsrentePct: 4.0, rentevastJaren: 10 });
    const alleen = maximaleHypotheek({ inkomen1: 75_000, toetsrentePct: 4.0, rentevastJaren: 10 });
    expect(samen).toEqual(alleen);
  });

  it("is symmetrisch in de volgorde van de inkomens", () => {
    const a = maximaleHypotheek({ inkomen1: 40_000, inkomen2: 35_000, toetsrentePct: 4.0, rentevastJaren: 10 });
    const b = maximaleHypotheek({ inkomen1: 35_000, inkomen2: 40_000, toetsrentePct: 4.0, rentevastJaren: 10 });
    const c = maximaleHypotheek({ inkomen1: 0, inkomen2: 75_000, toetsrentePct: 4.0, rentevastJaren: 10 });
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });
});

/* ------------------------------------------------------------------------- */
/* 4. Energielabelbedragen per klasse (art. 4 lid 3 en 4)                     */
/* ------------------------------------------------------------------------- */

describe("energielabelbedragen buiten beschouwing", () => {
  const basis: MaximaleHypotheekInput = { inkomen1: 75_000, toetsrentePct: 4.0, rentevastJaren: 10 };

  it("telt per labelklasse exact het bedrag van art. 4 lid 3 op", () => {
    const zonder = maximaleHypotheek(basis);
    for (const [klasse, bedrag] of Object.entries(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING)) {
      const met = maximaleHypotheek({ ...basis, energielabelKlasse: klasse as keyof typeof ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING });
      expect(met.labelExtra).toBe(bedrag);
      expect(met.maximaal - zonder.maximaal).toBe(bedrag);
    }
    // De uitersten expliciet: E/F/G 0 euro, A++++ met garantie 40.000 euro.
    expect(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.EFG).toBe(0);
    expect(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.A4PlusGarantie).toBe(40_000);
  });

  it("telt met verduurzamingsbudget de som van lid 3 en lid 4 op", () => {
    // Lid 3 + lid 4 per klasse: EFG 0+20.000, CD 5.000+15.000, AB 10.000+10.000,
    // A+/A++ 20.000+10.000, A+++ 25.000+0, A++++ 30.000+0, A++++ garantie 40.000+0.
    const verwacht = {
      EFG: 20_000,
      CD: 20_000,
      AB: 20_000,
      APlus_APlusPlus: 30_000,
      A3Plus: 25_000,
      A4Plus: 30_000,
      A4PlusGarantie: 40_000,
    } as const;
    for (const [klasse, bedrag] of Object.entries(verwacht)) {
      const met = maximaleHypotheek({
        ...basis,
        energielabelKlasse: klasse as keyof typeof ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING,
        verduurzamingsBudget: true,
      });
      expect(met.labelExtra).toBe(bedrag);
    }
  });
});

/* ------------------------------------------------------------------------- */
/* 5. NHG-grens en EBV-grens                                                  */
/* ------------------------------------------------------------------------- */

describe("NHG-kostengrens en EBV-grens", () => {
  it("gebruikt tussen de twee grenzen de EBV-grens alleen met verduurzamingsbudget", () => {
    // Inkomen 105.000 bij 4% (tabel 1, rij 105.000, kolom "3,501-4,000%":
    // 26,5%) levert een maximum tussen de gewone grens (470.000) en de
    // EBV-grens (498.200): maandruimte 2.318,75, hoofdsom ~485.700.
    const invoer: MaximaleHypotheekInput = { inkomen1: 105_000, toetsrentePct: 4.0, rentevastJaren: 10 };
    const zonder = maximaleHypotheek(invoer);
    expect(zonder.gebruiktPct).toBe(26.5);
    expect(zonder.maximaal).toBeGreaterThan(NHG_GRENS_2026);
    expect(zonder.maximaal).toBeLessThanOrEqual(NHG_GRENS_EBV_2026);
    expect(zonder.nhgMogelijk).toBe(false);

    // Zelfde bedrag, maar met energiebesparende voorzieningen geldt de hogere
    // EBV-grens (zonder opgegeven label komt er geen labelbedrag bij).
    const metEbv = maximaleHypotheek({ ...invoer, verduurzamingsBudget: true });
    expect(metEbv.maximaal).toBe(zonder.maximaal);
    expect(metEbv.nhgMogelijk).toBe(true);

    // Met het hoogste labelbedrag erbij schiet het maximum ook over de
    // EBV-grens heen: dan is NHG ook met verduurzaming niet meer in beeld.
    const teHoog = maximaleHypotheek({ ...invoer, verduurzamingsBudget: true, energielabelKlasse: "A4PlusGarantie" });
    expect(teHoog.maximaal).toBe(zonder.maximaal + 40_000);
    expect(teHoog.maximaal).toBeGreaterThan(NHG_GRENS_EBV_2026);
    expect(teHoog.nhgMogelijk).toBe(false);
  });
});

/* ------------------------------------------------------------------------- */
/* 6. Annuiteit bij rente 0 en extreem hoge rente                             */
/* ------------------------------------------------------------------------- */

describe("annuiteitformule: rente 0 en extreem hoge rente", () => {
  it("rekent bij rente 0 exact lineair, door de hele keten heen", () => {
    expect(annuiteitMaandlast(360_000, 0, 360)).toBe(1000);
    // Tabel 1, rij 75.000, kolom "<= 1,500%": 19,4%. Maandruimte
    // 75.000 / 12 * 0,194 = 1.212,50; hoofdsom decimaal 436.500. In binaire
    // floats is 0,194 net niet exact (1.212,4999...), en Math.floor rondt dan
    // naar 436.499: een euro lager, dus altijd de voorzichtige kant op.
    const uitkomst = maximaleHypotheek({ inkomen1: 75_000, toetsrentePct: 0, rentevastJaren: 10 });
    expect(uitkomst.toetsrente).toBe(0);
    expect(uitkomst.gebruiktPct).toBe(19.4);
    expect(uitkomst.maximaal).toBe(436_499);
    expect(uitkomst.maximaal).toBeLessThanOrEqual(436_500); // nooit boven het decimale maximum
    expect(uitkomst.maandlast).toBe(Math.round(436_499 / 360)); // 1.212
  });

  it("blijft eindig en boven het pure rentedeel bij extreem hoge rente", () => {
    // Bij 100% jaarrente is de aflossingscomponent verwaarloosbaar: de
    // maandlast nadert hoofdsom maal maandrente (100.000 * 100 / 1200).
    const maandlast = annuiteitMaandlast(100_000, 100, 360);
    expect(Number.isFinite(maandlast)).toBe(true);
    expect(maandlast).toBeGreaterThan((100_000 * 100) / 1200);
    expect(maandlast).toBeCloseTo(8333.33, 1);
  });

  it("geeft bij een extreme toetsrente een klein maar consistent maximum", () => {
    // Toetsrente 60% valt in de open band ">= 6,501%" (rij 75.000: 29,5%).
    const uitkomst = maximaleHypotheek({ inkomen1: 75_000, toetsrentePct: 60, rentevastJaren: 10 });
    expect(uitkomst.gebruiktPct).toBe(29.5);
    expect(Number.isFinite(uitkomst.maximaal)).toBe(true);
    expect(uitkomst.maximaal).toBeGreaterThan(0);
    expect(uitkomst.maximaal).toBeLessThan(40_000);
    expect(uitkomst.maandlast).toBe(Math.round(annuiteitMaandlast(uitkomst.maximaal, 60, TOETS_LOOPTIJD_MAANDEN)));
  });
});

/* ------------------------------------------------------------------------- */
/* 7. Afronding consistent                                                    */
/* ------------------------------------------------------------------------- */

describe("afronding", () => {
  it("levert hele euro's en een maandlast die bij het maximum hoort", () => {
    const gevallen: MaximaleHypotheekInput[] = [
      { inkomen1: 41_500, toetsrentePct: 3.7, rentevastJaren: 10 },
      { inkomen1: 75_000, inkomen2: 12_345, toetsrentePct: 4.2, rentevastJaren: 20 },
      { inkomen1: 63_000, toetsrentePct: 2.8, rentevastJaren: 5, verplichtingenPerMaand: 150 },
      { inkomen1: 90_000, toetsrentePct: 3.9, rentevastJaren: 10, energielabelKlasse: "AB" },
    ];
    for (const invoer of gevallen) {
      const uitkomst = maximaleHypotheek(invoer);
      expect(Number.isInteger(uitkomst.maximaal)).toBe(true);
      expect(Number.isInteger(uitkomst.maandlast)).toBe(true);
      expect(Number.isInteger(uitkomst.labelExtra)).toBe(true);
      expect(uitkomst.maandlast).toBe(Math.round(annuiteitMaandlast(uitkomst.maximaal, uitkomst.toetsrente, TOETS_LOOPTIJD_MAANDEN)));
    }
  });

  it("rondt de hoofdsom naar beneden af: de maandlast overschrijdt de ruimte nooit", () => {
    // Zonder labelbedrag is de maandlast van het maximum hooguit gelijk aan de
    // maandelijkse ruimte (Math.floor op de hoofdsom rondt nooit omhoog).
    const invoer: MaximaleHypotheekInput = { inkomen1: 68_432, toetsrentePct: 3.3, rentevastJaren: 10 };
    const uitkomst = maximaleHypotheek(invoer);
    const ruimte = (68_432 / 12) * (uitkomst.gebruiktPct / 100);
    expect(annuiteitMaandlast(uitkomst.maximaal, uitkomst.toetsrente, TOETS_LOOPTIJD_MAANDEN)).toBeLessThanOrEqual(ruimte + 1e-6);
  });
});

/* ------------------------------------------------------------------------- */
/* 8. AVM: comps-drempels en IQR-clamp                                        */
/* ------------------------------------------------------------------------- */

function comp(prijs: number, opp: number, id: number): Comparable {
  return { id, buurtCode: "BU8", straat: "Grensstraat", datum: "2026-05-01", prijs, oppervlakteM2: opp, woningtype: "tussenwoning", bron: "seed" };
}

const avmBasis = { oppervlakteM2: 100, bouwjaar: 1990, woningtype: "tussenwoning" as const, energielabel: "C" };

describe("AVM: precies 4 versus 3 comparables en de IQR-clamp", () => {
  it("schakelt op precies 4 comps naar het IQR-interval, op 3 naar de maximale marge", () => {
    // 4 identieke comps: IQR 0, dus clamp op de ondergrens van 5 procent.
    const vier = berekenWaarde({ ...avmBasis, comparables: [comp(400_000, 100, 1), comp(400_000, 100, 2), comp(400_000, 100, 3), comp(400_000, 100, 4)] })!;
    expect(vier.confidence).toBe("middel");
    expect(vier.uitleg.intervalPct).toBe(0.05);
    expect(vier.waarde).toBe(400_000);
    expect(vier.intervalLaag).toBe(380_000);
    expect(vier.intervalHoog).toBe(420_000);

    // 3 comps (zonder anker): comps blijven de basis, maar het interval valt
    // terug op de maximale marge en de confidence op laag.
    const drie = berekenWaarde({ ...avmBasis, comparables: [comp(400_000, 100, 1), comp(400_000, 100, 2), comp(400_000, 100, 3)], ankerM2Prijs: null })!;
    expect(drie.confidence).toBe("laag");
    expect(drie.uitleg.basisBron).toBe("comparables");
    expect(drie.uitleg.intervalPct).toBe(0.15);
  });

  it("gebruikt tussen de clamps exact de halve relatieve IQR", () => {
    // m2-prijzen 3600/3800/4200/4400: Q1 3.750, Q3 4.250, IQR 500,
    // mediaan 4.000, dus intervalPct = 500 / 4000 / 2 = 0,0625.
    const r = berekenWaarde({
      ...avmBasis,
      comparables: [comp(360_000, 100, 1), comp(380_000, 100, 2), comp(420_000, 100, 3), comp(440_000, 100, 4)],
    })!;
    expect(r.uitleg.intervalPct).toBeCloseTo(0.0625, 10);
    expect(r.waarde).toBe(400_000);
    expect(r.intervalLaag).toBe(375_000);
    expect(r.intervalHoog).toBe(425_000);
  });

  it("capt de marge op 15 procent bij precies 4 sterk gespreide comps", () => {
    // m2-prijzen 2000/3000/5000/12000: relatieve halve IQR 0,5, dus clamp 0,15.
    const r = berekenWaarde({
      ...avmBasis,
      comparables: [comp(200_000, 100, 1), comp(300_000, 100, 2), comp(500_000, 100, 3), comp(1_200_000, 100, 4)],
    })!;
    expect(r.uitleg.intervalPct).toBe(0.15);
  });

  it("neemt bij 4 comps plus anker het anker als basis maar de comps voor de marge", () => {
    // Onder de 5 comps is het buurt-anker de basis (dat is betrouwbaarder dan
    // een mediaan van weinig verkopen), maar de spreiding van de 4 comps
    // bepaalt wel het interval.
    const r = berekenWaarde({
      ...avmBasis,
      comparables: [comp(400_000, 100, 1), comp(400_000, 100, 2), comp(400_000, 100, 3), comp(400_000, 100, 4)],
      ankerM2Prijs: 5000,
    })!;
    expect(r.uitleg.basisBron).toBe("buurt_anker");
    expect(r.waarde).toBe(500_000);
    expect(r.confidence).toBe("middel");
    expect(r.uitleg.intervalPct).toBe(0.05);
  });
});

/* ------------------------------------------------------------------------- */
/* 9. Comparables: oppervlaktegrenzen en straat-versus-buurt (testdatabase)   */
/* ------------------------------------------------------------------------- */

describe("comparables: oppervlaktefilter 0,7x-1,4x en de straat-drempel van 5", () => {
  it("kiest straatniveau bij exact 5 passende straatverkopen; de grenzen 0,7x en 1,4x tellen mee", async () => {
    const r = await comparables.findComparables({ buurtCode: "BU8", straat: "Grensstraat", woningtype: "tussenwoning", oppervlakteM2: 100 });
    expect(r.niveau).toBe("straat");
    expect(r.comparables).toHaveLength(5);
    expect(r.comparables.every((c) => c.straat === "Grensstraat")).toBe(true);
    const oppervlaktes = r.comparables.map((c) => c.oppervlakteM2);
    expect(oppervlaktes).toContain(70); // exact 0,7 x 100: hoort erbij
    expect(oppervlaktes).toContain(140); // exact 1,4 x 100: hoort erbij
    expect(oppervlaktes).not.toContain(69); // net onder de ondergrens
    expect(oppervlaktes).not.toContain(141); // net boven de bovengrens
    const prijzen = r.comparables.map((c) => c.prijs);
    expect(prijzen).not.toContain(111_111); // ouder dan 24 maanden
    expect(prijzen).not.toContain(444_444); // verkeerd woningtype
  });

  it("valt bij 4 straatverkopen (net onder de drempel) terug op alle passende buurtverkopen", async () => {
    const r = await comparables.findComparables({ buurtCode: "BU8", straat: "Vierstraat", woningtype: "tussenwoning", oppervlakteM2: 100 });
    expect(r.niveau).toBe("buurt");
    // 5 passende uit de Grensstraat plus 4 uit de Vierstraat.
    expect(r.comparables).toHaveLength(9);
  });
});
