import type { Metadata } from "next";
import Link from "next/link";
import { GIDS_CATEGORIEEN, artikelenInCategorie } from "@/lib/gids";
import { breadcrumbJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { baseUrl } from "@/lib/util";
import { ArtikelKaart } from "@/app/gids/artikel-kaart";
import { GeplandeOnderwerpen } from "@/app/gids/gepland";
import { Kruimelpad } from "@/app/gids/kruimelpad";

export const metadata: Metadata = {
  title: "Woongids: uitleg over kopen, lenen en verduurzamen",
  description:
    "Artikelen in gewone taal over de leennormen, NHG, subsidies en meer. Gebaseerd op officiële bronnen met peildatum, met de rekenhulp erbij.",
  alternates: { canonical: "/gids" },
  // Bewust indexeerbaar: statische uitlegpagina's zonder adresdata. De hub
  // staat daarom ook in /sitemaps/statisch.xml via gidsSitemapEntries()
  // (lib/gids); indexeren en opnemen in de sitemap horen bij elkaar.
  robots: { index: true, follow: true },
};

/**
 * Gids-hub: intro, daarna ALLE zes categorieen in klantreis-volgorde
 * (lib/gids/model.ts). Categorieen met artikelen tonen artikelkaarten;
 * categorieen zonder artikelen tonen hun doel, de geplande onderwerpen
 * (tekst, bewust zonder links: klikbaar wordt pas wat af is) en de vaste
 * rekenhulpen. Zo staat de volledige structuur van de gids er vanaf dag een,
 * eerlijk over wat er al is en wat er komt.
 */
export default function GidsPagina() {
  const blokken = GIDS_CATEGORIEEN.map((categorie) => ({ categorie, artikelen: artikelenInCategorie(categorie.slug) }));

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <script
        {...jsonLdScriptProps(breadcrumbJsonLd([{ naam: "Home", url: `${baseUrl()}/` }, { naam: "Woongids" }]))}
      />
      <Kruimelpad items={[{ naam: "Home", href: "/" }, { naam: "Woongids" }]} />

      <div className="mt-6 max-w-2xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">Woongids</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Uitleg in gewone taal over kopen, bieden, lenen, waarde, verkopen en verduurzamen. Elk artikel is gebaseerd
          op officiële bronnen, met de peildatum erbij, en eindigt bij de rekenhulp waarmee je het voor jouw situatie
          doorrekent. De gids is in opbouw; per onderwerp zie je wat er al staat en wat eraan komt.
        </p>
      </div>

      <div className="mt-12 space-y-12">
        {blokken.map(({ categorie, artikelen }) => (
          <section key={categorie.slug}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-semibold">
                <Link href={`/gids/${categorie.slug}`} className="transition-colors hover:text-merk-licht">
                  {categorie.naam}
                </Link>
              </h2>
              {artikelen.length > 0 ? (
                <Link href={`/gids/${categorie.slug}`} className="text-sm font-medium text-merk hover:underline">
                  Alles over {categorie.naam.toLowerCase()}
                </Link>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-inkt-zacht">{categorie.beschrijving}</p>

            {artikelen.length > 0 ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {artikelen.map((artikel) => (
                  <ArtikelKaart key={artikel.slug} artikel={artikel} />
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <GeplandeOnderwerpen onderwerpen={categorie.geplandeOnderwerpen} />
              </div>
            )}

            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {categorie.rekenhulpen.map((rekenhulp) => (
                <Link
                  key={rekenhulp.href}
                  href={rekenhulp.href}
                  className="font-semibold text-merk underline underline-offset-4 transition-colors hover:text-merk-licht"
                >
                  {rekenhulp.label}
                </Link>
              ))}
            </p>
          </section>
        ))}
      </div>

      {/* Slot-dramaturgie (huisstijl v3): de ene donkere navy band van deze
          pagina (radius-band 20), met de amber knop. Zelfde vorm als CtaBand
          in ui.tsx; hier met de hand omdat CtaBand's witte kop nu nog verliest
          van de ongelaagde h1-h3-regel in globals.css (gemeld; na die fix kan
          dit terug naar <CtaBand />). */}
      <div className="mt-12 rounded-[20px] bg-merk-900 px-7 py-10 sm:px-10">
        {/* Wit via het paneel-token (geen losse hex); inline omdat de
            ongelaagde h1-h3-regel in globals.css van text-white wint. */}
        <h2 className="font-display text-2xl font-semibold sm:text-3xl" style={{ color: "var(--color-paneel)" }}>
          Liever meteen rekenen?
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-merk-200">
          Alle rekenhulpen uit de gids staan bij elkaar: woningwaarde, budget, WOZ-check, verduurzamen en meer. Gratis
          en zonder account.
        </p>
        <div className="mt-6">
          <Link
            href="/tools"
            className="inline-flex items-center justify-center rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-merk-900 transition-colors hover:bg-accent-400 focus:outline-2 focus:outline-offset-2 focus:outline-accent-300"
          >
            Bekijk alle rekenhulpen
          </Link>
        </div>
      </div>
    </div>
  );
}
