import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

/**
 * CBS-koppeltabel "buurt, wijk en gemeente voor postcode-huisnummer".
 * Keyless download (geverifieerd 2026-07-22): zip van ~22 MB met o.a.
 * pc6hnr20250801_gwb.csv (PC6;Huisnummer;Buurt2025;Wijk2025;Gemeente2025,
 * ~8 miljoen regels). De buurtcode staat er ZONDER "BU"-prefix in en kan
 * alfanumeriek zijn (Amsterdam: 0363AF01).
 *
 * De zip wordt eenmalig gecachet in data/koppeltabel/ en per gebied
 * stream-gefilterd (postcode4-set) naar een klein JSON-cachebestand, zodat
 * her-runs de 8M regels niet opnieuw hoeven te lezen. Uitpakken gebeurt
 * streamend via het systeem-unzip (`unzip -p`); geen nieuwe dependencies.
 */

export const KOPPELTABEL_URL_DEFAULT = "https://download.cbs.nl/postcode/2025-cbs-pc6huisnr20250801_buurt.zip";
export const KOPPELTABEL_CSV_PATROON = "pc6hnr*";

export type KoppeltabelEntry = { postcode: string; huisnummer: number; buurtCode: string };

export function koppeltabelKey(postcode: string, huisnummer: number): string {
  return `${postcode}|${huisnummer}`;
}

/** Pure parser voor een csv-regel; null voor header/lege/onbruikbare regels. */
export function parseKoppeltabelRegel(regel: string): KoppeltabelEntry | null {
  const delen = regel.split(";");
  if (delen.length < 3) return null;
  const postcode = delen[0].trim();
  const huisnummer = Number(delen[1]);
  const buurt = delen[2].trim();
  if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(postcode)) return null;
  if (!Number.isInteger(huisnummer) || huisnummer < 1) return null;
  if (buurt.length !== 8) return null;
  return { postcode, huisnummer, buurtCode: `BU${buurt}` };
}

/** Pure parser voor complete csv-tekst, optioneel gefilterd op postcode4. */
export function parseKoppeltabelCsv(tekst: string, postcode4?: Set<string> | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const regel of tekst.split(/\r?\n/)) {
    const entry = parseKoppeltabelRegel(regel);
    if (!entry) continue;
    if (postcode4 && !postcode4.has(entry.postcode.slice(0, 4))) continue;
    map.set(koppeltabelKey(entry.postcode, entry.huisnummer), entry.buurtCode);
  }
  return map;
}

/**
 * Fallback-koppeling (pure): per postcode4 de meest voorkomende buurt in de
 * meegegeven adresrijen. Bij gelijke stand wint de laagste buurtcode
 * (deterministisch). Eerlijk gedocumenteerd als beperking in docs/INGEST.md.
 */
export function modaleBuurtPerPostcode4(rijen: Array<{ postcode: string; buurtCode: string }>): Map<string, string> {
  const telling = new Map<string, Map<string, number>>();
  for (const rij of rijen) {
    const pc4 = rij.postcode.slice(0, 4);
    if (!telling.has(pc4)) telling.set(pc4, new Map());
    const per = telling.get(pc4)!;
    per.set(rij.buurtCode, (per.get(rij.buurtCode) ?? 0) + 1);
  }
  const resultaat = new Map<string, string>();
  for (const [pc4, per] of telling) {
    let beste: string | null = null;
    let besteN = -1;
    for (const [buurt, n] of per) {
      if (n > besteN || (n === besteN && beste !== null && buurt < beste)) {
        beste = buurt;
        besteN = n;
      }
    }
    if (beste) resultaat.set(pc4, beste);
  }
  return resultaat;
}

// ---------------------------------------------------------------------------
// Loader (Node-only, best effort): download + cache + stream-filter.
// ---------------------------------------------------------------------------

type KoppeltabelCache = { postcode4: string[]; entries: Array<[string, string]> };

async function downloadZip(url: string, zipPad: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} voor ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(path.dirname(zipPad), { recursive: true });
  writeFileSync(zipPad, buf);
}

function streamFilterUitZip(zipPad: string, postcode4: Set<string>): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const proc = spawn("unzip", ["-p", zipPad, KOPPELTABEL_CSV_PATROON]);
    const map = new Map<string, string>();
    const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
    rl.on("line", (regel) => {
      const entry = parseKoppeltabelRegel(regel);
      if (!entry || !postcode4.has(entry.postcode.slice(0, 4))) return;
      map.set(koppeltabelKey(entry.postcode, entry.huisnummer), entry.buurtCode);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(map);
      else reject(new Error(`unzip eindigde met code ${code}`));
    });
  });
}

/**
 * Laadt de koppeltabel voor een set postcode4-gebieden. Volgorde:
 * 1. gebied-cache (data/koppeltabel/pc6-buurt-<gebied>.json);
 * 2. gecachete zip, anders eenmalige download (~22 MB);
 * 3. streamend filteren en cachen.
 * Elke fout (geen netwerk, geen unzip) geeft null terug: de aanroeper valt
 * dan terug op de postcode4-koppeling. Nooit een harde crash.
 */
export async function laadKoppeltabel(opties: {
  postcode4: Set<string>;
  gebied: string;
  url?: string;
  zipPad?: string;
  cacheDir?: string;
}): Promise<Map<string, string> | null> {
  const cacheDir = opties.cacheDir ?? path.join(process.cwd(), "data", "koppeltabel");
  const zipPad = opties.zipPad ?? path.join(cacheDir, "pc6hnr_buurt.zip");
  const cachePad = path.join(cacheDir, `pc6-buurt-${opties.gebied}.json`);
  const gewenst = [...opties.postcode4].sort();

  try {
    if (existsSync(cachePad)) {
      const cache = JSON.parse(readFileSync(cachePad, "utf8")) as KoppeltabelCache;
      if (JSON.stringify(cache.postcode4) === JSON.stringify(gewenst)) return new Map(cache.entries);
    }
    if (!existsSync(zipPad)) {
      console.log(`Koppeltabel: eenmalige download van ${opties.url ?? KOPPELTABEL_URL_DEFAULT} (~22 MB)...`);
      await downloadZip(opties.url ?? KOPPELTABEL_URL_DEFAULT, zipPad);
    }
    const map = await streamFilterUitZip(zipPad, opties.postcode4);
    mkdirSync(cacheDir, { recursive: true });
    const cache: KoppeltabelCache = { postcode4: gewenst, entries: [...map.entries()] };
    writeFileSync(cachePad, JSON.stringify(cache));
    return map;
  } catch (e) {
    console.warn(`Koppeltabel niet beschikbaar (${(e as Error).message}); val terug op postcode4-koppeling.`);
    return null;
  }
}
