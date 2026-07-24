import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { breadcrumbJsonLd, jsonLdScriptProps, type Kruimel } from "@/lib/seo/jsonld";
import {
  allePlaatsSlugs,
  buurtenVanPlaats,
  marktcijfersVanPlaats,
  plaatsKerncijfers,
  recenteVerkopenVanPlaats,
  verkopenPerMaandVanPlaats,
  vindPlaats,
  woningenMetWaarde,
} from "@/lib/woningmarkt";
import { VerkopenGrafiek } from "@/components/grafieken/verkopen-grafiek";
import { baseUrl, formatEuro } from "@/lib/util";
import { Kaart, StatTegel, VoorbeelddataLabel, WoningKaart } from "@/components/ui";

/**
 * /woningmarkt/[plaats]: plaatspagina met kerncijfers, buurten-grid, recente
 * verkopen (buurt- en straatniveau, nooit huisnummers) en een rij woningen
 * met een recente waardeschatting. Voedt de interne linkstructuur
 * plaats > buurt > woning. Noindex tot de indexatie-gating dit vrijgeeft.
 */

type Params = { plaats: string };

// ISR: bekende plaatsen bij build voorgerenderd, daarna 24 uur gecachet.
// Zonder bereikbare database bij build (bv. CI) valt dit terug op leeg;
// dynamicParams rendert elke plaats dan alsnog on-demand.
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<Params[]> {
  try {
    return (await allePlaatsSlugs()).map((slug) => ({ plaats: slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const gemeente = await vindPlaats((await params).plaats);
  if (!gemeente) return { title: "Plaats niet gevonden", robots: { index: false, follow: false } };
  return {
    title: `Woningmarkt ${gemeente.naam}: buurten, prijzen en verkopen`,
    description: `De woningmarkt van ${gemeente.naam}: kerncijfers, buurten met gemiddelde WOZ, recente verkopen en woningen met een waardeschatting. Elk cijfer met bron.`,
    robots: { index: false, follow: true },
  };
}

function maandLabel(maand: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(`${maand}-01`));
}

export default async function PlaatsPagina({ params }: { params: Promise<Params> }) {
  const gemeente = await vindPlaats((await params).plaats);
  if (!gemeente) notFound();

  const [kerncijfers, buurten, verkopen, woningen, marktcijfers, perMaand] = await Promise.all([
    plaatsKerncijfers(gemeente.code),
    buurtenVanPlaats(gemeente.code),
    recenteVerkopenVanPlaats(gemeente.code, 12),
    woningenMetWaarde(gemeente.code, 8),
    marktcijfersVanPlaats(gemeente.code),
    verkopenPerMaandVanPlaats(gemeente.code),
  ]);
  const maandKort = new Intl.DateTimeFormat("nl-NL", { month: "short" });
  const grafiekData = perMaand.map((rij) => ({
    maand: maandKort.format(new Date(`${rij.maand}-01`)).replace(".", ""),
    verkopen: rij.verkopen,
  }));

  const kruimels: Kruimel[] = [
    { naam: "Wonea", url: `${baseUrl()}/` },
    { naam: "Woningmarkt", url: `${baseUrl()}/woningmarkt` },
    { naam: gemeente.naam, url: `${baseUrl()}/woningmarkt/${gemeente.slug}` },
  ];

  // Place-markup: alleen naam en plaats, bewust zonder prijzen of
  // waardeschattingen (harde regel in lib/seo/jsonld.ts).
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: gemeente.naam,
    url: `${baseUrl()}/woningmarkt/${gemeente.slug}`,
    address: { "@type": "PostalAddress", addressLocality: gemeente.naam, addressCountry: "NL" },
  };

  const maandFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <script {...jsonLdScriptProps(breadcrumbJsonLd(kruimels))} />
      <script {...jsonLdScriptProps(placeJsonLd)} />

      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> /{" "}
        <Link href="/woningmarkt" className="hover:text-merk">Woningmarkt</Link> / {gemeente.naam}
      </nav>

      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Woningmarkt {gemeente.naam}</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-inkt-zacht">
        Kerncijfers, buurten en recente verkopen in {gemeente.naam}. Elk cijfer komt met zijn bron; een schatting
        tonen we altijd als bandbreedte.
      </p>

      {/* Stat-tiles op tint (v3): navy-wash als basis, de WOZ als het ene amber-accent. */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTegel label="Woningen in beeld" waarde={kerncijfers.aantalWoningen.toLocaleString("nl-NL")} tint="merk" />
        <StatTegel label="Buurten" waarde={kerncijfers.aantalBuurten.toLocaleString("nl-NL")} tint="merk" />
        {kerncijfers.gemWoz != null ? (
          <StatTegel
            label="Gemiddelde WOZ"
            waarde={formatEuro(kerncijfers.gemWoz)}
            delta="gemiddelde van de buurtcijfers, CBS"
            deltaRichting="neutraal"
            tint="amber"
          />
        ) : null}
        {kerncijfers.inwoners != null ? (
          <StatTegel
            label="Inwoners"
            waarde={kerncijfers.inwoners.toLocaleString("nl-NL")}
            delta="bron: CBS"
            deltaRichting="neutraal"
            tint="merk"
          />
        ) : null}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Buurten in {gemeente.naam}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Elke buurt heeft een eigen pagina met kerncijfers, recente verkopen en prijsontwikkeling.
        </p>
        {buurten.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {buurten.map((buurt) => (
              <Link
                key={buurt.buurtCode}
                href={`/buurt/${gemeente.slug}/${buurt.slug}`}
                className="til-op block rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef focus:outline-2 focus:outline-offset-2 focus:outline-merk"
              >
                <p className="font-semibold text-inkt">{buurt.naam}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  {buurt.gemWoz != null ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gedempt">Gemiddelde WOZ</dt>
                      <dd className="font-medium text-inkt">{formatEuro(buurt.gemWoz)}</dd>
                    </div>
                  ) : null}
                  {buurt.ankerM2Prijs != null ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gedempt">Prijs per m2</dt>
                      <dd className="font-medium text-inkt">{formatEuro(Math.round(buurt.ankerM2Prijs))}</dd>
                    </div>
                  ) : null}
                  {buurt.gemWoz == null && buurt.ankerM2Prijs == null ? (
                    <div className="text-gedempt">Nog geen cijfers voor deze buurt.</div>
                  ) : null}
                </dl>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-inkt-zacht">Nog geen buurten bekend in {gemeente.naam}.</p>
        )}
      </section>

      <section className="mt-12">
        <Kaart>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Recente verkopen</h2>
            {verkopen.some((verkoop) => verkoop.bron === "seed") || marktcijfers?.heeftSeed ? <VoorbeelddataLabel /> : null}
          </div>
          {grafiekData.length >= 3 ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-inkt">Verkopen per maand</p>
              <p className="text-xs leading-relaxed text-gedempt">
                Som van de gemeten buurtvolumes in {gemeente.naam}, laatste {grafiekData.length} maanden.
              </p>
              <div className="mt-3">
                <VerkopenGrafiek data={grafiekData} />
              </div>
            </div>
          ) : null}
          {verkopen.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              {/* Tint-zebra (v3): even rijen op navy-wash in plaats van lijnen onder elke rij. */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                    <th className="px-3 py-2 font-medium">Wanneer</th>
                    <th className="px-3 py-2 font-medium">Buurt</th>
                    <th className="px-3 py-2 font-medium">Straat</th>
                    <th className="px-3 py-2 font-medium">Prijs</th>
                    <th className="px-3 py-2 font-medium">Oppervlakte</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {verkopen.map((verkoop) => (
                    <tr key={verkoop.id} className="even:bg-merk-50">
                      <td className="rounded-l-lg px-3 py-2.5">{maandFmt.format(new Date(verkoop.datum))}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/buurt/${gemeente.slug}/${verkoop.buurtSlug}`} className="text-merk hover:underline">
                          {verkoop.buurtNaam}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">{verkoop.straat ?? "onbekend"}</td>
                      <td className="px-3 py-2.5 font-medium tabular-nums">{formatEuro(verkoop.prijs)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{verkoop.oppervlakteM2} m2</td>
                      <td className="rounded-r-lg px-3 py-2.5">{verkoop.woningtype}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-inkt-zacht">Geen recente verkopen bekend in {gemeente.naam}.</p>
          )}
          {marktcijfers && marktcijfers.volumeTotaal != null ? (
            <p className="mt-4 text-sm text-inkt-zacht">
              In {maandLabel(marktcijfers.maand)} telden we {marktcijfers.volumeTotaal.toLocaleString("nl-NL")} verkopen,
              verdeeld over {marktcijfers.buurtenMetCijfers}{" "}
              {marktcijfers.buurtenMetCijfers === 1 ? "buurt" : "buurten"} met maandcijfers.
            </p>
          ) : null}
          <p className="mt-4 text-xs leading-relaxed text-gedempt">
            We tonen verkopen op straat- en buurtniveau, bewust zonder huisnummers of lijst van individuele adressen.
          </p>
        </Kaart>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Woningen met een recente waardeschatting</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Adressen in {gemeente.naam} waarvoor ons model onlangs een waarde berekende, altijd met bandbreedte.
        </p>
        {woningen.length > 0 ? (
          <div className="mt-6 flex gap-4 overflow-x-auto px-1 pb-3 pt-1" role="list">
            {woningen.map((woning) => {
              const naam = `${woning.straat} ${woning.huisnummer}${woning.toevoeging ? ` ${woning.toevoeging}` : ""}`;
              return (
                <div key={woning.adresId} role="listitem" className="w-72 shrink-0">
                  <WoningKaart
                    href={`/woning/${woning.postcode}/${woning.nummerslug}`}
                    adres={naam}
                    plaats={`${woning.postcode} ${woning.plaats}`}
                    micro={`${woning.oppervlakteM2} m2, ${woning.woningtype}`}
                    waarde={formatEuro(woning.waarde)}
                    bandbreedte={`${formatEuro(woning.intervalLaag)} tot ${formatEuro(woning.intervalHoog)}`}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-inkt-zacht">
            Nog geen woningen met een waardeschatting in {gemeente.naam}. Zoek een adres via de zoekbalk op de
            homepage; de schatting verschijnt daarna ook hier.
          </p>
        )}
      </section>

      {/* Donkere slotband (v3, radius-band 20): het ene donkere moment op deze
          pagina; amber knop met merk-900-tekst (6,8:1). */}
      <section className="mt-12">
        <div className="rounded-[20px] bg-merk-900 px-7 py-10 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-md">
              {/* Inline tokenkleur: de ongelaagde h1-h3-regel in globals.css wint
                  van de text-white-utility (cascade layers), dus op donker moet
                  de witkleur inline. Zelfde geldt site-breed voor CtaBand (ui.tsx). */}
              <h2 className="text-2xl font-semibold" style={{ color: "var(--color-paneel)" }}>
                Zelf rekenen?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-merk-200">
                Bereken wat een woning waard is, of wat je kunt lenen volgens de leennormen van 2026. Gratis en
                zonder account.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-merk-900 transition-colors hover:bg-accent-400 focus:outline-2 focus:outline-offset-2 focus:outline-accent-300"
              >
                Bereken een woningwaarde
              </Link>
              <Link
                href="/budget"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-300"
              >
                Bereken je budget
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
