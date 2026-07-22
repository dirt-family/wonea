import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * JSON-snapshots van ingest-runs in db/seed/snapshots/. Twee doelen:
 * 1. offline-fallback: bij een netwerkfout draait de ingest op de laatste
 *    snapshot in plaats van te crashen;
 * 2. reproduceerbaarheid van het testgebied (de seed blijft de basis).
 * Snapshots blijven bewust klein (cap), zodat ze commitbaar zijn.
 */

export const SNAPSHOT_DIR = path.join(process.cwd(), "db", "seed", "snapshots");
export const SNAPSHOT_MAX_BYTES = 4 * 1024 * 1024; // enkele MB, hard gecapt

export function snapshotPad(naam: string): string {
  return path.join(SNAPSHOT_DIR, `${naam}.json`);
}

export function schrijfSnapshot(naam: string, data: unknown): string {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const pad = snapshotPad(naam);
  writeFileSync(pad, JSON.stringify(data));
  return pad;
}

export function leesSnapshot<T>(naam: string): T | null {
  const pad = snapshotPad(naam);
  if (!existsSync(pad)) return null;
  try {
    return JSON.parse(readFileSync(pad, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Capt een featurelijst zodat het geserialiseerde snapshot onder maxBytes
 * blijft. Deterministisch: houdt de eerste N features die passen (op basis
 * van de gemiddelde feature-grootte in de lijst).
 */
export function capFeatures<T>(features: T[], maxBytes: number = SNAPSHOT_MAX_BYTES): T[] {
  if (features.length === 0) return features;
  const totaal = JSON.stringify(features).length;
  if (totaal <= maxBytes) return features;
  const gemiddeld = totaal / features.length;
  const past = Math.max(1, Math.floor(maxBytes / gemiddeld));
  return features.slice(0, past);
}
