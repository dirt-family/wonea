import { describe, expect, it } from "vitest";
import {
  berekenMaandlastKoopsom,
  berekenMaxHypotheek,
  berekenSpreiding,
  DNB_BUCKET,
  eigenInbrengBovenMax,
  ENERGIELABEL_OPTIES,
  gezamenlijkeStartersStatus,
  INDICATIE_MARGE_PCT,
  nhgBinnenGrens,
  parseBedrag,
  startersStatus,
  TOETS_RENTEVAST_JAREN,
  valideerGeboortejaar,
  valideerInkomen,
  valideerInkomenTweedeKoper,
  valideerKoopsom,
} from "@/app/hypotheek-berekenen/berekening";
import { berekenKostenKoper } from "@/app/kosten-koper/berekening";
import { getRenteBucket } from "@/lib/bronnen/rentes";
import { groepeerVoorTabel, type VerstrekkersRentes } from "@/lib/bronnen/rentes-verstrekkers";
import { annuiteitMaandlast, maandlastenOverzicht, maximaleHypotheek, TOETS_LOOPTIJD_MAANDEN } from "@/lib/hypotheek";
import { ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING, NHG_GRENS_2026 } from "@/lib/normen/leennormen-2026";
import { berekenOverdrachtsbelasting, STARTERS_LEEFTIJD_TOT, STARTERS_LEEFTIJD_VANAF, STARTERS_WONINGWAARDEGRENS } from "@/lib/normen/overdrachtsbelasting-2026";

/**
 * Hypotheekberekenaar (app/hypotheek-berekenen): pure mapping-laag, geen
 * database nodig. Twee beweringen:
 * 1. de stap-validaties bewaken precies de grenzen die de tool belooft;
 * 2. elke zichtbare rekenuitkomst is exact die van de bestaande lagen
 *    (lib/hypotheek.ts, lib/normen, app/kosten-koper/berekening.ts); de
 *    module introduceert geen eigen formules.
 */

const HUIDIG_JAAR = 2026;

describe("stap-validaties: grenzen", () => {
  it("geboortejaar: vier cijfers, niet in de toekomst, niet ouder dan 120 jaar", () => {
    expect(valideerGeboortejaar("1994", HUIDIG_JAAR)).toBeNull();
    expect(valideerGeboortejaar(" 1994 ", HUIDIG_JAAR)).toBeNull();
    expect(valideerGeboortejaar(String(HUIDIG_JAAR), HUIDIG_JAAR)).toBeNull();
    expect(valideerGeboortejaar(String(HUIDIG_JAAR - 120), HUIDIG_JAAR)).toBeNull();
    // Buiten de grenzen of geen jaar: een melding, geen crash.
    expect(valideerGeboortejaar(String(HUIDIG_JAAR + 1), HUIDIG_JAAR)).not.toBeNull();
    expect(valideerGeboortejaar(String(HUIDIG_JAAR - 121), HUIDIG_JAAR)).not.toBeNull();
    expect(valideerGeboortejaar("", HUIDIG_JAAR)).not.toBeNull();
    expect(valideerGeboortejaar("94", HUIDIG_JAAR)).not.toBeNull();
    expect(valideerGeboortejaar("19x4", HUIDIG_JAAR)).not.toBeNull();
    expect(valideerGeboortejaar("19940", HUIDIG_JAAR)).not.toBeNull();
  });

  it("inkomen: hoofdinkomen minimaal 1 euro, tweede koper mag 0", () => {
    expect(valideerInkomen("48000")).toBeNull();
    expect(valideerInkomen("48.000")).toBeNull();
    expect(valideerInkomen("1")).toBeNull();
    expect(valideerInkomen("0")).not.toBeNull();
    expect(valideerInkomen("")).not.toBeNull();
    expect(valideerInkomen("abc")).not.toBeNull();
    expect(valideerInkomenTweedeKoper("0")).toBeNull();
    expect(valideerInkomenTweedeKoper("42000")).toBeNull();
    expect(valideerInkomenTweedeKoper("")).not.toBeNull();
  });

  it("koopsom: minimaal 1 euro, duizendtallen met punt mogen", () => {
    expect(valideerKoopsom("350000")).toBeNull();
    expect(valideerKoopsom("350.000")).toBeNull();
    expect(valideerKoopsom("1")).toBeNull();
    expect(valideerKoopsom("0")).not.toBeNull();
    expect(valideerKoopsom("")).not.toBeNull();
  });

  it("parseBedrag leest NL-notatie en weigert onzin", () => {
    expect(parseBedrag("48.000")).toBe(48_000);
    expect(parseBedrag("48000")).toBe(48_000);
    expect(parseBedrag("48000,60")).toBe(48_001);
    expect(parseBedrag("")).toBeNull();
    expect(parseBedrag("abc")).toBeNull();
  });
});

