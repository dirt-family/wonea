import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * Tools-hub (/tools): de pagina is bewust indexeerbaar en hoort daarom in de
 * statische sitemap-shard. Deze test borgt die afspraak (een indexeerbare
 * pagina en opname in de sitemap horen bij elkaar, zie app/tools/page.tsx).
 */

let sitemap: typeof import("@/lib/seo/sitemap");

beforeAll(async () => {
  await maakTestDb();
  process.env.WONEA_BASE_URL = "http://localhost:4123";
  sitemap = await import("@/lib/seo/sitemap");
});

describe("tools-hub in de sitemap", () => {
  it("staat in de statische shard", () => {
    const statisch = sitemap.bouwStatischeShardXml();
    expect(statisch).toContain("<loc>http://localhost:4123/tools</loc>");
  });

  it("laat de statische shard verder met rust: geen adres-URL's", () => {
    const statisch = sitemap.bouwStatischeShardXml();
    expect(statisch).not.toContain("/woning/");
  });
});
