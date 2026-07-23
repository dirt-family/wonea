import { baseUrl } from "@/lib/util";
import type { GidsArtikel } from "@/lib/gids/model";

/**
 * JSON-LD voor gidsartikelen.
 *
 * HARDE REGEL (dezelfde als in lib/seo/jsonld.ts): NOOIT prijzen, Product of
 * Offer in structured data. Een artikel noemt normbedragen in de lopende
 * tekst; dat zijn wettelijke grenzen en subsidiebedragen, geen aanbiedingen,
 * en ze horen niet in de markup. tests/gids.test.ts bewaakt dit.
 */

type JsonLd = Record<string, unknown>;

export function artikelUrl(artikel: GidsArtikel): string {
  return `${baseUrl()}/gids/${artikel.categorie}/${artikel.slug}`;
}

/** Article-markup: feitelijke metadata, geen bedragen. */
export function artikelJsonLd(artikel: GidsArtikel): JsonLd {
  const url = artikelUrl(artikel);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: artikel.titel,
    description: artikel.beschrijving,
    inLanguage: "nl-NL",
    datePublished: artikel.gepubliceerd,
    dateModified: artikel.bijgewerkt,
    mainEntityOfPage: url,
    url,
    author: { "@type": "Organization", name: "Wonea", url: baseUrl() },
    publisher: { "@type": "Organization", name: "Wonea", url: baseUrl() },
  };
}

/** FAQPage-markup, ALLEEN als het artikel echte FAQ-items heeft; anders null. */
export function faqJsonLd(artikel: GidsArtikel): JsonLd | null {
  const items = artikel.secties.flatMap((s) => s.faq ?? []);
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.vraag,
      acceptedAnswer: { "@type": "Answer", text: item.antwoord },
    })),
  };
}
