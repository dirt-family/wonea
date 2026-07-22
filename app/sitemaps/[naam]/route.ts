import { bouwAdressenShardXml, bouwStatischeShardXml, shardIndexen, telIndexeerbareAdressen } from "@/lib/seo/sitemap";

/**
 * Sitemap-shards:
 * - /sitemaps/statisch.xml: vaste pagina's.
 * - /sitemaps/adressen-<n>.xml: indexeerbare adrespagina's (gating + suppressie).
 * Onbekende of niet-bestaande shards geven 404. Opt-out adressen staan in
 * geen enkele shard (de query in lib/seo/sitemap.ts sluit ze uit).
 */

export const dynamic = "force-dynamic";

function xml(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ naam: string }> }): Promise<Response> {
  const { naam } = await params;

  if (naam === "statisch.xml") return xml(bouwStatischeShardXml());

  const match = naam.match(/^adressen-([1-9][0-9]*)\.xml$/);
  if (match) {
    const n = Number(match[1]);
    const bestaande = shardIndexen(telIndexeerbareAdressen());
    if (bestaande.includes(n)) return xml(bouwAdressenShardXml(n));
  }

  return new Response("Niet gevonden", { status: 404 });
}
