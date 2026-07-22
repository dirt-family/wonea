import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { createLead } from "@/lib/leads";
import { isSuppressed } from "@/lib/suppression";
import { normalizePostcode } from "@/lib/util";
import { consentTekstversie, FUNNEL_BRON, PARTIJ_TYPE, VERTICAAL_SCHEMAS, type Verticaal } from "@/app/verduurzamen/verticalen";

/**
 * Kern van de verduurzamingsfunnel, los van Next-request-context zodat het
 * testbaar is (patroon: app/claim/verzilver/logic.ts).
 *
 * - Adres moet bestaan en niet gesuppresseerd zijn (opt-out is leidend).
 * - Antwoorden worden hier per verticaal met Zod gevalideerd.
 * - De lead ontstaat UITSLUITEND via lib/leads.createLead: die logt de
 *   consent met letterlijke tekstversie, zet de leadwaarde en stuurt de
 *   bevestigingsmail die het partijtype herhaalt.
 */

export type Adres = typeof addresses.$inferSelect;

/** Zoekt een adres op waarvoor de funnel mag draaien (bestaat, niet gesupprimeerd). */
export function vindVerduurzaamAdres(postcodeInput: string, nummerInput: string): Adres | null {
  const postcode = normalizePostcode(postcodeInput);
  if (!postcode) return null;
  const slug = nummerInput.toLowerCase().replace(/\s+/g, "");
  if (!slug) return null;
  const adres = db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, slug)))
    .get();
  if (!adres) return null;
  if (adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) return null;
  return adres;
}

export function adresNaam(adres: Adres): string {
  return `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`;
}

export type VerduurzamingInput = {
  verticaal: Verticaal;
  postcode: string;
  nummer: string;
  email: string;
  /** Ruwe antwoorden uit het formulier; hier gevalideerd per verticaal. */
  antwoorden: Record<string, unknown>;
};

export type VerduurzamingResultaat = { leadId: number } | { fout: "adres" | "antwoorden" };

export function verstuurVerduurzamingsLead(input: VerduurzamingInput): VerduurzamingResultaat {
  const adres = vindVerduurzaamAdres(input.postcode, input.nummer);
  if (!adres) return { fout: "adres" };

  const parsed = VERTICAAL_SCHEMAS[input.verticaal].safeParse(input.antwoorden);
  if (!parsed.success) return { fout: "antwoorden" };

  const { leadId } = createLead({
    type: "verduurzaming",
    subtype: input.verticaal,
    adresId: adres.id,
    email: input.email,
    antwoorden: parsed.data as Record<string, unknown>,
    consentTekst: consentTekstversie(),
    bron: FUNNEL_BRON,
    partijType: PARTIJ_TYPE,
    adresNaam: adresNaam(adres),
  });
  return { leadId };
}
