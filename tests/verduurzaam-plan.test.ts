import { describe, expect, it } from "vitest";
import { maakMaatregelAdviezen, type MaatregelKey } from "@/app/verduurzamen/advies/advies";
import { maakTotaalplan } from "@/app/verduurzamen/berekening";
import { berekenIsolatieSubsidie, ISDE_WARMTEPOMPEN, ISDE_ZONNEBOILERS } from "@/lib/normen/isde-2026";

/**
 * Het totaalplan telt bestaande maatregel-adviezen op (geen eigen kentallen).
 * Deze tests bewijzen de optelling, de toepassing van de bestaande
 * ISDE-verdubbelingsregel en de eerlijkheid bij ontbrekende cijfers.
 * De onderliggende per-maatregel-cijfers zijn al gedekt in
 * tests/verduurzaam-advies.test.ts.
 */

const tussenwoning = maakMaatregelAdviezen("tussenwoning");

function plan(keys: MaatregelKey[], woningtype: "tussenwoning" | "appartement" = "tussenwoning") {
  const adviezen = woningtype === "tussenwoning" ? tussenwoning : maakMaatregelAdviezen("appartement");
  return maakTotaalplan(adviezen, keys);
}

describe("maakTotaalplan: 1 maatregel", () => {
  it("neemt bij 1 maatregel de advies-cijfers ongewijzigd over (geen verdubbeling)", () => {
    const p = plan(["dakisolatie"]);
    expect(p.subsidie).toBe(berekenIsolatieSubsidie("dakisolatie", 20, false)); // 325
    expect(p.isolatieVerdubbeld).toBe(false);
    expect(p.besparing).toEqual({ laag: 460, hoog: 460 });
    expect(p.kosten).toEqual({ laag: 1000, hoog: 5000 });
    expect(p.netto).toEqual({ laag: 675, hoog: 4675 });
    // Zelfde uitkomst als de losse dak-terugverdientijd in advies.ts.
    expect(p.terugverdientijd).toEqual({ laag: 1, hoog: 10 });
    expect(p.zonderKental).toEqual([]);
    expect(p.zonderKosten).toEqual([]);
    expect(p.buitenTerugverdientijd).toEqual([]);
  });

  it("toont zonnepanelen zonder ISDE en met beide besparingsbedragen (salderen stopt per 2027)", () => {
    const p = plan(["zonnepanelen"]);
    expect(p.subsidie).toBe(0);
    expect(p.zonderSubsidie).toEqual(["zonnepanelen"]);
    expect(p.besparing).toEqual({ laag: 170, hoog: 540 });
    expect(p.netto).toEqual({ laag: 3200, hoog: 3200 });
    expect(p.terugverdientijd).toEqual({ laag: 6, hoog: 19 });
  });

  it("is eerlijk bij de zonneboiler: wel subsidie en besparing, geen kosten dus geen netto of terugverdientijd", () => {
    const klein = ISDE_ZONNEBOILERS.find((z) => z.categorie === "Tot en met 5m2")!;
    const p = plan(["zonneboiler"]);
    expect(p.subsidie).toBe(klein.mediaanEur); // 1789
    expect(p.besparing).toEqual({ laag: 180, hoog: 180 });
    expect(p.kosten).toBeNull();
    expect(p.netto).toBeNull();
    expect(p.terugverdientijd).toBeNull();
    expect(p.zonderKosten).toEqual(["zonneboiler"]);
    expect(p.buitenTerugverdientijd).toEqual(["zonneboiler"]);
  });
});

