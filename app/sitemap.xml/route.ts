import { bouwSitemapIndexXml } from "@/lib/seo/sitemap";

/**
 * Sitemap-INDEX: somt de shards op (/sitemaps/statisch.xml en
 * /sitemaps/adressen-<n>.xml). Het aantal adres-shards volgt uit een
 * count-query van indexeerbare adressen (whitelist + datadiepte + niet
 * gesupprimeerd); zie lib/seo/sitemap.ts.
 */

// Leest uit de database bij elke aanvraag; caching regelt de Cache-Control-header.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return new Response(bouwSitemapIndexXml(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
