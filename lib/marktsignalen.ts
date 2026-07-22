/**
 * Timing- en marktsignalen per buurt, berekend op market_stats (12 maanden).
 * PURE logica: geen database, geen IO; de aanroeper levert de maandrijen aan
 * (components/markt/signalen.tsx doet dat voor de UI). Daardoor is dit bestand
 * volledig testbaar zonder testdatabase (tests/marktsignalen.test.ts).
 *
 * Eerlijkheid boven volledigheid: is er te weinig prijsdata voor een zinnig
 * signaal, dan is het resultaat null. Liever geen signaal dan een verzonnen
 * signaal. Ontbrekende deelsignalen (doorlooptijd, overbieding, volume)
 * blijven null en krijgen geen uitlegregel.
 */

export type Momentum = "stijgend" | "vlak" | "dalend";
export type DoorlooptijdTrend = "korter" | "gelijk" | "langer";

/** Structureel compatibel met een market_stats-rij uit Drizzle (extra velden mogen). */
export type MarktStatMaand = {
  maand: string; // "2026-07"
  mediaanPrijs: number | null;
  doorlooptijdDagen: number | null;
  overbiedingPct: number | null;
  volume: number | null;
};

export type MarktSignalen = {
  /** Mediaanprijs laatste 3 maanden vs de 3 maanden ervoor, drempel 1,5%. */
  momentum: Momentum;
  /** Het percentage achter momentum, afgerond op 1 decimaal. */
  momentumPct: number;
  /** Eerste vs laatste maand met prijsdata binnen het 12-maandsvenster. */
  prijsontwikkeling12mPct: number;
  /** Gemiddelde doorlooptijd laatste 3 maanden vs de 3 ervoor, drempel 10%. */
  doorlooptijdTrend: DoorlooptijdTrend;
  /** Doorlooptijd in dagen in de recentste maand met data; null zonder data. */
  doorlooptijdNu: number | null;
  /** Overbieding in de recentste maand met data; positief = boven vraagprijs. */
  overbiedingNu: number | null;
  /** Aantal verkopen in de recentste maand met data. */
  volumeNu: number | null;
  /** Mediaanprijs per maand (oudste eerst), voor de grafiek in de UI. */
  prijsReeks: { maand: string; mediaan: number }[];
  /** Gewone taal: wat zegt dit, en wat doe je ermee. */
  uitlegregels: string[];
};

export const MOMENTUM_DREMPEL_PCT = 1.5;
export const DOORLOOPTIJD_DREMPEL_PCT = 10;
/** Minimaal 6 maanden met een mediaanprijs, anders is 3-vs-3 niet te vergelijken. */
const MIN_PRIJSMAANDEN = 6;

