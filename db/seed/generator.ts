import type { Woningtype } from "@/db/schema";
import { nummerslug, slugify } from "@/lib/util";

/**
 * Deterministische seed-generator voor het testgebied (Eindhoven).
 * Zelfde seed = exact dezelfde data, dus 2x seeden geeft 0 verschil
 * (idempotentie-eis uit het plan). Alle rijen krijgen bron=seed.
 * BELANGRIJK: seed-verkopen krijgen NOOIT een adres_id; ze bestaan alleen
 * op buurt/straatniveau (reviewer-blocker: nooit verzonnen koopsommen aan
 * echte, herleidbare adressen hangen).
 */

// mulberry32: klein, deterministisch, goed genoeg voor seed-data.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BuurtSeed = {
  buurtCode: string;
  naam: string;
  postcode4: string;
  gemWoz: number; // euro, CBS-achtig anker
  inwoners: number;
  straten: string[];
  typeMix: Array<{ type: Woningtype; kans: number }>;
  bouwjaarRange: [number, number];
};

export const GEMEENTE = { code: "GM0772", naam: "Eindhoven", slug: "eindhoven" };

// Buurtcodes volgen het CBS-formaat maar zijn hier seed-data; de echte
// CBS-koppeling komt via scripts/ingest-cbs.ts (Fase 5 generiek).
export const BUURTEN: BuurtSeed[] = [
  {
    buurtCode: "BU07720001",
    naam: "Binnenstad",
    postcode4: "5611",
    gemWoz: 465000,
    inwoners: 7200,
    straten: ["Kleine Berg", "Grote Berg", "Willemstraat", "Hoogstraat", "Bergstraat", "Keizersgracht"],
    typeMix: [
      { type: "appartement", kans: 0.72 },
      { type: "tussenwoning", kans: 0.22 },
      { type: "hoekwoning", kans: 0.06 },
    ],
    bouwjaarRange: [1890, 2020],
  },
  {
    buurtCode: "BU07720002",
    naam: "De Bergen",
    postcode4: "5611",
    gemWoz: 512000,
    inwoners: 3900,
    straten: ["Sint Antoniusstraat", "Prins Hendrikstraat", "Bergen op Zoomstraat", "Baronielaan"],
    typeMix: [
      { type: "tussenwoning", kans: 0.5 },
      { type: "appartement", kans: 0.35 },
      { type: "hoekwoning", kans: 0.15 },
    ],
    bouwjaarRange: [1900, 1965],
  },
  {
    buurtCode: "BU07720003",
    naam: "Villapark",
    postcode4: "5613",
    gemWoz: 738000,
    inwoners: 2800,
    straten: ["Parklaan", "Fazantlaan", "Nachtegaallaan", "Reigerlaan"],
    typeMix: [
      { type: "vrijstaand", kans: 0.35 },
      { type: "twee-onder-een-kap", kans: 0.3 },
      { type: "tussenwoning", kans: 0.2 },
      { type: "appartement", kans: 0.15 },
    ],
    bouwjaarRange: [1905, 1995],
  },
  {
    buurtCode: "BU07720004",
    naam: "Limbeek",
    postcode4: "5612",
    gemWoz: 348000,
    inwoners: 5100,
    straten: ["Limbeekstraat", "Hemelrijken", "Boschdijk", "Vlokhovenseweg"],
    typeMix: [
      { type: "tussenwoning", kans: 0.6 },
      { type: "hoekwoning", kans: 0.2 },
      { type: "appartement", kans: 0.2 },
    ],
    bouwjaarRange: [1910, 1990],
  },
  {
    buurtCode: "BU07720005",
    naam: "Woensel-West",
    postcode4: "5616",
    gemWoz: 322000,
    inwoners: 6400,
    straten: ["Edisonstraat", "Marconilaan", "Franklinstraat", "Galileistraat"],
    typeMix: [
      { type: "tussenwoning", kans: 0.65 },
      { type: "hoekwoning", kans: 0.18 },
      { type: "appartement", kans: 0.17 },
    ],
    bouwjaarRange: [1918, 1985],
  },
  {
    buurtCode: "BU07720006",
    naam: "Strijp",
    postcode4: "5616",
    gemWoz: 412000,
    inwoners: 8900,
    straten: ["Strijpsestraat", "Schootsestraat", "Sint Trudostraat", "Zeelsterstraat"],
    typeMix: [
      { type: "tussenwoning", kans: 0.5 },
      { type: "appartement", kans: 0.32 },
      { type: "hoekwoning", kans: 0.18 },
    ],
    bouwjaarRange: [1915, 2018],
  },
  {
    buurtCode: "BU07720007",
    naam: "Tongelre",
    postcode4: "5613",
    gemWoz: 445000,
    inwoners: 4700,
    straten: ["Tongelresestraat", "Krommenbeemd", "Loostraat", "Pagelaan"],
    typeMix: [
      { type: "tussenwoning", kans: 0.42 },
      { type: "hoekwoning", kans: 0.22 },
      { type: "twee-onder-een-kap", kans: 0.2 },
      { type: "appartement", kans: 0.16 },
    ],
    bouwjaarRange: [1930, 2010],
  },
  {
    buurtCode: "BU07720008",
    naam: "Gestel",
    postcode4: "5615",
    gemWoz: 398000,
    inwoners: 7600,
    straten: ["Hoogstraat Gestel", "Blaarthemseweg", "Genneperweg", "Sint Claralaan"],
    typeMix: [
      { type: "tussenwoning", kans: 0.48 },
      { type: "appartement", kans: 0.28 },
      { type: "hoekwoning", kans: 0.14 },
      { type: "twee-onder-een-kap", kans: 0.1 },
    ],
    bouwjaarRange: [1925, 2005],
  },
];

