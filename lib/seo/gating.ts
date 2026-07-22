import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { indexGating, wozValues, type addresses } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";

/**
 * Indexatie-gating op twee niveaus (docs/PLAN.md, Fase 5).
 *
 * Niveau 1: gebiedswhitelist. Een adres- of buurtpagina mag alleen de index in
 * als het gebied (buurt of postcode4) expliciet is vrijgegeven in index_gating.
 * DEFAULT IS ALLES NOINDEX: na de seed is de whitelist leeg, dus geen enkele
 * pagina is indexeerbaar tot iemand bewust gebieden vrijgeeft (scripts/gating.ts).
 * Dat is een bewuste keuze tegen scaled-content-abuse: honderdduizenden dunne,
 * bijna identieke adrespagina's tegelijk laten indexeren is precies het patroon
 * waar zoekmachines sites voor afstraffen. We geven alleen gebieden vrij waar
 * echte zoekvraag voor bestaat (handmatig of via een zoekvraag-import).
 *
 * Niveau 2: datadiepte per pagina. Ook binnen een vrijgegeven gebied is een
 * adrespagina alleen indexeerbaar als er genoeg echte inhoud is:
 * minstens MIN_COMPARABLES_VOOR_INDEX comparables, OF een WOZ-waarde die de
 * eigenaar zelf invulde, OF een echt (niet-indicatief) energielabel.
 * Een lege pagina de index in duwen is slecht voor bezoeker en site.
 *
 * Suppressie wint ALTIJD: een gesupprimeerd of opted-out adres is nooit
 * indexeerbaar, wat de whitelist of datadiepte ook zegt.
 */

/** Datadiepte-drempel: minimaal dit aantal comparables maakt de pagina indexeerbaar. */
export const MIN_COMPARABLES_VOOR_INDEX = 3;

export type AdresVoorGating = Pick<
  typeof addresses.$inferSelect,
  "id" | "postcode" | "nummerslug" | "buurtCode" | "status" | "energielabel" | "energielabelBron"
>;

/** Eerste vier cijfers van een postcode ("5611AB" -> "5611"). */
export function postcode4(postcode: string): string {
  return postcode.slice(0, 4);
}

/** Niveau 1: staat het gebied (buurt of postcode4) op de whitelist? */
export function heeftGebiedsWhitelist(buurtCode: string, postcode: string): boolean {
  const buurtRij = db
    .select({ id: indexGating.id })
    .from(indexGating)
    .where(and(eq(indexGating.scope, "buurt"), eq(indexGating.code, buurtCode), eq(indexGating.indexeerbaar, true)))
    .get();
  if (buurtRij) return true;
  const pc4Rij = db
    .select({ id: indexGating.id })
    .from(indexGating)
    .where(and(eq(indexGating.scope, "postcode4"), eq(indexGating.code, postcode4(postcode)), eq(indexGating.indexeerbaar, true)))
    .get();
  return !!pc4Rij;
}

function heeftEigenaarWoz(adresId: number): boolean {
  const rij = db
    .select({ id: wozValues.id })
    .from(wozValues)
    .where(and(eq(wozValues.adresId, adresId), eq(wozValues.bron, "eigenaar")))
    .get();
  return !!rij;
}

/**
 * Mag deze adrespagina de index in? Het comparables-aantal komt binnen via
 * opties (de aanroeper heeft het al berekend via lib/comparables), zodat deze
 * functie geen eigen comparables-query nodig heeft en per drempel puur
 * testbaar blijft.
 */
export function isAdresIndexeerbaar(adres: AdresVoorGating, opties: { nComparables: number }): boolean {
  // Suppressie wint altijd, ook van de whitelist.
  if (adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) return false;

  // Niveau 1: gebiedswhitelist (default leeg = alles noindex).
  if (!heeftGebiedsWhitelist(adres.buurtCode, adres.postcode)) return false;

  // Niveau 2: datadiepte.
  if (opties.nComparables >= MIN_COMPARABLES_VOOR_INDEX) return true;
  if (adres.energielabel && adres.energielabelBron === "echt") return true;
  return heeftEigenaarWoz(adres.id);
}

/**
 * Mag de buurtpagina de index in? Buurtpagina's gaten alleen op de
 * buurt-whitelist (een buurt heeft geen eenduidige postcode4 in het schema).
 */
export function isBuurtIndexeerbaar(buurtCode: string): boolean {
  const rij = db
    .select({ id: indexGating.id })
    .from(indexGating)
    .where(and(eq(indexGating.scope, "buurt"), eq(indexGating.code, buurtCode), eq(indexGating.indexeerbaar, true)))
    .get();
  return !!rij;
}

// ---------------------------------------------------------------------------
// Whitelist-beheer (gebruikt door scripts/gating.ts en de tests)
// ---------------------------------------------------------------------------

export type GatingScope = "buurt" | "postcode4";

export function isGatingScope(s: string): s is GatingScope {
  return s === "buurt" || s === "postcode4";
}

/** Upsert van een whitelist-rij (allow = indexeerbaar true, disallow = false). */
export function setGating(scope: GatingScope, code: string, indexeerbaar: boolean, reden?: string | null): void {
  db.insert(indexGating)
    .values({ scope, code, indexeerbaar, reden: reden ?? null })
    .onConflictDoUpdate({
      target: [indexGating.scope, indexGating.code],
      set: { indexeerbaar, reden: reden ?? null },
    })
    .run();
}

export function listGating() {
  return db.select().from(indexGating).orderBy(indexGating.scope, indexGating.code).all();
}

// ---------------------------------------------------------------------------
// Zoekvraag-CSV (import-optie van scripts/gating.ts)
// ---------------------------------------------------------------------------

export type ZoekvraagRij = { scope: GatingScope; code: string; zoekvolume: number; indexeerbaar: boolean };
export type ZoekvraagParseResultaat = { rijen: ZoekvraagRij[]; overgeslagen: string[] };

/**
 * Parset een zoekvraag-CSV met kolommen: scope,code,zoekvolume.
 * Een rij wordt indexeerbaar bij zoekvolume >= drempel (drempel is inclusief).
 * Rijen die niet kloppen (onbekende scope, geen getal) worden overgeslagen en
 * teruggegeven zodat de CLI ze kan melden; we raden nooit.
 */
export function parseZoekvraagCsv(inhoud: string, drempel: number): ZoekvraagParseResultaat {
  const rijen: ZoekvraagRij[] = [];
  const overgeslagen: string[] = [];
  const regels = inhoud.split(/\r?\n/);
  for (const regel of regels) {
    const kaal = regel.trim();
    if (!kaal) continue;
    const delen = kaal.split(",").map((d) => d.trim());
    if (delen[0]?.toLowerCase() === "scope") continue; // kopregel
    if (delen.length < 3) {
      overgeslagen.push(kaal);
      continue;
    }
    const [scope, code, volumeTekst] = delen;
    const zoekvolume = Number(volumeTekst);
    if (!isGatingScope(scope) || !code || !Number.isFinite(zoekvolume) || zoekvolume < 0) {
      overgeslagen.push(kaal);
      continue;
    }
    rijen.push({ scope, code, zoekvolume, indexeerbaar: zoekvolume >= drempel });
  }
  return { rijen, overgeslagen };
}
