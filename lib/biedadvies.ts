import { formatEuro } from "@/lib/util";

/**
 * Biedadvies met context: pure logica, geen database. De pagina haalt de
 * valuation en de market_stats van de buurt op en geeft ze hier door.
 * Regels (docs/PLAN.md Fase 3):
 * - basis is de bandbreedte van de waarde (interval_laag..interval_hoog);
 * - de gemiddelde overbieding van de buurt (laatste 6 maanden) schuift die
 *   range evenredig mee omhoog of omlaag;
 * - spanning volgt uit overbieding en doorlooptijd (drempels hieronder);
 * - uitlegregels zeggen in gewone taal exact wat waaruit volgt;
 * - geen data = eerlijk null, nooit een verzonnen range.
 */

export const BIEDADVIES_VERSIE = "wonea-biedadvies-1.0";

// Spanningsdrempels. Bewust simpel en zichtbaar; de uitlegregels noemen ze letterlijk.
export const OVERBIEDING_VERKOPER_PCT = 2; // gemiddelde overbieding boven deze grens
export const DOORLOOPTIJD_VERKOPER_DAGEN = 25; // en doorlooptijd onder deze grens = verkopersmarkt
export const DOORLOOPTIJD_KOPER_DAGEN = 45; // doorlooptijd boven deze grens = kopersmarkt
export const OVERBIEDING_KOPER_PCT = 0; // gemiddelde overbieding onder 0 = kopersmarkt

export type MarktMaand = {
  /** "2026-07" */
  maand: string;
  /** Positief = boven de vraagprijs betaald. Null = geen cijfer die maand. */
  overbiedingPct: number | null;
  doorlooptijdDagen: number | null;
};

export type BiedadviesInput = {
  /** Uit valuations; null als er geen eerlijke schatting is. */
  valuation: { intervalLaag: number; intervalHoog: number } | null;
  /** market_stats van de buurt, laatste 6 maanden (oudste eerst of door elkaar, volgorde maakt niet uit). */
  marktMaanden: MarktMaand[];
};

export type Spanning = "koper" | "neutraal" | "verkoper";

export const SPANNING_TEKST: Record<Spanning, string> = {
  verkoper: "verkopersmarkt",
  koper: "kopersmarkt",
  neutraal: "neutrale markt",
};

export type Biedadvies = {
  biedrangeLaag: number;
  biedrangeHoog: number;
  /** Gemiddelde overbieding over de aangeleverde maanden, 1 decimaal. Null zonder cijfers. */
  overbiedingPct6m: number | null;
  /** Gemiddelde doorlooptijd in dagen, afgerond. Null zonder cijfers. */
  doorlooptijd6m: number | null;
  spanning: Spanning;
  /** Gewone taal, exact wat waaruit volgt. Volgorde: basis, correctie, doorlooptijd, spanning. */
  uitlegregels: string[];
};

function gemiddelde(waarden: number[]): number {
  return waarden.reduce((som, w) => som + w, 0) / waarden.length;
}

function rond1Decimaal(n: number): number {
  return Math.round(n * 10) / 10;
}

