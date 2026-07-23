import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/util";

/**
 * /robots.txt: admin, dev en api zijn nooit voor crawlers. Welke pagina's de
 * index in mogen beslist de indexatie-gating per pagina (lib/seo/gating.ts);
 * robots.txt blokkeert alleen wat sowieso niet gecrawld hoort te worden.
 *
 * Uitzondering: /api/og blijft toegankelijk. De rapportpagina's zetten hun
 * og:image op /api/og?token=...; Twitterbot respecteert robots.txt en zou
 * zonder deze allow-regel geen kaartafbeelding tonen bij gedeelde rapporten
 * op X. Allow wint hier van de /api-disallow omdat de match langer is.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/api/og", disallow: ["/admin", "/dev", "/api"] }],
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
