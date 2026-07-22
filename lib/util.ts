import { createHash, randomBytes } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Bouwt de URL-nummerslug uit huisnummer + toevoeging: 12, 12a, 12-2. */
export function nummerslug(huisnummer: number, toevoeging?: string | null): string {
  if (!toevoeging) return String(huisnummer);
  const t = toevoeging.toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^\d/.test(t) ? `${huisnummer}-${t}` : `${huisnummer}${t}`;
}

/** Normaliseert postcode-invoer naar "1234AB". Geeft null bij ongeldig formaat. */
export function normalizePostcode(input: string): string | null {
  const p = input.toUpperCase().replace(/\s+/g, "");
  return /^[1-9][0-9]{3}[A-Z]{2}$/.test(p) ? p : null;
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function formatDatumNl(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function baseUrl(): string {
  return process.env.WONEA_BASE_URL ?? "http://localhost:3000";
}
