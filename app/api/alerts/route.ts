import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims, consents, sales, users } from "@/db/schema";
import { isAddressIdSuppressed, isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation, valuationHistorie } from "@/lib/valuation";
import { stuurWaardeAlert } from "@/emails/alert";
import { nowIso, todayIso } from "@/lib/util";

/**
 * Maandrun voor de waarde-alerts. POST loopt alle actieve abonnementen langs,
 * maakt per geclaimd adres een verse valuation van vandaag en zet de alert in
 * de outbox. Suppressie en consent zijn leidend: beeindigde claims, verwijderde
 * adressen en ingetrokken toestemming krijgen NOOIT een mail.
 *
 * Aanroepen: lokaal via curl of straks de admin (Fase 4):
 *   curl -X POST http://localhost:4123/api/alerts
 * In productie draait dit via een cron (bv. Vercel Cron, 1x per maand) met de
 * header x-admin-password: TODO bij livegang, zie docs/DEPLOYMENT.md.
 */

function verzoekToegestaan(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const geheim = process.env.WONEA_ADMIN_PASSWORD;
  const gegeven = request.headers.get("x-admin-password");
  if (!geheim || !gegeven) return false;
  // Vergelijking in constante tijd (via hash zodat de lengtes altijd gelijk zijn).
  const a = createHash("sha256").update(geheim).digest();
  const b = createHash("sha256").update(gegeven).digest();
  return timingSafeEqual(a, b);
}

function isoMaandTerug(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  if (!verzoekToegestaan(request)) {
    return NextResponse.json({ ok: false, fout: "geen toegang" }, { status: 401 });
  }

  const vandaag = todayIso();
  const dezeMaand = vandaag.slice(0, 7);

  const abonnementen = await db.select().from(alertSubscriptions).where(eq(alertSubscriptions.actief, true));

  let verzonden = 0;
  const geskipt: Record<string, number> = {};
  const skip = (reden: string) => {
    geskipt[reden] = (geskipt[reden] ?? 0) + 1;
  };

  for (const sub of abonnementen) {
    try {
      // Maandelijkse frequentie: nooit twee alerts in dezelfde kalendermaand.
      if (sub.laatstVerzonden && sub.laatstVerzonden.slice(0, 7) === dezeMaand) {
        skip("al_verzonden_deze_maand");
        continue;
      }

      const claim = (await db.select().from(claims).where(eq(claims.id, sub.claimId)).limit(1))[0];
      if (!claim || claim.endedAt) {
        skip("claim_beeindigd");
        continue;
      }

      const adres = (await db.select().from(addresses).where(eq(addresses.id, claim.adresId)).limit(1))[0];
      if (!adres || adres.status === "opted_out" || (await isAddressIdSuppressed(adres.id)) || (await isSuppressed(adres.postcode, adres.nummerslug))) {
        skip("adres_verwijderd");
        continue;
      }

      const user = (await db.select().from(users).where(eq(users.id, claim.userId)).limit(1))[0];
      if (!user) {
        skip("gebruiker_onbekend");
        continue;
      }

      // Consent (doel alerts) moet bestaan en niet ingetrokken zijn (AVG art. 7).
      const alertConsents = await db
        .select()
        .from(consents)
        .where(and(eq(consents.email, user.email), eq(consents.doel, "alerts")));
      const actieveConsent = alertConsents.find((c) => !c.revokedAt);
      if (!actieveConsent) {
        skip(alertConsents.length > 0 ? "consent_ingetrokken" : "consent_ontbreekt");
        continue;
      }

      // Verse valuation van vandaag (of de al bestaande rij van vandaag).
      const { valuation } = await getOrCreateValuation(adres);
      if (!valuation) {
        skip("geen_waarde_mogelijk");
        continue;
      }

      // Vorige alert-waarde: de nieuwste valuation op of voor de datum van de
      // laatst verzonden alert (valuations is de historie, dus dit is exact de
      // waarde die toen in de mail stond). Geen vorige = eerste alert.
      let vorigeWaarde: number | null = null;
      if (sub.laatstVerzonden) {
        const grens = sub.laatstVerzonden;
        const vorige = [...(await valuationHistorie(adres.id))].reverse().find((v) => v.id !== valuation.id && v.datum <= grens);
        vorigeWaarde = vorige?.waarde ?? null;
      }

      // Nieuwe verkopen in de buurt sinds de vorige alert (of de afgelopen maand).
      const sinds = sub.laatstVerzonden ? sub.laatstVerzonden.slice(0, 10) : isoMaandTerug();
      const nieuweVerkopen =
        (
          await db
            .select({ n: sql<number>`count(*)` })
            .from(sales)
            .where(and(eq(sales.buurtCode, adres.buurtCode), gte(sales.datum, sinds)))
            .limit(1)
        )[0]?.n ?? 0;

      const adresNaam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`;
      await stuurWaardeAlert({
        to: user.email,
        adresNaam,
        woningPad: `/woning/${adres.postcode}/${adres.nummerslug}`,
        waarde: valuation.waarde,
        intervalLaag: valuation.intervalLaag,
        intervalHoog: valuation.intervalHoog,
        vorigeWaarde,
        nieuweVerkopen,
      });

      await db.update(alertSubscriptions).set({ laatstVerzonden: nowIso() }).where(eq(alertSubscriptions.id, sub.id));
      verzonden++;
    } catch (err) {
      console.error(`Alert-run: fout bij abonnement ${sub.id}`, err);
      skip("fout");
    }
  }

  return NextResponse.json({ ok: true, totaal: abonnementen.length, verzonden, geskipt });
}
