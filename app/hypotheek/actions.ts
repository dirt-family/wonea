"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { createLead } from "@/lib/leads";
import { rateLimited } from "@/lib/ratelimit";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { normalizePostcode } from "@/lib/util";
import { HYPOTHEEK_PARTIJ_TYPE, hypotheekConsentTekstversie } from "@/app/hypotheek/consent-tekst";
import {
  AANKOOP_BUDGET_LABELS,
  AANKOOP_FASE_LABELS,
  aankoopVragenSchema,
  contactSchema,
  isHypotheekSubtype,
  overwaardeVragenSchema,
  oversluitenVragenSchema,
} from "@/app/hypotheek/schema";

/** FormData-veld als niet-lege string, anders undefined (voor optionele Zod-velden). */
function veld(formData: FormData, naam: string): string | undefined {
  const v = formData.get(naam);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s === "" ? undefined : s;
}

/**
 * Verwerkt de laatste stap van de hypotheekfunnel. Lead-aanmaak loopt
 * UITSLUITEND via lib/leads.ts createLead: die logt consent met letterlijke
 * tekst, respecteert de suppressielijst en zet de bevestigingsmail klaar.
 */
export async function verstuurHypotheekLead(formData: FormData): Promise<void> {
  const subtypeRuw = veld(formData, "subtype");
  if (!isHypotheekSubtype(subtypeRuw)) redirect("/hypotheek?fout=ongeldig");
  const subtype = subtypeRuw;

  const postcodeRuw = veld(formData, "postcode");
  const nummerRuw = veld(formData, "nummer");
  const terugBasis = new URLSearchParams({ subtype });
  if (postcodeRuw) terugBasis.set("postcode", postcodeRuw);
  if (nummerRuw) terugBasis.set("nummer", nummerRuw);
  const terug = (fout: string): string => {
    const q = new URLSearchParams(terugBasis);
    q.set("fout", fout);
    return `/hypotheek?${q.toString()}`;
  };

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "lokaal";
  if (rateLimited(`hypotheek:${ip}`)) redirect(terug("te-vaak"));

  // Zonder aangevinkte toestemming versturen we niets; aparte, eerlijke melding.
  if (formData.get("consent") !== "1") redirect(terug("consent"));

  const contact = contactSchema.safeParse({
    email: veld(formData, "email") ?? "",
    consent: formData.get("consent"),
    bedrijfsnaam: typeof formData.get("bedrijfsnaam") === "string" ? formData.get("bedrijfsnaam") : "",
  });
  if (!contact.success) redirect(terug("ongeldig"));
  const email = contact.data.email.toLowerCase().trim();

  // Adres alleen koppelen als het bestaat en niet gesupprimeerd is.
  let adres: typeof addresses.$inferSelect | null = null;
  if (postcodeRuw && nummerRuw) {
    const postcode = normalizePostcode(postcodeRuw);
    const slug = nummerRuw.toLowerCase().replace(/\s+/g, "");
    if (postcode) {
      adres =
        (
          await db
            .select()
            .from(addresses)
            .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, slug)))
            .limit(1)
        )[0] ?? null;
    }
    if (adres && (adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug)))) {
      redirect(terug("adres-verwijderd"));
    }
  }

  // Kwalificatievragen per subtype valideren en als leesbaar antwoordenobject bewaren.
  let antwoorden: Record<string, unknown>;
  if (subtype === "overwaarde") {
    const parsed = overwaardeVragenSchema.safeParse({
      eigenWaarde: veld(formData, "eigenWaarde"),
      restant: veld(formData, "restant") ?? "",
      doel: veld(formData, "doel") ?? "",
    });
    if (!parsed.success) redirect(terug("ongeldig"));

    // Wonea-waarde als die er is, anders de eigen inschatting van de gebruiker.
    let waardeBron: "wonea" | "eigen" | null = null;
    let woningWaarde: number | null = null;
    let intervalLaag: number | null = null;
    let intervalHoog: number | null = null;
    if (adres) {
      const { valuation } = await getOrCreateValuation(adres);
      if (valuation) {
        waardeBron = "wonea";
        woningWaarde = valuation.waarde;
        intervalLaag = valuation.intervalLaag;
        intervalHoog = valuation.intervalHoog;
      }
    }
    if (woningWaarde == null && parsed.data.eigenWaarde != null) {
      waardeBron = "eigen";
      woningWaarde = parsed.data.eigenWaarde;
    }
    if (woningWaarde == null || waardeBron == null) redirect(terug("ongeldig"));

    antwoorden = {
      waardeBron, // "wonea" = modelmatige schatting, "eigen" = inschatting gebruiker
      woningWaarde,
      ...(intervalLaag != null && intervalHoog != null
        ? {
            waardeIntervalLaag: intervalLaag,
            waardeIntervalHoog: intervalHoog,
            overwaardeIndicatieLaag: intervalLaag - parsed.data.restant,
            overwaardeIndicatieHoog: intervalHoog - parsed.data.restant,
          }
        : {}),
      restantHypotheek: parsed.data.restant,
      overwaardeIndicatie: woningWaarde - parsed.data.restant,
      doel: parsed.data.doel,
    };
  } else if (subtype === "oversluiten") {
    const parsed = oversluitenVragenSchema.safeParse({
      rentevastTot: veld(formData, "rentevastTot") ?? "",
      huidigeRente: veld(formData, "huidigeRente") ?? "",
      restschuld: veld(formData, "restschuld") ?? "",
    });
    if (!parsed.success) redirect(terug("ongeldig"));
    antwoorden = {
      rentevastTot: parsed.data.rentevastTot,
      huidigeRentePct: parsed.data.huidigeRente,
      restschuld: parsed.data.restschuld,
    };
  } else {
    const parsed = aankoopVragenSchema.safeParse({
      fase: veld(formData, "fase") ?? "",
      budget: veld(formData, "budget") ?? "",
      eigenInbreng: veld(formData, "eigenInbreng") ?? "",
    });
    if (!parsed.success) redirect(terug("ongeldig"));
    antwoorden = {
      fase: parsed.data.fase,
      faseLabel: AANKOOP_FASE_LABELS[parsed.data.fase],
      budget: parsed.data.budget,
      budgetLabel: AANKOOP_BUDGET_LABELS[parsed.data.budget],
      eigenInbreng: parsed.data.eigenInbreng,
    };
  }

  const user = await currentUser();
  const adresNaam = adres
    ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`
    : null;

  // createLead is het enige toegangspad: consent-rij, suppressiecheck,
  // leadwaarde, lead-event en bevestigingsmail in 1 transactiepad.
  let geweigerd = false;
  try {
    await createLead({
      type: "hypotheek",
      subtype,
      adresId: adres?.id ?? null,
      userId: user?.id ?? null,
      email,
      antwoorden,
      consentTekst: hypotheekConsentTekstversie(),
      bron: "funnel:hypotheek",
      partijType: HYPOTHEEK_PARTIJ_TYPE,
      adresNaam,
    });
  } catch {
    geweigerd = true; // suppressie-backstop in createLead
  }
  if (geweigerd) redirect(terug("adres-verwijderd"));

  const klaar = new URLSearchParams();
  if (adres) {
    klaar.set("postcode", adres.postcode);
    klaar.set("nummer", adres.nummerslug);
  }
  const query = klaar.toString();
  redirect(`/hypotheek/klaar${query ? `?${query}` : ""}`);
}
