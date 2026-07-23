"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { verstuurVerduurzamingsLead } from "@/app/verduurzamen/logic";
import { isVerticaal, type Verticaal } from "@/app/verduurzamen/verticalen";

/**
 * Server action voor de laatste stap van de stepper. Valideert, beperkt het
 * tempo (rate limit), respecteert de honeypot en maakt de lead aan via
 * logic.ts -> lib/leads.createLead. Fouten gaan terug naar de client
 * (useActionState); succes eindigt op de rustige bevestigingspagina.
 */

export type FunnelFormState = { fout: string | null };

const emailSchema = z.string().email().max(200);

const FOUTEN: Record<string, string> = {
  adres: "We herkennen dit adres niet (meer) op Wonea. Begin opnieuw via de verduurzamen-pagina.",
  antwoorden: "Een of meer antwoorden ontbreken of zijn ongeldig. Loop de vragen nog even na.",
};

function antwoordenUitFormData(verticaal: Verticaal, formData: FormData): Record<string, unknown> {
  switch (verticaal) {
    case "zonnepanelen":
      return {
        dakOrientatie: formData.get("dakOrientatie"),
        schaduw: formData.get("schaduw"),
        koophuis: formData.get("koophuis"),
      };
    case "warmtepomp":
      return {
        huidigeVerwarming: formData.get("huidigeVerwarming"),
        isolatiegraad: formData.get("isolatiegraad"),
        bouwjaar: formData.get("bouwjaar"),
      };
    case "isolatie":
      return {
        delen: formData.getAll("delen"),
        bouwjaar: formData.get("bouwjaar"),
        koophuis: formData.get("koophuis"),
      };
  }
}

export async function verstuurAanvraag(_vorige: FunnelFormState, formData: FormData): Promise<FunnelFormState> {
  const hdrs = await headers();
  const ip = clientIp(hdrs);
  if (rateLimited(`lead:verduurzamen:${ip}`)) {
    return { fout: "Te veel aanvragen achter elkaar. Probeer het over een minuut opnieuw." };
  }

  const verticaalRaw = String(formData.get("verticaal") ?? "");
  if (!isVerticaal(verticaalRaw)) {
    return { fout: "Onbekende maatregel. Begin opnieuw via de verduurzamen-pagina." };
  }

  // Honeypot: mensen laten dit veld leeg. Bots sturen we stil naar de
  // bevestigingspagina zonder iets op te slaan.
  if (String(formData.get("bedrijfsnaam") ?? "") !== "") {
    redirect(`/verduurzamen/klaar?v=${verticaalRaw}`);
  }

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!emailSchema.safeParse(email).success) {
    return { fout: "Vul een geldig e-mailadres in." };
  }

  // Consent is een bewuste keuze: nooit vooraangevinkt, zonder vinkje geen lead.
  if (formData.get("consent") !== "ja") {
    return { fout: "Zonder jouw toestemming sturen we niets door. Vink de toestemming aan als je de aanvraag wilt versturen." };
  }

  const resultaat = await verstuurVerduurzamingsLead({
    verticaal: verticaalRaw,
    postcode: String(formData.get("postcode") ?? ""),
    nummer: String(formData.get("nummer") ?? ""),
    email,
    antwoorden: antwoordenUitFormData(verticaalRaw, formData),
  });

  if ("fout" in resultaat) {
    return { fout: FOUTEN[resultaat.fout] ?? "Er ging iets mis. Probeer het opnieuw." };
  }

  redirect(`/verduurzamen/klaar?v=${verticaalRaw}`);
}
