import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { normalizePostcode } from "@/lib/util";

/** Gedeeld tussen de aanvraagpagina en de placeholder-checkout. */

export const MOMENTEN = {
  "zo-snel-mogelijk": "Zo snel mogelijk",
  "binnen-een-maand": "Binnen een maand",
  "1-3-maanden": "Over 1 tot 3 maanden",
  orienterend: "Weet ik nog niet, ik oriënteer me eerst",
} as const;

export type Moment = keyof typeof MOMENTEN;

export function isMoment(v: string | undefined): v is Moment {
  return v != null && v in MOMENTEN;
}

/** Zoekt een adres op en respecteert de suppressielijst (opt-out is leidend). */
export function vindAdres(postcodeInput: string, nummerInput: string) {
  const postcode = normalizePostcode(postcodeInput);
  if (!postcode) return null;
  const slug = nummerInput.toLowerCase().replace(/\s+/g, "");
  const adres = db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, slug)))
    .get();
  if (!adres) return null;
  if (adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) return null;
  return adres;
}
