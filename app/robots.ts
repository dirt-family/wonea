import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/util";

/**
 * /robots.txt: admin, dev en api zijn nooit voor crawlers. Welke pagina's de
 * index in mogen beslist de indexatie-gating per pagina (lib/seo/gating.ts);
 * robots.txt blokkeert alleen wat sowieso niet gecrawld hoort te worden.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/admin", "/dev", "/api"] }],
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