describe("starters-indicatie uit geboortejaar (grenzen uit lib/normen, per kalenderjaar)", () => {
  it("volgt de leeftijdsband 18 tot 35 met een eerlijk grensjaar", () => {
    // Wordt dit jaar 17: nog geen 18, dus nee.
    expect(startersStatus(HUIDIG_JAAR - (STARTERS_LEEFTIJD_VANAF - 1), HUIDIG_JAAR)).toBe("nee");
    // Wordt dit jaar 18 respectievelijk 34: leeftijdseis kan kloppen.
    expect(startersStatus(HUIDIG_JAAR - STARTERS_LEEFTIJD_VANAF, HUIDIG_JAAR)).toBe("mogelijk");
    expect(startersStatus(HUIDIG_JAAR - (STARTERS_LEEFTIJD_TOT - 1), HUIDIG_JAAR)).toBe("mogelijk");
    // Wordt dit jaar 35: hangt af van de overdrachtsdatum, dus grensjaar.
    expect(startersStatus(HUIDIG_JAAR - STARTERS_LEEFTIJD_TOT, HUIDIG_JAAR)).toBe("grensjaar");
    // Wordt dit jaar 36: te oud.
    expect(startersStatus(HUIDIG_JAAR - (STARTERS_LEEFTIJD_TOT + 1), HUIDIG_JAAR)).toBe("nee");
  });

  it("samen kopen: de strengste status wint (normlaag kent alleen alles-of-niets)", () => {
    expect(gezamenlijkeStartersStatus(["mogelijk", "mogelijk"])).toBe("mogelijk");
    expect(gezamenlijkeStartersStatus(["mogelijk", "grensjaar"])).toBe("grensjaar");
    expect(gezamenlijkeStartersStatus(["mogelijk", "nee"])).toBe("nee");
    expect(gezamenlijkeStartersStatus(["grensjaar", "nee"])).toBe("nee");
    expect(gezamenlijkeStartersStatus([])).toBe("nee");
  });
});

describe("maximale hypotheek: zichtbare uitkomst == lib/hypotheek (geen eigen formules)", () => {
  const rentePct = getRenteBucket(DNB_BUCKET)!.rentePct;

  it("geeft exact de kernuitkomst van maximaleHypotheek door, met 10 jaar rentevast", () => {
    const zichtbaar = berekenMaxHypotheek({ inkomen1: 48_000, inkomen2: 42_000, energielabelKlasse: "AB", rentePct });
    const kern = maximaleHypotheek({
      inkomen1: 48_000,
      inkomen2: 42_000,
      toetsrentePct: rentePct,
      rentevastJaren: TOETS_RENTEVAST_JAREN,
      energielabelKlasse: "AB",
    });
    expect(zichtbaar.maximaal).toBe(kern.maximaal);
    expect(zichtbaar.maandlast).toBe(kern.maandlast);
    expect(zichtbaar.gebruiktPct).toBe(kern.gebruiktPct);
    expect(zichtbaar.toetsrente).toBe(kern.toetsrente);
    expect(zichtbaar.labelExtra).toBe(kern.labelExtra);
    expect(zichtbaar.nhgMogelijk).toBe(kern.nhgMogelijk);
    // Vanaf 10 jaar rentevast is de DNB-rente meteen de toetsrente (geen AFM-ondergrens).
    expect(zichtbaar.toetsrente).toBe(rentePct);
    // Afgeleiden: alleen presentatie, herleidbaar uit de kern.
    expect(zichtbaar.toetsinkomen).toBe(90_000);
    expect(zichtbaar.laag).toBe(Math.round(kern.maximaal * (1 - INDICATIE_MARGE_PCT / 100)));
    expect(zichtbaar.hoog).toBe(Math.round(kern.maximaal * (1 + INDICATIE_MARGE_PCT / 100)));
    expect(zichtbaar.maximaal).toBeGreaterThan(0);
    expect(zichtbaar.labelExtra).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.AB);
  });

  it("de DNB-bucket voor het uitgangspunt bestaat en is plausibel", () => {
    const bucket = getRenteBucket(DNB_BUCKET);
    expect(bucket).toBeDefined();
    expect(bucket!.rentePct).toBeGreaterThan(0);
    expect(bucket!.rentePct).toBeLessThan(15);
  });
});

