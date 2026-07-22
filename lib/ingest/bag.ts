import type { Woningtype } from "@/db/schema";
import { mulberry32 } from "@/db/seed/generator";
import { normalizePostcode, nummerslug } from "@/lib/format";
import { fetchJson, fetchText, slaap } from "@/lib/ingest/http";

/**
 * BAG-verblijfsobjecten via de keyless PDOK BAG WFS 2.0.
 *
 * Het plan noemt de "BAG OGC API Features" op api.pdok.nl/lv/bag/ogc/v1, maar
 * die API serveert (live geverifieerd 2026-07-22) alleen vector-TILES en
 * styles, geen /collections met features. De keyless WFS op
 * service.pdok.nl/lv/bag/wfs/v2_0 levert dezelfde BAG-data als GeoJSON,
 * inclusief een voorgebakken pand-join: het verblijfsobject draagt zelf al
 * bouwjaar + pandidentificatie + pandstatus, dus een aparte panden-fetch is
 * niet nodig. Paging via startIndex/count, uitvoer in WGS84 via srsName.
 */

export const BAG_WFS_DEFAULT = "https://service.pdok.nl/lv/bag/wfs/v2_0";

export type BagFeature = {
  geometry: { type: string; coordinates: [number, number] } | null;
  properties: {
    identificatie: string;
    oppervlakte: number | null;
    status: string;
    gebruiksdoel: string;
    openbare_ruimte: string;
    huisnummer: number;
    huisletter: string;
    toevoeging: string;
    postcode: string;
    woonplaats: string;
    bouwjaar: number | null;
    pandidentificatie: string;
    pandstatus: string;
  };
};

/** Gemapte adresrij, klaar voor upsert (bron/status zet de upsert-laag). */
export type BagAdresRij = {
  bagId: string;
  straat: string;
  huisnummer: number;
  toevoeging: string | null;
  nummerslug: string;
  postcode: string;
  plaats: string;
  lat: number | null;
  lon: number | null;
  bouwjaar: number;
  oppervlakteM2: number;
  woningtype: Woningtype;
  energielabel: string;
};

const STATUS_IN_GEBRUIK = new Set(["Verblijfsobject in gebruik", "Verblijfsobject in gebruik (niet ingemeten)"]);

// BAG kent placeholder-oppervlaktes (1, 999999); daarbuiten is het geen
// bruikbare woning-rij voor het AVM.
const OPPERVLAKTE_MIN = 10;
const OPPERVLAKTE_MAX = 1500;
const BOUWJAAR_MIN = 1500;
const BOUWJAAR_MAX = 2035;

/** BAG huisletter + toevoeging naar een enkele toevoeging ("A" + "2" = "A2"). */
export function combineerToevoeging(huisletter: string | null | undefined, toevoeging: string | null | undefined): string | null {
  const samen = `${(huisletter ?? "").trim()}${(toevoeging ?? "").trim()}`;
  return samen.length > 0 ? samen : null;
}

/**
 * Woningtype-heuristiek (BAG kent geen woningtype; gedocumenteerd in
 * docs/INGEST.md):
 * - meer dan 1 verblijfsobject in hetzelfde pand -> appartement;
 * - anders op oppervlakte: >= 160 m2 vrijstaand, 120-159 m2
 *   twee-onder-een-kap, daaronder tussenwoning.
 * Hoekwoning is uit BAG-attributen niet af te leiden en wordt dus nooit
 * toegekend. De pand-telling ziet alleen de opgehaalde features (bbox/max).
 */
export function woningtypeHeuristiek(oppervlakteM2: number, vbosInPand: number): Woningtype {
  if (vbosInPand > 1) return "appartement";
  if (oppervlakteM2 >= 160) return "vrijstaand";
  if (oppervlakteM2 >= 120) return "twee-onder-een-kap";
  return "tussenwoning";
}

