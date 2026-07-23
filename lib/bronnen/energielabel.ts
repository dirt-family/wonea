import { and, eq } from "drizzle-orm";
import { addresses } from "@/db/schema";
import { db } from "@/lib/db";
import { normalizePostcode, nummerslug } from "@/lib/format";
import { isSuppressed } from "@/lib/suppression";

/**
 * Echte energielabels via de EP-Online Public REST API v5 (RVO).
 * Endpoint en veldnamen geverifieerd op 2026-07-23 tegen de officiele
 * swagger-spec (public.ep-online.nl/swagger/v5/swagger.json):
 *
 *   GET https://public.ep-online.nl/api/v5/PandEnergielabel/Adres
 *       ?postcode=5611AB&huisnummer=12[&huisletter=a][&huisnummertoevoeging=2]
 *   Header: "Authorization: <API-key>"  (kale key, geen Bearer-prefix)
 *   200 -> JSON-array van registraties (veld Energieklasse = de labelletter)
 *   404 -> geen label geregistreerd voor dit adres
 *
 * Gedrag (eerlijkheid eerst):
 * - Zonder EPONLINE_API_KEY of bij elke fout geeft getEnergielabel null; de
 *   aanroeper laat dan de bestaande bouwjaar-indicatie staan (die blijft
 *   gelabeld als "indicatie op basis van bouwjaar", zie
 *   lib/ingest/bag.ts energielabelIndicatie).
 * - Bij een echte hit wordt het label gecachet in de addresses-tabel
 *   (energielabel + energielabelBron = "echt"), zodat de adrespagina het
 *   daarna zonder API-call toont.
 * - Suppressie wint altijd: voor een opted-out adres wordt de API niet
 *   aangeroepen en niets gecachet.
 *
 * De API-key is gratis en persoonsgebonden (apikey.ep-online.nl); de
 * voorwaarden staan gebruik op een woningsite expliciet toe, zie
 * docs/DATABRONNEN.md punt 4.
 */

const EPONLINE_BASIS_DEFAULT = "https://public.ep-online.nl/api/v5";
const TIMEOUT_MS_DEFAULT = 8_000;

/** Labelletter zoals EP-Online die registreert: A t/m G, A met plussen (A+ t/m A+++++). */
const LABEL_REGEX = /^[A-G]\+{0,6}$/;

export function heeftEpOnlineKey(): boolean {
  return Boolean(process.env.EPONLINE_API_KEY);
}

/** Basis-URL, overschrijfbaar voor tests (EPONLINE_API_URL). */
export function epOnlineBasisUrl(): string {
  return process.env.EPONLINE_API_URL ?? EPONLINE_BASIS_DEFAULT;
}

/** Fout uit de EP-Online API zelf (HTTP-status beschikbaar voor de ingest). */
export class EpOnlineFout extends Error {
  readonly status?: number;
  constructor(bericht: string, status?: number) {
    super(bericht);
    this.name = "EpOnlineFout";
    this.status = status;
  }
}

export type EpOnlineLabel = {
  /** Labelletter, bv. "B" of "A++". */
  label: string;
  /** ISO yyyy-mm-dd; peildatum voor de UI ("geregistreerd op ..."). */
  registratiedatum: string | null;
  geldigTot: string | null;
};

export type EnergielabelResultaat = EpOnlineLabel & {
  /** true = uit de addresses-cache (eerdere hit), zonder nieuwe API-call. */
  uitCache: boolean;
};

/**
 * Splitst onze gecombineerde toevoeging-kolom terug naar de EP-Online
 * parameters. De BAG-ingest plakt huisletter en huisnummertoevoeging aan
 * elkaar (combineerToevoeging in lib/ingest/bag.ts: "A", "2", "A2"); EP-Online
 * wil ze los: huisletter = precies 1 letter, huisnummertoevoeging = 1-4
 * alfanumeriek. Een eerste letter lezen we dus als huisletter, de rest als
 * toevoeging. Geeft null als de waarde niet in die parameters past (dan geen
 * API-call: liever geen label dan het label van een verkeerd adres).
 */
export function splitsToevoeging(toevoeging?: string | null): { huisletter?: string; huisnummertoevoeging?: string } | null {
  const t = (toevoeging ?? "").trim();
  if (!t) return {};
  const m = /^([a-zA-Z])?([a-zA-Z0-9]{0,4})$/.exec(t);
  if (!m) return null;
  const resultaat: { huisletter?: string; huisnummertoevoeging?: string } = {};
  if (m[1]) resultaat.huisletter = m[1];
  if (m[2]) resultaat.huisnummertoevoeging = m[2];
  return resultaat;
}

type EpOnlineRegistratie = {
  Energieklasse?: unknown;
  Registratiedatum?: unknown;
  Geldig_tot?: unknown;
  Gebouwklasse?: unknown;
};