function gemiddelde(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function rondAf1(x: number): number {
  return Math.round(x * 10) / 10;
}

function formatPct(x: number): string {
  return Math.abs(x).toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

/** "ongeveer 12 dagen" of "ongeveer 3 weken": afgerond, want het is een gemiddelde. */
export function formatDoorlooptijd(dagen: number): string {
  if (dagen < 14) return `ongeveer ${dagen} dagen`;
  const weken = Math.round(dagen / 7);
  return `ongeveer ${weken} weken`;
}

/**
 * Berekent de marktsignalen uit maximaal 12 maanden market_stats van een buurt.
 * Rijen mogen ongesorteerd en met gaten aangeleverd worden; er wordt gesorteerd
 * op maand en alleen de laatste 12 maanden tellen mee. Maanden zonder bruikbare
 * mediaanprijs (null of 0) tellen niet als prijsdata.
 */
export function berekenMarktsignalen(rijen: MarktStatMaand[]): MarktSignalen | null {
  const maanden = [...rijen].sort((a, b) => (a.maand < b.maand ? -1 : a.maand > b.maand ? 1 : 0)).slice(-12);
  const prijsMaanden = maanden.filter(
    (m): m is MarktStatMaand & { mediaanPrijs: number } => m.mediaanPrijs != null && m.mediaanPrijs > 0,
  );
  if (prijsMaanden.length < MIN_PRIJSMAANDEN) return null;

  // Momentum: gemiddelde van de maandmedianen, laatste 3 vs de 3 ervoor.
  // Vergeleken op de afgeronde waarde, zodat het getal dat we tonen ook het
  // getal is waarop we classificeren.
  const recent = prijsMaanden.slice(-3);
  const ervoor = prijsMaanden.slice(-6, -3);
  const gemErvoor = gemiddelde(ervoor.map((m) => m.mediaanPrijs));
  if (gemErvoor <= 0) return null;
  const momentumPct = rondAf1(((gemiddelde(recent.map((m) => m.mediaanPrijs)) - gemErvoor) / gemErvoor) * 100);
  const momentum: Momentum =
    momentumPct > MOMENTUM_DREMPEL_PCT ? "stijgend" : momentumPct < -MOMENTUM_DREMPEL_PCT ? "dalend" : "vlak";

  const eerste = prijsMaanden[0];
  const laatste = prijsMaanden[prijsMaanden.length - 1];
  const prijsontwikkeling12mPct = rondAf1(((laatste.mediaanPrijs - eerste.mediaanPrijs) / eerste.mediaanPrijs) * 100);

  // Doorlooptijd: zelfde 3-vs-3-vergelijking, relatieve drempel 10%.
  // Te weinig data voor de vergelijking = "gelijk" (geen trendclaim).
  const looptijdMaanden = maanden.filter(
    (m): m is MarktStatMaand & { doorlooptijdDagen: number } => m.doorlooptijdDagen != null,
  );
  const doorlooptijdNu = looptijdMaanden.length > 0 ? looptijdMaanden[looptijdMaanden.length - 1].doorlooptijdDagen : null;
  let doorlooptijdTrend: DoorlooptijdTrend = "gelijk";
  const lRecent = looptijdMaanden.slice(-3);
  const lErvoor = looptijdMaanden.slice(-6, -3);
  if (lRecent.length >= 2 && lErvoor.length >= 2) {
    const gemLErvoor = gemiddelde(lErvoor.map((m) => m.doorlooptijdDagen));
    if (gemLErvoor > 0) {
      const deltaPct = ((gemiddelde(lRecent.map((m) => m.doorlooptijdDagen)) - gemLErvoor) / gemLErvoor) * 100;
      if (deltaPct <= -DOORLOOPTIJD_DREMPEL_PCT) doorlooptijdTrend = "korter";
      else if (deltaPct >= DOORLOOPTIJD_DREMPEL_PCT) doorlooptijdTrend = "langer";
    }
  }

  // Overbieding en volume: de recentste maand waarin het gemeten is.
  const overbiedingNu = [...maanden].reverse().find((m) => m.overbiedingPct != null)?.overbiedingPct ?? null;
  const volumeNu = [...maanden].reverse().find((m) => m.volume != null)?.volume ?? null;

  const prijsReeks = prijsMaanden.map((m) => ({ maand: m.maand, mediaan: m.mediaanPrijs }));

  return {
    momentum,
    momentumPct,
    prijsontwikkeling12mPct,
    doorlooptijdTrend,
    doorlooptijdNu,
    overbiedingNu,
    volumeNu,
    prijsReeks,
    uitlegregels: bouwUitlegregels({
      momentum,
      momentumPct,
      prijsontwikkeling12mPct,
      doorlooptijdTrend,
      doorlooptijdNu,
      overbiedingNu,
      volumeNu,
    }),
  };
}

function bouwUitlegregels(s: {
  momentum: Momentum;
  momentumPct: number;
  prijsontwikkeling12mPct: number;
  doorlooptijdTrend: DoorlooptijdTrend;
  doorlooptijdNu: number | null;
  overbiedingNu: number | null;
  volumeNu: number | null;
}): string[] {
  const regels: string[] = [];

  if (s.momentum === "stijgend") {
    regels.push(
      `De mediaanprijs ligt de laatste drie maanden ${formatPct(s.momentumPct)}% hoger dan in de drie maanden ervoor. Voor kopers: wachten maakt het hier zelden goedkoper. Voor verkopers: een gunstig moment om de verkoop te starten.`,
    );
  } else if (s.momentum === "dalend") {
    regels.push(
      `De mediaanprijs ligt de laatste drie maanden ${formatPct(s.momentumPct)}% lager dan in de drie maanden ervoor. Voor kopers: er is ruimte om scherp te bieden. Voor verkopers: reken met de prijzen van nu, niet met die van vorig jaar.`,
    );
  } else {
    regels.push(
      `De mediaanprijs beweegt de laatste maanden nauwelijks: het verschil met de drie maanden ervoor is hooguit ${formatPct(MOMENTUM_DREMPEL_PCT)}%. Geen reden voor haast, dus neem de tijd om rustig te vergelijken.`,
    );
  }

  if (s.prijsontwikkeling12mPct > 0) {
    regels.push(`Over het hele jaar gezien steeg de mediaanprijs hier per saldo met ${formatPct(s.prijsontwikkeling12mPct)}%.`);
  } else if (s.prijsontwikkeling12mPct < 0) {
    regels.push(`Over het hele jaar gezien daalde de mediaanprijs hier per saldo met ${formatPct(s.prijsontwikkeling12mPct)}%.`);
  } else {
    regels.push(`Over het hele jaar gezien bleef de mediaanprijs hier per saldo vrijwel gelijk.`);
  }

  if (s.doorlooptijdNu != null) {
    const basis = `Woningen verkopen hier nu in ${formatDoorlooptijd(s.doorlooptijdNu)}`;
    if (s.doorlooptijdTrend === "korter") {
      regels.push(`${basis}, sneller dan eerder. Snel beslissen loont, overhaasten niet.`);
    } else if (s.doorlooptijdTrend === "langer") {
      regels.push(`${basis}, langzamer dan eerder. Je hebt als koper meer tijd om na te denken en te onderhandelen.`);
    } else if (s.doorlooptijdNu <= 45) {
      regels.push(`${basis}. Snel beslissen loont, overhaasten niet.`);
    } else {
      regels.push(`${basis}. Er is tijd om rustig te kijken en te onderhandelen.`);
    }
  }

  if (s.overbiedingNu != null) {
    if (s.overbiedingNu > 0.5) {
      regels.push(
        `Kopers betalen hier gemiddeld ${formatPct(s.overbiedingNu)}% boven de vraagprijs. Bepaal vooraf je maximum, dan kun je scherp bieden zonder je te laten meeslepen.`,
      );
    } else if (s.overbiedingNu < -0.5) {
      regels.push(
        `Kopers betalen hier gemiddeld ${formatPct(s.overbiedingNu)}% onder de vraagprijs. Een bod onder de vraagprijs is hier dus normaal: er is onderhandelingsruimte.`,
      );
    } else {
      regels.push(`Kopers betalen hier gemiddeld ongeveer de vraagprijs. Een realistisch bod ligt daar dan ook dicht bij.`);
    }
  }

  if (s.volumeNu != null) {
    if (s.volumeNu < 5) {
      regels.push(
        `Let op: dit beeld leunt op weinig verkopen (${s.volumeNu} in de recentste maand). Lees het als richting, niet als zekerheid.`,
      );
    } else {
      regels.push(`In de recentste maand wisselden hier ${s.volumeNu} woningen van eigenaar.`);
    }
  }

  return regels;
}