/** FNV-1a 32-bit hash: deterministisch seed-getal uit een BAG-id. */
function hashNaarSeed(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Energielabel-INDICATIE op bouwjaar: zelfde bouwjaarklassen en verdeling als
 * labelVoorBouwjaar in db/seed/generator.ts, maar deterministisch per BAG-id
 * (zelfde adres krijgt bij elke run hetzelfde label; idempotentie-eis).
 * Echte labels (EP-Online) zijn een livegang-TODO; bron blijft "indicatie".
 */
export function energielabelIndicatie(bouwjaar: number, bagId: string): string {
  const rand = mulberry32(hashNaarSeed(bagId));
  if (bouwjaar >= 2015) return rand() < 0.8 ? "A" : "B";
  if (bouwjaar >= 2000) return rand() < 0.6 ? "B" : "C";
  if (bouwjaar >= 1980) return rand() < 0.5 ? "C" : "D";
  if (bouwjaar >= 1960) return rand() < 0.5 ? "D" : "E";
  if (bouwjaar >= 1930) return rand() < 0.5 ? "E" : "F";
  return rand() < 0.5 ? "F" : "G";
}

/** Telt verblijfsobjecten per pand binnen de opgehaalde set (voor de heuristiek). */
export function telVbosPerPand(features: BagFeature[]): Map<string, number> {
  const telling = new Map<string, number>();
  for (const f of features) {
    const pand = f.properties.pandidentificatie;
    if (!pand) continue;
    telling.set(pand, (telling.get(pand) ?? 0) + 1);
  }
  return telling;
}

/**
 * Pure mapper: BAG-feature naar adresrij. Geeft null terug voor rijen die we
 * bewust overslaan (geen woonfunctie, niet in gebruik, ongeldige postcode,
 * placeholder-oppervlakte of onbruikbaar bouwjaar).
 */
export function mapVerblijfsobject(f: BagFeature, vbosInPand: number): BagAdresRij | null {
  const p = f.properties;
  if (!p.gebruiksdoel || !p.gebruiksdoel.toLowerCase().includes("woonfunctie")) return null;
  if (!STATUS_IN_GEBRUIK.has(p.status)) return null;
  const postcode = normalizePostcode(p.postcode ?? "");
  if (!postcode) return null;
  const straat = (p.openbare_ruimte ?? "").trim();
  if (!straat || !Number.isInteger(p.huisnummer) || p.huisnummer < 1) return null;
  const oppervlakte = p.oppervlakte ?? 0;
  if (oppervlakte < OPPERVLAKTE_MIN || oppervlakte > OPPERVLAKTE_MAX) return null;
  const bouwjaar = p.bouwjaar ?? 0;
  if (bouwjaar < BOUWJAAR_MIN || bouwjaar > BOUWJAAR_MAX) return null;

  const toevoeging = combineerToevoeging(p.huisletter, p.toevoeging);
  // GeoJSON-coordinaten in EPSG:4326 zijn [lon, lat].
  const coords = f.geometry?.type === "Point" ? f.geometry.coordinates : null;
  return {
    bagId: p.identificatie,
    straat,
    huisnummer: p.huisnummer,
    toevoeging,
    nummerslug: nummerslug(p.huisnummer, toevoeging),
    postcode,
    plaats: (p.woonplaats ?? "").trim() || straat,
    lat: coords ? coords[1] : null,
    lon: coords ? coords[0] : null,
    bouwjaar,
    oppervlakteM2: Math.round(oppervlakte),
    woningtype: woningtypeHeuristiek(oppervlakte, vbosInPand),
    energielabel: energielabelIndicatie(bouwjaar, p.identificatie),
  };
}

type WfsAntwoord = { features: BagFeature[] };

function wfsUrl(basisUrl: string, bbox: string, extra: string): string {
  const vast = "service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject";
  const gebied = `bbox=${bbox},urn:ogc:def:crs:EPSG::28992`;
  return `${basisUrl}?${vast}&${gebied}&${extra}`;
}

/** Totaal beschikbare verblijfsobjecten in de bbox (resultType=hits). */
export async function telTotaalInBbox(basisUrl: string, bbox: string): Promise<number | null> {
  try {
    const xml = await fetchText(wfsUrl(basisUrl, bbox, "resultType=hits"));
    const match = xml.match(/numberMatched="(\d+)"/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

export type BagPagina = { features: BagFeature[]; startIndex: number };

/**
 * Gepagineerde fetch van verblijfsobjecten in een RD-bbox (EPSG:28992),
 * uitvoer in WGS84. Kleine delay per request (nette burger). De aanroeper
 * bepaalt via max hoeveel objecten er in totaal opgehaald worden.
 */
export async function* haalVerblijfsobjecten(opties: {
  basisUrl?: string;
  bbox: string;
  max: number;
  startIndex?: number;
  paginaGrootte?: number;
  delayMs?: number;
}): AsyncGenerator<BagPagina> {
  const basisUrl = opties.basisUrl ?? BAG_WFS_DEFAULT;
  const paginaGrootte = opties.paginaGrootte ?? 500;
  const delayMs = opties.delayMs ?? 300;
  let startIndex = opties.startIndex ?? 0;
  let opgehaald = startIndex;

  while (opgehaald < opties.max) {
    const count = Math.min(paginaGrootte, opties.max - opgehaald);
    const extra = `outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::4326&count=${count}&startIndex=${startIndex}`;
    const antwoord = await fetchJson<WfsAntwoord>(wfsUrl(basisUrl, opties.bbox, extra));
    const features = antwoord.features ?? [];
    if (features.length === 0) return;
    yield { features, startIndex };
    startIndex += features.length;
    opgehaald += features.length;
    if (features.length < count) return; // laatste pagina
    await slaap(delayMs);
  }
}
