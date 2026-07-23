import type { Metadata } from "next";
import Link from "next/link";
import { categorieenMetArtikelen, categorieenZonderArtikelen } from "@/lib/gids";
import { breadcrumbJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { baseUrl } from "@/lib/util";
import { ArtikelKaart } from "@/app/gids/artikel-kaart";
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
 * Gids-hub: intro, daarna per categorie (alleen die met artikelen) een blok
 * met artikelkaarten. Lege categorieen worden eerlijk als "volgt" genoemd,
 * zonder link. De categoriestructuur is data (lib/gids/model.ts) en kan door
 * de research-uitkomst worden herzien zonder dat deze pagina wijzigt.
 */
export default function GidsPagina() {
  const blokken = categorieenMetArtikelen();
  const komtNog = categorieenZonderArtikelen();

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <script
        {...jsonLdScriptProps(breadcrumbJsonLd([{ naam: "Home", url: `${baseUrl()}/` }, { naam: "Woongids" }]))}
      />
      <Kruimelpad items={[{ naam: "Home", href: "/" }, { naam: "Woongids" }]} />

      <div className="mt-6 max-w-2xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">Woongids</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Uitleg in gewone taal over de regels achter kopen, lenen en verduurzamen. Elk artikel is gebaseerd op
          officiële bronnen, met de peildatum erbij, en eindigt bij de rekenhulp waarmee je het voor jouw situatie
          doorrekent.
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
              <Link href={`/gids/${categorie.slug}`} className="text-sm font-medium text-merk hover:underline">
                Alles over {categorie.naam.toLowerCase()}
              </Link>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-inkt-zacht">{categorie.beschrijving}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {artikelen.map((artikel) => (
                <ArtikelKaart key={artikel.slug} artikel={artikel} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {komtNog.length > 0 ? (
        <p className="mt-12 text-sm text-gedempt">
          In voorbereiding: {komtNog.map((c) => c.naam.toLowerCase()).join(" en ")}. Die artikelen verschijnen hier
          zodra ze af zijn.
        </p>
      ) : null}

      <div className="mt-12 rounded-[14px] border border-lijn bg-merk-wash p-6">
        <h2 className="text-xl font-semibold">Liever meteen rekenen?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Alle rekenhulpen uit de gids staan bij elkaar: woningwaarde, budget, WOZ-check, verduurzamen en meer. Gratis
          en zonder account.
        </p>
        <Link
          href="/tools"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht focus:outline-2 focus:outline-offset-2 focus:outline-merk"
        >
          Bekijk alle rekenhulpen
        </Link>
      </div>
    </div>
  );
}
