import { describe, expect, it } from "vitest";
import {
  berekenOverdrachtsbelasting,
  OVB_TARIEF_ALGEMEEN_PCT,
  OVB_TARIEF_HOOFDVERBLIJF_PCT,
  OVB_TARIEF_WONING_OVERIG_PCT,
  STARTERS_LEEFTIJD_TOT,
  STARTERS_LEEFTIJD_VANAF,
  STARTERS_WONINGWAARDEGRENS,
} from "@/lib/normen/overdrachtsbelasting-2026";
import {
  berekenKostenKoper,
  INDICATIE_KOSTEN,
  INDICATIE_KOSTEN_TOTAAL,
  klemKoopsom,
  KOOPSOM_MAX,
  KOOPSOM_MIN,
} from "@/app/kosten-koper/berekening";
import { berekenOverbod, klemOverbodPct, klemVraagprijs, OVERBOD_PCT_MAX, VRAAGPRIJS_MAX, VRAAGPRIJS_MIN } from "@/app/overbieden/berekening";

/**
 * Rekenhulpen kosten koper (app/kosten-koper) en overbieden (app/overbieden):
 * pure functies, geen database nodig. De belastingregels zijn geverifieerd op
 * wetten.overheid.nl (BWBR0002740, geldend vanaf 01-01-2026) en
 * belastingdienst.nl; deze tests bewaken dat de code die regels exact volgt,
 * inclusief de randgevallen van de startersvrijstelling (alles-of-niets op de
 * waardegrens van 555.000 euro).
 */

describe("normconstanten overdrachtsbelasting 2026 (geverifieerde bronwaarden)", () => {
  it("bevat de letterlijke tarieven en grenzen uit de wet", () => {
    expect(OVB_TARIEF_HOOFDVERBLIJF_PCT).toBe(2);
    expect(OVB_TARIEF_WONING_OVERIG_PCT).toBe(8);
    expect(OVB_TARIEF_ALGEMEEN_PCT).toBe(10.4);
    expect(STARTERS_LEEFTIJD_VANAF).toBe(18);
    expect(STARTERS_LEEFTIJD_TOT).toBe(35);
    expect(STARTERS_WONINGWAARDEGRENS).toBe(555_000);
  });
});

describe("berekenOverdrachtsbelasting: hoofdverblijf", () => {
  it("rekent 2% zonder startersvrijstelling", () => {
    const u = berekenOverdrachtsbelasting({ woningwaarde: 350_000, situatie: "hoofdverblijf", startersvrijstelling: false });
    expect(u.tariefPct).toBe(2);
    expect(u.belasting).toBe(7_000);
    expect(u.vrijstellingToegepast).toBe(false);
    expect(u.vrijstellingVervallenDoorWaardegrens).toBe(false);
  });

  it("rondt de belasting af op hele euro's", () => {
    // 2% van 123.457 = 2.469,14 -> 2.469
    const u = berekenOverdrachtsbelasting({ woningwaarde: 123_457, situatie: "hoofdverblijf", startersvrijstelling: false });
    expect(u.belasting).toBe(2_469);
  });

  it("past de startersvrijstelling toe onder de waardegrens: 0%", () => {
    const u = berekenOverdrachtsbelasting({ woningwaarde: 350_000, situatie: "hoofdverblijf", startersvrijstelling: true });
    expect(u.tariefPct).toBe(0);
    expect(u.belasting).toBe(0);
    expect(u.vrijstellingToegepast).toBe(true);
    expect(u.vrijstellingVervallenDoorWaardegrens).toBe(false);
  });

  it("randgeval: precies op de waardegrens geldt de vrijstelling nog (niet BOVEN de grens)", () => {
    const u = berekenOverdrachtsbelasting({
      woningwaarde: STARTERS_WONINGWAARDEGRENS,
      situatie: "hoofdverblijf",
      startersvrijstelling: true,
    });
    expect(u.vrijstellingToegepast).toBe(true);
    expect(u.belasting).toBe(0);
  });

  it("randgeval: 1 euro boven de grens vervalt de vrijstelling VOLLEDIG: 2% over de hele waarde", () => {
    const waarde = STARTERS_WONINGWAARDEGRENS + 1;
    const u = berekenOverdrachtsbelasting({ woningwaarde: waarde, situatie: "hoofdverblijf", startersvrijstelling: true });
    expect(u.vrijstellingToegepast).toBe(false);
    expect(u.vrijstellingVervallenDoorWaardegrens).toBe(true);
    expect(u.tariefPct).toBe(2);
    // Geen drempelvrijstelling: belasting over de hele waarde, niet alleen het deel boven de grens.
    expect(u.belasting).toBe(Math.round((waarde * 2) / 100));
    expect(u.belasting).toBe(11_100);
  });

  it("markeert de vervallen vrijstelling alleen als er om gevraagd is", () => {
    const u = berekenOverdrachtsbelasting({
      woningwaarde: STARTERS_WONINGWAARDEGRENS + 1,
      situatie: "hoofdverblijf",
      startersvrijstelling: false,
    });
    expect(u.vrijstellingVervallenDoorWaardegrens).toBe(false);
  });

  it("is veilig bij waarde 0 of negatief: geen belasting", () => {
    expect(berekenOverdrachtsbelasting({ woningwaarde: 0, situatie: "hoofdverblijf", startersvrijstelling: false }).belasting).toBe(0);
    expect(berekenOverdrachtsbelasting({ woningwaarde: -5, situatie: "hoofdverblijf", startersvrijstelling: false }).belasting).toBe(0);
  });
});

