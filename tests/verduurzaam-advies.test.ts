import { describe, expect, it } from "vitest";
import {
  ADVIES_GROEPEN,
  berekenTerugverdientijd,
  extraLeenruimteBijLabel,
  formatEuroBereik,
  formatTerugverdientijd,
  maakMaatregelAdviezen,
  type MaatregelKey,
} from "@/app/verduurzamen/advies/advies";
import { VERTICAAL_SLUGS } from "@/app/verduurzamen/verticalen";
import { formatEuro } from "@/lib/format";
import { berekenIsolatieSubsidie, ISDE_WARMTEPOMPEN, ISDE_ZONNEBOILERS } from "@/lib/normen/isde-2026";
import { BESPARING_DAK, BESPARING_ZONNEPANELEN } from "@/lib/normen/besparing";
import { VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING } from "@/lib/normen/leennormen-2026";

/**
 * De adviesmodule is puur (geen database): deze tests toetsen de rekenlogica
 * en dat elk advies zijn bronnen meedraagt. Het adres-pad (bestaan +
 * suppressie) van de adviespagina loopt via vindVerduurzaamAdres en is al
 * gedekt in tests/funnel-verduurzaming.test.ts.
 */

describe("berekenTerugverdientijd", () => {
  it("rekent (kosten minus subsidie) gedeeld door jaarbesparing, afgerond op hele jaren", () => {
    // (1000 - 325) / 460 = 1,47 -> 1; (5000 - 325) / 460 = 10,16 -> 10
    expect(berekenTerugverdientijd({ laag: 1000, hoog: 5000 }, 325, { laag: 460, hoog: 460 })).toEqual({ laag: 1, hoog: 10 });
  });

  it("koppelt de uiteinden paarsgewijs (lage kosten bij lage besparing) en sorteert op min/max", () => {
    // Warmtepomp-geval: (4000 - 3250) / 600 = 1,25 -> 1; (15000 - 3250) / 1000 = 11,75 -> 12
    expect(berekenTerugverdientijd({ laag: 4000, hoog: 15000 }, 3250, { laag: 600, hoog: 1000 })).toEqual({ laag: 1, hoog: 12 });
    // Zonnepanelen-geval (vaste kosten, besparing daalt na 2027): 3200/170 = 18,8 -> 19; 3200/540 = 5,9 -> 6
    expect(berekenTerugverdientijd({ laag: 3200, hoog: 3200 }, 0, { laag: 170, hoog: 540 })).toEqual({ laag: 6, hoog: 19 });
  });

  it("geeft 0 (minder dan 1 jaar) als de subsidie de kosten dekt, en null zonder besparing", () => {
    expect(berekenTerugverdientijd({ laag: 1000, hoog: 1000 }, 1500, { laag: 400, hoog: 400 })).toEqual({ laag: 0, hoog: 0 });
    expect(berekenTerugverdientijd({ laag: 1000, hoog: 5000 }, 0, { laag: 0, hoog: 0 })).toBeNull();
  });
});

describe("formatTerugverdientijd en formatEuroBereik", () => {
  it("formatteert bereiken leesbaar en eerlijk", () => {
    expect(formatTerugverdientijd({ laag: 1, hoog: 10 })).toBe("ongeveer 1 tot 10 jaar");
    expect(formatTerugverdientijd({ laag: 6, hoog: 6 })).toBe("ongeveer 6 jaar");
    expect(formatTerugverdientijd({ laag: 0, hoog: 0 })).toBe("minder dan 1 jaar");
    expect(formatTerugverdientijd({ laag: 0, hoog: 3 })).toBe("minder dan 1 tot 3 jaar");
  });

  it("toont een eurobereik als 1 bedrag wanneer laag en hoog gelijk zijn", () => {
    expect(formatEuroBereik({ laag: 3200, hoog: 3200 })).toBe(formatEuro(3200));
    expect(formatEuroBereik({ laag: 1000, hoog: 5000 })).toBe(`${formatEuro(1000)} tot ${formatEuro(5000)}`);
    expect(formatEuroBereik({ laag: 3200, hoog: 3200 })).not.toContain("tot");
  });
});

