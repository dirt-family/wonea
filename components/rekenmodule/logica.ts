/**
 * Pure logica van het rekenmodule-framework: stap-parameter in de URL,
 * klemmen van een gewenste stap op de validatiestand, en sessie-opslag.
 * Geen React en geen DOM-aannames, zodat tests/rekenmodule.test.ts dit
 * in een node-omgeving kan bewijzen. De UI-schil staat in rekenmodule.tsx.
 */

/** Naam van de query-parameter die de actieve stap draagt (?stap=2). */
export const STAP_PARAM = "stap";

/**
 * Leest de stap uit de URL-parameter (1-gebaseerd voor mensen) en geeft de
 * 0-gebaseerde stapindex terug. Alles wat geen hele stap binnen bereik is
 * (leeg, tekst, 0, negatief, decimaal, te groot) valt stil terug op stap 1.
 */
export function parseStapParam(raw: string | null, aantalStappen: number): number {
  if (raw == null || !/^\d+$/.test(raw)) return 0;
  const n = Number(raw);
  if (n < 1 || n > aantalStappen) return 0;
  return n - 1;
}

/**
 * Klemt een gewenste stapindex op wat de invoer toestaat: je kunt nooit
 * verder staan dan de eerste stap waarvan de validatie nog een melding geeft.
 * `meldingen` bevat per invoerstap het resultaat van diens validatie (null =
 * in orde); de uitkomststap heeft index meldingen.length en is alleen
 * bereikbaar als alle invoerstappen in orde zijn.
 */
export function klemStap(gewenst: number, meldingen: (string | null)[]): number {
  const eersteOnaf = meldingen.findIndex((m) => m !== null);
  const maximaal = eersteOnaf === -1 ? meldingen.length : eersteOnaf;
  return Math.max(0, Math.min(gewenst, maximaal));
}

/**
 * Bouwt het zoekdeel van de URL voor een stapindex, met behoud van andere
 * parameters. Stap 1 krijgt geen parameter (schone deelbare URL); latere
 * stappen krijgen ?stap=2, ?stap=3, enzovoort. Geeft "" of "?..." terug.
 */
export function stapZoekdeel(huidigeSearch: string, stapIndex: number): string {
  const params = new URLSearchParams(huidigeSearch);
  if (stapIndex <= 0) params.delete(STAP_PARAM);
  else params.set(STAP_PARAM, String(stapIndex + 1));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/* -------------------------------------------------------------------------
 * Sessie-opslag: invoer overleeft een refresh binnen de browsersessie.
 * Expliciet sessionStorage (geen localStorage, niets naar de server) en
 * stil falend: privemodus of volle opslag mag een rekenhulp nooit breken.
 * ---------------------------------------------------------------------- */

export type SessieOpslag = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function sessieSleutel(moduleId: string): string {
  return `wonea:rekenmodule:${moduleId}`;
}

function standaardOpslag(): SessieOpslag | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Toegang tot sessionStorage kan zelf al gooien (privacy-instellingen).
    return null;
  }
}

/**
 * Laadt de bewaarde invoer voor een module. Geeft alleen een plat object
 * terug; corrupte JSON, arrays of andere typen leveren null op (dan begint
 * de module gewoon leeg).
 */
export function laadSessie(moduleId: string, opslag?: SessieOpslag | null): Record<string, unknown> | null {
  const bron = opslag ?? standaardOpslag();
  if (!bron) return null;
  try {
    const tekst = bron.getItem(sessieSleutel(moduleId));
    if (tekst == null) return null;
    const data: unknown = JSON.parse(tekst);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Bewaart de invoer (als JSON-tekst) voor een module; faalt stil. */
export function bewaarSessie(moduleId: string, jsonTekst: string, opslag?: SessieOpslag | null): void {
  const bron = opslag ?? standaardOpslag();
  if (!bron) return;
  try {
    bron.setItem(sessieSleutel(moduleId), jsonTekst);
  } catch {
    // Vol of geblokkeerd: de rekenhulp werkt gewoon door zonder persistentie.
  }
}