describe("berekenOverdrachtsbelasting: woning niet-hoofdverblijf (8% per 2026)", () => {
  it("rekent 8% voor een woning die niet het hoofdverblijf wordt", () => {
    const u = berekenOverdrachtsbelasting({ woningwaarde: 350_000, situatie: "woning_overig", startersvrijstelling: false });
    expect(u.tariefPct).toBe(8);
    expect(u.belasting).toBe(28_000);
  });

  it("kent nooit een startersvrijstelling toe zonder zelfbewoning", () => {
    const u = berekenOverdrachtsbelasting({ woningwaarde: 300_000, situatie: "woning_overig", startersvrijstelling: true });
    expect(u.vrijstellingToegepast).toBe(false);
    expect(u.tariefPct).toBe(8);
    expect(u.belasting).toBe(24_000);
  });
});

describe("berekenKostenKoper: zichtbare uitkomst == normlaag plus indicatie (geen UI-drift)", () => {
  it("geeft de belasting ongewijzigd door en telt de indicatiekosten erbij op", () => {
    const u = berekenKostenKoper({ koopsom: 350_000, starter: false });
    const norm = berekenOverdrachtsbelasting({ woningwaarde: 350_000, situatie: "hoofdverblijf", startersvrijstelling: false });
    expect(u.ovb).toEqual(norm);
    expect(u.bijkomendTotaal).toBe(INDICATIE_KOSTEN_TOTAAL);
    expect(u.eigenGeldMinimaal).toBe(norm.belasting + INDICATIE_KOSTEN_TOTAAL);
  });

  it("met startersvrijstelling blijft alleen de kosten-indicatie over als eigen geld", () => {
    const u = berekenKostenKoper({ koopsom: 350_000, starter: true });
    expect(u.ovb.belasting).toBe(0);
    expect(u.eigenGeldMinimaal).toBe(INDICATIE_KOSTEN_TOTAAL);
  });

  it("het indicatietotaal is exact de som van de benoemde posten", () => {
    expect(INDICATIE_KOSTEN_TOTAAL).toBe(INDICATIE_KOSTEN.reduce((som, k) => som + k.bedrag, 0));
    expect(INDICATIE_KOSTEN.map((k) => k.key).sort()).toEqual(["advies", "notaris", "taxatie"]);
  });

  it("klemKoopsom houdt de invoer binnen de toolgrenzen", () => {
    expect(klemKoopsom(KOOPSOM_MIN - 1)).toBe(KOOPSOM_MIN);
    expect(klemKoopsom(KOOPSOM_MAX + 1)).toBe(KOOPSOM_MAX);
    expect(klemKoopsom(Number.NaN)).toBeGreaterThanOrEqual(KOOPSOM_MIN);
    expect(klemKoopsom(350_000)).toBe(350_000);
  });

  it("de startersgrens is bereikbaar met de slider-stap (randgeval blijft testbaar in de UI)", () => {
    expect(STARTERS_WONINGWAARDEGRENS % 5_000).toBe(0);
  });

  it("hoofdverblijf weggelaten of true: zelfde uitkomst als de hoofdverblijf-route (bestaand gedrag)", () => {
    expect(berekenKostenKoper({ koopsom: 350_000, starter: false, hoofdverblijf: true })).toEqual(
      berekenKostenKoper({ koopsom: 350_000, starter: false }),
    );
  });

  it("hoofdverblijf false: geeft de 8%-uitkomst van de normlaag ongewijzigd door", () => {
    const u = berekenKostenKoper({ koopsom: 350_000, starter: false, hoofdverblijf: false });
    const norm = berekenOverdrachtsbelasting({ woningwaarde: 350_000, situatie: "woning_overig", startersvrijstelling: false });
    expect(u.ovb).toEqual(norm);
    expect(u.ovb.tariefPct).toBe(OVB_TARIEF_WONING_OVERIG_PCT);
    expect(u.eigenGeldMinimaal).toBe(norm.belasting + INDICATIE_KOSTEN_TOTAAL);
  });

  it("hoofdverblijf false: nooit een startersvrijstelling (normlaag vereist zelfbewoning)", () => {
    const u = berekenKostenKoper({ koopsom: 300_000, starter: true, hoofdverblijf: false });
    expect(u.ovb.vrijstellingToegepast).toBe(false);
    expect(u.ovb.tariefPct).toBe(OVB_TARIEF_WONING_OVERIG_PCT);
  });
});

