/**
 * In-memory rate limiter, per serverless-instance (beta-schaal).
 * Beperkingen bewust gedocumenteerd: geen gedeelde store over instances heen;
 * een persistente store (Postgres/KV) staat in docs/TODO.md voor productie.
 */
const buckets = new Map<string, number[]>();

/** Harde bovengrens op het aantal buckets: simpele eviction tegen geheugengroei. */
const MAX_BUCKETS = 5_000;

/**
 * Client-IP voor rate-limit-sleutels. De x-forwarded-for-header is door de
 * client spoofbaar aan de VOORKANT (eigen waarden voorop); de vertrouwde proxy
 * (Vercel) voegt het echte peer-IP als laatste hop toe. We gebruiken daarom
 * x-real-ip (door het platform gezet) en anders de LAATSTE hop, nooit de hele
 * header.
 */
export function clientIp(hdrs: { get(name: string): string | null }): string {
  const echt = hdrs.get("x-real-ip");
  if (echt) return echt.trim();
  const xff = hdrs.get("x-forwarded-for");
  if (!xff) return "lokaal";
  const hops = xff.split(",").map((deel) => deel.trim()).filter(Boolean);
  return hops.at(-1) ?? "lokaal";
}

export function rateLimited(key: string, maxPerMinuut = 5): boolean {
  const now = Date.now();

  if (buckets.size >= MAX_BUCKETS) {
    // Gooi eerst verlopen buckets weg; is dat niet genoeg, dan de oudste helft.
    for (const [k, tijden] of buckets) {
      if (tijden.every((t) => now - t >= 60_000)) buckets.delete(k);
    }
    if (buckets.size >= MAX_BUCKETS) {
      let over = Math.floor(MAX_BUCKETS / 2);
      for (const k of buckets.keys()) {
        if (over-- <= 0) break;
        buckets.delete(k);
      }
    }
  }

  const recent = (buckets.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= maxPerMinuut) return true;
  recent.push(now);
  buckets.set(key, recent);
  return false;
}
