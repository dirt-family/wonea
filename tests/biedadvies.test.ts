import { describe, expect, it } from "vitest";
import { berekenBiedadvies, type MarktMaand } from "@/lib/biedadvies";

// Pure logica: geen database nodig, alle input gaat er als waarde in.

const valuation = { intervalLaag: 300000, intervalHoog: 360000 };

function maand(maand: string, overbiedingPct: number | null, doorlooptijdDagen: number | null): MarktMaand {
  return { maand, overbiedingPct, doorlooptijdDagen };
}

describe("berekenBiedadvies", () => {
  it("geeft null zonder valuation (geen basis, geen verzonnen range)", () => {
    expect(berekenBiedadvies({ valuation: null, marktMaanden: [maand("2026-06", 3, 20)] })).toBeNull();
  });

  it("geeft null zonder marktcijfers (lege lijst of alleen null-maanden)", () => {
    expect(berekenBiedadvies({ valuation, marktMaanden: [] })).toBeNull();
    expect(berekenBiedadvies({ valuation, marktMaanden: [maand("2026-05", null, null), maand("2026-06", null, null)] })).toBeNull();
  });

  it("schuift de range mee omhoog met de gemiddelde overbieding (+3,4%)", () => {
    const advies = berekenBiedadvies({
      valuation,
      marktMaanden: [maand("2026-05", 3.0, 22), maand("2026-06", 3.8, 24)],
    });
    expect(advies).not.toBeNull();
    expect(advies!.overbiedingPct6m).toBe(3.4);
    expect(advies!.biedrangeLaag).toBe(Math.round(300000 * 1.034)); // 310200
    expect(advies!.biedrangeHoog).toBe(Math.round(360000 * 1.034)); // 372240
  });

  it("schuift de range omlaag bij gemiddeld onderbieden", () => {
    const advies = berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", -2, 30)] });
    expect(advies!.biedrangeLaag).toBe(Math.round(300000 * 0.98));
    expect(advies!.biedrangeHoog).toBe(Math.round(360000 * 0.98));
    expect(advies!.biedrangeHoog).toBeLessThan(valuation.intervalHoog);
  });

  it("negeert null-maanden in het gemiddelde", () => {
    const advies = berekenBiedadvies({
      valuation,
      marktMaanden: [maand("2026-04", 3.0, null), maand("2026-05", null, 40), maand("2026-06", 3.8, null)],
    });
    expect(advies!.overbiedingPct6m).toBe(3.4);
    expect(advies!.doorlooptijd6m).toBe(40);
  });

  it("herkent een verkopersmarkt: overbieding > 2 en doorlooptijd < 25", () => {
    const advies = berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", 3.4, 20)] });
    expect(advies!.spanning).toBe("verkoper");
    expect(advies!.uitlegregels.join(" ")).toContain("verkopersmarkt");
  });

  it("herkent een kopersmarkt bij overbieding < 0", () => {
    const advies = berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", -1.5, 30)] });
    expect(advies!.spanning).toBe("koper");
    expect(advies!.uitlegregels.join(" ")).toContain("kopersmarkt");
  });

  it("herkent een kopersmarkt bij doorlooptijd > 45, ook met lichte overbieding", () => {
    const advies = berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", 1, 50)] });
    expect(advies!.spanning).toBe("koper");
  });

  it("is neutraal tussen de drempels in", () => {
    const advies = berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", 1, 30)] });
    expect(advies!.spanning).toBe("neutraal");
  });

  it("behandelt de drempels zelf als neutraal (precies 2% of precies 25/45 dagen)", () => {
    expect(berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", 2, 20)] })!.spanning).toBe("neutraal");
    expect(berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", 3, 25)] })!.spanning).toBe("neutraal");
    expect(berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", 0, 45)] })!.spanning).toBe("neutraal");
  });

  it("bepaalt spanning ook met alleen doorlooptijd (overbieding null verschuift de range niet)", () => {
    const advies = berekenBiedadvies({ valuation, marktMaanden: [maand("2026-06", null, 60)] });
    expect(advies).not.toBeNull();
    expect(advies!.overbiedingPct6m).toBeNull();
    expect(advies!.spanning).toBe("koper");
    expect(advies!.biedrangeLaag).toBe(valuation.intervalLaag);
    expect(advies!.biedrangeHoog).toBe(valuation.intervalHoog);
    expect(advies!.uitlegregels.join(" ")).toContain("geen overbiedingscijfers");
  });

  it("noemt in de uitlegregels exact de getallen die de range bepalen", () => {
    const advies = berekenBiedadvies({ valuation, marktMaanden: [maand("2026-05", 3.0, 22), maand("2026-06", 3.8, 24)] })!;
    const euro = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    const tekst = advies.uitlegregels.join(" ");
    expect(advies.uitlegregels.length).toBeGreaterThanOrEqual(4); // basis, correctie, doorlooptijd, spanning
    expect(tekst).toContain("3,4"); // nl-NL notatie van het gemiddelde
    expect(tekst).toContain("23 dagen"); // gemiddelde doorlooptijd (22+24)/2
    expect(tekst).toContain(euro(valuation.intervalLaag)); // basis laag
    expect(tekst).toContain(euro(advies.biedrangeLaag)); // verschoven range, zelfde notatie als op de pagina
  });
});
