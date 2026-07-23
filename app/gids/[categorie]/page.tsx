import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GIDS_CATEGORIEEN, artikelenInCategorie, vindCategorie } from "@/lib/gids";
import { breadcrumbJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { baseUrl } from "@/lib/util";
import { LegeStaat } from "@/components/ui";
import { ArtikelKaart } from "@/app/gids/artikel-kaart";
import { Kruimelpad } from "@/app/gids/kruimelpad";

type Params = { categorie: string };

export function generateStaticParams(): Params[] {
  return GIDS_CATEGORIEEN.map((c) => ({ categorie: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const categorie = vindCategorie((await params).categorie);
  if (!categorie) return {};
  const artikelen = artikelenInCategorie(categorie.slug);
  return {
    title: `${categorie.naam}: uitleg en artikelen`,
    description: categorie.beschrijving,
    alternates: { canonical: `/gids/${categorie.slug}` },
    // Alleen indexeerbaar met inhoud: een lege categoriepagina is dun en
    // blijft noindex en buiten de sitemap tot er artikelen zijn
    // (gidsSitemapEntries in lib/gids volgt dezelfde regel).
    robots: artikelen.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
  };
}

/** Categoriepagina: alle artikelen in een categorie, of een eerlijke lege staat. */
export default async function GidsCategoriePagina({ params }: { params: Promise<Params> }) {
  const categorie = vindCategorie((await params).categorie);
  if (!categorie) notFound();
  const artikelen = artikelenInCategorie(categorie.slug);

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { naam: "Home", url: `${baseUrl()}/` },
            { naam: "Woongids", url: `${baseUrl()}/gids` },
            { naam: categorie.naam },
          ]),
        )}
      />
      <Kruimelpad items={[{ naam: "Home", href: "/" }, { naam: "Woongids", href: "/gids" }, { naam: categorie.naam }]} />

      <div className="mt-6 max-w-2xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">{categorie.naam}</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">{categorie.beschrijving}</p>
      </div>

      {artikelen.length > 0 ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {artikelen.map((artikel) => (
            <ArtikelKaart key={artikel.slug} artikel={artikel} />
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <LegeStaat
            titel="Nog geen artikelen in deze categorie"
            tekst="We schrijven elk artikel op basis van geverifieerde bronnen, en dat kost even. Kijk in de gids wat er al wel staat."
          />
        </div>
      )}
    </div>
  );
}