function naarDatumIso(v: unknown): string | null {
  if (typeof v !== "string" || v.length < 10) return null;
  const d = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * Kiest uit de API-respons (array van registraties) het bruikbare label:
 * alleen registraties met een geldige labelletter; voorkeur voor
 * Gebouwklasse "W" (woning; utiliteitslabels slaan we over als er een
 * woninglabel is); de meest recente registratie wint. Puur en los testbaar.
 */
export function parseEpOnlineRespons(json: unknown): EpOnlineLabel | null {
  if (!Array.isArray(json)) return null;
  const metLabel = json.filter((r): r is EpOnlineRegistratie => {
    if (typeof r !== "object" || r === null) return false;
    const klasse = (r as EpOnlineRegistratie).Energieklasse;
    return typeof klasse === "string" && LABEL_REGEX.test(klasse.trim().toUpperCase());
  });
  if (metLabel.length === 0) return null;

  const woningen = metLabel.filter((r) => typeof r.Gebouwklasse === "string" && r.Gebouwklasse.trim().toUpperCase().startsWith("W"));
  const pool = woningen.length > 0 ? woningen : metLabel;

  const gesorteerd = [...pool].sort((a, b) =>
    String(b.Registratiedatum ?? "").localeCompare(String(a.Registratiedatum ?? "")),
  );
  const beste = gesorteerd[0];
  return {
    label: String(beste.Energieklasse).trim().toUpperCase(),
    registratiedatum: naarDatumIso(beste.Registratiedatum),
    geldigTot: naarDatumIso(beste.Geldig_tot),
  };
}

export type EpOnlineAdresVraag = {
  postcode: string; // "5611AB", al genormaliseerd
  huisnummer: number;
  huisletter?: string;
  huisnummertoevoeging?: string;
  timeoutMs?: number;
};

/**
 * Rauwe API-call zonder cache of suppressie-check; gebruikt door
 * getEnergielabel en scripts/ingest-labels.ts. Geeft null bij ontbrekende key
 * of 404 (geen label); gooit EpOnlineFout bij andere HTTP-fouten en laat
 * netwerk-/timeoutfouten door (de aanroepers vangen die af).
 */
export async function fetchEnergielabel(vraag: EpOnlineAdresVraag): Promise<EpOnlineLabel | null> {
  const key = process.env.EPONLINE_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({ postcode: vraag.postcode, huisnummer: String(vraag.huisnummer) });
  if (vraag.huisletter) params.set("huisletter", vraag.huisletter);
  if (vraag.huisnummertoevoeging) params.set("huisnummertoevoeging", vraag.huisnummertoevoeging);

  const res = await fetch(`${epOnlineBasisUrl()}/PandEnergielabel/Adres?${params.toString()}`, {
    headers: { Authorization: key, Accept: "application/json" },
    signal: AbortSignal.timeout(vraag.timeoutMs ?? TIMEOUT_MS_DEFAULT),
  });
  if (res.status === 404) return null; // geen label geregistreerd: eerlijk terugvallen op indicatie
  if (!res.ok) throw new EpOnlineFout(`EP-Online gaf HTTP ${res.status}`, res.status);
  return parseEpOnlineRespons(await res.json());
}

/**
 * Haalt het echte energielabel voor een adres op, met cache in de
 * addresses-tabel. Geeft null zonder key, bij suppressie, bij een
 * niet-representeerbare toevoeging en bij elke fout; de aanroeper valt dan
 * terug op de bestaande bouwjaar-indicatie (energielabelBron blijft
 * "indicatie").
 */
export async function getEnergielabel(
  postcodeInput: string,
  huisnummer: number,
  toevoeging?: string | null,
): Promise<EnergielabelResultaat | null> {
  if (!heeftEpOnlineKey()) return null;

  const postcode = normalizePostcode(postcodeInput);
  if (!postcode || !Number.isInteger(huisnummer) || huisnummer < 1 || huisnummer > 99_999) return null;
  const slug = nummerslug(huisnummer, toevoeging);

  try {
    // Suppressie wint altijd: geen API-call en geen cache voor een opted-out adres.
    if (await isSuppressed(postcode, slug)) return null;

    // Cache: een eerder opgehaald echt label staat in addresses.
    const bestaandRows = await db
      .select({ energielabel: addresses.energielabel, energielabelBron: addresses.energielabelBron })
      .from(addresses)
      .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, slug)))
      .limit(1);
    const bestaand = bestaandRows[0];
    if (bestaand && bestaand.energielabelBron === "echt" && bestaand.energielabel) {
      return { label: bestaand.energielabel, registratiedatum: null, geldigTot: null, uitCache: true };
    }

    const splitsing = splitsToevoeging(toevoeging);
    if (splitsing === null) return null;

    const resultaat = await fetchEnergielabel({ postcode, huisnummer, ...splitsing });
    if (!resultaat) return null;

    await db
      .update(addresses)
      .set({ energielabel: resultaat.label, energielabelBron: "echt" })
      .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, slug)));

    return { ...resultaat, uitCache: false };
  } catch {
    // Timeout, netwerk, ongeldige key, onverwachte respons: stil terugvallen
    // op de indicatie. De ingest (scripts/ingest-labels.ts) logt fouten wel.
    return null;
  }
}
