"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { alertSubscriptions, claims, consents, mortgageInfo, sharedReports } from "@/db/schema";
import { currentUser, destroySession } from "@/lib/auth";
import { nowIso } from "@/lib/util";
import { consentTekstversie } from "@/app/claim/consent-teksten";
import { upsertEigenWoz } from "@/components/dossier/woz-data";

/**
 * Server actions van het dashboard en het woningdossier. Elke action
 * verifieert de sessie en het eigenaarschap van de claim opnieuw; een
 * claimId uit een formulier is nooit te vertrouwen. Na afloop wordt terug-
 * gestuurd naar de dossierpagina, met een anker naar de juiste sectie.
 */

async function eigenActieveClaim(claimId: number) {
  const user = await currentUser();
  if (!user) redirect("/claim");
  const claim = (
    await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, claimId), eq(claims.userId, user.id), isNull(claims.endedAt)))
      .limit(1)
  )[0];
  if (!claim) redirect("/dashboard?fout=claim");
  return { user, claim };
}

function dossierUrl(claimId: number, param: "ok" | "fout", code: string, anker: string): string {
  return `/dashboard/woning/${claimId}?${param}=${code}#${anker}`;
}

// ---------------------------------------------------------------------------
// Waarde-alerts
// ---------------------------------------------------------------------------

const alertsSchema = z.object({
  claimId: z.coerce.number().int().positive(),
  actie: z.enum(["aan", "uit"]),
  consent: z.literal("1").optional(),
});

export async function zetAlerts(formData: FormData) {
  const parsed = alertsSchema.safeParse({
    claimId: formData.get("claimId") ?? "",
    actie: formData.get("actie") ?? "",
    consent: formData.get("consent") ?? undefined,
  });
  if (!parsed.success) redirect("/dashboard?fout=ongeldig");
  const { user, claim } = await eigenActieveClaim(parsed.data.claimId);

  const abonnement = (
    await db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claim.id)).limit(1)
  )[0];

  if (parsed.data.actie === "uit") {
    if (abonnement) await db.update(alertSubscriptions).set({ actief: false }).where(eq(alertSubscriptions.id, abonnement.id));
    redirect(dossierUrl(claim.id, "ok", "alerts-uit", "rapporten"));
  }

  // Aanzetten mag alleen met een niet-ingetrokken alerts-consent; anders is
  // het vinkje (nooit vooraangevinkt) verplicht en loggen we de consent nu.
  const actieveConsent = (
    await db
      .select({ id: consents.id })
      .from(consents)
      .where(and(eq(consents.email, user.email), eq(consents.doel, "alerts"), isNull(consents.revokedAt)))
      .limit(1)
  )[0];
  if (!actieveConsent) {
    if (!parsed.data.consent) redirect(dossierUrl(claim.id, "fout", "alerts-consent", "rapporten"));
    await db.insert(consents).values({
      userId: user.id,
      email: user.email,
      doel: "alerts",
      tekstversie: consentTekstversie("alerts"),
      bron: "dashboard",
      consentedAt: nowIso(),
    });
  }

  if (abonnement) {
    await db.update(alertSubscriptions).set({ actief: true }).where(eq(alertSubscriptions.id, abonnement.id));
  } else {
    await db.insert(alertSubscriptions).values({ claimId: claim.id, frequentie: "maandelijks", actief: true });
  }
  redirect(dossierUrl(claim.id, "ok", "alerts-aan", "rapporten"));
}

// ---------------------------------------------------------------------------
// Hypotheekgegevens
// ---------------------------------------------------------------------------

const hypotheekSchema = z.object({
  claimId: z.coerce.number().int().positive(),
  restant: z.string().min(1).max(12),
  rente: z.string().max(8).optional(),
  rentevastTot: z.string().max(10).optional(),
});

