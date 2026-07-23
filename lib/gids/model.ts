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

export type GidsCategorieSlug = "kopen" | "bieden" | "hypotheek" | "woningwaarde" | "verkopen" | "verduurzamen";

export type GidsCategorie = {
  slug: GidsCategorieSlug;
  naam: string;
  /** Een zin voor de hub en de categoriepagina. */
  beschrijving: string;
  /** De vaste rekenhulp-koppelingen van deze categorie (docs/GIDS-STRATEGIE.md). */
  rekenhulpen: { href: string; label: string }[];
  /**
   * Geplande onderwerpen uit de artikel-backlog (docs/GIDS-STRATEGIE.md),
   * getoond op de hub zolang de categorie nog geen of weinig artikelen heeft.
   * Puur tekst, geen links: een onderwerp wordt pas klikbaar als het artikel af is.
   */
  geplandeOnderwerpen: string[];
};

/**
 * De zes categorieen volgen de klantreis (funda-les uit de research):
 * kopen -> bieden -> hypotheek -> woningwaarde en WOZ -> verkopen ->
 * verduurzamen. Volgorde hier = toonvolgorde op de hub.
 */
export const GIDS_CATEGORIEEN: readonly GidsCategorie[] = [
  {
    slug: "kopen",
    naam: "Kopen",
    beschrijving: "Van orienteren tot sleutel: het koopproces, kosten koper en waar starters op letten.",
    rekenhulpen: [
      { href: "/hypotheek-berekenen", label: "Hypotheek berekenen" },
      { href: "/kosten-koper", label: "Kosten koper" },
      { href: "/budget", label: "Budgetberekenaar" },
    ],
    geplandeOnderwerpen: [
      "Kosten koper in 2026: waar dat geld heen gaat",
      "Overdrachtsbelasting en de startersvrijstelling",
      "Huis kopen: het stappenplan van zoeken tot sleutel",
      "Je eerste huis kopen: waar starters op letten",
      "Aankoopmakelaar: wat doet die en wat heb je eraan",
    ],
  },
  {
    slug: "bieden",
    naam: "Bieden",
    beschrijving: "Een bod bepalen zonder schijnzekerheid: overbieden, taxatie en de voorbehouden die je beschermen.",
    rekenhulpen: [
      { href: "/overbieden", label: "Overbieden doorrekenen" },
      { href: "/vergelijken", label: "Woningen vergelijken" },
    ],
    geplandeOnderwerpen: [
      "Hoeveel overbieden? Eerlijk over wat we weten",
      "Een bod uitbrengen: zo werkt het",
      "Biedlogica in een krappe markt",
    ],
  },
  {
    slug: "hypotheek",
    naam: "Hypotheek",
    beschrijving: "Hoe hypotheken werken: de leennormen, NHG en wat de regels voor jouw situatie betekenen.",
    rekenhulpen: [
      { href: "/hypotheek-berekenen", label: "Hypotheek berekenen" },
      { href: "/hypotheek-rentes", label: "Actuele hypotheekrentes" },
    ],
    geplandeOnderwerpen: [
      "Energielabel en je hypotheek: de bedragen van 2026",
      "Hypotheekrente vergelijken: zo lees je de cijfers",
      "Oversluiten: wanneer is het zinvol",
    ],
  },
  {
    slug: "woningwaarde",
    naam: "Woningwaarde en WOZ",
    beschrijving: "Wat je huis waard is en waarom: WOZ, taxaties en modelmatige schattingen.",
    rekenhulpen: [
      { href: "/", label: "Woningwaarde-check" },
      { href: "/woz-check", label: "WOZ-check" },
    ],
    geplandeOnderwerpen: [
      "Wat is mijn huis waard? Zo werkt een schatting",
      "WOZ-waarde 2026: wat het is en wat je ermee kunt",
      "WOZ-bezwaar: gratis via je gemeente",
      "Taxatie, WOZ of modelwaarde: drie getallen, drie doelen",
    ],
  },
  {
    slug: "verkopen",
    naam: "Verkopen",
    beschrijving: "Je huis verkopen: het stappenplan, de kosten en de makelaarskeuze.",
    rekenhulpen: [
      { href: "/verkopen", label: "Verkoopbegeleiding" },
      { href: "/makelaars", label: "Vind een makelaar" },
    ],
    geplandeOnderwerpen: [
      "Huis verkopen: het stappenplan",
      "Wat kost je huis verkopen?",
    ],
  },
  {
    slug: "verduurzamen",
    naam: "Verduurzamen",
    beschrijving: "Isolatie, warmtepompen en subsidies: wat verduurzamen kost en wat het oplevert.",
    rekenhulpen: [{ href: "/verduurzamen", label: "Verduurzamingscheck" }],
    geplandeOnderwerpen: [
      "Spouwmuurisolatie: kosten, besparing en subsidie",
      "Warmtepomp in 2026: subsidie en terugverdientijd",
      "Energielabel verbeteren stap voor stap",
    ],
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
