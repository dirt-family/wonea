import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buurtKarakteristiek,
  buurtKerncijfers,
  buurtPrijsontwikkeling,
  recenteVerkopenInBuurt,
  vergelijkbareBuurten,
  vindBuurtMetGemeente,
  woningenInBuurt,
  type PrijsPunt,
} from "@/lib/buurt-data";
import { isBuurtIndexeerbaar } from "@/lib/seo/gating";
import { formatEuro } from "@/lib/util";
import { BronLabel, EnergieLabelBadge, Kaart, ModuleTag, StatTegel, VoorbeelddataLabel } from "@/components/ui";
import { MarktSignalenKaart } from "@/components/markt/signalen";

/**
 * Buurtpagina, opgebouwd volgens docs/PROTOTYPE-OOGST.md ("Buurtpagina"):
 * broodkruimel + titel met karakteristiek-zin (alleen uit data), stats-rij,
 * prijsontwikkeling (alleen bij echte reeks), woningen-kaartenrij, recente
 * verkopen op buurtniveau en vergelijkbare buurten. Bewust WEGGELATEN:
 * voorzieningen, bewoners-statistieken en veiligheid (geen bron geingest;
 * backlog) en "Volg deze buurt" (de alert-flow is per adres-claim, er bestaat
 * geen buurt-abonnement om aan te koppelen).
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

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const data = await vindBuurtMetGemeente(p.gemeente, p.buurt);
  if (!data) return { title: "Buurt niet gevonden", robots: { index: false, follow: false } };
  // Gebiedswhitelist (lib/seo/gating.ts): buurtpagina's mogen alleen de index
  // in als de buurt bewust is vrijgegeven. Default is noindex.
  const indexeerbaar = await isBuurtIndexeerbaar(data.buurt.buurtCode);
  return {
    title: `Buurt ${data.buurt.naam} in ${data.gemeente.naam}: woningmarkt`,
    description: `Kerncijfers, recente verkopen en prijsontwikkeling van buurt ${data.buurt.naam} in ${data.gemeente.naam}, met bronnen en uitleg.`,
    robots: indexeerbaar ? { index: true, follow: true } : { index: false, follow: false },
  };
}

function maandLabel(maand: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" }).format(new Date(`${maand}-01`));
}

/**
 * Staafgrafiek van de mediaanprijs per maand (server-side SVG, currentColor).
 * Staven beginnen op nul: eerlijke verhoudingen, geen aangezette y-as die
 * kleine verschillen dramatisch maakt.
 */
