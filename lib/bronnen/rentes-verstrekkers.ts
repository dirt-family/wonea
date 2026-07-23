/**
 * Actuele hypotheekrentes per geldverstrekker uit de in-repo snapshot.
 *
 * De snapshot (rentes-verstrekkers-snapshot.json) wordt geschreven door
 * scripts/ingest-open/rentes-verstrekkers.py: maandelijks gecrawld van
 * UITSLUITEND de eigen websites van de banken (nooit vergelijkers), met
 * respect voor robots.txt. Zie docs/RENTES-CRAWLER.md voor de juridische
 * lijn en het runbook.
 *
 * Eerlijkheidsregels in deze lezer:
 * - Snapshot ontbreekt, is leeg of ouder dan 45 dagen -> beschikbaar=false.
 *   Verouderde tarieven tonen is misleidend; dan liever niets.
 * - Rijen met een onwaarschijnlijk percentage (buiten 1-8%) worden genegeerd.
 * - UI-regel (CONTRACTS): toon bij elk rentecijfer ALTIJD peildatum en bron,
 *   plus de verwijzing naar de bank zelf voor de actuele tarieven.
 */

import snapshot from "./rentes-verstrekkers-snapshot.json";

/** Na zoveel dagen is de snapshot verouderd en tonen we niets meer. */
export const MAX_SNAPSHOT_LEEFTIJD_DAGEN = 45;

/** Plausibiliteitsband voor rentes; erbuiten wordt de rij genegeerd. */
export const MIN_RENTE_PCT = 1;
export const MAX_RENTE_PCT = 8;

export type NhgStatus = "ja" | "nee" | "onbekend";

export type VerstrekkerRenteRij = {
  /** Naam van de geldverstrekker, bv. "Rabobank". */
  verstrekker: string;
  /** Product zoals de bank het publiceert, bv. "Woon Hypotheek, annuitair". */
  product: string;
  /** Rentevaste periode in jaren (10 of 20 in deze snapshot). */
  rentevastJaren: number;
  /** Publiceert de bank dit tarief met of zonder NHG. */
  nhg: NhgStatus;
  /** Rente in procenten, bv. 4.11. */
  rentePct: number;
  /** De rentepagina van de bank zelf. */
  bronUrl: string;
  /** Datum waarop wij dit tarief van de bankwebsite haalden, "YYYY-MM-DD". */
  peildatum: string;
  /** Condities die bij dit tarief horen (tariefklasse, kortingen, productbeperkingen). */
  opmerking: string;
};

export type VerstrekkersRentes = {
  /** false = niet tonen (snapshot ontbreekt, is leeg of verouderd). */
  beschikbaar: boolean;
  /** Datum van de crawl, "YYYY-MM-DD" (lege string als onbeschikbaar). */
  peildatum: string;
  /** Bronvermelding voor de UI. */
  bron: string;
  /** Eerlijke duiding voor de methode-uitleg. */
  toelichting: string;
  /** Alle plausibele tariefrijen; leeg als onbeschikbaar. */
  rijen: VerstrekkerRenteRij[];
};

const NIET_BESCHIKBAAR: VerstrekkersRentes = {
  beschikbaar: false,
  peildatum: "",
  bron: "",
  toelichting: "",
  rijen: [],
};

function isRij(x: unknown): x is VerstrekkerRenteRij {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.verstrekker === "string" &&
    r.verstrekker.length > 0 &&
    typeof r.product === "string" &&
    typeof r.rentevastJaren === "number" &&
    (r.nhg === "ja" || r.nhg === "nee" || r.nhg === "onbekend") &&
    typeof r.rentePct === "number" &&
    typeof r.bronUrl === "string" &&
    typeof r.peildatum === "string" &&
    typeof r.opmerking === "string"
  );
}

/**
 * Pure lezer, los van de echte snapshot zodat het gedrag testbaar is.
 * Geeft beschikbaar=false bij een ontbrekende/kapotte/lege/verouderde snapshot
 * en filtert rijen met een onwaarschijnlijk percentage weg.
 */
