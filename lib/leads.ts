import { db } from "@/lib/db";
import { consents, leadEvents, leads, type LeadType } from "@/db/schema";
import { leadwaarde } from "@/lib/config/leadwaarde";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { nowIso } from "@/lib/util";
import { stuurLeadBevestiging } from "@/emails/lead";

export type NieuweLead = {
  type: LeadType;
  subtype?: string | null;
  adresId?: number | null;
  userId?: number | null;
  email: string;
  antwoorden: Record<string, unknown>;
  /** Letterlijke consent-tekst waar de gebruiker mee instemde (AVG art. 7). */
  consentTekst: string;
  /** Bv. "funnel:hypotheek". */
  bron: string;
  /** Voor de bevestigingsmail: aan welk type partij wordt doorgegeven. */
  partijType: string;
  adresNaam?: string | null;
};

const RETENTIE_MAANDEN = 12;

function retentieTot(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + RETENTIE_MAANDEN);
  return d.toISOString();
}

/**
 * Enige toegangspad voor het aanmaken van leads. Regels (CONTRACTS.md):
 * consent met letterlijke tekst gelogd, suppressie gerespecteerd,
 * bevestigingsmail benoemt het type ontvanger, retentie gezet.
 * Doorsturen naar echte partijen gebeurt NIET automatisch: dat is een
 * bewuste admin-actie (status "doorgestuurd") en pas echt bij livegang.
 */
export async function createLead(input: NieuweLead): Promise<{ leadId: number }> {
  if (input.adresId && (await isAddressIdSuppressed(input.adresId))) {
    throw new Error("Adres is verwijderd van Wonea; hiervoor maken we geen leads aan.");
  }
  const now = nowIso();
  const consentRows = await db
    .insert(consents)
    .values({
      userId: input.userId ?? null,
      email: input.email,
      doel: "lead_doorgifte",
      tekstversie: input.consentTekst,
      bron: input.bron,
      consentedAt: now,
    })
    .returning({ id: consents.id });
  const consent = consentRows[0];

  const leadRows = await db
    .insert(leads)
    .values({
      type: input.type,
      subtype: input.subtype ?? null,
      adresId: input.adresId ?? null,
      userId: input.userId ?? null,
      email: input.email,
      antwoordenJson: JSON.stringify(input.antwoorden),
      status: "nieuw",
      estValueEur: leadwaarde(input.type, input.subtype, "nieuw"),
      consentId: consent.id,
      createdAt: now,
      retentieTot: retentieTot(),
    })
    .returning({ id: leads.id });
  const lead = leadRows[0];

  await db.insert(leadEvents).values({ leadId: lead.id, event: "aangemaakt", ts: now });

  await stuurLeadBevestiging({
    to: input.email,
    type: input.type,
    partijType: input.partijType,
    adresNaam: input.adresNaam ?? null,
  });

  return { leadId: lead.id };
}
