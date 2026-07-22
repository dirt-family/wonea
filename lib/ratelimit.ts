/** Simpele in-memory rate limiter (dev-schaal). Productie: echte store, zie docs/TODO.md. */
const buckets = new Map<string, number[]>();

export function rateLimited(key: string, maxPerMinuut = 5): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= maxPerMinuut) return true;
  recent.push(now);
  buckets.set(key, recent);
  return false;
}