describe("extraLeenruimteBijLabel (art. 4 lid 4, Stcrt. 2025-36471)", () => {
  it("volgt de bedragen per labelgroep uit de regeling", () => {
    expect(extraLeenruimteBijLabel("G")?.bedrag).toBe(20000);
    expect(extraLeenruimteBijLabel("F")?.bedrag).toBe(20000);
    expect(extraLeenruimteBijLabel("E")?.bedrag).toBe(20000);
    expect(extraLeenruimteBijLabel("D")?.bedrag).toBe(15000);
    expect(extraLeenruimteBijLabel("C")?.bedrag).toBe(15000);
    expect(extraLeenruimteBijLabel("B")?.bedrag).toBe(10000);
    expect(extraLeenruimteBijLabel("A")?.bedrag).toBe(10000);
    expect(extraLeenruimteBijLabel("A+")?.bedrag).toBe(10000);
    expect(extraLeenruimteBijLabel("A++")?.bedrag).toBe(10000);
    expect(extraLeenruimteBijLabel("A+++")?.bedrag).toBe(0);
    expect(extraLeenruimteBijLabel("A++++")?.bedrag).toBe(0);
    // Sluit aan op de brondata in lib/normen/leennormen-2026.ts.
    expect(extraLeenruimteBijLabel("G")?.bedrag).toBe(VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.EFG);
    expect(extraLeenruimteBijLabel("A+++")?.bedrag).toBe(VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.A3PlusEnBeter);
  });

  it("normaliseert invoer en weigert onherkenbare labels (liever geen bedrag dan een verzonnen bedrag)", () => {
    expect(extraLeenruimteBijLabel(" c ")?.bedrag).toBe(15000);
    expect(extraLeenruimteBijLabel("a+")?.bedrag).toBe(10000);
    expect(extraLeenruimteBijLabel(null)).toBeNull();
    expect(extraLeenruimteBijLabel(undefined)).toBeNull();
    expect(extraLeenruimteBijLabel("")).toBeNull();
    expect(extraLeenruimteBijLabel("X")).toBeNull();
    expect(extraLeenruimteBijLabel("B+")).toBeNull(); // bestaat niet
  });
});

