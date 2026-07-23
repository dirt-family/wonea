/**
 * Makelaarskantoren per plaats via OpenStreetMap (Overpass API).
 *
 * Waarom OSM: er is geen open makelaarsregister (NVM/VBO-lijsten zijn niet
 * open, KvK en Google Places zijn betaald); OSM kent office=estate_agent-POI's
 * onder de ODbL-licentie (docs/DATABRONNEN.md punt 7). Dat betekent twee harde
 * verplichtingen voor elk gebruik van deze module:
 *
 * 1. ATTRIBUTIE IS VERPLICHT: toon OSM_ATTRIBUTIE met link naar
 *    OSM_COPYRIGHT_URL overal waar deze data zichtbaar is.
 * 2. EERLIJK OVER DEKKING: OSM wordt door vrijwilligers bijgehouden; de
 *    dekking is onvolledig en wisselt per plaats. Een lege lijst betekent
 *    "OSM kent hier geen makelaars", niet "hier zijn geen makelaars".
 *
 * Gedrag:
 * - zoekMakelaars(plaats) zoekt binnen de Nederlandse bestuurlijke grens
 *   (gemeente of stadsdeel/woonplaats met eigen grens) die zo heet.
 * - Server-side cache van 24 uur per plaats (in-memory Map, v1): de publieke
 *   Overpass-API is een gedeelde vrijwilligersvoorziening, die belasten we
 *   niet per paginaweergave. Fouten worden bewust NIET gecachet.
 * - Timeout van 10 seconden; elke fout geeft status "bron-fout" zodat de
 *   pagina eerlijk "bron onbereikbaar" kan tonen in plaats van een lege lijst.
 *
 * Deze module raakt geen database en geen adresdata van Wonea zelf: het zijn
 * bedrijfsvermeldingen uit een openbare kaartendatabase.
 */

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const OSM_ATTRIBUTIE = "Gegevens © OpenStreetMap-bijdragers, ODbL";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
export const ODBL_URL = "https://opendatacommons.org/licenses/odbl/";

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 uur
const TIMEOUT_MS = 10_000;
const MAX_RESULTATEN = 200;
const MAX_CACHE_ENTRIES = 200;
const USER_AGENT = "Wonea/1.0 (woningwaardeplatform; https://www.wonea.nl)";

export type Makelaar = {
  naam: string;
  /** "Straat 12, 5611 AB Eindhoven", of null als OSM geen adres kent. */
  adres: string | null;
  website: string | null;
  telefoon: string | null;
};

export type MakelaarsResultaat =
  | {
      status: "ok";
      /** De opgeschoonde plaatsnaam zoals gezocht, voor weergave. */
      plaats: string;
      /** Alfabetisch op naam; leeg = OSM kent hier geen makelaars. */
      makelaars: Makelaar[];
      /** ISO-datetime van het moment van ophalen: de peildatum voor de UI. */
      opgehaaldOp: string;
      uitCache: boolean;
    }
  | { status: "ongeldige-plaats" }
  | { status: "bron-fout" };

/* ------------------------------------------------------------------------- */
/* Invoer                                                                     */
/* ------------------------------------------------------------------------- */