function pctTekst(n: number): string {
  return Math.abs(n).toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

export function berekenBiedadvies(input: BiedadviesInput): Biedadvies | null {
  // Zonder waarde-schatting is er geen basis voor een biedrange.
  if (!input.valuation) return null;

  const overbiedingen = input.marktMaanden.map((m) => m.overbiedingPct).filter((v): v is number => v != null && Number.isFinite(v));
  const doorlooptijden = input.marktMaanden.map((m) => m.doorlooptijdDagen).filter((v): v is number => v != null && Number.isFinite(v));

  // Zonder enig marktcijfer valt er niets te corrigeren en geen spanning te duiden.
  if (overbiedingen.length === 0 && doorlooptijden.length === 0) return null;

  const overbiedingPct6m = overbiedingen.length > 0 ? rond1Decimaal(gemiddelde(overbiedingen)) : null;
  const doorlooptijd6m = doorlooptijden.length > 0 ? Math.round(gemiddelde(doorlooptijden)) : null;

  // De afgeronde overbieding bepaalt de verschuiving, zodat de uitlegregels
  // exact dezelfde getallen noemen als de range die we tonen.
  const factor = 1 + (overbiedingPct6m ?? 0) / 100;
  const biedrangeLaag = Math.round(input.valuation.intervalLaag * factor);
  const biedrangeHoog = Math.round(input.valuation.intervalHoog * factor);

  const spanning = bepaalSpanning(overbiedingPct6m, doorlooptijd6m);

  const uitlegregels: string[] = [];

  uitlegregels.push(
    `De basis is de geschatte bandbreedte van de woningwaarde: ${formatEuro(input.valuation.intervalLaag)} tot ${formatEuro(input.valuation.intervalHoog)}.`,
  );

  if (overbiedingPct6m == null) {
    uitlegregels.push("Er zijn geen overbiedingscijfers voor deze buurt, dus we passen de bandbreedte niet aan.");
  } else if (overbiedingPct6m > 0) {
    uitlegregels.push(
      `Kopers betaalden in deze buurt de afgelopen zes maanden gemiddeld ${pctTekst(overbiedingPct6m)}% boven de vraagprijs (gemiddelde van ${overbiedingen.length} maandcijfers). Daarom schuift de biedrange ${pctTekst(overbiedingPct6m)}% omhoog, naar ${formatEuro(biedrangeLaag)} tot ${formatEuro(biedrangeHoog)}.`,
    );
  } else if (overbiedingPct6m < 0) {
    uitlegregels.push(
      `Kopers betaalden in deze buurt de afgelopen zes maanden gemiddeld ${pctTekst(overbiedingPct6m)}% onder de vraagprijs (gemiddelde van ${overbiedingen.length} maandcijfers). Daarom schuift de biedrange ${pctTekst(overbiedingPct6m)}% omlaag, naar ${formatEuro(biedrangeLaag)} tot ${formatEuro(biedrangeHoog)}.`,
    );
  } else {
    uitlegregels.push(
      `Kopers betaalden in deze buurt de afgelopen zes maanden gemiddeld precies de vraagprijs (gemiddelde van ${overbiedingen.length} maandcijfers). De biedrange blijft daarom gelijk aan de bandbreedte.`,
    );
  }

  if (doorlooptijd6m == null) {
    uitlegregels.push("Er zijn geen doorlooptijdcijfers voor deze buurt.");
  } else {
    uitlegregels.push(
      `Woningen die hier werden verkocht, stonden gemiddeld ${doorlooptijd6m} dagen te koop (gemiddelde van ${doorlooptijden.length} maandcijfers).`,
    );
  }

  uitlegregels.push(spanningUitleg(spanning, overbiedingPct6m, doorlooptijd6m));

  return { biedrangeLaag, biedrangeHoog, overbiedingPct6m, doorlooptijd6m, spanning, uitlegregels };
}

function bepaalSpanning(overbiedingPct: number | null, doorlooptijd: number | null): Spanning {
  if (
    overbiedingPct != null &&
    overbiedingPct > OVERBIEDING_VERKOPER_PCT &&
    doorlooptijd != null &&
    doorlooptijd < DOORLOOPTIJD_VERKOPER_DAGEN
  ) {
    return "verkoper";
  }
  if ((overbiedingPct != null && overbiedingPct < OVERBIEDING_KOPER_PCT) || (doorlooptijd != null && doorlooptijd > DOORLOOPTIJD_KOPER_DAGEN)) {
    return "koper";
  }
  return "neutraal";
}

function spanningUitleg(spanning: Spanning, overbiedingPct: number | null, doorlooptijd: number | null): string {
  if (spanning === "verkoper") {
    return `Meer dan ${OVERBIEDING_VERKOPER_PCT}% overbieding en een doorlooptijd korter dan ${DOORLOOPTIJD_VERKOPER_DAGEN} dagen: dat wijst op een verkopersmarkt. Houd rekening met concurrentie van andere bieders.`;
  }
  if (spanning === "koper") {
    const redenen: string[] = [];
    if (overbiedingPct != null && overbiedingPct < OVERBIEDING_KOPER_PCT) redenen.push("er wordt gemiddeld onder de vraagprijs gekocht");
    if (doorlooptijd != null && doorlooptijd > DOORLOOPTIJD_KOPER_DAGEN) redenen.push(`woningen staan gemiddeld langer dan ${DOORLOOPTIJD_KOPER_DAGEN} dagen te koop`);
    const reden = redenen.join(" en ");
    return `${reden.charAt(0).toUpperCase()}${reden.slice(1)}: dat wijst op een kopersmarkt. Onderhandelen over de prijs is hier gebruikelijk.`;
  }
  return "De cijfers wijzen niet duidelijk op een kopers- of verkopersmarkt: we noemen de marktspanning daarom neutraal.";
}
