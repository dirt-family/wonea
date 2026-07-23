import { GIDS_CATEGORIEEN, type GidsArtikel, type GidsCategorie, type GidsCategorieSlug } from "@/lib/gids/model";
import { ARTIKEL_MAXIMALE_HYPOTHEEK } from "@/lib/gids/artikelen/maximale-hypotheek-2026";
import { ARTIKEL_NHG } from "@/lib/gids/artikelen/nhg-2026";
import { ARTIKEL_ISDE } from "@/lib/gids/artikelen/isde-subsidie-2026";

/**
 * Alle gids-artikelen op een plek. Nieuw artikel = een bestand in
 * lib/gids/artikelen/ plus een regel hier; hub, categoriepagina's, sitemap en
 * tests volgen de data. Volgorde = toonvolgorde binnen een categorie.
 */
export const GIDS_ARTIKELEN: readonly GidsArtikel[] = [ARTIKEL_MAXIMALE_HYPOTHEEK, ARTIKEL_NHG, ARTIKEL_ISDE];

export { GIDS_CATEGORIEEN, berekenLeestijdMinuten } from "@/lib/gids/model";
export type { GidsArtikel, GidsBron, GidsCategorie, GidsCategorieSlug, GidsFaqItem, GidsRekenhulp, GidsSectie } from "@/lib/gids/model";

export function vindCategorie(slug: string): GidsCategorie | undefined {
  return GIDS_CATEGORIEEN.find((c) => c.slug === slug);
}

export function artikelenInCategorie(slug: GidsCategorieSlug): GidsArtikel[] {
  return GIDS_ARTIKELEN.filter((a) => a.categorie === slug);
}

/** Artikel op categorie + slug; undefined als de combinatie niet bestaat. */
export function vindArtikel(categorie: string, slug: string): GidsArtikel | undefined {
  return GIDS_ARTIKELEN.find((a) => a.categorie === categorie && a.slug === slug);
}

/** Categorieen die minstens een artikel hebben, met hun artikelen (hub-volgorde). */
export function categorieenMetArtikelen(): { categorie: GidsCategorie; artikelen: GidsArtikel[] }[] {
  return GIDS_CATEGORIEEN.map((categorie) => ({ categorie, artikelen: artikelenInCategorie(categorie.slug) })).filter(
    (blok) => blok.artikelen.length > 0,
  );
}

/** Categorieen zonder artikelen (op de hub genoemd als "volgt", zonder link). */
export function categorieenZonderArtikelen(): GidsCategorie[] {
  return GIDS_CATEGORIEEN.filter((c) => artikelenInCategorie(c.slug).length === 0);
}

function maxBijgewerkt(artikelen: GidsArtikel[]): string {
  return artikelen.map((a) => a.bijgewerkt).sort().at(-1) as string;
}

/**
 * Gids-URL's voor de statische sitemap-shard (lib/seo/sitemap.ts): de hub,
 * categoriepagina's MET artikelen en de artikelen zelf. Lege categorieen
 * staan noindex en horen dus niet in de sitemap (zelfde afspraak als bij
 * /tools: indexeren en sitemap-opname horen bij elkaar).
 */
export function gidsSitemapEntries(): { pad: string; lastmod: string }[] {
  const blokken = categorieenMetArtikelen();
  return [
    { pad: "/gids", lastmod: maxBijgewerkt([...GIDS_ARTIKELEN]) },
    ...blokken.map((blok) => ({ pad: `/gids/${blok.categorie.slug}`, lastmod: maxBijgewerkt(blok.artikelen) })),
    ...GIDS_ARTIKELEN.map((a) => ({ pad: `/gids/${a.categorie}/${a.slug}`, lastmod: a.bijgewerkt })),
  ];
}