describe("maakMaatregelAdviezen", () => {
  const adviezen = maakMaatregelAdviezen("tussenwoning");
  const per = Object.fromEntries(adviezen.map((a) => [a.key, a]));

  it("levert de zeven maatregelen, elk gekoppeld aan een bestaande funnel-verticaal", () => {
    expect(adviezen.map((a) => a.key)).toEqual([
      "dakisolatie",
      "spouwmuurisolatie",
      "vloerisolatie",
      "glasisolatie",
      "warmtepomp",
      "zonneboiler",
      "zonnepanelen",
    ]);
    for (const advies of adviezen) {
      expect(VERTICAAL_SLUGS).toContain(advies.verticaal);
      // Elk advies draagt minstens 1 echte bron en uitleg-alinea's mee.
      expect(advies.bronnen.length).toBeGreaterThan(0);
      for (const bron of advies.bronnen) expect(bron.url).toMatch(/^https:\/\//);
      expect(advies.uitleg.length).toBeGreaterThan(0);
    }
  });

  it("gebruikt voor isolatie het ISDE-rekenvoorbeeld bij het minimumoppervlak", () => {
    expect(per.dakisolatie!.subsidie?.bedrag).toBe(berekenIsolatieSubsidie("dakisolatie", 20, false)); // 325
    expect(per.dakisolatie!.subsidie?.bedrag).toBe(325);
    expect(per.spouwmuurisolatie!.subsidie?.bedrag).toBe(berekenIsolatieSubsidie("spouwmuurisolatie", 10, false)); // 53
    expect(per.vloerisolatie!.subsidie?.bedrag).toBe(berekenIsolatieSubsidie("vloerisolatie", 20, false)); // 110
    expect(per.glasisolatie!.subsidie?.bedrag).toBe(75); // 3 m2 x 25 euro (hr++ in bestaande kozijnen)
  });

  it("gebruikt de Milieu Centraal-kentallen per woningtype voor de isolatie-besparing", () => {
    expect(per.dakisolatie!.besparing?.bereik.laag).toBe(BESPARING_DAK.perWoningtype!.tussenwoning.eurPerJaar); // 460
    const vrijstaand = maakMaatregelAdviezen("vrijstaand");
    const dakVrijstaand = vrijstaand.find((a) => a.key === "dakisolatie")!;
    expect(dakVrijstaand.besparing?.bereik.laag).toBe(BESPARING_DAK.perWoningtype!.vrijstaand.eurPerJaar); // 750
  });

  it("rekent de dak-terugverdientijd volgens de simpele formule", () => {
    // (1000 - 325) / 460 -> 1 jaar; (5000 - 325) / 460 -> 10 jaar
    expect(per.dakisolatie!.terugverdientijd).toEqual({ laag: 1, hoog: 10 });
  });

  it("is eerlijk bij een appartement: geen kental, dus geen besparing en geen terugverdientijd", () => {
    const appartement = maakMaatregelAdviezen("appartement");
    for (const key of ["dakisolatie", "spouwmuurisolatie", "vloerisolatie", "glasisolatie"] as MaatregelKey[]) {
      const advies = appartement.find((a) => a.key === key)!;
      expect(advies.besparing).toBeNull();
      expect(advies.besparingGeenReden).toBeTruthy();
      expect(advies.terugverdientijd).toBeNull();
      // De subsidie (RVO) staat los van het kental en blijft gewoon staan.
      expect(advies.subsidie?.bedrag).toBeGreaterThan(0);
    }
  });

  it("gebruikt voor de warmtepomp de mediaan van de RVO-meldcodelijst als subsidie-indicatie", () => {
    const luchtWater = ISDE_WARMTEPOMPEN.find((w) => w.categorie === "Lucht-Water")!;
    expect(per.warmtepomp!.subsidie?.bedrag).toBe(luchtWater.mediaanEur); // 3250
    expect(per.warmtepomp!.terugverdientijd).toEqual({ laag: 1, hoog: 12 });
  });

  it("is eerlijk bij de zonneboiler: geen kosten-ordegrootte, dus geen terugverdientijd, wel subsidie en besparing", () => {
    const klein = ISDE_ZONNEBOILERS.find((z) => z.categorie === "Tot en met 5m2")!;
    expect(per.zonneboiler!.kosten).toBeNull();
    expect(per.zonneboiler!.terugverdientijd).toBeNull();
    expect(per.zonneboiler!.subsidie?.bedrag).toBe(klein.mediaanEur); // 1789
    expect(per.zonneboiler!.besparing?.bereik.laag).toBe(180);
  });

  it("toont voor zonnepanelen geen ISDE en altijd beide besparingsbedragen (salderen stopt per 2027)", () => {
    const zp = per.zonnepanelen!;
    expect(zp.subsidie).toBeNull();
    expect(zp.subsidieGeenReden).toBeTruthy();
    expect(zp.besparing?.bereik).toEqual({
      laag: BESPARING_ZONNEPANELEN.eurPerJaarVanaf2027, // 170
      hoog: BESPARING_ZONNEPANELEN.eurPerJaar2026, // 540
    });
    expect(zp.kosten?.bereik.laag).toBe(BESPARING_ZONNEPANELEN.aanschafEur); // 3200
    expect(zp.terugverdientijd).toEqual({ laag: 6, hoog: 19 });
    // De uitleg noemt het einde van salderen expliciet, nooit alleen het hoge bedrag.
    expect(zp.uitleg.join(" ")).toContain("2027");
  });

  it("dekt met de groepen alle maatregelen precies 1 keer, elk richting een bestaande funnel", () => {
    const keysUitGroepen = ADVIES_GROEPEN.flatMap((g) => g.keys);
    expect([...keysUitGroepen].sort()).toEqual(adviezen.map((a) => a.key).sort());
    for (const groep of ADVIES_GROEPEN) expect(VERTICAAL_SLUGS).toContain(groep.verticaal);
  });
});
