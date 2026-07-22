import { z } from "zod";

/**
 * Subtypes en kwalificatievragen van de hypotheekfunnel (Zod-servervalidatie).
 * Drie triggers uit het plan: overwaarde, oversluiten, aankoop.
 */

export const HYPOTHEEK_SUBTYPES = ["overwaarde", "oversluiten", "aankoop"] as const;
export type HypotheekSubtype = (typeof HYPOTHEEK_SUBTYPES)[number];

export function isHypotheekSubtype(waarde: string | null | undefined): waarde is HypotheekSubtype {
  return !!waarde && (HYPOTHEEK_SUBTYPES as readonly string[]).includes(waarde);
}

export const SUBTYPE_META: Record<HypotheekSubtype, { titel: string; vraag: string; omschrijving: string }> = {
  overwaarde: {
    titel: "Overwaarde",
    vraag: "Wat kan ik met de waarde boven mijn hypotheek?",
    omschrijving:
      "Is je woning meer waard dan je hypotheek? Dan heb je overwaarde. Die kun je soms gebruiken voor een verbouwing, verduurzaming of aflossing.",
  },
  oversluiten: {
    titel: "Oversluiten",
    vraag: "Mijn rentevaste periode loopt af",
    omschrijving:
      "Loopt je rentevaste periode binnenkort af? Dan is dit een goed moment om je opties naast elkaar te leggen voordat de bank een voorstel doet.",
  },
  aankoop: {
    titel: "Aankoop",
    vraag: "Ik wil kopen en zoek advies",
    omschrijving:
      "Van eerste oriëntatie tot bod: een adviseur rekent door wat je kunt lenen en wat in jouw situatie verstandig is.",
  },
};

// ---------------------------------------------------------------------------
// Antwoordopties met labels (waarden ascii, labels voor de UI en samenvatting)
// ---------------------------------------------------------------------------

export const OVERWAARDE_DOELEN = ["verbouwen", "verduurzamen", "aflossen", "anders"] as const;
export type OverwaardeDoel = (typeof OVERWAARDE_DOELEN)[number];
export const OVERWAARDE_DOEL_LABELS: Record<OverwaardeDoel, string> = {
  verbouwen: "Verbouwen",
  verduurzamen: "Verduurzamen",
  aflossen: "Hypotheek deels aflossen",
  anders: "Iets anders",
};

export const AANKOOP_FASES = ["orienterend", "bezichtigen", "bod_gedaan"] as const;
export type AankoopFase = (typeof AANKOOP_FASES)[number];
export const AANKOOP_FASE_LABELS: Record<AankoopFase, string> = {
  orienterend: "Ik oriënteer me nog",
  bezichtigen: "Ik ben woningen aan het bezichtigen",
  bod_gedaan: "Ik heb een bod gedaan",
};

export const AANKOOP_BUDGETTEN = ["tot_300k", "300k_tot_450k", "450k_tot_600k", "meer_dan_600k"] as const;
export type AankoopBudget = (typeof AANKOOP_BUDGETTEN)[number];
export const AANKOOP_BUDGET_LABELS: Record<AankoopBudget, string> = {
  tot_300k: "Tot 300.000 euro",
  "300k_tot_450k": "300.000 tot 450.000 euro",
  "450k_tot_600k": "450.000 tot 600.000 euro",
  meer_dan_600k: "Meer dan 600.000 euro",
};

// ---------------------------------------------------------------------------
// Zod-schema's per subtype
// ---------------------------------------------------------------------------

/** Overwaarde: eigen inschatting is alleen nodig als er geen Wonea-waarde is. */
export const overwaardeVragenSchema = z.object({
  eigenWaarde: z.coerce.number().int().min(10_000).max(10_000_000).optional(),
  restant: z.coerce.number().int().min(0).max(10_000_000),
  doel: z.enum(OVERWAARDE_DOELEN),
});

export const oversluitenVragenSchema = z.object({
  rentevastTot: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), // maand, bv. "2027-05"
  huidigeRente: z.coerce.number().min(0.1).max(15), // procent
  restschuld: z.coerce.number().int().min(1_000).max(10_000_000),
});

export const aankoopVragenSchema = z.object({
  fase: z.enum(AANKOOP_FASES),
  budget: z.enum(AANKOOP_BUDGETTEN),
  eigenInbreng: z.enum(["ja", "nee"]),
});

/** Laatste stap: e-mail verplicht, consent-checkbox verplicht, honeypot leeg. */
export const contactSchema = z.object({
  email: z.string().email().max(200),
  consent: z.literal("1"),
  bedrijfsnaam: z.string().max(0).optional(), // honeypot: mensen laten dit leeg
});
