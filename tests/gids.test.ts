import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";
import {
  GIDS_ARTIKELEN,
  GIDS_CATEGORIEEN,
  artikelenInCategorie,
  berekenLeestijdMinuten,
  categorieenMetArtikelen,
  gidsSitemapEntries,
  vindArtikel,
} from "@/lib/gids";
import { artikelJsonLd, faqJsonLd } from "@/lib/gids/jsonld";
import {
  AFM_TOETSRENTE_KORTER_DAN_10JR,
  ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING,
  NHG_GRENS_2026,
  NHG_GRENS_EBV_2026,
  NHG_PROVISIE_PCT,
  VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING,
  vindFinancieringslastPct,
} from "@/lib/normen/leennormen-2026";
import {
  berekenIsolatieSubsidie,
  ISDE_GLAS,
  ISDE_ISOLATIE,
  ISDE_WARMTEPOMP_MINIMUM_EUR,
  ISDE_WARMTEPOMPEN,
  ISDE_ZONNEBOILERS,
  type IsolatieMaatregelKey,
} from "@/lib/normen/isde-2026";

/**
 * Gids-fundament: contentmodel-validatie, slug-uniciteit, sitemap-afspraak
 * en de normbedragen-koppeling. Die laatste is de kern: elk artikel draagt de
 * getallen die het noemt als letterlijk normbedragen-blok, en hier vergelijken
 * we dat blok met de constanten uit lib/normen. Wijzigt een norm, dan faalt
 * deze test en wordt het artikel herzien in plaats van stil te verouderen.
 */

// Sitemap-module pas laden na maakTestDb (importeert lib/db, zoals tools-hub.test.ts).
let sitemap: typeof import("@/lib/seo/sitemap");

beforeAll(async () => {
  await maakTestDb();
  process.env.WONEA_BASE_URL = "http://localhost:4123";
  sitemap = await import("@/lib/seo/sitemap");
});

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

