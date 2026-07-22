import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { marketStats, municipalities, neighborhoods, sales } from "@/db/schema";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { isBuurtIndexeerbaar } from "@/lib/seo/gating";
import { formatEuro } from "@/lib/util";
import { BronLabel, Kaart, SectieLabel, VoorbeelddataLabel } from "@/components/ui";
import { MarktSignalenKaart } from "@/components/markt/signalen";

/**
 * Buurtpagina: kerncijfers, recente verkopen en prijsontwikkeling op
 * buurtniveau. BEWUST geen lijst van individuele adressen (privacy-rust).
 * Verkopen met een adres_id (bron kadaster) respecteren de suppressielijst.
 */

type Params = { gemeente: string; buurt: string };

/**
 * ISR on-demand, zelfde beleid als de adrespagina: niets bij build, elke
 * bezochte buurt-URL 24 uur gecachet. Datapatroon past: puur leeswerk (geen
 * writes bij render), geen cookies/headers, en de bron (market_stats, CBS,
 * seed-verkopen) verandert hooguit maandelijks. Let op (docs/PERFORMANCE.md):
 * zodra er kadaster-verkopen MET adres_id bestaan, moet de opt-out-cascade ook
 * de buurtpagina van dat adres revalidaten; met alleen seed-verkopen (nooit
 * een adres_id) kan hier niets lekken.
 */
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams(): Params[] {
  return [];
}

function vindBuurt(params: Params) {
  const gemeente = db.select().from(municipalities).where(eq(municipalities.slug, params.gemeente.toLowerCase())).get();
  if (!gemeente) return null;
  const buurt = db
    .select()
    .from(neighborhoods)
    .where(and(eq(neighborhoods.gemeenteCode, gemeente.code), eq(neighborhoods.slug, params.buurt.toLowerCase())))
    .get();
  if (!buurt) return null;
  return { gemeente, buurt };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const data = vindBuurt(await params);
  if (!data) return { title: "Buurt niet gevonden", robots: { index: false, follow: false } };
  // Gebiedswhitelist (lib/seo/gating.ts): buurtpagina's mogen alleen de index
  // in als de buurt bewust is vrijgegeven. Default is noindex.
  const indexeerbaar = isBuurtIndexeerbaar(data.buurt.buurtCode);
  return {
    title: `Buurt ${data.buurt.naam} in ${data.gemeente.naam}: woningmarkt en prijzen`,
    description: `Kerncijfers, recente verkopen en prijsontwikkeling van buurt ${data.buurt.naam} in ${data.gemeente.naam}, met bronnen en uitleg.`,
    robots: indexeerbaar ? { index: true, follow: true } : { index: false, follow: false },
  };
}

function maandLabel(maand: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" }).format(new Date(`${maand}-01`));
}

/** Kleine inline lijngrafiek van de mediaanprijs per maand. Kleur via currentColor (token text-merk). */
function PrijsLijn({ punten }: { punten: { maand: string; mediaan: number }[] }) {
  const w = 560;
  const h = 130;
  const pad = 8;
  const waarden = punten.map((p) => p.mediaan);
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const span = max - min || 1;
  const stap = punten.length > 1 ? (w - pad * 2) / (punten.length - 1) : 0;
  const coords = punten
    .map((p, i) => `${(pad + i * stap).toFixed(1)},${(h - pad - ((p.mediaan - min) / span) * (h - pad * 2)).toFixed(1)}`)
    .join(" ");
  const eerste = punten[0];
  const laatste = punten[punten.length - 1];
  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full text-merk"
        role="img"
        aria-label={`Mediaanprijs per maand, van ${formatEuro(eerste.mediaan)} in ${maandLabel(eerste.maand)} naar ${formatEuro(laatste.mediaan)} in ${maandLabel(laatste.maand)}`}
      >
        <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-gedempt">
        <span>{maandLabel(eerste.maand)}: {formatEuro(eerste.mediaan)}</span>
        <span>{maandLabel(laatste.maand)}: {formatEuro(laatste.mediaan)}</span>
      </figcaption>
    </figure>
  );
}

