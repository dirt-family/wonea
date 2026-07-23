/**
 * Invoer-naar-uitkomst-mapping van de hypotheekberekenaar: puur, geen UI,
 * geen database. Alle rekenregels komen ongewijzigd uit de bestaande lagen:
 * - maximale hypotheek: lib/hypotheek.ts (leennormen 2026, Staatscourant
 *   2025, 36471);
 * - maandlasten: maandlastenOverzicht uit lib/hypotheek.ts;
 * - verstrekkerstarieven: lib/bronnen/rentes-verstrekkers.ts (groepering en
 *   eerlijkheidsregels van die lezer, alfabetisch, geen "beste");
 * - eigen geld: app/kosten-koper/berekening.ts (overdrachtsbelasting uit
 *   lib/normen/overdrachtsbelasting-2026.ts plus de indicatie-kosten), door
 *   de stepper rechtstreeks aangeroepen;
 * - starters-leeftijdsgrenzen en NHG-grens: letterlijk de constanten uit
 *   lib/normen.
 *
 * Dit bestand voegt alleen toe wat de tool zelf nodig heeft: veldvalidaties,
 * de vertaling van geboortejaar naar een starters-indicatie (leeftijd per
 * kalenderjaar, dus nadrukkelijk een indicatie), de energielabel-opties voor
 * het formulier en een indicatiemarge rond de uitkomst.
 * tests/hypotheek-berekenen.test.ts bewaakt dat deze laag geen eigen
 * rekenregels introduceert.
 */

import {
  maandlastenOverzicht,
  maximaleHypotheek,
  type EnergielabelKlasse,
  type MaximaleHypotheekUitkomst,
  type RenteOptie,
} from "@/lib/hypotheek";
import { ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING, NHG_GRENS_2026 } from "@/lib/normen/leennormen-2026";
import { STARTERS_LEEFTIJD_TOT, STARTERS_LEEFTIJD_VANAF } from "@/lib/normen/overdrachtsbelasting-2026";
import type { RenteBucketKey } from "@/lib/bronnen/rentes";
import { groepeerVoorTabel, type NhgStatus, type VerstrekkersRentes } from "@/lib/bronnen/rentes-verstrekkers";

// ---------------------------------------------------------------------------
// Rente-uitgangspunt van de tool
// ---------------------------------------------------------------------------

/**
 * De tool rekent met 10 jaar rentevast: vanaf tien jaar toetst de wet op de
 * werkelijke rente (art. 3, negende lid), dus het DNB-gemiddelde is dan ook
 * meteen de toetsrente en er is geen AFM-ondergrens die het beeld vertekent.
 */
export const TOETS_RENTEVAST_JAREN = 10;

/** DNB-bucket die bij 10 jaar rentevast hoort (dekt langer dan 5 tot en met 10 jaar). */
export const DNB_BUCKET: RenteBucketKey = "5_tot_10";

/**
 * Indicatiemarge rond de maximale hypotheek, in procenten omlaag en omhoog.
 * Een marge van de tool (geen norm-onzekerheid), zelfde conventie als de
 * budgetberekenaar: acceptatiebeleid en persoonlijke details maken de echte
 * ruimte anders. De UI toont dit altijd als indicatie met die uitleg.
 */
export const INDICATIE_MARGE_PCT = 5;

// ---------------------------------------------------------------------------
// Veldvalidaties (puur, zodat de grenzen in node testbaar zijn)
// ---------------------------------------------------------------------------