export async function bewaarHypotheek(formData: FormData) {
  const parsed = hypotheekSchema.safeParse({
    claimId: formData.get("claimId") ?? "",
    restant: formData.get("restant") ?? "",
    rente: formData.get("rente") ?? "",
    rentevastTot: formData.get("rentevastTot") ?? "",
  });
  if (!parsed.success) redirect("/dashboard?fout=ongeldig");
  const { claim } = await eigenActieveClaim(parsed.data.claimId);
  const fout = (): never => redirect(dossierUrl(claim.id, "fout", "hypotheek", "hypotheek"));

  const restantRuw = parsed.data.restant.replace(/[.\s]/g, "");
  if (!/^\d{1,9}$/.test(restantRuw)) fout();
  const restantEur = Number(restantRuw);

  let rentePct: number | null = null;
  if (parsed.data.rente && parsed.data.rente.trim() !== "") {
    const r = Number(parsed.data.rente.trim().replace(",", "."));
    if (!Number.isFinite(r) || r < 0 || r > 20) fout();
    rentePct = Math.round(r * 100) / 100;
  }

  let rentevastTot: string | null = null;
  if (parsed.data.rentevastTot && parsed.data.rentevastTot.trim() !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.rentevastTot.trim())) fout();
    rentevastTot = parsed.data.rentevastTot.trim();
  }

  const bestaand = (await db.select().from(mortgageInfo).where(eq(mortgageInfo.claimId, claim.id)).limit(1))[0];
  if (bestaand) {
    await db.update(mortgageInfo).set({ restantEur, rentePct, rentevastTot, updatedAt: nowIso() }).where(eq(mortgageInfo.id, bestaand.id));
  } else {
    await db.insert(mortgageInfo).values({ claimId: claim.id, restantEur, rentePct, rentevastTot, updatedAt: nowIso() });
  }
  redirect(dossierUrl(claim.id, "ok", "hypotheek", "hypotheek"));
}

// ---------------------------------------------------------------------------
// Eigen WOZ-invoer per peiljaar
// ---------------------------------------------------------------------------

const wozSchema = z.object({
  claimId: z.coerce.number().int().positive(),
  peiljaar: z.string().min(4).max(4),
  waarde: z.string().min(1).max(12),
});

export async function bewaarWoz(formData: FormData) {
  const parsed = wozSchema.safeParse({
    claimId: formData.get("claimId") ?? "",
    peiljaar: formData.get("peiljaar") ?? "",
    waarde: formData.get("waarde") ?? "",
  });
  if (!parsed.success) redirect("/dashboard?fout=ongeldig");
  const user = await currentUser();
  if (!user) redirect("/claim");

  const claimId = parsed.data.claimId;
  const peiljaar = Number(parsed.data.peiljaar);
  const waardeRuw = parsed.data.waarde.replace(/[.\s]/g, "");
  const waarde = /^\d{1,9}$/.test(waardeRuw) ? Number(waardeRuw) : Number.NaN;
  if (!Number.isInteger(waarde)) redirect(dossierUrl(claimId, "fout", "woz-waarde", "woz"));

  const resultaat = await upsertEigenWoz({ userId: user.id, claimId, peiljaar, waarde });
  if (!resultaat.ok) {
    if (resultaat.reden === "claim" || resultaat.reden === "adres") redirect("/dashboard?fout=claim");
    redirect(dossierUrl(claimId, "fout", `woz-${resultaat.reden}`, "woz"));
  }
  redirect(dossierUrl(claimId, "ok", `woz-${resultaat.actie}`, "woz"));
}

// ---------------------------------------------------------------------------
// Claim opzeggen en uitloggen
// ---------------------------------------------------------------------------

const opzegSchema = z.object({ claimId: z.coerce.number().int().positive() });

export async function zegClaimOp(formData: FormData) {
  const parsed = opzegSchema.safeParse({ claimId: formData.get("claimId") ?? "" });
  if (!parsed.success) redirect("/dashboard?fout=ongeldig");
  const { claim } = await eigenActieveClaim(parsed.data.claimId);

  const now = nowIso();
  await db.update(claims).set({ endedAt: now }).where(eq(claims.id, claim.id));
  await db.update(alertSubscriptions).set({ actief: false }).where(eq(alertSubscriptions.claimId, claim.id));
  await db
    .update(sharedReports)
    .set({ revokedAt: now })
    .where(and(eq(sharedReports.claimId, claim.id), isNull(sharedReports.revokedAt)));
  redirect("/dashboard?ok=opgezegd");
}

export async function uitloggen() {
  await destroySession();
  redirect("/");
}
