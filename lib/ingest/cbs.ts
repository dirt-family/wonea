import { fetchJson, slaap } from "@/lib/ingest/http";

/**
 * CBS StatLine (OData v3, keyless): Kerncijfers wijken en buurten (KWB).
 *
 * Dataset-id opgezocht via de StatLine OData-catalogus
 * (https://opendata.cbs.nl/ODataCatalog/Tables, titel "Kerncijfers wijken en
 * buurten"): 86165NED = KWB 2025, meest recent (geverifieerd 2026-07-22).
 * Een nieuw jaar krijgt een nieuw id; overschrijfbaar via env
 * WONEA_KWB_DATASET, zie docs/INGEST.md.
 *
 * Live geverifieerde StatLine-eigenaardigheden waar deze module op leunt:
 * - De TypedDataSet ondersteunt alleen eq-filters (met and/or). Functies als
 *   substringof/startswith worden er STIL genegeerd (je krijgt gewoon alle
 *   rijen terug). Daarom batchen we eq-or-filters per buurtcode.
 * - De dimensie-tabel WijkenEnBuurten ondersteunt wel startswith/eq en bevat
 *   per code de naam (Title) en de gemeente (Municipality).
 * - Codes en namen zijn met spaties gepad ("GM0772    "): altijd trimmen.
 * - GemiddeldeWOZWaardeVanWoningen_39 staat in DUIZENDEN euro's.
 */

export const KWB_DATASET_DEFAULT = "86165NED";
const CBS_BASE = "https://opendata.cbs.nl/ODataApi/odata";
const BATCH_GROOTTE = 20;
const DELAY_MS = 200;

export type KwbDimensieRij = {
  Key: string;
  Title: string;
  Municipality?: string | null;
};

export type KwbDataRij = {
  WijkenEnBuurten: string;
  AantalInwoners_5: number | null;
  GemiddeldeWOZWaardeVanWoningen_39: number | null;
};

export type CbsBuurt = {
  buurtCode: string; // "BU07721110"
  naam: string;
  gemWoz: number | null; // hele euro's
  inwoners: number | null;
};

export type CbsSnapshot = {
  datasetId: string;
  opgehaaldAt: string;
  gemeente: { code: string; naam: string };
  buurten: CbsBuurt[];
};

type ODataAntwoord<T> = { value: T[] };

/** KWB-WOZ staat in duizenden euro's; naar hele euro's. Null blijft null. */
export function wozNaarEuro(woz: number | null | undefined): number | null {
  return woz == null ? null : Math.round(woz * 1000);
}

/** Pure mapper: dimensierij (code + naam) + datarij (cijfers) naar buurt. */
export function mapKwbBuurt(dim: KwbDimensieRij, data: KwbDataRij | undefined): CbsBuurt {
  return {
    buurtCode: dim.Key.trim(),
    naam: dim.Title.trim(),
    gemWoz: wozNaarEuro(data?.GemiddeldeWOZWaardeVanWoningen_39),
    inwoners: data?.AantalInwoners_5 ?? null,
  };
}

/** Zoekt de CBS-gemeentecode (GM....) bij een gemeentenaam (case-insensitief). */
export async function zoekGemeente(datasetId: string, naam: string): Promise<{ code: string; naam: string } | null> {
  const filter = encodeURIComponent("startswith(Key,'GM')");
  const url = `${CBS_BASE}/${datasetId}/WijkenEnBuurten?$format=json&$filter=${filter}&$top=1000`;
  const antwoord = await fetchJson<ODataAntwoord<KwbDimensieRij>>(url);
  const doel = naam.trim().toLowerCase();
  const rij = antwoord.value.find((r) => r.Title.trim().toLowerCase() === doel);
  return rij ? { code: rij.Key.trim(), naam: rij.Title.trim() } : null;
}

/** Haalt alle buurt-dimensierijen (code + naam) van een gemeente op. */
export async function haalBuurtDimensies(datasetId: string, gemeenteCode: string): Promise<KwbDimensieRij[]> {
  const filter = encodeURIComponent(`Municipality eq '${gemeenteCode}'`);
  const url = `${CBS_BASE}/${datasetId}/WijkenEnBuurten?$format=json&$filter=${filter}&$top=5000`;
  const antwoord = await fetchJson<ODataAntwoord<KwbDimensieRij>>(url);
  return antwoord.value.filter((r) => r.Key.trim().startsWith("BU"));
}

/**
 * Haalt de KWB-cijfers voor een lijst buurtcodes op, gebatcht met
 * eq-or-filters (het enige filtertype dat de TypedDataSet accepteert).
 */
export async function haalBuurtData(datasetId: string, buurtCodes: string[]): Promise<Map<string, KwbDataRij>> {
  const velden = "WijkenEnBuurten,AantalInwoners_5,GemiddeldeWOZWaardeVanWoningen_39";
  const resultaat = new Map<string, KwbDataRij>();
  for (let i = 0; i < buurtCodes.length; i += BATCH_GROOTTE) {
    const batch = buurtCodes.slice(i, i + BATCH_GROOTTE);
    const filter = encodeURIComponent(batch.map((code) => `WijkenEnBuurten eq '${code}'`).join(" or "));
    const url = `${CBS_BASE}/${datasetId}/TypedDataSet?$format=json&$filter=${filter}&$select=${velden}`;
    const antwoord = await fetchJson<ODataAntwoord<KwbDataRij>>(url);
    for (const rij of antwoord.value) resultaat.set(rij.WijkenEnBuurten.trim(), rij);
    if (i + BATCH_GROOTTE < buurtCodes.length) await slaap(DELAY_MS);
  }
  return resultaat;
}

/** Complete online flow: gemeente zoeken, buurten + cijfers ophalen. */
export async function haalKwbVoorGemeente(datasetId: string, gemeenteNaam: string): Promise<CbsSnapshot | "niet-gevonden"> {
  const gemeente = await zoekGemeente(datasetId, gemeenteNaam);
  if (!gemeente) return "niet-gevonden";
  const dimensies = await haalBuurtDimensies(datasetId, gemeente.code);
  const data = await haalBuurtData(datasetId, dimensies.map((d) => d.Key.trim()));
  return {
    datasetId,
    opgehaaldAt: new Date().toISOString(),
    gemeente,
    buurten: dimensies.map((dim) => mapKwbBuurt(dim, data.get(dim.Key.trim()))),
  };
}
