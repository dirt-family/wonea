import { db } from "@/lib/db";
import { emailsOutbox, type EmailType } from "@/db/schema";
import { nowIso } from "@/lib/util";

/**
 * Outbox-patroon: lokaal wordt niets echt verstuurd. Elke mail wordt als
 * volledige HTML in emails_outbox gezet en is leesbaar/klikbaar op /dev/mail
 * (alleen in development). Echte verzending is een livegang-TODO.
 * Templates staan in emails/ en bevatten ALTIJD een afmeld-/beheerlink.
 */
export async function queueEmail(input: { to: string; subject: string; html: string; type: EmailType }): Promise<void> {
  await db.insert(emailsOutbox).values({ to: input.to, subject: input.subject, html: input.html, type: input.type, status: "queued", createdAt: nowIso() });
}
