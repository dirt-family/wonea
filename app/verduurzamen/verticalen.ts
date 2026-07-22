import { z } from "zod";

/**
 * Configuratie van de verduurzamingsfunnel: de drie verticalen met hun
 * kwalificatievragen (als data, zodat de stepper ze generiek rendert),
 * de Zod-schema's per verticaal en de letterlijke consent-tekst.
 * Puur module: geen imports van db of Next, bruikbaar in client en server.
 */

export type Verticaal = "zonnepanelen" | "warmtepomp" | "isolatie";

export const VERTICAAL_SLUGS = ["zonnepanelen", "warmtepomp", "isolatie"] as const;

export function isVerticaal(s: string): s is Verticaal {
  return (VERTICAAL_SLUGS as readonly string[]).includes(s);
}

// ---------------------------------------------------------------------------
// Consent (AVG art. 7: letterlijke tekst plus versie-id wordt gelogd)
// ---------------------------------------------------------------------------

export const CONSENT_TEKSTVERSIE = "verduurzamen-v1";

/** Aan welk type partij de aanvraag wordt doorgegeven; staat ook voor de verzendknop. */
export const PARTIJ_TYPE = "maximaal twee gecertificeerde installatiebedrijven uit de regio";

/** De letterlijke checkbox-tekst die de gebruiker ziet. Wijzig je deze, verhoog dan de versie. */
export const CONSENT_TEKST = `Ja, Wonea mag deze aanvraag eenmalig doorgeven aan ${PARTIJ_TYPE}, zodat zij contact met mij kunnen opnemen. Daarna stopt het: geen doorverkoop en geen andere partijen.`;

/** De tekstversie zoals die in consents.tekstversie wordt opgeslagen. */
export function consentTekstversie(): string {
  return `${CONSENT_TEKSTVERSIE}: "${CONSENT_TEKST}"`;
}

/** Bron-veld voor consents en leads uit deze funnel. */
export const FUNNEL_BRON = "funnel:verduurzamen";

// ---------------------------------------------------------------------------
// Vragen per verticaal (data voor de stepper)
// ---------------------------------------------------------------------------

export type VraagOptie = { waarde: string; label: string };

export type Vraag = {
  naam: string;
  label: string;
  soort: "radio" | "checkbox" | "bouwjaar";
  opties?: VraagOptie[];
  hint?: string;
};

export type VerticaalConfig = {
  slug: Verticaal;
  titel: string;
  /** Eerlijke zin over kosten-ordegrootte en wat het oplevert; geen subsidie-beloftes. */
  kaartZin: string;
  vragen: Vraag[];
};

