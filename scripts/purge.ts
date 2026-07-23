/**
 * Retentie-handhaving (AVG-checklist):
 * - emails_outbox: 90 dagen
 * - onbevestigde widget_captures: 30 dagen
 * - leads voorbij retentie_tot (default 12 mnd na afronding, gezet bij aanmaak)
 * - verlopen magic_tokens en sessions
 * - optouts worden BEWUST NOOIT gepurged: de suppressielijst moet blijven.
 */
import { and, isNull, lt } from "drizzle-orm";
import { db, sql } from "../lib/db";
import { emailsOutbox, leads, magicTokens, sessions, widgetCaptures } from "../db/schema";
import { nowIso } from "../lib/util";

function isoDagenGeleden(dagen: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dagen);
  return d.toISOString();
}

async function main() {
  const outbox = await db.delete(emailsOutbox).where(lt(emailsOutbox.createdAt, isoDagenGeleden(90))).returning({ id: emailsOutbox.id });
  const captures = await db
    .delete(widgetCaptures)
    .where(and(isNull(widgetCaptures.bevestigdAt), lt(widgetCaptures.createdAt, isoDagenGeleden(30))))
    .returning({ id: widgetCaptures.id });
  const oudeLeads = await db.delete(leads).where(lt(leads.retentieTot, nowIso())).returning({ id: leads.id });
  const tokens = await db.delete(magicTokens).where(lt(magicTokens.expiresAt, isoDagenGeleden(1))).returning({ id: magicTokens.id });
  const sess = await db.delete(sessions).where(lt(sessions.expiresAt, nowIso())).returning({ id: sessions.id });

  console.log(
    `Purge klaar: outbox ${outbox.length}, onbevestigde captures ${captures.length}, leads ${oudeLeads.length}, tokens ${tokens.length}, sessies ${sess.length}. Optouts blijven altijd staan.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
