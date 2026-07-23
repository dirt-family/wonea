import { sql } from "@/lib/db";
import { baseUrl, todayIso } from "@/lib/util";
import { gidsSitemapEntries } from "@/lib/gids";
import { MIN_COMPARABLES_VOOR_INDEX } from "@/lib/seo/gating";

/**
 * Sitemap-opbouw: een sitemap-INDEX op /sitemap.xml die shards opsomt, plus
 * de shards zelf onder /sitemaps/.
 *
 * - /sitemaps/statisch.xml: de vaste pagina's.
 * - /sitemaps/adressen-<n>.xml: indexeerbare adrespagina's, max
 *   MAX_ADRESSEN_PER_SHARD per shard (ruim onder de 50k-protocolgrens).
 *
 * In de adres-shards staan UITSLUITEND adressen die door de volledige gating
 * komen: gebiedswhitelist EN datadiepte EN niet gesupprimeerd. Een
 * noindex-pagina hoort nooit in een sitemap, en een opted-out adres komt in
 * geen enkele sitemap voor (merkbelofte; getest in tests/gating.test.ts).
 *
 * De WHERE-clause hieronder is de SQL-spiegel van isAdresIndexeerbaar in
 * lib/seo/gating.ts en van de comparables-selectie in lib/comparables.ts
 * (zelfde buurt, zelfde woningtype, oppervlakte 0,7x-1,4x, laatste 24
 * maanden). Wijzigt een van die twee, wijzig dan ook deze query.
 */

export const MAX_ADRESSEN_PER_SHARD = 45000;

/**
 * Vaste pagina's in /sitemaps/statisch.xml. Alleen indexeerbare pagina's.
 * De gids-URL's (hub, categorieen met artikelen, artikelen) komen erbij via
 * gidsSitemapEntries() in lib/gids: die volgen de artikeldata en dragen hun
 * eigen lastmod (de bijgewerkt-datum van het artikel).
 */
const STATISCHE_PADEN = ["/", "/methode", "/over-ons", "/woz-check", "/privacy", "/tools", "/hypotheek-rentes", "/makelaars", "/budget", "/kosten-koper", "/overbieden"];

// Spiegel van lib/comparables.ts (MAANDEN_TERUG = 24).
function comparablesCutoff(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 24);
  return d.toISOString().slice(0, 10);
}

// Gedeelde WHERE voor tellen en pagineren: actief, niet gesupprimeerd,
// gebied op de whitelist, en voldoende datadiepte. Postgres-boolean:
// index_gating.indexeerbaar = true (was = 1 in SQLite).
function indexeerbaarWhere(cutoff: string, minComps: number) {
  return sql`
    a.status = 'actief'
    AND NOT EXISTS (
      SELECT 1 FROM optouts o
      WHERE o.postcode = a.postcode AND o.nummerslug = a.nummerslug AND o.bevestigd_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM index_gating g
      WHERE g.indexeerbaar = true
        AND (
          (g.scope = 'buurt' AND g.code = a.buurt_code)
          OR (g.scope = 'postcode4' AND g.code = substr(a.postcode, 1, 4))
        )
    )
    AND (
      (
        SELECT count(*) FROM sales s
        WHERE s.buurt_code = a.buurt_code
          AND s.datum >= ${cutoff}
          AND s.woningtype = a.woningtype
          AND s.oppervlakte_m2 >= a.oppervlakte_m2 * 0.7
          AND s.oppervlakte_m2 <= a.oppervlakte_m2 * 1.4
      ) >= ${minComps}
      OR EXISTS (SELECT 1 FROM woz_values w WHERE w.adres_id = a.id AND w.bron = 'eigenaar')
      OR (a.energielabel IS NOT NULL AND a.energielabel_bron = 'echt')
    )
  `;
}

/** Aantal adressen dat door de volledige gating komt (voedt het aantal shards). */
export async function telIndexeerbareAdressen(): Promise<number> {
  const rijen = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM addresses a WHERE ${indexeerbaarWhere(comparablesCutoff(), MIN_COMPARABLES_VOOR_INDEX)}`;
  return rijen[0].n;
}

type ShardRij = { postcode: string; nummerslug: string; laatste_valuation: string | null };

/** Adressen voor shard n (1-based), stabiel gesorteerd op id. */
async function indexeerbareAdressenShard(n: number, perShard: number): Promise<ShardRij[]> {
  const rijen = await sql<ShardRij[]>`
    SELECT a.postcode, a.nummerslug,
      (SELECT max(v.datum) FROM valuations v WHERE v.adres_id = a.id) AS laatste_valuation
    FROM addresses a
    WHERE ${indexeerbaarWhere(comparablesCutoff(), MIN_COMPARABLES_VOOR_INDEX)}
    ORDER BY a.id
    LIMIT ${perShard} OFFSET ${(n - 1) * perShard}`;
  return rijen;
}

/** Shardnummers (1-based) voor een totaal: 0 -> [], 45001 -> [1, 2]. */
export function shardIndexen(totaal: number, perShard = MAX_ADRESSEN_PER_SHARD): number[] {
  const aantal = Math.ceil(Math.max(0, totaal) / perShard);
  return Array.from({ length: aantal }, (_, i) => i + 1);
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod: string): string {
  return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(lastmod)}</lastmod></url>`;
}

/** De sitemap-index op /sitemap.xml: somt de shards op. */
export async function bouwSitemapIndexXml(): Promise<string> {
  const base = baseUrl();
  const shards = ["statisch.xml", ...shardIndexen(await telIndexeerbareAdressen()).map((n) => `adressen-${n}.xml`)];
  const regels = shards.map((naam) => `  <sitemap><loc>${escapeXml(`${base}/sitemaps/${naam}`)}</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${regels.join("\n")}\n</sitemapindex>\n`;
}

/** Shard met de vaste pagina's, inclusief de gids-URL's uit lib/gids. */
export function bouwStatischeShardXml(): string {
  const base = baseUrl();
  const vandaag = todayIso();
  const regels = [
    ...STATISCHE_PADEN.map((pad) => urlEntry(pad === "/" ? `${base}/` : `${base}${pad}`, vandaag)),
    ...gidsSitemapEntries().map((entry) => urlEntry(`${base}${entry.pad}`, entry.lastmod)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${regels.join("\n")}\n</urlset>\n`;
}

/**
 * Adres-shard n. lastmod = datum van de laatste valuation van het adres,
 * of vandaag als er nog geen valuation is.
 */
export async function bouwAdressenShardXml(n: number, perShard = MAX_ADRESSEN_PER_SHARD): Promise<string> {
  const base = baseUrl();
  const vandaag = todayIso();
  const rijen = await indexeerbareAdressenShard(n, perShard);
  const regels = rijen.map((a) => urlEntry(`${base}/woning/${a.postcode}/${a.nummerslug}`, a.laatste_valuation ?? vandaag));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${regels.join("\n")}\n</urlset>\n`;
}
