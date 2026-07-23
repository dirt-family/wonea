/**
 * Invoer-naar-uitkomst-mapping van de kosten-koper-rekenhulp: puur, geen UI,
 * geen database. De belastingregels komen ongewijzigd uit
 * lib/normen/overdrachtsbelasting-2026.ts (geverifieerd op wetten.overheid.nl
 * en belastingdienst.nl); dit bestand voegt alleen toe wat de tool zelf nodig
 * heeft: de slider-grenzen en de RUWE indicatie van de bijkomende kosten.
 *
 * De indicatiebedragen hieronder zijn nadrukkelijk GEEN norm en geen offerte:
 * het zijn afgeronde middenbedragen van wat notarissen, hypotheekadviseurs en
 * taxateurs in de praktijk rekenen. De UI labelt ze overal als indicatie.
 * tests/kosten-koper.test.ts bewaakt dat deze laag geen eigen belastingregels
 * introduceert: de belasting-uitkomst is exact die van de normlaag.
 */

import { berekenOverdrachtsbelasting, type OverdrachtsbelastingUitkomst } from "@/lib/normen/overdrachtsbelasting-2026";

// ---------------------------------------------------------------------------
// Slider-grenzen voor de koopsom
// ---------------------------------------------------------------------------

export const KOOPSOM_MIN = 100_000;
export const KOOPSOM_MAX = 1_500_000;
export const KOOPSOM_STAP = 5_000;
export const KOOPSOM_DEFAULT = 350_000;

/** Klemt een getypt of geschoven bedrag binnen de grenzen van de tool. */
export function klemKoopsom(n: number): number {
  if (!Number.isFinite(n)) return KOOPSOM_DEFAULT;
  return Math.min(KOOPSOM_MAX, Math.max(KOOPSOM_MIN, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Bijkomende kosten: ruwe indicatie, geen norm
// ---------------------------------------------------------------------------

export type IndicatieKost = {
  key: "notaris" | "advies" | "taxatie";
  label: string;
  /** Afgerond middenbedrag in hele euro's; de UI toont het als indicatie. */
  bedrag: number;
  /** Korte toelichting voor de uitleg, in gewone taal. */
  toelichting: string;
};

/**
 * Ruwe indicatie van de kosten die vrijwel elke koper met hypotheek maakt.
 * Bewust drie herkenbare posten, geen schijnprecisie: de echte bedragen
 * hangen af van wie je kiest en verschillen honderden euro's.
 *
 * HERKOMST (zelfde stramien als lib/normen): dit zijn geen wettelijke normen
 * maar redactionele middenwaarden, gekozen binnen de bandbreedtes die
 * (hypotheek)partijen in 2026 publiek publiceren: notaris ~1.200-2.500,
 * advies/bemiddeling ~1.500-3.500, gevalideerde taxatie ~400-900 euro.
 * Peildatum en bandbreedte staan hieronder per post, zodat de UI ze kan tonen
 * en veroudering opvalt.
 */
export const INDICATIE_KOSTEN_PEILDATUM = "2026-07-23";

export const INDICATIE_KOSTEN: readonly IndicatieKost[] = [
  {
    key: "notaris",
    label: "Notaris",
    bedrag: 1_500,
    toelichting:
      "Leveringsakte en hypotheekakte, inclusief inschrijving bij het Kadaster. Gangbare bandbreedte 1.200 tot 2.500 euro.",
  },
  {
    key: "advies",
    label: "Hypotheekadvies en bemiddeling",
    bedrag: 2_500,
    toelichting:
      "Advies- en afsluitkosten van een hypotheekadviseur of geldverstrekker. Gangbare bandbreedte 1.500 tot 3.500 euro.",
  },
  {
    key: "taxatie",
    label: "Taxatierapport",
    bedrag: 600,
    toelichting:
      "Gevalideerd taxatierapport, vrijwel altijd verplicht voor de hypotheek. Gangbare bandbreedte 400 tot 900 euro.",
  },
] as const;

/** Som van de indicatiebedragen, hele euro's. */
export const INDICATIE_KOSTEN_TOTAAL = INDICATIE_KOSTEN.reduce((som, k) => som + k.bedrag, 0);

// ---------------------------------------------------------------------------
// Uitkomst
// ---------------------------------------------------------------------------

export interface KostenKoperInvoer {
  /** Koopsom in hele euro's; de tool gebruikt die als benadering van de woningwaarde. */
  koopsom: number;
  /** True als het starters-vinkje aanstaat (voorwaarden staan in de UI ernaast). */
  starter: boolean;
  /**
   * False als de koper de woning NIET zelf als hoofdverblijf gaat gebruiken
   * (bijvoorbeeld verhuur of een tweede woning): dan geldt het 8%-tarief uit
   * de normlaag en kent die laag nooit een startersvrijstelling toe.
   * Weglaten = true (kopen om er zelf te wonen, de hoofdroute van de tool).
   */
  hoofdverblijf?: boolean;
}

export interface KostenKoperUitkomst {
  /** Belasting-uitkomst, ongewijzigd uit de normlaag. */
  ovb: OverdrachtsbelastingUitkomst;
  /** Som van de indicatie-kostenposten (notaris, advies, taxatie). */
  bijkomendTotaal: number;
  /** Minimaal eigen geld: overdrachtsbelasting plus de bijkomende kosten. */
  eigenGeldMinimaal: number;
}

/**
 * De volledige zichtbare uitkomst van de tool. De hoofdroute is kopen om er
 * zelf te wonen (hoofdverblijf); met hoofdverblijf: false rekent de normlaag
 * met het 8%-tarief voor woningen die geen hoofdverblijf worden. Dit bestand
 * kiest alleen de situatie, alle belastingregels blijven in de normlaag.
 * Minimaal eigen geld = belasting + bijkomende kosten, omdat je maximaal
 * 100% van de woningwaarde kunt lenen en deze kosten dus niet in de
 * hypotheek passen.
 */
export function berekenKostenKoper(invoer: KostenKoperInvoer): KostenKoperUitkomst {
  const ovb = berekenOverdrachtsbelasting({
    woningwaarde: invoer.koopsom,
    situatie: invoer.hoofdverblijf === false ? "woning_overig" : "hoofdverblijf",
    startersvrijstelling: invoer.starter,
  });
  return {
    ovb,
    bijkomendTotaal: INDICATIE_KOSTEN_TOTAAL,
    eigenGeldMinimaal: ovb.belasting + INDICATIE_KOSTEN_TOTAAL,
  };
}
