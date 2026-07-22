import type { addresses } from "@/db/schema";
import { baseUrl } from "@/lib/util";

/**
 * Schema.org JSON-LD builders (docs/PLAN.md, Fase 5).
 *
 * HARDE REGEL: NOOIT Product-, Offer- of price-markup op waardeschattingen.
 * Een modelmatige schatting is geen product met een prijs; prijs-markup op
 * schattingen is misleidend richting zoekmachines (rich results met een
 * "prijs" die geen prijs is) en richting mensen. Woningen krijgen alleen
 * SingleFamilyResidence/Apartment met feitelijke kenmerken (oppervlakte,
 * bouwjaar) als PropertyValue. Geen waarde, geen bandbreedte, geen euro's
 * in structured data. Wie dit wil veranderen: eerst docs/PLAN.md aanpassen.
 */

type JsonLd = Record<string, unknown>;

/**
 * Serialiseert JSON-LD veilig voor een inline <script>: "<" wordt ge-escapet
 * zodat data nooit uit de script-tag kan breken (bv. "</script>" in een veld).
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Props voor een <script>-tag met JSON-LD, te spreaden in JSX:
 * <script {...jsonLdScriptProps(organizationJsonLd())} />
 */
export function jsonLdScriptProps(data: JsonLd): {
  type: "application/ld+json";
  dangerouslySetInnerHTML: { __html: string };
} {
  return { type: "application/ld+json", dangerouslySetInnerHTML: { __html: serializeJsonLd(data) } };
}

/** Organization voor de root-layout. */
export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Wonea",
    url: baseUrl(),
    description:
      "Wonea toont de geschatte waarde van woningen met een eerlijke bandbreedte, de verkopen erachter en een uitgelegde methode.",
  };
}

/** WebSite voor de root-layout. */
export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Wonea",
    url: baseUrl(),
    inLanguage: "nl-NL",
  };
}

export type Kruimel = { naam: string; url?: string };

/** BreadcrumbList; alleen echte URL's meegeven (geen url = alleen naam). */
export function breadcrumbJsonLd(kruimels: Kruimel[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: kruimels.map((kruimel, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: kruimel.naam,
      ...(kruimel.url ? { item: kruimel.url } : {}),
    })),
  };
}

type AdresVoorJsonLd = Pick<
  typeof addresses.$inferSelect,
  "straat" | "huisnummer" | "toevoeging" | "nummerslug" | "postcode" | "plaats" | "bouwjaar" | "oppervlakteM2" | "woningtype"
>;

/**
 * Woning-markup voor de adrespagina: Apartment voor appartementen, anders
 * SingleFamilyResidence. Feitelijke kenmerken als PropertyValue; BEWUST
 * zonder prijs of waardeschatting (zie de harde regel bovenaan dit bestand).
 */
export function woningJsonLd(adres: AdresVoorJsonLd): JsonLd {
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  return {
    "@context": "https://schema.org",
    "@type": adres.woningtype === "appartement" ? "Apartment" : "SingleFamilyResidence",
    name: naam,
    url: `${baseUrl()}/woning/${adres.postcode}/${adres.nummerslug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: naam,
      postalCode: adres.postcode,
      addressLocality: adres.plaats,
      addressCountry: "NL",
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Woonoppervlakte", value: adres.oppervlakteM2, unitText: "m2" },
      { "@type": "PropertyValue", name: "Bouwjaar", value: adres.bouwjaar },
    ],
  };
}