// Nederlandse plaatsnamen: letters (ook 's-Hertogenbosch, Sint-Oedenrode,
// St. Anthonis), spaties, apostrof, punt, koppelteken. Bewust geen cijfers of
// regex-metatekens: dit is ook de eerste verdediging tegen query-injectie.
const PLAATS_REGEX = /^[a-zA-ZÀ-ɏ' .-]{2,60}$/;

/** Trimt en normaliseert spaties. Geeft null bij een onbruikbare plaatsnaam. */
export function normaliseerPlaats(input: string): string | null {
  const plaats = input.trim().replace(/\s+/g, " ");
  return PLAATS_REGEX.test(plaats) ? plaats : null;
}

/** Maakt een letterlijke waarde veilig voor gebruik in een Overpass-regex. */
function escapeOverpassRegex(s: string): string {
  // Eerst regex-metatekens escapen, daarna backslashes en aanhalingstekens
  // verdubbelen voor de Overpass-stringliteral zelf.
  return s.replace(/[\\^$.|?*+()[\]{}]/g, "\\$&").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Bouwt de Overpass-query: zoek de Nederlandse bestuurlijke grens met deze
 * naam (admin_level 8 = gemeente, 9/10 = stadsdeel/woonplaats met eigen
 * grens) en daarbinnen alle office=estate_agent-punten en -gebouwen.
 * Los exporteerbaar zodat tests de query kunnen controleren.
 */
export function bouwOverpassQuery(plaats: string): string {
  const naam = escapeOverpassRegex(plaats);
  return [
    `[out:json][timeout:${Math.floor(TIMEOUT_MS / 1000)}];`,
    `area["ISO3166-1"="NL"]["admin_level"="2"]->.nl;`,
    `rel["boundary"="administrative"]["admin_level"~"^(8|9|10)$"]["name"~"^${naam}$",i](area.nl);`,
    `map_to_area->.gebied;`,
    `nwr["office"="estate_agent"](area.gebied);`,
    `out center ${MAX_RESULTATEN};`,
  ].join("\n");
}

/* ------------------------------------------------------------------------- */
/* Respons parsen (puur, los testbaar)                                        */
/* ------------------------------------------------------------------------- */

type OverpassTags = Record<string, unknown>;

function tekst(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/** Alleen echte http(s)-links; kale domeinen krijgen https:// ervoor. */
function normaliseerWebsite(v: unknown): string | null {
  const s = tekst(v);
  if (!s || s.length > 300) return null;
  let kandidaat = s;
  if (!/^https?:\/\//i.test(kandidaat)) {
    // Kale domeinnaam ("wonea-makelaar.nl")? Anders geen link: liever geen
    // website dan een niet-klikbare of onveilige waarde (javascript: e.d.).
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(kandidaat)) return null;
    kandidaat = `https://${kandidaat}`;
  }
  try {
    const url = new URL(kandidaat);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normaliseerTelefoon(v: unknown): string | null {
  const s = tekst(v);
  if (!s) return null;
  // Eerste nummer bij meerdere ("06-1;040-2"), alleen plausibele tekens.
  const eerste = s.split(";")[0].trim();
  return /^[+0-9][0-9 ()./-]{5,24}$/.test(eerste) ? eerste : null;
}

function bouwAdres(tags: OverpassTags): string | null {
  const straat = tekst(tags["addr:street"]);
  const nummer = tekst(tags["addr:housenumber"]);
  const postcode = tekst(tags["addr:postcode"]);
  const plaats = tekst(tags["addr:city"]);
  const straatregel = straat ? (nummer ? `${straat} ${nummer}` : straat) : null;
  const plaatsregel = [postcode, plaats].filter(Boolean).join(" ") || null;
  const adres = [straatregel, plaatsregel].filter(Boolean).join(", ");
  return adres || null;
}

/**
 * Parseert de Overpass-respons naar een nette lijst: alleen elementen met een
 * naam (een naamloos punt is voor bezoekers onbruikbaar), ontdubbeld op
 * naam+adres (OSM heeft vaak een punt EN een gebouw voor hetzelfde kantoor),
 * alfabetisch gesorteerd. Geeft null als de respons niet het verwachte
 * Overpass-formaat heeft: dat is een bronfout, geen lege lijst.
 */
export function parseOverpassRespons(json: unknown): Makelaar[] | null {
  if (typeof json !== "object" || json === null) return null;
  const elements = (json as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return null;

  const perSleutel = new Map<string, Makelaar>();
  for (const element of elements) {
    if (typeof element !== "object" || element === null) continue;
    const tags = (element as { tags?: unknown }).tags;
    if (typeof tags !== "object" || tags === null) continue;
    const t = tags as OverpassTags;

    const naam = tekst(t.name);
    if (!naam || naam.length > 150) continue;

    const makelaar: Makelaar = {
      naam,
      adres: bouwAdres(t),
      website: normaliseerWebsite(t.website ?? t["contact:website"]),
      telefoon: normaliseerTelefoon(t.phone ?? t["contact:phone"]),
    };
    const sleutel = `${naam.toLowerCase()}|${(makelaar.adres ?? "").toLowerCase()}`;
    if (!perSleutel.has(sleutel)) perSleutel.set(sleutel, makelaar);
  }

  const collator = new Intl.Collator("nl");
  return [...perSleutel.values()].sort((a, b) => collator.compare(a.naam, b.naam));
}

/* ------------------------------------------------------------------------- */
/* Cache + ophalen                                                            */
/* ------------------------------------------------------------------------- */

type CacheEntry = { resultaat: Extract<MakelaarsResultaat, { status: "ok" }>; verlooptOp: number };

const cache = new Map<string, CacheEntry>();

/** Alleen voor tests: cache leegmaken tussen testgevallen. */
export function _wisMakelaarsCache(): void {
  cache.clear();
}

/**
 * Zoekt makelaarskantoren in een Nederlandse plaats via Overpass, met 24 uur
 * server-side cache per plaats. Zie het module-commentaar voor de
 * eerlijkheids- en attributieregels die bij het tonen horen.
 */
export async function zoekMakelaars(plaatsInput: string): Promise<MakelaarsResultaat> {
  const plaats = normaliseerPlaats(plaatsInput);
  if (!plaats) return { status: "ongeldige-plaats" };

  const sleutel = plaats.toLowerCase();
  const nu = Date.now();
  const bestaand = cache.get(sleutel);
  if (bestaand && bestaand.verlooptOp > nu) {
    return { ...bestaand.resultaat, uitCache: true };
  }
  cache.delete(sleutel); // verlopen entry opruimen

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(bouwOverpassQuery(plaats))}`,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { status: "bron-fout" };

    const makelaars = parseOverpassRespons(await res.json());
    if (makelaars === null) return { status: "bron-fout" };

    const resultaat: Extract<MakelaarsResultaat, { status: "ok" }> = {
      status: "ok",
      plaats,
      makelaars,
      opgehaaldOp: new Date().toISOString(),
      uitCache: false,
    };

    // Alleen successen cachen; bij een fout willen we het gewoon opnieuw
    // proberen. Cache begrensd houden (oudste eruit) tegen onbegrensde groei.
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oudste = cache.keys().next().value;
      if (oudste !== undefined) cache.delete(oudste);
    }
    cache.set(sleutel, { resultaat, verlooptOp: nu + CACHE_TTL_MS });

    return resultaat;
  } catch {
    // Timeout, netwerkfout, kapotte JSON: eerlijk melden dat de bron niet
    // bereikbaar was in plaats van een lege lijst te veinzen.
    return { status: "bron-fout" };
  }
}