describe("maandlasten: 1-op-1 maandlastenOverzicht / annuiteitMaandlast", () => {
  it("maandlast over de koopsom is exact de lib-annuiteit over 360 maanden", () => {
    const koopsom = 350_000;
    const pct = 3.9;
    expect(berekenMaandlastKoopsom(koopsom, pct)).toBe(Math.round(annuiteitMaandlast(koopsom, pct, TOETS_LOOPTIJD_MAANDEN)));
    expect(berekenMaandlastKoopsom(koopsom, pct)).toBe(maandlastenOverzicht(koopsom, [{ label: "x", pct }])[0].maandlast);
  });

  it("spreiding: alfabetisch via de lib-groepering, maandlast per tarief uit de lib, geen 'beste'-volgorde", () => {
    const koopsom = 350_000;
    const verstrekkers: VerstrekkersRentes = {
      beschikbaar: true,
      peildatum: "2026-07-20",
      bron: "Testbron",
      toelichting: "",
      rijen: [
        // Bewust niet alfabetisch aangeleverd; 20-jaarstarief moet niet meetellen.
        { verstrekker: "Rabobank", product: "Woon Hypotheek", rentevastJaren: 10, nhg: "ja", rentePct: 3.85, bronUrl: "https://rabobank.nl", peildatum: "2026-07-20", opmerking: "" },
        { verstrekker: "ABN AMRO", product: "Budget Hypotheek", rentevastJaren: 10, nhg: "ja", rentePct: 3.72, bronUrl: "https://abnamro.nl", peildatum: "2026-07-20", opmerking: "" },
        { verstrekker: "ING", product: "Annuitair", rentevastJaren: 20, nhg: "ja", rentePct: 4.1, bronUrl: "https://ing.nl", peildatum: "2026-07-20", opmerking: "" },
      ],
    };
    const spreiding = berekenSpreiding(koopsom, verstrekkers);
    // Alleen 10-jaarstarieven, in de alfabetische volgorde van groepeerVoorTabel.
    expect(spreiding.map((r) => r.verstrekker)).toEqual(["ABN AMRO", "Rabobank"]);
    expect(spreiding.map((r) => r.verstrekker)).toEqual(
      groepeerVoorTabel(verstrekkers.rijen)
        .filter((g) => g.pct10 != null)
        .map((g) => g.verstrekker),
    );
    for (const rij of spreiding) {
      expect(rij.maandlast).toBe(Math.round(annuiteitMaandlast(koopsom, rij.rentePct, TOETS_LOOPTIJD_MAANDEN)));
    }
  });

  it("spreiding is eerlijk leeg als de snapshot onbeschikbaar is", () => {
    const leeg: VerstrekkersRentes = { beschikbaar: false, peildatum: "", bron: "", toelichting: "", rijen: [] };
    expect(berekenSpreiding(350_000, leeg)).toEqual([]);
  });
});

describe("NHG en eigen inbreng: afgeleiden op de normconstanten", () => {
  it("beantwoordt de NHG-vraag automatisch precies op de kostengrens", () => {
    expect(nhgBinnenGrens(NHG_GRENS_2026)).toBe(true);
    expect(nhgBinnenGrens(NHG_GRENS_2026 + 1)).toBe(false);
  });

  it("eigen inbreng boven het maximum is het verschil, nooit negatief", () => {
    expect(eigenInbrengBovenMax(350_000, 400_000)).toBe(0);
    expect(eigenInbrengBovenMax(400_000, 350_000)).toBe(50_000);
  });
});

describe("eigen geld: de tool gebruikt berekenKostenKoper ongewijzigd", () => {
  it("startersvrijstelling en waardegrens komen exact uit de normlaag", () => {
    // Starter binnen de grens: 0% via de normlaag.
    const starter = berekenKostenKoper({ koopsom: 350_000, starter: true });
    expect(starter.ovb).toEqual(
      berekenOverdrachtsbelasting({ woningwaarde: 350_000, situatie: "hoofdverblijf", startersvrijstelling: true }),
    );
    expect(starter.ovb.vrijstellingToegepast).toBe(true);
    expect(starter.ovb.belasting).toBe(0);
    // Boven de waardegrens vervalt de vrijstelling volledig (alles-of-niets).
    const boven = berekenKostenKoper({ koopsom: STARTERS_WONINGWAARDEGRENS + 1, starter: true });
    expect(boven.ovb.vrijstellingToegepast).toBe(false);
    expect(boven.ovb.vrijstellingVervallenDoorWaardegrens).toBe(true);
    expect(boven.ovb.tariefPct).toBe(2);
  });
});

describe("energielabel-opties in het formulier", () => {
  it("dekken elke normklasse precies een keer, met het letterlijke normbedrag en geldige badge-letters", () => {
    const klassen = ENERGIELABEL_OPTIES.map((o) => o.klasse);
    expect([...klassen].sort()).toEqual(Object.keys(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING).sort());
    expect(new Set(klassen).size).toBe(klassen.length);
    for (const o of ENERGIELABEL_OPTIES) {
      expect(o.bedrag).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING[o.klasse]);
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.badges.length).toBeGreaterThan(0);
      for (const b of o.badges) expect(b).toMatch(/^[A-G]$/);
    }
  });

  it("het gekozen label werkt door zoals de norm voorschrijft", () => {
    const rentePct = getRenteBucket(DNB_BUCKET)!.rentePct;
    const zonder = berekenMaxHypotheek({ inkomen1: 48_000, rentePct });
    const met = berekenMaxHypotheek({ inkomen1: 48_000, energielabelKlasse: "APlus_APlusPlus", rentePct });
    expect(met.maximaal - zonder.maximaal).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.APlus_APlusPlus);
    expect(met.labelExtra).toBe(ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.APlus_APlusPlus);
  });
});
