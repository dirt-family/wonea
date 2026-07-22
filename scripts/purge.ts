/**
 * Retentie-handhaving (AVG-checklist):
 * - emails_outbox: 90 dagen
 * - onbevestigde widget_captures: 30 dagen
 * - leads voorbij retentie_tot (default 12 mnd na afronding, gezet bij aanmaak)
 * - verlopen magic_tokens en sessions
 * - optouts worden BEWUST NOOIT gepurged: de suppressielijst moet blijven.
 */
import { and, isNull, lt } from "drizzle-orm";
import { db } from "../lib/db";
import { emailsOutbox, leads, magicTokens, sessions, widgetCaptures } from "../db/schema";
import { nowIso } from "../lib/util";

function isoDagenGeleden(dagen: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dagen);
  return d.toISOString();
}

function main() {
  const outbox = db.delete(emailsOutbox).where(lt(emailsOutbox.createdAt, isoDagenGeleden(90))).run();
  const captures = db
    .delete(widgetCaptures)
    .where(and(isNull(widgetCaptures.bevestigdAt), lt(widgetCaptures.createdAt, isoDagenGeleden(30))))
    .run();
  const oudeLeads = db.delete(leads).where(lt(leads.retentieTot, nowIso())).run();
  const tokens = db.delete(magicTokens).where(lt(magicTokens.expiresAt, isoDagenGeleden(1))).run();
  const sess = db.delete(sessions).where(lt(sessions.expiresAt, nowIso())).run();

  console.log(
    `Purge klaar: outbox ${outbox.changes}, onbevestigde captures ${captures.changes}, leads ${oudeLeads.changes}, tokens ${tokens.changes}, sessies ${sess.changes}. Optouts blijven altijd staan.`,
  );
}

main();
