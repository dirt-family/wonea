import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  addresses,
  alertSubscriptions,
  claims,
  consents,
  leads,
  magicTokens,
  mortgageInfo,
  premiumEntitlements,
  sessions,
  sharedReports,
  users,
  wozValues,
  type ConsentDoel,
} from "@/db/schema";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { nowIso } from "@/lib/util";
import { stuurAccountOpgezegd, stuurConsentIngetrokken } from "@/emails/consent";

/**
 * Kernlogica van accountbeheer en AVG-zelfbeheer, los van Next-request-context
 * zodat het testbaar is (tests/account.test.ts). De pagina's in app/account/
 * doen alleen sessie-checks, invoervalidatie en weergave.
 */

/** Leads verliezen bij opzegging hun e-mailadres, niet hun statistiek. */
export const GEANONIMISEERD_EMAIL = "verwijderd@wonea.nl";

/** Leesbare labels per consent-doel; ook gebruikt in de bevestigingsmail. */
export const DOEL_LABELS: Record<ConsentDoel, string> = {
  alerts: "Waarde-alerts per e-mail",
  marketing: "Aanbiedingen en tips",
  widget: "Woningwaarde-updates via een widget",
  lead_doorgifte: "Doorgifte van je aanvraag aan de gekozen partij",
};

function parseJsonVeilig(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

async function adresLabel(adresId: number): Promise<string | null> {
  const adres = (await db.select().from(addresses).where(eq(addresses.id, adresId)).limit(1))[0];
  if (!adres) return null;
  // Suppressie geldt op elk pad dat adresdata toont, ook hier: een op verzoek
  // verwijderd adres noemen we niet meer bij naam.
  if (adres.status === "opted_out" || (await isAddressIdSuppressed(adres.id))) return null;
  return `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.postcode} ${adres.plaats}`;
}

// ---------------------------------------------------------------------------
// Consent intrekken (AVG art. 7 lid 3: intrekken net zo makkelijk als geven)
// ---------------------------------------------------------------------------

export type TrekConsentInResultaat = "ingetrokken" | "al-ingetrokken" | "niet-gevonden";

/**
 * Trekt een consent in. Eigenaarschap wordt hier opnieuw gecheckt: de consent
 * moet aan deze user (userId) of dit e-mailadres hangen; een consentId uit een
 * formulier is nooit te vertrouwen. Bij een alerts-consent gaan ook alle
 * alert-abonnementen van deze gebruiker uit. De rij blijft bestaan met
 * revokedAt gezet: het register is het bewijs, ook van de intrekking.
 */
export async function trekConsentIn(input: { userId: number; email: string; consentId: number }): Promise<TrekConsentInResultaat> {
  const rij = (
    await db
      .select()
      .from(consents)
      .where(and(eq(consents.id, input.consentId), or(eq(consents.userId, input.userId), eq(consents.email, input.email))))
      .limit(1)
  )[0];
  if (!rij) return "niet-gevonden";
  if (rij.revokedAt) return "al-ingetrokken";

  await db.update(consents).set({ revokedAt: nowIso() }).where(eq(consents.id, rij.id));

  if (rij.doel === "alerts") {
    const claimIds = (await db.select({ id: claims.id }).from(claims).where(eq(claims.userId, input.userId))).map((c) => c.id);
    if (claimIds.length > 0) {
      await db.update(alertSubscriptions).set({ actief: false }).where(inArray(alertSubscriptions.claimId, claimIds));
    }
  }

  await stuurConsentIngetrokken({ to: rij.email, doel: rij.doel, doelLabel: DOEL_LABELS[rij.doel] });
  return "ingetrokken";
}

// ---------------------------------------------------------------------------
// Gegevens-inzage (AVG art. 15/20): alles wat we van deze gebruiker hebben
// ---------------------------------------------------------------------------

/**
 * Bouwt de volledige JSON-export voor een gebruiker: account, claims (met
 * hypotheekgegevens en deel-links), toestemmingen, aanvragen (leads),
 * WOZ-invoer en abonnementen. Alleen echte rijen uit de database; ontbreekt
 * een categorie, dan is de lijst eerlijk leeg.
 */
export async function bouwGegevensExport(userId: number) {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) return null;

  const mijnClaims = await db.select().from(claims).where(eq(claims.userId, userId)).orderBy(desc(claims.createdAt));

  const waardeAlerts: { claimId: number; actief: boolean; frequentie: string; laatstVerzonden: string | null }[] = [];
  const claimsExport = [];
  for (const claim of mijnClaims) {
    const label = await adresLabel(claim.adresId);
    const hypotheek = (await db.select().from(mortgageInfo).where(eq(mortgageInfo.claimId, claim.id)).limit(1))[0];
    const abonnement = (await db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claim.id)).limit(1))[0];
    if (abonnement) {
      waardeAlerts.push({ claimId: claim.id, actief: abonnement.actief, frequentie: abonnement.frequentie, laatstVerzonden: abonnement.laatstVerzonden });
    }
    const rapporten = await db.select().from(sharedReports).where(eq(sharedReports.claimId, claim.id));
    claimsExport.push({
      id: claim.id,
      adresId: claim.adresId,
      adres: label,
      adresOpmerking: label ? null : "Dit adres is op verzoek van de pagina verwijderd; daarom noemen we het hier niet meer bij naam.",
      rol: claim.rol,
      sinds: claim.createdAt,
      beeindigdOp: claim.endedAt,
      hypotheek: hypotheek
        ? { restantEur: hypotheek.restantEur, rentePct: hypotheek.rentePct, rentevastTot: hypotheek.rentevastTot, bijgewerkt: hypotheek.updatedAt }
        : null,
      deelRapporten: rapporten.map((r) => ({ token: r.token, aangemaakt: r.createdAt, ingetrokken: r.revokedAt })),
    });
  }

  const toestemmingen = await db
    .select()
    .from(consents)
    .where(or(eq(consents.userId, userId), eq(consents.email, user.email)))
    .orderBy(desc(consents.consentedAt));

  const aanvragen = await db
    .select()
    .from(leads)
    .where(or(eq(leads.email, user.email), eq(leads.userId, userId)))
    .orderBy(desc(leads.createdAt));

  const adresIds = mijnClaims.map((c) => c.adresId);
  // Alleen invoer met bron "eigenaar" is van de gebruiker zelf; seed-WOZ is
  // voorbeelddata van ons en hoort niet in een persoonsgegevens-export.
  const wozInvoer =
    adresIds.length > 0
      ? await db
          .select()
          .from(wozValues)
          .where(and(inArray(wozValues.adresId, adresIds), eq(wozValues.bron, "eigenaar")))
      : [];

  const premium = await db.select().from(premiumEntitlements).where(eq(premiumEntitlements.userId, userId));

  return {
    export: {
      platform: "Wonea",
      peildatum: nowIso(),
      toelichting:
        "Dit bestand bevat alle gegevens die Wonea aan jouw account of e-mailadres koppelt (AVG artikel 15 en 20). Bedragen in hele euro's, datums in ISO-formaat (UTC). Lege lijsten betekenen: daar hebben we niets van je.",
    },
    gebruiker: { id: user.id, email: user.email, aangemaakt: user.createdAt, geverifieerd: user.verifiedAt },
    claims: claimsExport,
    toestemmingen: toestemmingen.map((c) => ({
      id: c.id,
      doel: c.doel,
      doelLabel: DOEL_LABELS[c.doel],
      letterlijkeTekst: c.tekstversie,
      bron: c.bron,
      gegevenOp: c.consentedAt,
      ingetrokkenOp: c.revokedAt,
    })),
    aanvragen: aanvragen.map((l) => ({
      id: l.id,
      type: l.type,
      subtype: l.subtype,
      adresId: l.adresId,
      status: l.status,
      antwoorden: parseJsonVeilig(l.antwoordenJson),
      geschatteLeadwaardeEur: l.estValueEur,
      aangemaakt: l.createdAt,
      bewaardTot: l.retentieTot,
    })),
    wozInvoer: wozInvoer.map((w) => ({ adresId: w.adresId, peiljaar: w.peiljaar, waardeEur: w.waarde, bron: w.bron })),
    abonnementen: {
      waardeAlerts,
      premium: premium.map((p) => ({ product: p.product, status: p.status, sinds: p.createdAt })),
    },
  };
}