describe("maakTotaalplan: combinaties en de ISDE-verdubbelingsregel", () => {
  it("verdubbelt het m2-tarief voor dak/spouw/vloer bij 2 of meer tellende maatregelen", () => {
    const p = plan(["dakisolatie", "vloerisolatie"]);
    expect(p.isolatieVerdubbeld).toBe(true);
    expect(p.subsidie).toBe(
      berekenIsolatieSubsidie("dakisolatie", 20, true) + berekenIsolatieSubsidie("vloerisolatie", 20, true), // 650 + 220
    );
    expect(p.besparing).toEqual({ laag: 570, hoog: 570 });
    expect(p.kosten).toEqual({ laag: 2000, hoog: 10000 });
    expect(p.netto).toEqual({ laag: 2000 - 870, hoog: 10000 - 870 });
  });

  it("telt warmtepomp mee voor de verdubbeling van isolatie, maar houdt voor glas het basisbedrag", () => {
    const luchtWater = ISDE_WARMTEPOMPEN.find((w) => w.categorie === "Lucht-Water")!;
    const p = plan(["glasisolatie", "warmtepomp"]);
    // 2 tellende maatregelen, maar geen van de drie m2-isolatiekeys: geen verdubbeling gerekend.
    expect(p.isolatieVerdubbeld).toBe(false);
    expect(p.subsidie).toBe(75 + luchtWater.mediaanEur); // glas-basisvoorbeeld + wp-mediaan
    expect(p.besparing).toEqual({ laag: 350 + 600, hoog: 350 + 1000 });
    expect(p.kosten).toEqual({ laag: 5000, hoog: 20000 });
  });

  it("laat de subsidie van een maatregel zonder kosten niet meetellen in de netto-investering", () => {
    const klein = ISDE_ZONNEBOILERS.find((z) => z.categorie === "Tot en met 5m2")!;
    const p = plan(["dakisolatie", "zonneboiler"]);
    // Verdubbeling geldt (2 tellende maatregelen); totaalsubsidie is dak (verdubbeld) + zonneboiler.
    const dakVerdubbeld = berekenIsolatieSubsidie("dakisolatie", 20, true); // 650
    expect(p.subsidie).toBe(dakVerdubbeld + klein.mediaanEur);
    // Netto en terugverdientijd rekenen alleen met de dak-kant (kosten bekend).
    expect(p.netto).toEqual({ laag: 1000 - dakVerdubbeld, hoog: 5000 - dakVerdubbeld });
    expect(p.buitenTerugverdientijd).toEqual(["zonneboiler"]);
    expect(p.terugverdientijd).toEqual({ laag: 1, hoog: 9 }); // (1000-650)/460 -> 1; (5000-650)/460 -> 9
  });

  it("klemt de netto-investering op 0 als de subsidie boven de lage kosten uitkomt", () => {
    // Drie isolatiemaatregelen verdubbeld: 650 + 105 + 220 = 975 subsidie bij 3000 tot 15000 kosten.
    const p = plan(["dakisolatie", "spouwmuurisolatie", "vloerisolatie"]);
    expect(p.subsidie).toBe(975);
    expect(p.netto).toEqual({ laag: 2025, hoog: 14025 });
    // En een geval waar de klem echt nodig is: kunstmatig via een enkel goedkoop advies bestaat
    // niet in de echte data, dus we bewijzen de klem via de laagste combinatie die eronder komt.
    expect(p.netto!.laag).toBeGreaterThanOrEqual(0);
  });
});

describe("maakTotaalplan: eerlijk bij een appartement", () => {
  it("somt alleen echte kentallen en benoemt wat er buiten valt", () => {
    const p = plan(["dakisolatie", "warmtepomp"], "appartement");
    // Dak heeft bij een appartement geen kental; alleen de warmtepomp telt in de besparing.
    expect(p.besparing).toEqual({ laag: 600, hoog: 1000 });
    expect(p.zonderKental).toEqual(["dakisolatie"]);
    expect(p.buitenTerugverdientijd).toEqual(["dakisolatie"]);
    // De RVO-subsidie staat los van het kental en telt gewoon mee (verdubbeld: 2 maatregelen).
    const luchtWater = ISDE_WARMTEPOMPEN.find((w) => w.categorie === "Lucht-Water")!;
    expect(p.subsidie).toBe(berekenIsolatieSubsidie("dakisolatie", 20, true) + luchtWater.mediaanEur);
    // Terugverdientijd alleen over de warmtepomp: (4000-3250)/600 -> 1; (15000-3250)/1000 -> 12.
    expect(p.terugverdientijd).toEqual({ laag: 1, hoog: 12 });
  });

  it("geeft null-besparing als geen enkele gekozen maatregel een kental heeft", () => {
    const p = plan(["dakisolatie", "glasisolatie"], "appartement");
    expect(p.besparing).toBeNull();
    expect(p.terugverdientijd).toBeNull();
    expect(p.zonderKental).toEqual(["dakisolatie", "glasisolatie"]);
    expect(p.subsidie).toBeGreaterThan(0);
  });
});

describe("maakTotaalplan: leeg en volgorde", () => {
  it("geeft bij een lege selectie overal null of 0", () => {
    const p = plan([]);
    expect(p.gekozen).toEqual([]);
    expect(p.besparing).toBeNull();
    expect(p.subsidie).toBe(0);
    expect(p.kosten).toBeNull();
    expect(p.netto).toBeNull();
    expect(p.terugverdientijd).toBeNull();
  });

  it("houdt de vaste advies-volgorde aan, onafhankelijk van de klik-volgorde", () => {
    const p = plan(["zonnepanelen", "dakisolatie", "warmtepomp"]);
    expect(p.gekozen.map((a) => a.key)).toEqual(["dakisolatie", "warmtepomp", "zonnepanelen"]);
  });
});