export default async function BuurtPagina({ params }: { params: Promise<Params> }) {
  const data = vindBuurt(await params);
  if (!data) notFound();
  const { gemeente, buurt } = data;

  // Recente verkopen: seed-verkopen hebben nooit een adres_id; kadaster-rijen
  // wel, en die vallen weg zodra het adres gesupprimeerd is.
  const recenteVerkopen = db
    .select()
    .from(sales)
    .where(eq(sales.buurtCode, buurt.buurtCode))
    .orderBy(desc(sales.datum))
    .limit(36)
    .all()
    .filter((s) => s.adresId == null || !isAddressIdSuppressed(s.adresId))
    .slice(0, 12);

  const stats = db
    .select()
    .from(marketStats)
    .where(eq(marketStats.buurtCode, buurt.buurtCode))
    .orderBy(marketStats.maand)
    .all()
    .slice(-12);
  const laatsteMaand = stats.at(-1);
  const trendPunten = stats
    .filter((s): s is typeof s & { mediaanPrijs: number } => s.mediaanPrijs != null)
    .map((s) => ({ maand: s.maand, mediaan: s.mediaanPrijs }));

  const maandFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> / {gemeente.naam} / {buurt.naam}
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Buurt {buurt.naam}</h1>
      <p className="mt-1 text-inkt-zacht">Gemeente {gemeente.naam}</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <Kaart>
          <SectieLabel>Gemiddelde WOZ</SectieLabel>
          {buurt.gemWoz ? (
            <>
              <p className="mt-3 font-display text-3xl font-semibold text-merk">{formatEuro(buurt.gemWoz)}</p>
              <p className="mt-2"><BronLabel>CBS</BronLabel></p>
            </>
          ) : (
            <p className="mt-3 text-sm text-inkt-zacht">Geen CBS-cijfer beschikbaar voor deze buurt.</p>
          )}
        </Kaart>
        <Kaart>
          <SectieLabel>Inwoners</SectieLabel>
          {buurt.inwoners ? (
            <>
              <p className="mt-3 font-display text-3xl font-semibold text-merk">{buurt.inwoners.toLocaleString("nl-NL")}</p>
              <p className="mt-2"><BronLabel>CBS</BronLabel></p>
            </>
          ) : (
            <p className="mt-3 text-sm text-inkt-zacht">Geen CBS-cijfer beschikbaar voor deze buurt.</p>
          )}
        </Kaart>
        <Kaart>
          <SectieLabel>Prijs per m2</SectieLabel>
          {buurt.ankerM2Prijs ? (
            <>
              <p className="mt-3 font-display text-3xl font-semibold text-merk">{formatEuro(Math.round(buurt.ankerM2Prijs))}</p>
              <p className="mt-2"><BronLabel>afgeleide: gemiddelde WOZ gedeeld door gemiddelde oppervlakte</BronLabel></p>
            </>
          ) : (
            <p className="mt-3 text-sm text-inkt-zacht">Nog niet te berekenen voor deze buurt.</p>
          )}
        </Kaart>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Kaart className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectieLabel>Recente verkopen in deze buurt</SectieLabel>
            {recenteVerkopen.some((s) => s.bron === "seed") ? <VoorbeelddataLabel /> : null}
          </div>
          {recenteVerkopen.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                    <th className="py-2 pr-4 font-medium">Wanneer</th>
                    <th className="py-2 pr-4 font-medium">Straat</th>
                    <th className="py-2 pr-4 font-medium">Prijs</th>
                    <th className="py-2 pr-4 font-medium">Oppervlakte</th>
                    <th className="py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {recenteVerkopen.map((s) => (
                    <tr key={s.id} className="border-b border-lijn last:border-0">
                      <td className="py-2.5 pr-4">{maandFmt.format(new Date(s.datum))}</td>
                      <td className="py-2.5 pr-4">{s.straat ?? "onbekend"}</td>
                      <td className="py-2.5 pr-4 font-medium">{formatEuro(s.prijs)}</td>
                      <td className="py-2.5 pr-4">{s.oppervlakteM2} m2</td>
                      <td className="py-2.5">{s.woningtype}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-inkt-zacht">Geen recente verkopen bekend in deze buurt.</p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-gedempt">
            We tonen verkopen op straat- en buurtniveau, bewust zonder huisnummers of lijst van individuele adressen.
          </p>
        </Kaart>

        <Kaart>
          <SectieLabel>Zoek een adres</SectieLabel>
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            De geschatte waarde van een specifieke woning, altijd met bandbreedte, vind je via de zoekbalk op de homepage.
          </p>
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Naar de zoekbalk
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-inkt-zacht">
            Benieuwd hoe we rekenen en waarom we altijd een bandbreedte tonen?
          </p>
          <Link href="/methode" className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Onze methode
          </Link>
        </Kaart>
      </div>

      <Kaart className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectieLabel>Prijsontwikkeling</SectieLabel>
          {stats.some((s) => s.bron === "seed") ? <VoorbeelddataLabel /> : null}
        </div>
        {trendPunten.length >= 2 ? (
          <>
            <p className="mt-3 text-sm text-inkt-zacht">Mediaan verkoopprijs per maand, laatste {trendPunten.length} maanden.</p>
            <PrijsLijn punten={trendPunten} />
          </>
        ) : (
          <p className="mt-3 text-sm text-inkt-zacht">
            Nog te weinig maandcijfers om een prijsontwikkeling te tonen. Liever geen lijn dan een verzonnen lijn.
          </p>
        )}

        {laatsteMaand && (laatsteMaand.doorlooptijdDagen != null || laatsteMaand.overbiedingPct != null) ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {laatsteMaand.doorlooptijdDagen != null ? (
              <div className="rounded-lg bg-merk-wash p-4">
                <SectieLabel>Doorlooptijd</SectieLabel>
                <p className="mt-2 font-display text-2xl font-semibold text-merk">{laatsteMaand.doorlooptijdDagen} dagen</p>
                <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                  Woningen die in {maandLabel(laatsteMaand.maand)} in deze buurt werden verkocht, stonden gemiddeld{" "}
                  {laatsteMaand.doorlooptijdDagen} dagen te koop. Hoe korter, hoe krapper de markt.
                </p>
              </div>
            ) : null}
            {laatsteMaand.overbiedingPct != null ? (
              <div className="rounded-lg bg-merk-wash p-4">
                <SectieLabel>Overbieden</SectieLabel>
                <p className="mt-2 font-display text-2xl font-semibold text-merk">
                  {laatsteMaand.overbiedingPct >= 0 ? "+" : "-"}
                  {Math.abs(laatsteMaand.overbiedingPct).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%
                </p>
                <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                  {laatsteMaand.overbiedingPct >= 0
                    ? `Kopers betaalden in ${maandLabel(laatsteMaand.maand)} gemiddeld ${Math.abs(laatsteMaand.overbiedingPct).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}% boven de vraagprijs.`
                    : `Kopers betaalden in ${maandLabel(laatsteMaand.maand)} gemiddeld ${Math.abs(laatsteMaand.overbiedingPct).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}% onder de vraagprijs.`}{" "}
                  Dat zegt iets over de onderhandelingsruimte, niet over een individuele woning.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Kaart>

      <MarktSignalenKaart variant="volledig" buurtCode={buurt.buurtCode} className="mt-5" />
    </div>
  );
}
