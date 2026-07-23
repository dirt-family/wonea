import { z } from "zod";
import { maandlastenOverzicht, TOETS_LOOPTIJD_MAANDEN } from "@/lib/hypotheek";
import snapshot from "@/lib/bronnen/rentes-snapshot.json";
import type { RenteBucket, RenteBucketKey } from "@/lib/bronnen/rentes";

/**
 * Pure rekenlogica voor de rentestanden-tool (app/hypotheek-rentes), los van
 * React zodat het testbaar is (patroon: app/verduurzamen/logic.ts). Geen
 * database en geen Node-API's: alles hier is ook client-veilig, want de
 * maandlastentabel rekent client-side mee met het ingestelde leenbedrag.
 */

/* ---------------------------------------------------------------------- */
/* Leenbedrag                                                             */
/* ---------------------------------------------------------------------- */

/** Grenzen van de leenbedrag-invoer. Onder de 50.000 euro is een hypotheek-
 * maandlast zelden de vraag; boven de 1 miljoen wordt het gemiddelde van DNB
 * steeds minder zeggend. De grenzen begrenzen alleen de invoer, geen advies. */
export const LEEN_MIN = 50_000;
export const LEEN_MAX = 1_000_000;
export const LEEN_STAP = 5_000;
export const LEEN_DEFAULT = 300_000;

/**
 * Maakt van willekeurige invoer een bruikbaar leenbedrag: niet-getallen
 * worden het standaardbedrag, de rest wordt binnen [LEEN_MIN, LEEN_MAX]
 * geklemd. De tabel rekent ALTIJD met de uitkomst hiervan, zodat er nooit
 * een maandlast bij een onzinnig bedrag op het scherm staat.
 */
export function klemLeenbedrag(invoer: number): number {
  if (!Number.isFinite(invoer)) return LEEN_DEFAULT;
  return Math.min(LEEN_MAX, Math.max(LEEN_MIN, Math.round(invoer)));
}

/* ---------------------------------------------------------------------- */
/* Maandlasten per rentevast-bucket                                       */
/* ---------------------------------------------------------------------- */

export interface MaandlastRij {
  bucket: RenteBucketKey;
  /** NL-label van de rentevaste periode, uit de DNB-snapshot. */
  label: string;
  /** Gemiddelde rente in procenten (DNB-maandgemiddelde over banken). */
  rentePct: number;
  /** Bruto maandlast in hele euro's, 30 jaar annuitair (lib/hypotheek). */
  maandlast: number;
}

/**
 * Bruto maandlast per rentevast-bucket voor het gegeven leenbedrag.
 * Rekent via maandlastenOverzicht (lib/hypotheek): 30 jaar annuitair,
 * hetzelfde uitgangspunt als de wettelijke toets. De volgorde van de
 * buckets blijft behouden (oplopende rentevaste periode).
 */
export function maandlastRijen(leenbedrag: number, buckets: RenteBucket[]): MaandlastRij[] {
  const bedrag = klemLeenbedrag(leenbedrag);
  const regels = maandlastenOverzicht(
    bedrag,
    buckets.map((b) => ({ label: b.label, pct: b.rentePct })),
    TOETS_LOOPTIJD_MAANDEN,
  );
  return buckets.map((b, i) => ({
    bucket: b.bucket,
    label: b.label,
    rentePct: b.rentePct,
    maandlast: regels[i].maandlast,
  }));
}

/** Rente als NL-tekst: 4.1 wordt "4,1%", 3.79 wordt "3,79%". */
export function formatPct(pct: number): string {
  return `${pct.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

/* ---------------------------------------------------------------------- */
/* Historie (optioneel in de snapshot)                                    */
/* ---------------------------------------------------------------------- */

/**
 * De ingest (scripts/ingest-open/dnb-rentes.py) schrijft vandaag alleen de
 * laatste maand; een toekomstige versie kan een veld "historie" toevoegen
 * met per maand de bucket-rentes. Deze parser accepteert precies die vorm
 * en NIETS anders: is de historie afwezig of ook maar deels ongeldig, dan
 * is de uitkomst een lege lijst en toont de pagina geen grafiek. Liever
 * geen lijntje dan een lijntje op kapotte data.
 */
const historiePuntSchema = z.object({
  /** Maand "YYYY-MM", zelfde formaat als peildatum. */
  maand: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  /** Rente per bucket in procenten; zelfde gezonde bandbreedte als de ingest-sanity (0,5 tot 10). */
  rentes: z.object({
    variabel_tot_1: z.number().min(0.5).max(10).optional(),
    "1_tot_5": z.number().min(0.5).max(10).optional(),
    "5_tot_10": z.number().min(0.5).max(10).optional(),
    vanaf_10: z.number().min(0.5).max(10).optional(),
  }),
});

export type RenteHistoriePunt = z.infer<typeof historiePuntSchema>;

/** Parset een onbekende waarde naar historiepunten, oplopend op maand. Ongeldig of afwezig: lege lijst. */
export function parseRenteHistorie(data: unknown): RenteHistoriePunt[] {
  const uitkomst = z.array(historiePuntSchema).safeParse(data);
  if (!uitkomst.success) return [];
  // "YYYY-MM" sorteert correct als tekst.
  return [...uitkomst.data].sort((a, b) => a.maand.localeCompare(b.maand));
}

/** Historie uit de echte snapshot; vandaag leeg (de ingest schrijft alleen de laatste maand). */
export function renteHistorie(): RenteHistoriePunt[] {
  return parseRenteHistorie((snapshot as Record<string, unknown>).historie);
}

/** Reeks voor een Sparkline: de rente van 1 bucket door de maanden heen (alleen aanwezige waarden). */
export function sparklineReeks(historie: RenteHistoriePunt[], bucket: RenteBucketKey): number[] {
  return historie.map((p) => p.rentes[bucket]).filter((pct): pct is number => pct !== undefined);
}
