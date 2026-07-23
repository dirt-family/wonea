/**
 * Gids-contentmodel: artikelen als getypeerde TS-data, geen MDX-dependency.
 *
 * De categorieen zijn DATA (GIDS_CATEGORIEEN), niet her en der herhaalde
 * strings: de definitieve categoriestructuur komt uit lopend deep-research en
 * moet de lijst kunnen herzien zonder refactor. Categorie toevoegen of
 * hernoemen = dit bestand plus de artikelen aanpassen; routes, hub, sitemap
 * en tests volgen de data vanzelf.
 *
 * Normbedragen-discipline: elk artikel draagt een `normbedragen`-blok met de
 * letterlijke getallen die het noemt. tests/gids.test.ts vergelijkt dat blok
 * met de constanten in lib/normen. Wijzigt een norm, dan faalt de test en
 * wordt het artikel herzien in plaats van stil te verouderen.
 */

export type GidsCategorieSlug = "hypotheek" | "kopen" | "verduurzamen" | "woningwaarde";

export type GidsCategorie = {
  slug: GidsCategorieSlug;
  naam: string;
  /** Een zin voor de hub en de categoriepagina. */
  beschrijving: string;
};

export const GIDS_CATEGORIEEN: readonly GidsCategorie[] = [
  {
    slug: "hypotheek",
    naam: "Hypotheek",
    beschrijving: "Hoe hypotheken werken: de leennormen, NHG en wat de regels voor jouw situatie betekenen.",
  },
  {
    slug: "kopen",
    naam: "Kopen",
    beschrijving: "Van bezichtiging tot overdracht: bieden, kosten koper en de stappen van het koopproces.",
  },
  {
    slug: "verduurzamen",
    naam: "Verduurzamen",
    beschrijving: "Isolatie, warmtepompen en subsidies: wat verduurzamen kost en wat het oplevert.",
  },
  {
    slug: "woningwaarde",
    naam: "Woningwaarde",
    beschrijving: "Wat je huis waard is en waarom: WOZ, taxaties en modelmatige schattingen.",
  },
] as const;

export type GidsBron = {
  naam: string;
  url: string;
  /** ISO-datum (YYYY-MM-DD) waarop wij de bron voor het laatst hebben gecontroleerd. */
  peildatum: string;
};

export type GidsFaqItem = {
  vraag: string;
  antwoord: string;
};

export type GidsSectie = {
  kop: string;
  paragrafen: string[];
  /** Optionele label-waarde-rijen (bedragen, grenzen) onder de paragrafen. */
  cijfers?: { label: string; waarde: string }[];
  /** Optionele FAQ-items; deze voeden ook de FAQPage-JSON-LD van het artikel. */
  faq?: GidsFaqItem[];
};

export type GidsRekenhulp = {
  /** Interne route van de rekenhulp, bijvoorbeeld "/budget". */
  href: string;
  label: string;
  /** Een zin die uitlegt wat de rekenhulp met dit artikel te maken heeft. */
  zin: string;
};

export type GidsArtikel = {
  /** URL-slug binnen de categorie: /gids/<categorie>/<slug>. */
  slug: string;
  titel: string;
  /** Meta-description en tegelijk de leadtekst onder de kop. */
  beschrijving: string;
  categorie: GidsCategorieSlug;
  leestijdMinuten: number;
  /** ISO-datums (YYYY-MM-DD). */
  gepubliceerd: string;
  bijgewerkt: string;
  bronnen: GidsBron[];
  rekenhulp: GidsRekenhulp;
  secties: GidsSectie[];
  /** Zie de kop van dit bestand: letterlijke getallen, bewaakt door tests/gids.test.ts. */
  normbedragen: Record<string, number>;
};

/**
 * Leestijd uit de echte tekst (ongeveer 200 woorden per minuut), zodat het
 * getal op de kaarten geen slag in de lucht is. Artikelen vullen hun
 * leestijdMinuten hiermee; de test bewaakt dat dat zo blijft.
 */
export function berekenLeestijdMinuten(secties: GidsSectie[]): number {
  const woorden = secties
    .flatMap((s) => [
      s.kop,
      ...s.paragrafen,
      ...(s.cijfers ?? []).flatMap((c) => [c.label, c.waarde]),
      ...(s.faq ?? []).flatMap((f) => [f.vraag, f.antwoord]),
    ])
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(woorden / 200));
}