function PrijsStaven({ punten }: { punten: PrijsPunt[] }) {
  const w = 560;
  const h = 150;
  const pad = 4;
  const max = Math.max(...punten.map((p) => p.mediaan));
  const gap = 6;
  const staafBreedte = (w - pad * 2 - gap * (punten.length - 1)) / punten.length;
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
        {punten.map((p, i) => {
          const hoogte = (p.mediaan / max) * (h - pad * 2);
          return (
            <rect
              key={p.maand}
              x={(pad + i * (staafBreedte + gap)).toFixed(1)}
              y={(h - pad - hoogte).toFixed(1)}
              width={staafBreedte.toFixed(1)}
              height={hoogte.toFixed(1)}
              rx="3"
              fill="currentColor"
              opacity={i === punten.length - 1 ? 1 : 0.55}
            />
          );
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-gedempt tabular-nums">
        <span>{maandLabel(eerste.maand)}: {formatEuro(eerste.mediaan)}</span>
        <span>{maandLabel(laatste.maand)}: {formatEuro(laatste.mediaan)}</span>
      </figcaption>
    </figure>
  );
}

/** Verschil in m2-prijs met de eigen buurt, in gewone taal en zonder oordeel. */
function verschilTekst(verschilPct: number): string {
  const abs = Math.abs(verschilPct).toLocaleString("nl-NL", { maximumFractionDigits: 1 });
  if (Math.abs(verschilPct) < 2) return "vergelijkbaar met deze buurt";
  return verschilPct > 0 ? `${abs}% boven deze buurt` : `${abs}% onder deze buurt`;
}

export default async function BuurtPagina({ params }: { params: Promise<Params> }) {
  const p = await params;
  const data = await vindBuurtMetGemeente(p.gemeente, p.buurt);
  if (!data) notFound();
  const { gemeente, buurt } = data;

  const [karakteristiek, kerncijfers, prijsreeks, woningen, verkopen, buren] = await Promise.all([
    buurtKarakteristiek(buurt.buurtCode),
    buurtKerncijfers(buurt.buurtCode),
    buurtPrijsontwikkeling(buurt.buurtCode),
    woningenInBuurt(buurt.buurtCode, 8),
    recenteVerkopenInBuurt(buurt.buurtCode, 12),
    vergelijkbareBuurten(buurt.buurtCode, 3),
  ]);

  const maandFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> /{" "}
        <Link href={`/woningmarkt/${gemeente.slug}`} className="hover:text-merk">{gemeente.naam}</Link> / {buurt.naam}
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Buurt {buurt.naam}</h1>
      <p className="mt-1 text-inkt-zacht">Gemeente {gemeente.naam}</p>
      {karakteristiek ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-inkt-zacht">{karakteristiek}</p> : null}

      {/* Stats-rij: alle cijfers echt; een tegel zonder bron laten we weg.
          Geen delta bij de m2-prijs: er is geen historische reeks van dit
          cijfer, dus ook geen delta-claim. */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {buurt.ankerM2Prijs != null ? (
          <StatTegel
            label="Prijs per m2"
            waarde={formatEuro(Math.round(buurt.ankerM2Prijs))}
            delta="gemiddelde WOZ gedeeld door gemiddelde oppervlakte"
            deltaRichting="neutraal"
          />
        ) : null}
        {buurt.gemWoz != null ? (
          <StatTegel label="Gemiddelde WOZ" waarde={formatEuro(buurt.gemWoz)} delta="bron: CBS" deltaRichting="neutraal" />
        ) : null}
        <StatTegel
          label="Woningen in ons bestand"
          waarde={kerncijfers.aantalWoningen.toLocaleString("nl-NL")}
          delta="adressen in het testgebied"
          deltaRichting="neutraal"
        />
        <StatTegel
          label="Recente verkopen"
          waarde={kerncijfers.aantalRecenteVerkopen.toLocaleString("nl-NL")}
          delta="laatste 12 maanden"
          deltaRichting="neutraal"
        />
      </div>

      {/* Prijsontwikkeling: alleen bij een echte reeks. */}
      {prijsreeks ? (
        <Kaart className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Prijsontwikkeling</h2>
            {prijsreeks.heeftSeed ? <VoorbeelddataLabel /> : <ModuleTag>per maand</ModuleTag>}
          </div>
          <p className="mt-2 text-sm text-inkt-zacht">
            Mediaan verkoopprijs per maand, laatste {prijsreeks.punten.length} maanden.
          </p>
          <PrijsStaven punten={prijsreeks.punten} />
        </Kaart>
      ) : null}

      {/* Woningen in de buurt: echte adressen met een echte schatting. */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Woningen in {buurt.naam}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Adressen in ons bestand met een recente waardeschatting. Het is een indicatie, geen taxatie, dus zie het als
          een goed startpunt.
        </p>
        {woningen.length > 0 ? (
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2" role="list">
            {woningen.map((woning) => {
              const naam = `${woning.straat} ${woning.huisnummer}${woning.toevoeging ? ` ${woning.toevoeging}` : ""}`;
              return (
                <Link
                  key={woning.adresId}
                  role="listitem"
                  href={`/woning/${woning.postcode}/${woning.nummerslug}`}
                  className="block w-64 shrink-0 rounded-[14px] border border-lijn bg-paneel p-5 transition-colors hover:border-merk"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-inkt">{naam}</p>
                      <p className="mt-0.5 text-xs text-gedempt">{woning.postcode} {woning.plaats}</p>
                    </div>
                    {woning.energielabel ? <EnergieLabelBadge label={woning.energielabel} klein /> : null}
                  </div>
                  <p className="mt-3 font-display text-xl font-semibold text-merk tabular-nums">{formatEuro(woning.waarde)}</p>
                  <p className="mt-1 text-xs text-inkt-zacht tabular-nums">
                    {formatEuro(woning.intervalLaag)} tot {formatEuro(woning.intervalHoog)}
                  </p>
                  <p className="mt-2 text-xs text-gedempt tabular-nums">
                    {woning.oppervlakteM2} m2, {woning.woningtype}, bouwjaar {woning.bouwjaar}
                  </p>
                  {woning.energielabel && woning.energielabelBron === "indicatie" ? (
                    <p className="mt-2"><BronLabel>label: indicatie op basis van bouwjaar</BronLabel></p>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-inkt-zacht">
            Nog geen woningen met een waardeschatting in deze buurt. Zoek een adres via de zoekbalk op de homepage; de
            schatting verschijnt daarna ook hier.
          </p>
        )}
      </section>

      {/* Recente verkopen op buurtniveau. */}
      <Kaart className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Recente verkopen in deze buurt</h2>
          {verkopen.some((verkoop) => verkoop.bron === "seed") ? <VoorbeelddataLabel /> : <ModuleTag>buurtniveau</ModuleTag>}
        </div>
        {verkopen.length > 0 ? (
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
                {verkopen.map((verkoop) => (
                  <tr key={verkoop.id} className="border-b border-lijn last:border-0">
                    <td className="py-2.5 pr-4">{maandFmt.format(new Date(verkoop.datum))}</td>
                    <td className="py-2.5 pr-4">{verkoop.straat ?? "onbekend"}</td>
                    <td className="py-2.5 pr-4 font-medium tabular-nums">{formatEuro(verkoop.prijs)}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{verkoop.oppervlakteM2} m2</td>
                    <td className="py-2.5">{verkoop.woningtype}</td>
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

      {/* Marktsignalen: bestaande module, uitleg in gewone taal. */}
      <MarktSignalenKaart variant="volledig" buurtCode={buurt.buurtCode} className="mt-5" />

      {/* Vergelijkbare buurten: zelfde gemeente, dichtstbijzijnde m2-prijs. */}
      {buren.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Vergelijkbare buurten</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            Buurten in {gemeente.naam} met een m2-prijs die het dichtst bij {buurt.naam} ligt.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {buren.map((buur) => (
              <Link
                key={buur.buurtCode}
                href={`/buurt/${gemeente.slug}/${buur.slug}`}
                className="block rounded-[14px] border border-lijn bg-paneel p-5 transition-colors hover:border-merk"
              >
                <p className="font-semibold text-inkt">{buur.naam}</p>
                <p className="mt-2 font-display text-xl font-semibold text-merk tabular-nums">
                  {formatEuro(Math.round(buur.ankerM2Prijs))} per m2
                </p>
                <p className="mt-1 text-xs text-gedempt tabular-nums">{verschilTekst(buur.verschilPct)}</p>
                {buur.gemWoz != null ? (
                  <p className="mt-2 text-xs text-inkt-zacht tabular-nums">Gemiddelde WOZ: {formatEuro(buur.gemWoz)}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