export function leesVerstrekkersRentes(bron: unknown, vandaag: Date = new Date()): VerstrekkersRentes {
  if (typeof bron !== "object" || bron === null) return NIET_BESCHIKBAAR;
  const s = bron as Record<string, unknown>;
  if (typeof s.opgehaaldOp !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.opgehaaldOp)) return NIET_BESCHIKBAAR;

  const opgehaald = new Date(`${s.opgehaaldOp}T00:00:00Z`);
  const leeftijdDagen = (vandaag.getTime() - opgehaald.getTime()) / (24 * 60 * 60 * 1000);
  if (!Number.isFinite(leeftijdDagen) || leeftijdDagen > MAX_SNAPSHOT_LEEFTIJD_DAGEN) return NIET_BESCHIKBAAR;

  const rijen = (Array.isArray(s.rijen) ? s.rijen : [])
    .filter(isRij)
    .filter((r) => r.rentePct >= MIN_RENTE_PCT && r.rentePct <= MAX_RENTE_PCT);
  if (rijen.length === 0) return NIET_BESCHIKBAAR;

  return {
    beschikbaar: true,
    peildatum: s.opgehaaldOp,
    bron: typeof s.bron === "string" ? s.bron : "",
    toelichting: typeof s.toelichting === "string" ? s.toelichting : "",
    rijen,
  };
}

/** De actuele per-verstrekker-rentes uit de gecommitte snapshot. */
export function getVerstrekkersRentes(vandaag: Date = new Date()): VerstrekkersRentes {
  return leesVerstrekkersRentes(snapshot, vandaag);
}

/** Een regel in de vergelijkingstabel: 1 verstrekker+product+NHG-status, met de 10- en 20-jaarsrente naast elkaar. */
export type VerstrekkerTabelRij = {
  verstrekker: string;
  product: string;
  nhg: NhgStatus;
  bronUrl: string;
  /** null = de bank publiceert deze periode niet (toon een streepje, verzin niets). */
  pct10: number | null;
  pct20: number | null;
  /** Unieke condities uit de onderliggende rijen (tariefklasse, kortingen). */
  opmerkingen: string[];
};

const NHG_VOLGORDE: Record<NhgStatus, number> = { ja: 0, nee: 1, onbekend: 2 };

/**
 * Groepeert losse tariefrijen tot tabelregels (verstrekker+product+NHG) met
 * de 10- en 20-jaarsrente in kolommen. Gesorteerd op verstrekker (alfabetisch,
 * neutraal: geen "beste"-volgorde) en daarbinnen NHG voor niet-NHG.
 */
export function groepeerVoorTabel(rijen: VerstrekkerRenteRij[]): VerstrekkerTabelRij[] {
  const groepen = new Map<string, VerstrekkerTabelRij>();
  for (const rij of rijen) {
    const sleutel = `${rij.verstrekker}|${rij.product}|${rij.nhg}`;
    let groep = groepen.get(sleutel);
    if (!groep) {
      groep = {
        verstrekker: rij.verstrekker,
        product: rij.product,
        nhg: rij.nhg,
        bronUrl: rij.bronUrl,
        pct10: null,
        pct20: null,
        opmerkingen: [],
      };
      groepen.set(sleutel, groep);
    }
    if (rij.rentevastJaren === 10) groep.pct10 = rij.rentePct;
    if (rij.rentevastJaren === 20) groep.pct20 = rij.rentePct;
    if (rij.opmerking && !groep.opmerkingen.includes(rij.opmerking)) groep.opmerkingen.push(rij.opmerking);
  }
  return [...groepen.values()].sort(
    (a, b) => a.verstrekker.localeCompare(b.verstrekker, "nl") || NHG_VOLGORDE[a.nhg] - NHG_VOLGORDE[b.nhg],
  );
}