export const VERTICALEN: Record<Verticaal, VerticaalConfig> = {
  zonnepanelen: {
    slug: "zonnepanelen",
    titel: "Zonnepanelen",
    kaartZin:
      "Een gemiddeld systeem kost ruwweg 3.000 tot 5.000 euro en verdient zich via een lagere energierekening doorgaans in 6 tot 9 jaar terug.",
    vragen: [
      {
        naam: "dakOrientatie",
        label: "Welke kant ligt je dak vooral op?",
        soort: "radio",
        opties: [
          { waarde: "zuid", label: "Vooral zuid" },
          { waarde: "oost-west", label: "Oost en west" },
          { waarde: "noord", label: "Vooral noord" },
          { waarde: "weet-niet", label: "Weet ik niet" },
        ],
        hint: "Zuid levert het meest op, maar oost-west is vaak ook prima.",
      },
      {
        naam: "schaduw",
        label: "Hoeveel schaduw valt er op je dak?",
        soort: "radio",
        opties: [
          { waarde: "geen", label: "Geen of nauwelijks" },
          { waarde: "beetje", label: "Een deel van de dag" },
          { waarde: "veel", label: "Veel, door bomen of hogere gebouwen" },
        ],
      },
      {
        naam: "koophuis",
        label: "Is dit een koophuis?",
        soort: "radio",
        opties: [
          { waarde: "ja", label: "Ja" },
          { waarde: "nee", label: "Nee, ik huur" },
        ],
        hint: "Bij een huurwoning beslist de verhuurder over zonnepanelen.",
      },
    ],
  },
  warmtepomp: {
    slug: "warmtepomp",
    titel: "Warmtepomp",
    kaartZin:
      "Kost grofweg 4.000 (hybride) tot 15.000 euro (volledig elektrisch) inclusief installatie en kan je gasverbruik fors verlagen, mits je huis redelijk geïsoleerd is.",
    vragen: [
      {
        naam: "huidigeVerwarming",
        label: "Hoe verwarm je nu?",
        soort: "radio",
        opties: [
          { waarde: "cv-ketel", label: "Cv-ketel op gas" },
          { waarde: "stadsverwarming", label: "Stadsverwarming" },
          { waarde: "hybride-warmtepomp", label: "Hybride warmtepomp" },
          { waarde: "volledig-elektrisch", label: "Volledig elektrisch" },
          { waarde: "anders", label: "Anders" },
        ],
      },
      {
        naam: "isolatiegraad",
        label: "Hoe goed is je huis geïsoleerd, denk je?",
        soort: "radio",
        opties: [
          { waarde: "goed", label: "Goed" },
          { waarde: "gemiddeld", label: "Gemiddeld" },
          { waarde: "matig", label: "Matig of slecht" },
          { waarde: "weet-niet", label: "Weet ik niet" },
        ],
        hint: "Een warmtepomp werkt pas comfortabel in een redelijk geïsoleerd huis; een eerlijke inschatting is genoeg.",
      },
      {
        naam: "bouwjaar",
        label: "Wat is het bouwjaar van je huis?",
        soort: "bouwjaar",
        hint: "Vooringevuld vanuit je adres; pas aan als het niet klopt.",
      },
    ],
  },
  isolatie: {
    slug: "isolatie",
    titel: "Isolatie",
    kaartZin:
      "Vaak 1.000 tot 5.000 euro per maatregel en meestal de logische eerste stap: direct minder warmteverlies, meer comfort en een lagere rekening.",
    vragen: [
      {
        naam: "delen",
        label: "Wat wil je isoleren?",
        soort: "checkbox",
        opties: [
          { waarde: "dak", label: "Dak" },
          { waarde: "spouwmuur", label: "Spouwmuur" },
          { waarde: "vloer", label: "Vloer" },
          { waarde: "glas", label: "Glas (bv. HR++)" },
        ],
        hint: "Meerdere antwoorden mogelijk.",
      },
      {
        naam: "bouwjaar",
        label: "Wat is het bouwjaar van je huis?",
        soort: "bouwjaar",
        hint: "Vooringevuld vanuit je adres; pas aan als het niet klopt.",
      },
      {
        naam: "koophuis",
        label: "Is dit een koophuis?",
        soort: "radio",
        opties: [
          { waarde: "ja", label: "Ja" },
          { waarde: "nee", label: "Nee, ik huur" },
        ],
        hint: "Bij een huurwoning is isoleren iets voor de verhuurder.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Validatie (Zod) per verticaal
// ---------------------------------------------------------------------------

const HUIDIG_JAAR = new Date().getFullYear();
const bouwjaarSchema = z.coerce.number().int().min(1500).max(HUIDIG_JAAR + 1);

export const VERTICAAL_SCHEMAS: Record<Verticaal, z.ZodTypeAny> = {
  zonnepanelen: z.object({
    dakOrientatie: z.enum(["zuid", "oost-west", "noord", "weet-niet"]),
    schaduw: z.enum(["geen", "beetje", "veel"]),
    koophuis: z.enum(["ja", "nee"]),
  }),
  warmtepomp: z.object({
    huidigeVerwarming: z.enum(["cv-ketel", "stadsverwarming", "hybride-warmtepomp", "volledig-elektrisch", "anders"]),
    isolatiegraad: z.enum(["goed", "gemiddeld", "matig", "weet-niet"]),
    bouwjaar: bouwjaarSchema,
  }),
  isolatie: z.object({
    delen: z.array(z.enum(["dak", "spouwmuur", "vloer", "glas"])).min(1),
    bouwjaar: bouwjaarSchema,
    koophuis: z.enum(["ja", "nee"]),
  }),
};