/** "48.000" of "48000" naar 48000; onleesbaar wordt null. */
export function parseBedrag(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function valideerGeboortejaar(tekst: string, huidigJaar: number): string | null {
  if (!/^\d{4}$/.test(tekst.trim())) return "Vul het geboortejaar in met vier cijfers, bijvoorbeeld 1994.";
  const jaar = Number(tekst.trim());
  if (jaar > huidigJaar || jaar < huidigJaar - 120) return "Controleer het geboortejaar: dat jaar kan niet kloppen.";
  return null;
}

export function valideerInkomen(tekst: string): string | null {
  const n = parseBedrag(tekst);
  if (n == null || n < 1) return "Vul je bruto jaarinkomen in, in hele euro's. Afronden mag.";
  return null;
}

export function valideerInkomenTweedeKoper(tekst: string): string | null {
  const n = parseBedrag(tekst);
  if (n == null || n < 0) return "Vul ook het bruto jaarinkomen van de tweede koper in. Geen inkomen? Vul 0 in.";
  return null;
}

export function valideerKoopsom(tekst: string): string | null {
  const n = parseBedrag(tekst);
  if (n == null || n < 1) return "Vul de verwachte koopsom in, in hele euro's. Een schatting mag.";
  return null;
}

// ---------------------------------------------------------------------------
// Geboortejaar naar starters-indicatie (grenzen uit lib/normen, geen kopie)
// ---------------------------------------------------------------------------

/**
 * Wat het geboortejaar zegt over de startersvrijstelling:
 * - "mogelijk": dit kalenderjaar nog geen 35 (en al 18), dus de leeftijdseis
 *   kan kloppen;
 * - "grensjaar": wordt dit kalenderjaar 35; de vrijstelling hangt dan af van
 *   of de overdracht voor de verjaardag valt. We rekenen zonder vrijstelling
 *   en zeggen dat er eerlijk bij;
 * - "nee": voldoet dit kalenderjaar niet aan de leeftijdseis.
 * We kennen alleen het geboortejaar, niet de geboortedatum: leeftijden zijn
 * hier per kalenderjaar en dus een indicatie.
 */
export type StartersStatus = "mogelijk" | "grensjaar" | "nee";

export function startersStatus(geboortejaar: number, huidigJaar: number): StartersStatus {
  const bereiktDitJaar = huidigJaar - geboortejaar;
  if (bereiktDitJaar < STARTERS_LEEFTIJD_VANAF) return "nee";
  if (bereiktDitJaar < STARTERS_LEEFTIJD_TOT) return "mogelijk";
  if (bereiktDitJaar === STARTERS_LEEFTIJD_TOT) return "grensjaar";
  return "nee";
}

/**
 * Samen kopen: de normlaag kent alleen een vrijstelling over het geheel, dus
 * we rekenen de vrijstelling alleen als iedereen aan de leeftijdseis voldoet.
 * Voldoet maar een van de kopers, dan kan er over diens deel toch vrijstelling
 * gelden; de UI benoemt dat expliciet (de notaris rekent het per persoon uit).
 */
export function gezamenlijkeStartersStatus(statussen: StartersStatus[]): StartersStatus {
  if (statussen.length === 0 || statussen.some((s) => s === "nee")) return "nee";
  if (statussen.some((s) => s === "grensjaar")) return "grensjaar";
  return "mogelijk";
}

// ---------------------------------------------------------------------------
// Energielabel-opties voor stap 3 (bedragen letterlijk uit lib/normen)
// ---------------------------------------------------------------------------

export type EnergielabelOptie = {
  klasse: EnergielabelKlasse;
  /** NL-label voor het formulier. */
  label: string;
  /** Letters voor de EnergieLabelBadge(s) in de keuzerij; A+-varianten tonen we als A. */
  badges: string[];
  /** Bedrag dat de norm buiten beschouwing laat (art. 4 lid 3), hele euro's. */
  bedrag: number;
};

function optie(klasse: EnergielabelKlasse, label: string, badges: string[]): EnergielabelOptie {
  return { klasse, label, badges, bedrag: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING[klasse] };
}

/** Van beste naar slechtste label, zelfde volgorde-conventie als de budgetberekenaar. */
export const ENERGIELABEL_OPTIES: EnergielabelOptie[] = [
  optie("A4PlusGarantie", "A++++ met energieprestatiegarantie van minimaal 10 jaar", ["A"]),
  optie("A4Plus", "A++++", ["A"]),
  optie("A3Plus", "A+++", ["A"]),
  optie("APlus_APlusPlus", "A+ of A++", ["A"]),
  optie("AB", "A of B", ["A", "B"]),
  optie("CD", "C of D", ["C", "D"]),
  optie("EFG", "E, F of G", ["E", "F", "G"]),
];

// ---------------------------------------------------------------------------
// Uitkomst: maximale hypotheek, maandlasten, spreiding, afgeleiden
// ---------------------------------------------------------------------------

export interface MaxHypotheekInvoer {
  /** Bruto jaarinkomen koper 1, hele euro's. */
  inkomen1: number;
  /** Bruto jaarinkomen koper 2; telt in 2026 volledig mee (art. 3 lid 6). */
  inkomen2?: number;
  /** Energielabelklasse; weglaten betekent: geen labelbedrag meerekenen. */
  energielabelKlasse?: EnergielabelKlasse;
  /** De actuele DNB-gemiddelde rente in procenten (serverpagina levert die aan). */
  rentePct: number;
}

export interface MaxHypotheekUitkomst extends MaximaleHypotheekUitkomst {
  /** Toetsinkomen waarmee gerekend is: inkomen1 plus inkomen2. */
  toetsinkomen: number;
  /** Onderkant van de indicatiemarge. */
  laag: number;
  /** Bovenkant van de indicatiemarge. */
  hoog: number;
}

/**
 * Maximale hypotheek bij het rente-uitgangspunt van de tool. De kern komt
 * ongewijzigd uit maximaleHypotheek (lib/hypotheek.ts); hier komen alleen de
 * presentatie-afgeleiden bij (toetsinkomen, indicatiemarge).
 * Vereenvoudiging (de UI benoemt die): we rekenen met de tabel voor wie de
 * AOW-leeftijd nog niet heeft bereikt en zonder bestaande maandelijkse
 * verplichtingen; de budgetberekenaar vraagt daar wel naar.
 */
export function berekenMaxHypotheek(invoer: MaxHypotheekInvoer): MaxHypotheekUitkomst {
  const kern = maximaleHypotheek({
    inkomen1: invoer.inkomen1,
    inkomen2: invoer.inkomen2,
    toetsrentePct: invoer.rentePct,
    rentevastJaren: TOETS_RENTEVAST_JAREN,
    energielabelKlasse: invoer.energielabelKlasse,
  });
  const marge = INDICATIE_MARGE_PCT / 100;
  return {
    ...kern,
    toetsinkomen: invoer.inkomen1 + (invoer.inkomen2 ?? 0),
    laag: Math.round(kern.maximaal * (1 - marge)),
    hoog: Math.round(kern.maximaal * (1 + marge)),
  };
}

/**
 * Bruto maandlast als je de volledige koopsom leent (sinds 2018 het maximum:
 * 100% van de woningwaarde), bij de meegegeven rente. Rechtstreeks
 * maandlastenOverzicht uit lib/hypotheek.ts, 30 jaar annuitair.
 */
export function berekenMaandlastKoopsom(koopsom: number, rentePct: number): number {
  const regel = maandlastenOverzicht(koopsom, [{ label: "koopsom", pct: rentePct }])[0];
  return regel ? regel.maandlast : 0;
}

/** Een regel in de spreiding over verstrekkers: tarief plus bijbehorende maandlast. */
export type SpreidingRij = {
  verstrekker: string;
  product: string;
  nhg: NhgStatus;
  /** De rentepagina van de bank zelf. */
  bronUrl: string;
  /** 10 jaar rentevast, procenten. */
  rentePct: number;
  /** Bruto maandlast over de koopsom, hele euro's (maandlastenOverzicht). */
  maandlast: number;
};

/**
 * Spreiding van de maandlast over de echte verstrekkerstarieven (10 jaar
 * rentevast, het rente-uitgangspunt van de tool). Groepering, alfabetische
 * volgorde en eerlijkheidsregels komen uit lib/bronnen/rentes-verstrekkers.ts;
 * de maandlast per tarief komt uit maandlastenOverzicht. Geen "beste", geen
 * volgorde op prijs. Onbeschikbare snapshot betekent een lege lijst.
 */
export function berekenSpreiding(koopsom: number, verstrekkers: VerstrekkersRentes): SpreidingRij[] {
  if (!verstrekkers.beschikbaar) return [];
  const met10Jaar = groepeerVoorTabel(verstrekkers.rijen).filter((g) => g.pct10 != null);
  const opties: RenteOptie[] = met10Jaar.map((g) => ({ label: `${g.verstrekker} ${g.product}`.trim(), pct: g.pct10 as number }));
  const maandlasten = maandlastenOverzicht(koopsom, opties);
  return met10Jaar.map((g, i) => ({
    verstrekker: g.verstrekker,
    product: g.product,
    nhg: g.nhg,
    bronUrl: g.bronUrl,
    rentePct: g.pct10 as number,
    maandlast: maandlasten[i]?.maandlast ?? 0,
  }));
}

/**
 * De NHG-vraag beantwoordt de tool zelf vanuit de koopsom: NHG toetst op de
 * kosten van de woning en de kostengrens 2026 komt letterlijk uit lib/normen.
 */
export function nhgBinnenGrens(koopsom: number): boolean {
  return koopsom <= NHG_GRENS_2026;
}

/**
 * Het deel van de koopsom boven de maximale hypotheek: dat kun je niet lenen
 * en komt boven op het benodigde eigen geld. Presentatie-arithmetiek, geen
 * norm; de UI benoemt het als indicatie.
 */
export function eigenInbrengBovenMax(koopsom: number, maximaal: number): number {
  return Math.max(0, koopsom - maximaal);
}