describe("contentmodel", () => {
  it("er zijn artikelen", () => {
    expect(GIDS_ARTIKELEN.length).toBeGreaterThanOrEqual(3);
  });

  it("elk artikel heeft minstens een echte bron met naam, url en ISO-peildatum", () => {
    for (const artikel of GIDS_ARTIKELEN) {
      expect(artikel.bronnen.length, artikel.slug).toBeGreaterThanOrEqual(1);
      for (const bron of artikel.bronnen) {
        expect(bron.naam.length, artikel.slug).toBeGreaterThan(0);
        expect(bron.url, artikel.slug).toMatch(/^https:\/\//);
        expect(bron.peildatum, artikel.slug).toMatch(ISO_DATUM);
      }
    }
  });

  it("elke artikelcategorie bestaat in GIDS_CATEGORIEEN", () => {
    const slugs = new Set(GIDS_CATEGORIEEN.map((c) => c.slug));
    for (const artikel of GIDS_ARTIKELEN) {
      expect(slugs.has(artikel.categorie), `${artikel.slug}: categorie ${artikel.categorie}`).toBe(true);
    }
  });

  it("elke gekoppelde rekenhulp-route bestaat echt in app/", () => {
    for (const artikel of GIDS_ARTIKELEN) {
      expect(artikel.rekenhulp.href, artikel.slug).toMatch(/^\/[a-z-]+$/);
      const pagina = join(process.cwd(), "app", artikel.rekenhulp.href.slice(1), "page.tsx");
      expect(existsSync(pagina), `${artikel.slug}: ${pagina} ontbreekt`).toBe(true);
      expect(artikel.rekenhulp.label.length, artikel.slug).toBeGreaterThan(0);
      expect(artikel.rekenhulp.zin.length, artikel.slug).toBeGreaterThan(0);
    }
  });

  it("datums zijn ISO en bijgewerkt is niet ouder dan gepubliceerd", () => {
    for (const artikel of GIDS_ARTIKELEN) {
      expect(artikel.gepubliceerd, artikel.slug).toMatch(ISO_DATUM);
      expect(artikel.bijgewerkt, artikel.slug).toMatch(ISO_DATUM);
      expect(artikel.bijgewerkt >= artikel.gepubliceerd, artikel.slug).toBe(true);
    }
  });

  it("de leestijd op de kaarten volgt uit de echte tekst", () => {
    for (const artikel of GIDS_ARTIKELEN) {
      expect(artikel.leestijdMinuten, artikel.slug).toBe(berekenLeestijdMinuten(artikel.secties));
    }
  });

  it("slugs zijn uniek", () => {
    const slugs = GIDS_ARTIKELEN.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("artikelenInCategorie en vindArtikel sluiten op elkaar aan", () => {
    for (const artikel of GIDS_ARTIKELEN) {
      expect(artikelenInCategorie(artikel.categorie)).toContain(artikel);
      expect(vindArtikel(artikel.categorie, artikel.slug)).toBe(artikel);
      // Verkeerde categorie in de URL mag het artikel niet vinden.
      expect(vindArtikel("kopen" === artikel.categorie ? "hypotheek" : "kopen", artikel.slug)).toBeUndefined();
    }
  });
});

describe("normbedragen blijven gelijk aan lib/normen", () => {
  it("maximale-hypotheek-2026 noemt exact de bedragen uit de leennormen", () => {
    const artikel = vindArtikel("hypotheek", "maximale-hypotheek-2026");
    expect(artikel).toBeDefined();
    expect(artikel?.normbedragen).toEqual({
      buitenBeschouwingEFG: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.EFG,
      buitenBeschouwingCD: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.CD,
      buitenBeschouwingAB: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.AB,
      buitenBeschouwingAPlusAPlusPlus: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.APlus_APlusPlus,
      buitenBeschouwingA3Plus: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.A3Plus,
      buitenBeschouwingA4Plus: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.A4Plus,
      buitenBeschouwingA4PlusGarantie: ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING.A4PlusGarantie,
      verduurzamingEFG: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.EFG,
      verduurzamingCD: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.CD,
      verduurzamingAB: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.AB,
      verduurzamingAPlusAPlusPlus: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.APlus_APlusPlus,
      verduurzamingA3PlusEnBeter: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.A3PlusEnBeter,
      afmToetsrentePct: AFM_TOETSRENTE_KORTER_DAN_10JR,
      voorbeeldPctInkomen60000Rente4: vindFinancieringslastPct("totAow", 60000, 4.0),
    });
  });

  it("nhg-2026 noemt exact de NHG-bedragen, inclusief de afgeleiden", () => {
    const artikel = vindArtikel("hypotheek", "nhg-2026");
    expect(artikel).toBeDefined();
    expect(artikel?.normbedragen).toEqual({
      kostengrens: NHG_GRENS_2026,
      kostengrensEbv: NHG_GRENS_EBV_2026,
      provisiePct: NHG_PROVISIE_PCT,
      extraRuimteEbv: NHG_GRENS_EBV_2026 - NHG_GRENS_2026,
      provisieVoorbeeldBijGrens: Math.round((NHG_GRENS_2026 * NHG_PROVISIE_PCT) / 100),
    });
  });

  it("isde-subsidie-2026 noemt exact de ISDE-bedragen", () => {
    const artikel = vindArtikel("verduurzamen", "isde-subsidie-2026");
    expect(artikel).toBeDefined();

    const iso = (key: IsolatieMaatregelKey) => {
      const m = ISDE_ISOLATIE.find((x) => x.key === key);
      if (!m) throw new Error(`test: onbekende isolatiemaatregel ${key}`);
      return m;
    };
    const wp = (categorie: string) => {
      const w = ISDE_WARMTEPOMPEN.find((x) => x.categorie === categorie);
      if (!w) throw new Error(`test: onbekende warmtepompcategorie ${categorie}`);
      return w;
    };
    const glas = (key: string) => {
      const t = ISDE_GLAS.tarieven.find((x) => x.key === key);
      if (!t) throw new Error(`test: onbekend glastarief ${key}`);
      return t;
    };
    const isolatieVerwacht = Object.fromEntries(
      (["dakisolatie", "zoldervloerisolatie", "gevelisolatie", "spouwmuurisolatie", "vloerisolatie", "bodemisolatie"] as const).flatMap(
        (key) => {
          const m = iso(key);
          return [
            [`${key}EurPerM2`, m.eurPerM2],
            [`${key}MinM2`, m.minM2],
            [`${key}MaxM2`, m.maxM2],
            [`${key}BiobasedBonus`, m.biobasedBonusEurPerM2],
          ];
        },
      ),
    );

    expect(artikel?.normbedragen).toEqual({
      ...isolatieVerwacht,
      glasMinM2Totaal: ISDE_GLAS.minM2Totaal,
      glasMaxM2Totaal: ISDE_GLAS.maxM2Totaal,
      hrppGlasEurPerM2: glas("hrpp_glas").eurPerM2,
      tripleNieuwKozijnEurPerM2: glas("triple_nieuw_kozijn").eurPerM2,
      paneelEurPerM2: glas("paneel").eurPerM2,
      paneelNieuwKozijnEurPerM2: glas("paneel_nieuw_kozijn").eurPerM2,
      deurEurPerM2: glas("deur").eurPerM2,
      deurNieuwKozijnEurPerM2: glas("deur_nieuw_kozijn").eurPerM2,
      warmtepompMinimumEur: ISDE_WARMTEPOMP_MINIMUM_EUR,
      luchtWaterMediaanEur: wp("Lucht-Water").mediaanEur,
      luchtWaterMinEur: wp("Lucht-Water").minEur,
      luchtWaterMaxEur: wp("Lucht-Water").maxEur,
      grondWaterMediaanEur: wp("Grond-Water").mediaanEur,
      waterWaterMediaanEur: wp("Water-Water").mediaanEur,
      warmtepompboilerMediaanEur: wp("Warmtepompboiler").mediaanEur,
      zonneboilerKleinMediaanEur: ISDE_ZONNEBOILERS[0].mediaanEur,
      zonneboilerGrootMediaanEur: ISDE_ZONNEBOILERS[1].mediaanEur,
      voorbeeldDak100M2Los: berekenIsolatieSubsidie("dakisolatie", 100, false),
      voorbeeldDak100M2MetTweedeMaatregel: berekenIsolatieSubsidie("dakisolatie", 100, true),
    });
  });
});

describe("structured data", () => {
  it("Article-JSON-LD bevat nooit prijzen of Offer-markup", () => {
    for (const artikel of GIDS_ARTIKELEN) {
      const json = JSON.stringify(artikelJsonLd(artikel));
      expect(json, artikel.slug).not.toMatch(/offer|price/i);
      expect(json, artikel.slug).toContain('"@type":"Article"');
    }
  });

  it("FAQPage-JSON-LD bestaat alleen bij echte FAQ-items", () => {
    for (const artikel of GIDS_ARTIKELEN) {
      const items = artikel.secties.flatMap((s) => s.faq ?? []);
      const faq = faqJsonLd(artikel);
      if (items.length === 0) {
        expect(faq, artikel.slug).toBeNull();
      } else {
        expect(faq, artikel.slug).not.toBeNull();
        expect((faq as { mainEntity: unknown[] }).mainEntity).toHaveLength(items.length);
      }
    }
    // Het null-pad expliciet: een artikel zonder FAQ-secties geeft null.
    const [eerste] = GIDS_ARTIKELEN;
    expect(faqJsonLd({ ...eerste, secties: [{ kop: "x", paragrafen: ["y"] }] })).toBeNull();
  });
});

describe("gids in de sitemap", () => {
  it("hub, categorieen met artikelen en artikelen staan in de statische shard", () => {
    const statisch = sitemap.bouwStatischeShardXml();
    expect(statisch).toContain("<loc>http://localhost:4123/gids</loc>");
    for (const { categorie } of categorieenMetArtikelen()) {
      expect(statisch).toContain(`<loc>http://localhost:4123/gids/${categorie.slug}</loc>`);
    }
    for (const artikel of GIDS_ARTIKELEN) {
      expect(statisch).toContain(`<loc>http://localhost:4123/gids/${artikel.categorie}/${artikel.slug}</loc>`);
    }
  });

  it("lege categorieen (noindex) staan NIET in de sitemap", () => {
    const statisch = sitemap.bouwStatischeShardXml();
    for (const categorie of GIDS_CATEGORIEEN) {
      if (artikelenInCategorie(categorie.slug).length === 0) {
        expect(statisch).not.toContain(`<loc>http://localhost:4123/gids/${categorie.slug}</loc>`);
      }
    }
  });

  it("artikel-URL's dragen hun bijgewerkt-datum als lastmod", () => {
    const entries = gidsSitemapEntries();
    for (const artikel of GIDS_ARTIKELEN) {
      const entry = entries.find((e) => e.pad === `/gids/${artikel.categorie}/${artikel.slug}`);
      expect(entry?.lastmod, artikel.slug).toBe(artikel.bijgewerkt);
    }
  });
});