function kies<T>(rand: () => number, items: Array<{ type: T; kans: number }>): T {
  const r = rand();
  let acc = 0;
  for (const it of items) {
    acc += it.kans;
    if (r <= acc) return it.type;
  }
  return items[items.length - 1].type;
}

function labelVoorBouwjaar(bouwjaar: number, rand: () => number): string {
  // Indicatie op basis van bouwjaar (echte labels: EP-Online, livegang-TODO).
  if (bouwjaar >= 2015) return rand() < 0.8 ? "A" : "B";
  if (bouwjaar >= 2000) return rand() < 0.6 ? "B" : "C";
  if (bouwjaar >= 1980) return rand() < 0.5 ? "C" : "D";
  if (bouwjaar >= 1960) return rand() < 0.5 ? "D" : "E";
  if (bouwjaar >= 1930) return rand() < 0.5 ? "E" : "F";
  return rand() < 0.5 ? "F" : "G";
}

export type SeedAdres = {
  straat: string;
  huisnummer: number;
  toevoeging: string | null;
  nummerslug: string;
  postcode: string;
  plaats: string;
  buurtCode: string;
  bouwjaar: number;
  oppervlakteM2: number;
  woningtype: Woningtype;
  energielabel: string;
};

export type SeedVerkoop = {
  buurtCode: string;
  straat: string;
  datum: string;
  prijs: number;
  oppervlakteM2: number;
  woningtype: Woningtype;
};

export type SeedMarktStat = {
  buurtCode: string;
  maand: string;
  mediaanPrijs: number;
  doorlooptijdDagen: number;
  overbiedingPct: number;
  volume: number;
};

const LETTERS = ["A", "B", "C", "D", "E", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "V", "X", "Z"];

