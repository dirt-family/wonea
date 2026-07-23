/**
 * Rekenkern van de overbieden-rekenhulp: puur, geen UI, geen database.
 *
 * Bewuste keuze uit docs/PROTOTYPE-OOGST.md: de getaxeerde waarde is een
 * EIGEN invoerveld. We nemen GEEN aanname over hoe de taxatie zich tot de
 * vraagprijs verhoudt (het prototype rekende met een verzonnen +3,8% en dat
 * nemen we niet over). Zonder ingevulde taxatie zeggen we dus ook niets over
 * het deel uit eigen zak; dat is de eerlijke uitkomst.
 *
 * De kern die de tool uitlegt: banken financieren tot de getaxeerde
 * marktwaarde van de woning (maximaal 100%). Alles wat je daarboven biedt,
 * betaal je uit eigen geld.
 */

// ---------------------------------------------------------------------------
// Slider-grenzen
// ---------------------------------------------------------------------------

export const VRAAGPRIJS_MIN = 100_000;
export const VRAAGPRIJS_MAX = 1_500_000;
export const VRAAGPRIJS_STAP = 5_000;
export const VRAAGPRIJS_DEFAULT = 350_000;

export const OVERBOD_PCT_MIN = 0;
export const OVERBOD_PCT_MAX = 30;
export const OVERBOD_PCT_STAP = 1;
export const OVERBOD_PCT_DEFAULT = 5;

/** Klemt een getypte of geschoven vraagprijs binnen de grenzen van de tool. */
export function klemVraagprijs(n: number): number {
  if (!Number.isFinite(n)) return VRAAGPRIJS_DEFAULT;
  return Math.min(VRAAGPRIJS_MAX, Math.max(VRAAGPRIJS_MIN, Math.round(n)));
}

/** Klemt het overbod-percentage binnen de slider-grenzen. */
export function klemOverbodPct(n: number): number {
  if (!Number.isFinite(n)) return OVERBOD_PCT_DEFAULT;
  return Math.min(OVERBOD_PCT_MAX, Math.max(OVERBOD_PCT_MIN, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Uitkomst
// ---------------------------------------------------------------------------

export interface OverbodInvoer {
  /** Vraagprijs in hele euro's. */
  vraagprijs: number;
  /** Overbod in procenten van de vraagprijs (0 = precies de vraagprijs bieden). */
  overbodPct: number;
  /**
   * Getaxeerde marktwaarde in hele euro's, als de bezoeker die kent
   * (taxatierapport of gevalideerde waardebepaling). Null = onbekend; de
   * tool doet dan geen uitspraak over het deel uit eigen zak.
   */
  taxatiewaarde: number | null;
}

export interface OverbodUitkomst {
  /** Het bod: vraagprijs plus het overbod-percentage, hele euro's. */
  bod: number;
  /** Deel van het bod dat de bank kan financieren (tot de getaxeerde waarde); null zonder taxatie. */
  gefinancierdDeel: number | null;
  /** Deel van het bod boven de getaxeerde waarde, uit eigen geld; null zonder taxatie. */
  uitEigenZak: number | null;
}

/** Rekent het bod en, als de taxatiewaarde bekend is, de verdeling bank/eigen geld uit. */
export function berekenOverbod(invoer: OverbodInvoer): OverbodUitkomst {
  const bod = Math.round(invoer.vraagprijs * (1 + invoer.overbodPct / 100));
  if (invoer.taxatiewaarde == null) {
    return { bod, gefinancierdDeel: null, uitEigenZak: null };
  }
  const taxatie = Math.max(0, invoer.taxatiewaarde);
  return {
    bod,
    gefinancierdDeel: Math.min(bod, taxatie),
    uitEigenZak: Math.max(0, bod - taxatie),
  };
}
