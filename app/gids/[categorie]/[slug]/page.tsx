import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GIDS_ARTIKELEN, vindArtikel, vindCategorie, type GidsSectie } from "@/lib/gids";
import { artikelJsonLd, artikelUrl, faqJsonLd } from "@/lib/gids/jsonld";
import { breadcrumbJsonLd, jsonLdScriptProps } from "@/lib/seo/jsonld";
import { formatDatumNl, slugify } from "@/lib/format";
import { baseUrl } from "@/lib/util";
import { Kaart, KnopPrimair, UitklapUitleg } from "@/components/ui";
import { Kruimelpad } from "@/app/gids/kruimelpad";

type Params = { categorie: string; slug: string };

export function generateStaticParams(): Params[] {
  return GIDS_ARTIKELEN.map((a) => ({ categorie: a.categorie, slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categorie, slug } = await params;
  const artikel = vindArtikel(categorie, slug);
  if (!artikel) return {};
  return {
    title: artikel.titel,
    description: artikel.beschrijving,
    alternates: { canonical: `/gids/${artikel.categorie}/${artikel.slug}` },
    // Indexeerbaar en daarom ook in /sitemaps/statisch.xml (gidsSitemapEntries).
    robots: { index: true, follow: true },
  };
}

function Sectie({ sectie }: { sectie: GidsSectie }) {
  return (
    <section>
      <h2 id={slugify(sectie.kop)} className="scroll-mt-24 text-2xl font-semibold">
        {sectie.kop}
      </h2>
      {sectie.paragrafen.map((p) => (
        <p key={p.slice(0, 40)} className="mt-4 leading-relaxed text-inkt-zacht">
          {p}
        </p>
      ))}
      {sectie.cijfers ? (
        <dl className="mt-5 rounded-[14px] border border-lijn bg-paneel px-5 shadow-zweef">
          {sectie.cijfers.map((rij) => (
            <div
              key={rij.label}
              className="flex flex-col gap-0.5 border-b border-lijn py-3 text-sm last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <dt className="text-inkt">{rij.label}</dt>
              <dd className="shrink-0 font-semibold tabular-nums text-merk">{rij.waarde}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {sectie.faq && sectie.faq.length > 0 ? (
        <div className="mt-5 space-y-3">
          {sectie.faq.map((item) => (
            <UitklapUitleg key={item.vraag} titel={item.vraag}>
              {item.antwoord}
            </UitklapUitleg>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Artikelpagina: leeslayout op max-w-3xl, inhoudsopgave bij 4 of meer
 * secties, de rekenhulp-CTA in de leesflow en het bronnenblok onderaan.
 * JSON-LD: Article + BreadcrumbList altijd, FAQPage alleen met echte
 * FAQ-items. Nooit prijzen of Offer in structured data (lib/gids/jsonld.ts).
 */
export default async function GidsArtikelPagina({ params }: { params: Promise<Params> }) {
  const { categorie: categorieSlug, slug } = await params;
  const artikel = vindArtikel(categorieSlug, slug);
  const categorie = vindCategorie(categorieSlug);
  if (!artikel || !categorie) notFound();

  const faq = faqJsonLd(artikel);
  const eersteBron = artikel.bronnen[0];
  const toonInhoudsopgave = artikel.secties.length >= 4;
  // CTA in de flow: na de tweede sectie, waar de lezer het onderwerp beet heeft.
  const ctaNaIndex = 1;

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <script {...jsonLdScriptProps(artikelJsonLd(artikel))} />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { naam: "Home", url: `${baseUrl()}/` },
            { naam: "Woongids", url: `${baseUrl()}/gids` },
            { naam: categorie.naam, url: `${baseUrl()}/gids/${categorie.slug}` },
            { naam: artikel.titel, url: artikelUrl(artikel) },
          ]),
        )}
      />
      {faq ? <script {...jsonLdScriptProps(faq)} /> : null}

      <Kruimelpad
        items={[
          { naam: "Home", href: "/" },
          { naam: "Woongids", href: "/gids" },
          { naam: categorie.naam, href: `/gids/${categorie.slug}` },
          { naam: artikel.titel },
        ]}
      />

      <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">{artikel.titel}</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">{artikel.beschrijving}</p>
      <p className="mt-3 text-xs text-gedempt">
        {artikel.leestijdMinuten} min leestijd · gepubliceerd {formatDatumNl(artikel.gepubliceerd)}
        {artikel.bijgewerkt !== artikel.gepubliceerd ? ` · bijgewerkt ${formatDatumNl(artikel.bijgewerkt)}` : ""}
      </p>

      <p className="mt-6 rounded-lg bg-accent-wash px-4 py-3 text-sm leading-relaxed text-inkt">
        Dit artikel is informatie, geen financieel advies. Bedragen volgens {eersteBron.naam}, peildatum{" "}
        {formatDatumNl(eersteBron.peildatum)}.
      </p>

      {toonInhoudsopgave ? (
        <nav aria-label="Inhoudsopgave" className="mt-8 rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef">
          <p className="text-sm font-semibold text-inkt">Op deze pagina</p>
          <ol className="mt-2 space-y-1.5 text-sm">
            {artikel.secties.map((sectie) => (
              <li key={sectie.kop}>
                <a href={`#${slugify(sectie.kop)}`} className="text-inkt-zacht transition-colors hover:text-merk">
                  {sectie.kop}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="mt-10 space-y-10">
        {artikel.secties.map((sectie, i) => (
          <div key={sectie.kop} className="space-y-10">
            <Sectie sectie={sectie} />
            {i === ctaNaIndex ? (
              <Kaart className="bg-merk-wash">
                <h2 className="text-xl font-semibold">Reken het door voor jouw situatie</h2>
                <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">{artikel.rekenhulp.zin}</p>
                <div className="mt-4">
                  <KnopPrimair href={artikel.rekenhulp.href}>{artikel.rekenhulp.label}</KnopPrimair>
                </div>
              </Kaart>
            ) : null}
          </div>
        ))}
      </div>

      <section className="mt-12 rounded-[14px] border border-lijn bg-paneel p-6 shadow-zweef">
        <h2 className="text-xl font-semibold">Bronnen en peildatum</h2>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Elk bedrag in dit artikel komt rechtstreeks uit deze bronnen. Wijzigt een regeling, dan werken we het artikel
          bij en passen we de datum hierboven aan.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-inkt-zacht">
          {artikel.bronnen.map((bron) => (
            <li key={bron.url}>
              <a
                href={bron.url}
                rel="noreferrer"
                className="font-medium text-merk underline underline-offset-4 transition-colors hover:text-merk-licht"
              >
                {bron.naam}
              </a>{" "}
              <span className="text-gedempt">(peildatum {formatDatumNl(bron.peildatum)})</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-inkt-zacht">
          Hoe we met bronnen en cijfers omgaan lees je op{" "}
          <Link href="/methode" className="font-semibold text-merk underline underline-offset-4 transition-colors hover:text-merk-licht">
            onze methodepagina
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