export function genereerAdressen(perBuurt = 260): SeedAdres[] {
  const rand = mulberry32(20260722);
  const out: SeedAdres[] = [];
  for (const buurt of BUURTEN) {
    const perStraat = Math.ceil(perBuurt / buurt.straten.length);
    for (const straat of buurt.straten) {
      const pcLetters = LETTERS[Math.floor(rand() * LETTERS.length)] + LETTERS[Math.floor(rand() * LETTERS.length)];
      const postcode = `${buurt.postcode4}${pcLetters}`;
      for (let i = 0; i < perStraat; i++) {
        const huisnummer = 1 + i * 2 + Math.floor(rand() * 2); // oneven/even mix
        const type = kies(rand, buurt.typeMix);
        const toevoeging = type === "appartement" && rand() < 0.45 ? (rand() < 0.5 ? String(1 + Math.floor(rand() * 4)) : "a") : null;
        const bouwjaar = Math.round(buurt.bouwjaarRange[0] + rand() * (buurt.bouwjaarRange[1] - buurt.bouwjaarRange[0]));
        const basisOpp = type === "appartement" ? 55 : type === "vrijstaand" ? 160 : type === "twee-onder-een-kap" ? 135 : 105;
        const oppervlakteM2 = Math.round(basisOpp * (0.75 + rand() * 0.7));
        out.push({
          straat,
          huisnummer,
          toevoeging,
          nummerslug: nummerslug(huisnummer, toevoeging),
          postcode,
          plaats: GEMEENTE.naam,
          buurtCode: buurt.buurtCode,
          bouwjaar,
          oppervlakteM2,
          woningtype: type,
          energielabel: labelVoorBouwjaar(bouwjaar, rand),
        });
      }
    }
  }
  // Dedupe op postcode+nummerslug (uniekheidseis van de URL-sleutel).
  const seen = new Set<string>();
  return out.filter((a) => {
    const key = `${a.postcode}|${a.nummerslug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Maanddrift per buurt: lichte stijging met ruis, deterministisch. */
function driftFactor(rand: () => number, maandIndex: number): number {
  const jaarlijks = 0.045; // ~4,5% per jaar, in lijn met CBS-prijsontwikkeling
  const ruis = (rand() - 0.5) * 0.01;
  return Math.pow(1 + jaarlijks, maandIndex / 12) * (1 + ruis);
}

export function genereerVerkopen(maanden = 24, extraSeed = 0): { verkopen: SeedVerkoop[]; stats: SeedMarktStat[] } {
  const rand = mulberry32(918273645 + extraSeed);
  const verkopen: SeedVerkoop[] = [];
  const stats: SeedMarktStat[] = [];
  const nu = new Date();

  for (const buurt of BUURTEN) {
    const ankerM2 = buurt.gemWoz / 110; // ruw anker; echte ankers rekent seed.ts uit adressen
    for (let m = maanden - 1; m >= 0; m--) {
      const d = new Date(nu.getFullYear(), nu.getMonth() - m, 1);
      const maand = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const drift = driftFactor(rand, maanden - m);
      const volume = 2 + Math.floor(rand() * 4);
      const prijzen: number[] = [];
      for (let v = 0; v < volume; v++) {
        const straat = buurt.straten[Math.floor(rand() * buurt.straten.length)];
        const type = kies(rand, buurt.typeMix);
        const basisOpp = type === "appartement" ? 55 : type === "vrijstaand" ? 160 : type === "twee-onder-een-kap" ? 135 : 105;
        const opp = Math.round(basisOpp * (0.75 + rand() * 0.7));
        const m2 = ankerM2 * drift * (0.85 + rand() * 0.3);
        const prijs = Math.round((m2 * opp) / 1000) * 1000;
        const dag = 1 + Math.floor(rand() * 27);
        verkopen.push({
          buurtCode: buurt.buurtCode,
          straat,
          datum: `${maand}-${String(dag).padStart(2, "0")}`,
          prijs,
          oppervlakteM2: opp,
          woningtype: type,
        });
        prijzen.push(prijs);
      }
      const sorted = [...prijzen].sort((a, b) => a - b);
      stats.push({
        buurtCode: buurt.buurtCode,
        maand,
        mediaanPrijs: sorted[Math.floor(sorted.length / 2)],
        doorlooptijdDagen: 18 + Math.floor(rand() * 30),
        overbiedingPct: Math.round((rand() * 8 - 1.5) * 10) / 10,
        volume,
      });
    }
  }
  return { verkopen, stats };
}

export function buurtSlug(naam: string): string {
  return slugify(naam);
}
