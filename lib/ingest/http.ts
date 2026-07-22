/**
 * HTTP-helpers voor de ingest-scripts. Server-only: alleen gebruikt door
 * scripts/ingest-* (nooit importeren vanuit client components).
 * Nette burger: timeout, beperkte retries met backoff en een delay-helper
 * zodat we publieke API's (PDOK, CBS) niet hameren.
 */

export function slaap(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const USER_AGENT = "wonea-ingest/0.1 (lokale dev; contact via repo)";

export async function fetchJson<T>(url: string, opties?: { timeoutMs?: number; pogingen?: number }): Promise<T> {
  const timeoutMs = opties?.timeoutMs ?? 30_000;
  const pogingen = opties?.pogingen ?? 3;
  let laatsteFout: unknown;
  for (let poging = 1; poging <= pogingen; poging++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status} voor ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      laatsteFout = e;
      if (poging < pogingen) await slaap(500 * poging);
    }
  }
  throw laatsteFout instanceof Error ? laatsteFout : new Error(String(laatsteFout));
}

export async function fetchText(url: string, opties?: { timeoutMs?: number }): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(opties?.timeoutMs ?? 30_000), headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} voor ${url}`);
  return res.text();
}