// ---------------------------------------------------------------------------
// Account opzeggen (stap 2 van de bevestigingspagina)
// ---------------------------------------------------------------------------

/**
 * Zegt het account definitief op, in een transactie:
 * 1. leads anonimiseren (email wordt verwijderd@wonea.nl, userId los): de
 *    leadstatistiek blijft kloppen, zonder persoonsgegevens;
 * 2. actieve toestemmingen intrekken; het register blijft bestaan als bewijs
 *    van geven en intrekken, losgekoppeld van de user-rij;
 * 3. claims en hun hypotheekgegevens, alert-abonnementen en deel-links weg;
 * 4. premium-rechten, magic-link-tokens en alle sessies weg;
 * 5. de user-rij zelf weg.
 * De publieke woningpagina staat hier bewust los van: die verwijder je via
 * /verwijderen (twee stappen, zonder account).
 */
export async function zegAccountOp(userId: number): Promise<"ok" | "niet-gevonden"> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) return "niet-gevonden";
  const now = nowIso();

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({ email: GEANONIMISEERD_EMAIL, userId: null })
      .where(or(eq(leads.email, user.email), eq(leads.userId, userId)));

    await tx
      .update(consents)
      .set({ revokedAt: now })
      .where(and(or(eq(consents.userId, userId), eq(consents.email, user.email)), isNull(consents.revokedAt)));
    await tx.update(consents).set({ userId: null }).where(eq(consents.userId, userId));

    const claimIds = (await tx.select({ id: claims.id }).from(claims).where(eq(claims.userId, userId))).map((c) => c.id);
    if (claimIds.length > 0) {
      await tx.delete(mortgageInfo).where(inArray(mortgageInfo.claimId, claimIds));
      await tx.delete(alertSubscriptions).where(inArray(alertSubscriptions.claimId, claimIds));
      await tx.delete(sharedReports).where(inArray(sharedReports.claimId, claimIds));
      await tx.delete(claims).where(inArray(claims.id, claimIds));
    }

    await tx.delete(premiumEntitlements).where(eq(premiumEntitlements.userId, userId));
    await tx.delete(magicTokens).where(eq(magicTokens.email, user.email));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });

  // Laatste mail, naar het inmiddels losgekoppelde adres: bevestiging van de
  // opzegging. De outbox zelf wordt na 90 dagen gepurged (scripts/purge.ts).
  await stuurAccountOpgezegd(user.email);
  return "ok";
}

/** Aantal niet-verlopen sessies (apparaten) van deze gebruiker, voor de sessie-uitleg. */
export async function telActieveSessies(userId: number): Promise<number> {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, nowIso())));
  return rows.length;
}