describe("berekenOverbod: de overbieden-som", () => {
  it("bod = vraagprijs plus percentage; deel boven de taxatie is eigen geld", () => {
    const u = berekenOverbod({ vraagprijs: 400_000, overbodPct: 10, taxatiewaarde: 425_000 });
    expect(u.bod).toBe(440_000);
    expect(u.gefinancierdDeel).toBe(425_000);
    expect(u.uitEigenZak).toBe(15_000);
  });

  it("taxatie boven het bod: niets uit eigen zak, bank kan het hele bod financieren", () => {
    // GEEN aanname dat de taxatie onder het bod ligt: ook dit is een echte uitkomst.
    const u = berekenOverbod({ vraagprijs: 400_000, overbodPct: 5, taxatiewaarde: 450_000 });
    expect(u.bod).toBe(420_000);
    expect(u.uitEigenZak).toBe(0);
    expect(u.gefinancierdDeel).toBe(420_000);
  });

  it("zonder taxatiewaarde geen uitspraak over eigen geld (bewust null, geen aanname)", () => {
    const u = berekenOverbod({ vraagprijs: 400_000, overbodPct: 10, taxatiewaarde: null });
    expect(u.bod).toBe(440_000);
    expect(u.uitEigenZak).toBeNull();
    expect(u.gefinancierdDeel).toBeNull();
  });

  it("0% overbod: het bod is precies de vraagprijs", () => {
    const u = berekenOverbod({ vraagprijs: 375_000, overbodPct: 0, taxatiewaarde: 375_000 });
    expect(u.bod).toBe(375_000);
    expect(u.uitEigenZak).toBe(0);
  });

  it("rondt het bod af op hele euro's", () => {
    // 333.333 * 1,07 = 356.666,31 -> 356.666
    const u = berekenOverbod({ vraagprijs: 333_333, overbodPct: 7, taxatiewaarde: null });
    expect(u.bod).toBe(356_666);
  });

  it("klemfuncties houden slider-invoer binnen de grenzen", () => {
    expect(klemVraagprijs(VRAAGPRIJS_MIN - 1)).toBe(VRAAGPRIJS_MIN);
    expect(klemVraagprijs(VRAAGPRIJS_MAX + 1)).toBe(VRAAGPRIJS_MAX);
    expect(klemOverbodPct(-5)).toBe(0);
    expect(klemOverbodPct(99)).toBe(OVERBOD_PCT_MAX);
  });
});
