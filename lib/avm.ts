import type { Comparable } from "@/lib/comparables";
import type { Confidence, Woningtype } from "@/db/schema";

export const MODEL_VERSIE = "wonea-avm-1.0";

export type AvmInput = {
  oppervlakteM2: number;
  bouwjaar: number;
  woningtype: Woningtype;
  energielabel?: string | null;
  comparables: Comparable[];
  /** Fallback-anker per m2 (gem. WOZ buurt / gem. oppervlakte buurt), gelabeld als afgeleide. */
  ankerM2Prijs?: number | null;
};

export type AvmResult = {
  waarde: number;
  intervalLaag: number;
  intervalHoog: number;
  confidence: Confidence;
  nComparables: number;
  modelVersie: string;
  /** Voor de uitlegbaarheid op de pagina en in valuations.inputs_json. */
  uitleg: {
    basisM2Prijs: number;
    basisBron: "comparables" | "buurt_anker";
    factorBouwjaar: number;
    factorType: number;
    factorLabel: number;
    intervalPct: number;
  };
};

// Correctiefactoren: bewust simpel en zichtbaar (methode-pagina toont ze).
function bouwjaarFactor(bouwjaar: number): number {
  if (bouwjaar >= 2015) return 1.08;
  if (bouwjaar >= 2000) return 1.04;
  if (bouwjaar >= 1980) return 1.0;
  if (bouwjaar >= 1960) return 0.96;
  if (bouwjaar >= 1930) return 0.94;
  return 0.97; // vooroorlogs heeft vaak karakterpremie t.o.v. 1930-1960
}

function typeFactor(t: Woningtype): number {
  switch (t) {
    case "vrijstaand":
      return 1.15;
    case "twee-onder-een-kap":
      return 1.08;
    case "hoekwoning":
      return 1.02;
    case "tussenwoning":
      return 1.0;
    case "appartement":
      return 1.0;
  }
}

function labelFactor(label?: string | null): number {
  switch ((label ?? "").toUpperCase()) {
    case "A":
      return 1.04;
    case "B":
      return 1.02;
    case "C":
      return 1.0;
    case "D":
      return 0.985;
    case "E":
      return 0.97;
    case "F":
      return 0.955;
    case "G":
      return 0.94;
    default:
      return 1.0;
  }
}

function mediaan(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function kwartiel(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const MIN_INTERVAL_PCT = 0.05;
const MAX_INTERVAL_PCT = 0.15;
const MIN_COMPS_VOOR_BASIS = 5;

/**
 * Wonea AVM v1. Deterministisch en uitlegbaar:
 * basis-m2-prijs uit comparables (mediaan), anders het buurt-anker;
 * correcties voor bouwjaar, type en label; interval uit de spreiding (IQR),
 * begrensd op 5-15 procent. Confidence volgt het aantal comparables.
 * Geen comparables EN geen anker: null (eerlijk "geen schatting mogelijk").
 */
export function berekenWaarde(input: AvmInput): AvmResult | null {
  const m2Prijzen = input.comparables.map((c) => c.prijs / c.oppervlakteM2);

  let basisM2Prijs: number;
  let basisBron: "comparables" | "buurt_anker";
  if (m2Prijzen.length >= MIN_COMPS_VOOR_BASIS) {
    basisM2Prijs = mediaan(m2Prijzen);
    basisBron = "comparables";
  } else if (input.ankerM2Prijs && input.ankerM2Prijs > 0) {
    basisM2Prijs = input.ankerM2Prijs;
    basisBron = "buurt_anker";
  } else if (m2Prijzen.length > 0) {
    basisM2Prijs = mediaan(m2Prijzen);
    basisBron = "comparables";
  } else {
    return null;
  }

  const fBouwjaar = bouwjaarFactor(input.bouwjaar);
  const fType = typeFactor(input.woningtype);
  const fLabel = labelFactor(input.energielabel);

  const waarde = Math.round((basisM2Prijs * input.oppervlakteM2 * fBouwjaar * fType * fLabel) / 1000) * 1000;

  // Interval uit spreiding van de comps; weinig comps = breed.
  let intervalPct: number;
  if (m2Prijzen.length >= 4) {
    const iqr = kwartiel(m2Prijzen, 0.75) - kwartiel(m2Prijzen, 0.25);
    const rel = iqr / mediaan(m2Prijzen) / 2;
    intervalPct = Math.min(MAX_INTERVAL_PCT, Math.max(MIN_INTERVAL_PCT, rel));
  } else {
    intervalPct = MAX_INTERVAL_PCT;
  }

  const n = input.comparables.length;
  const confidence: Confidence = n >= 8 ? "hoog" : n >= 4 ? "middel" : "laag";

  return {
    waarde,
    intervalLaag: Math.round((waarde * (1 - intervalPct)) / 1000) * 1000,
    intervalHoog: Math.round((waarde * (1 + intervalPct)) / 1000) * 1000,
    confidence,
    nComparables: n,
    modelVersie: MODEL_VERSIE,
    uitleg: {
      basisM2Prijs: Math.round(basisM2Prijs),
      basisBron,
      factorBouwjaar: fBouwjaar,
      factorType: fType,
      factorLabel: fLabel,
      intervalPct,
    },
  };
}
