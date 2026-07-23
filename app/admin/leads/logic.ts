import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadEvents, leads, type LeadStatus, type LeadType } from "@/db/schema";
import { leadwaarde } from "@/lib/config/leadwaarde";
import { nowIso } from "@/lib/util";

/** Alle waarden op 1 plek, zodat filters, selects en validatie gelijk lopen. */
export const LEAD_TYPES: LeadType[] = ["hypotheek", "makelaar", "taxatie", "verduurzaming"];
export const LEAD_STATUSSEN: LeadStatus[] = ["nieuw", "gekwalificeerd", "doorgestuurd", "gesloten", "afgewezen"];
/** Open pipeline: alles wat nog waarde kan opleveren. */
export const OPEN_LEAD_STATUSSEN: LeadStatus[] = ["nieuw", "gekwalificeerd", "doorgestuurd"];

const RETENTIE_MAANDEN = 12;

function retentieVanafNu(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + RETENTIE_MAANDEN);
  return d.toISOString();
}

export type WijzigStatusResultaat = { ok: true } | { ok: false; fout: string };

/**
 * Statuswijziging van een lead vanuit de admin. Werkt drie dingen bij:
 * 1. status zelf;
 * 2. est_value_eur, herberekend via lib/config/leadwaarde (zo registreert een
 *    gesloten hypotheeklead de succes-fee-waarde en telt afgewezen als 0);
 * 3. een lead_event met tijdstempel, zodat de tijdlijn compleet blijft.
 * Bij gesloten of afgewezen start de bewaartermijn opnieuw: retentie_tot wordt
 * nu plus 12 maanden, daarna ruimt scripts/purge.ts de lead op.
 */
export async function wijzigLeadStatus(leadId: number, nieuweStatus: LeadStatus): Promise<WijzigStatusResultaat> {
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) return { ok: false, fout: "Lead niet gevonden." };
  if (lead.status === nieuweStatus) return { ok: true }; // niets te doen, geen ruis in de tijdlijn

  const nieuweWaarden: Partial<typeof leads.$inferInsert> = {
    status: nieuweStatus,
    estValueEur: leadwaarde(lead.type, lead.subtype, nieuweStatus),
  };
  if (nieuweStatus === "gesloten" || nieuweStatus === "afgewezen") {
    nieuweWaarden.retentieTot = retentieVanafNu();
  }

  await db.update(leads).set(nieuweWaarden).where(eq(leads.id, leadId));
  await db.insert(leadEvents).values({ leadId, event: `status: ${lead.status} -> ${nieuweStatus}`, ts: nowIso() });
  return { ok: true };
}
