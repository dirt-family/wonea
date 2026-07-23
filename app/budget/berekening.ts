/**
 * Invoer-naar-uitkomst-mapping van de budgetberekenaar: puur, geen UI, geen
 * database. De rekenkern is lib/hypotheek.ts (leennormen 2026, Staatscourant
 * 2025, 36471); dit bestand voegt alleen toe wat de tool zelf nodig heeft:
 * - de vier rentevast-keuzes met hun DNB-bucket voor de rente-voorinvulling;
 * - de energielabel-opties voor het formulier (bedragen komen letterlijk uit
 *   lib/normen/leennormen-2026.ts, dus geen dubbel onderhoud);
 * - de indicatiemarge van 5% rond de uitkomst (leesbaarheidsmarge van de
 *   tool, geen norm: de exacte ruimte rekent een adviseur door).
 *
 * tests/budget.test.ts bewaakt dat deze laag geen eigen rekenregels
 * introduceert: de zichtbare uitkomst is exact die van lib/hypotheek.
 */

import type { RenteBucketKey } from "@/lib/bronnen/rentes";
import {
  annuiteitMaandlast,
  maximaleHypotheek,
  TOETS_LOOPTIJD_MAANDEN,
  type EnergielabelKlasse,
  type MaximaleHypotheekUitkomst,
} from "@/lib/hypotheek";
import { ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING, NHG_GRENS_2026, NHG_PROVISIE_PCT } from "@/lib/normen/leennormen-2026";

/** De rentevast-keuzes die de tool aanbiedt, in jaren. */
export const RENTEVAST_KEUZES = [5, 10, 20, 30] as const;
export type RentevastKeuze = (typeof RENTEVAST_KEUZES)[number];

/**
 * Welke DNB-bucket de rente-voorinvulling per keuze levert. DNB publiceert
 * gemiddelden per rentevast-bucket (lib/bronnen/rentes.ts): 5 jaar valt in
 * "1 tot en met 5 jaar", 10 jaar in "5 tot en met 10 jaar" (de bucket dekt
 * langer dan 5 tot en met 10), en 20 en 30 jaar allebei in "langer dan
 * 10 jaar"; een fijnere splitsing bestaat niet in de open DNB-data.
 */
export const RENTEVAST_BUCKET: Record<RentevastKeuze, RenteBucketKey> = {
  5: "1_tot_5",
  10: "5_tot_10",
  20: "vanaf_10",
  30: "vanaf_10",
};

export type EnergielabelOptie = {
  klasse: EnergielabelKlasse;
  /** NL-label voor het formulier. */
  label: string;
  /** Bedrag dat de norm buiten beschouwing laat (art. 4 lid 3), hele euro's. */
  bedrag: number;
};

function optie(klasse: EnergielabelKlasse, label: string): EnergielabelOptie {
  return { klasse, label, bedrag: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING[klasse] };
}

/** Energielabel-opties voor stap 3, van beste naar slechtste label. */
export const ENERGIELABEL_OPTIES: EnergielabelOptie[] = [
  optie("A4PlusGarantie", "A++++ met energieprestatiegarantie van minimaal 10 jaar"),
  optie("A4Plus", "A++++"),
  optie("A3Plus", "A+++"),
  optie("APlus_APlusPlus", "A+ of A++"),
  optie("AB", "A of B"),
  optie("CD", "C of D"),
  optie("EFG", "E, F of G"),
];

/**
 * Indicatiemarge rond de maximale hypotheek, in procenten omlaag en omhoog.
 * Dit is een marge van de tool (geen norm-onzekerheid): de wettelijke tabellen
 * zijn exact, maar acceptatiebeleid en persoonlijke details maken de echte
 * ruimte anders. Toon dit in de UI altijd als indicatie met die uitleg.
 */
export const INDICATIE_MARGE_PCT = 5;

export interface BudgetInvoer {
  /** Bruto jaarinkomen aanvrager 1, hele euro's. */
  inkomen1: number;
  /** Bruto jaarinkomen aanvrager 2; telt in 2026 volledig mee (art. 3 lid 6). */
  inkomen2?: number;
  /** Gekozen rentevaste periode in jaren. */
  rentevastJaren: RentevastKeuze;
  /** Rente in procenten: de DNB-voorinvulling of de eigen (offerte)rente. */
  rentePct: number;
  /** Bestaande verplichtingen in euro per maand; weglaten betekent 0. */
  verplichtingenPerMaand?: number;
  /** True als (een van) de aanvrager(s) de AOW-leeftijd heeft bereikt. */
  aowLeeftijdBereikt: boolean;
  /** Energielabelklasse; weglaten betekent: geen labelbedrag meerekenen. */
  energielabelKlasse?: EnergielabelKlasse;
}

export interface BudgetUitkomst extends MaximaleHypotheekUitkomst {
  /** Toetsinkomen waarmee gerekend is: inkomen1 plus inkomen2 (art. 3 lid 6). */
  toetsinkomen: number;
  /** Onderkant van de indicatiemarge: maximaal minus INDICATIE_MARGE_PCT. */
  laag: number;
  /** Bovenkant van de indicatiemarge: maximaal plus INDICATIE_MARGE_PCT. */
  hoog: number;
  /**
   * Bruto maandlast bij de eigen ingevulde rente (hele euro's) wanneer de
   * AFM-toetsrente de toetsing overnam (rentevast korter dan 10 jaar met een
   * lagere eigen rente); null als de toetsrente gelijk is aan de eigen rente
   * of als er geen leenruimte is.
   */
  maandlastBijEigenRente: number | null;
  /** NHG-kostengrens 2026 (bron: nhg.nl), voor de weergave naast de indicatie. */
  nhgGrens: number;
  /** Eenmalige NHG-borgtochtprovisie in procenten (bron: nhg.nl). */
  nhgProvisiePct: number;
}

/**
 * De volledige zichtbare uitkomst van de tool. Alle normcijfers komen
 * ongewijzigd uit maximaleHypotheek (lib/hypotheek.ts); hier komen alleen de
 * afgeleiden bij die de UI toont (toetsinkomen, indicatiemarge, maandlast bij
 * de eigen rente, NHG-constanten voor de bronvermelding).
 */
export function berekenBudget(invoer: BudgetInvoer): BudgetUitkomst {
  const uitkomst = maximaleHypotheek({
    inkomen1: invoer.inkomen1,
    inkomen2: invoer.inkomen2,
    toetsrentePct: invoer.rentePct,
    rentevastJaren: invoer.rentevastJaren,
    energielabelKlasse: invoer.energielabelKlasse,
    aowLeeftijdBereikt: invoer.aowLeeftijdBereikt,
    verplichtingenPerMaand: invoer.verplichtingenPerMaand,
  });
  const marge = INDICATIE_MARGE_PCT / 100;
  const afmToegepast = uitkomst.maximaal > 0 && uitkomst.toetsrente !== invoer.rentePct;
  return {
    ...uitkomst,
    toetsinkomen: invoer.inkomen1 + (invoer.inkomen2 ?? 0),
    laag: Math.round(uitkomst.maximaal * (1 - marge)),
    hoog: Math.round(uitkomst.maximaal * (1 + marge)),
    maandlastBijEigenRente: afmToegepast
      ? Math.round(annuiteitMaandlast(uitkomst.maximaal, invoer.rentePct, TOETS_LOOPTIJD_MAANDEN))
      : null,
    nhgGrens: NHG_GRENS_2026,
    nhgProvisiePct: NHG_PROVISIE_PCT,
  };
}
