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
} from "@/lib/buurt-data";
import { isBuurtIndexeerbaar } from "@/lib/seo/gating";
import { formatEuro } from "@/lib/util";
import { AnalyseKaart, Kaart, ModuleTag, Pil, StatTegel, VoorbeelddataLabel, WoningKaart } from "@/components/ui";
import { WaardeGrafiek } from "@/components/grafieken/waarde-grafiek";
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
      {/* Stat-tiles op tint (v3): navy-wash als basis, de m2-prijs als het ene amber-accent. */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {buurt.ankerM2Prijs != null ? (
          <StatTegel
            label="Prijs per m2"
            waarde={formatEuro(Math.round(buurt.ankerM2Prijs))}
            delta="gemiddelde WOZ gedeeld door gemiddelde oppervlakte"
            deltaRichting="neutraal"
            tint="amber"
          />
        ) : null}
        {buurt.gemWoz != null ? (
          <StatTegel label="Gemiddelde WOZ" waarde={formatEuro(buurt.gemWoz)} delta="bron: CBS" deltaRichting="neutraal" tint="merk" />
        ) : null}
        <StatTegel
          label="Woningen in ons bestand"
          waarde={kerncijfers.aantalWoningen.toLocaleString("nl-NL")}
          delta="adressen in het testgebied"
          deltaRichting="neutraal"
          tint="merk"
        />
        <StatTegel
          label="Recente verkopen"
          waarde={kerncijfers.aantalRecenteVerkopen.toLocaleString("nl-NL")}
          delta="laatste 12 maanden"
          deltaRichting="neutraal"
          tint="merk"
        />
      </div>

      {/* Prijsontwikkeling: alleen bij een echte reeks. Flux-kleurlaag: de
          donkere AnalyseKaart (shell-zwart, radius-band 20) is het ene donkere
          moment op deze pagina; chart-op-shell dempt de historie-staven en
          markeert de actuele maand in het lime-anker. */}
      {prijsreeks ? (
        <section className="mt-8" aria-labelledby="prijsontwikkeling-kop">
          <h2 id="prijsontwikkeling-kop" className="sr-only">
            Prijsontwikkeling
          </h2>
          <AnalyseKaart
            titel="Prijsontwikkeling"
            meta={`Mediaan verkoopprijs per maand, laatste ${prijsreeks.punten.length} maanden.`}
            className="shadow-zweef-md"
          >
            {/* Het lange voorbeelddata-label hoort in de flow (het actie-slot is
                shrink-0 en zou de kaart op mobiel breder dan het scherm duwen). */}
            {prijsreeks.heeftSeed ? (
              <p className="mb-4 -mt-1">
                <VoorbeelddataLabel />
              </p>
            ) : null}
            <WaardeGrafiek data={prijsreeks.punten.map((p) => ({ label: maandLabel(p.maand), waarde: p.mediaan }))} maxLabels={6} />
            <p className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs tabular-nums text-op-shell-zacht">
              <span>
                {maandLabel(prijsreeks.punten[0].maand)}: {formatEuro(prijsreeks.punten[0].mediaan)}
              </span>
              <span>
                {maandLabel(prijsreeks.punten[prijsreeks.punten.length - 1].maand)}:{" "}
                {formatEuro(prijsreeks.punten[prijsreeks.punten.length - 1].mediaan)}
              </span>
            </p>
          </AnalyseKaart>
        </section>
      ) : null}

      {/* Woningen in de buurt: echte adressen met een echte schatting. */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Woningen in {buurt.naam}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Adressen in ons bestand met een recente waardeschatting. Het is een indicatie, geen taxatie, dus zie het als
          een goed startpunt.
        </p>
        {woningen.length > 0 ? (
          <div className="mt-6 flex gap-4 overflow-x-auto px-1 pb-3 pt-1" role="list">
            {woningen.map((woning) => {
              const naam = `${woning.straat} ${woning.huisnummer}${woning.toevoeging ? ` ${woning.toevoeging}` : ""}`;
              const indicatie = woning.energielabel && woning.energielabelBron === "indicatie";
              return (
                <div key={woning.adresId} role="listitem" className="w-72 shrink-0">
                  <WoningKaart
                    href={`/woning/${woning.postcode}/${woning.nummerslug}`}
                    adres={naam}
                    plaats={`${woning.postcode} ${woning.plaats}`}
                    micro={`${woning.oppervlakteM2} m2, ${woning.woningtype}, bouwjaar ${woning.bouwjaar}${indicatie ? " · label: indicatie op basis van bouwjaar" : ""}`}
                    waarde={formatEuro(woning.waarde)}
                    bandbreedte={`${formatEuro(woning.intervalLaag)} tot ${formatEuro(woning.intervalHoog)}`}
                    energielabel={woning.energielabel}
                  />
                </div>
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
            {/* Tint-zebra (v3): even rijen op navy-wash in plaats van lijnen onder elke rij. */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                  <th className="px-3 py-2 font-medium">Wanneer</th>
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
                className="til-op block rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef focus:outline-2 focus:outline-offset-2 focus:outline-merk"
              >
                <p className="font-semibold text-inkt">{buur.naam}</p>
                <p className="mt-2 font-display text-xl font-semibold text-merk tabular-nums">
                  {formatEuro(Math.round(buur.ankerM2Prijs))} per m2
                </p>
                <p className="mt-2">
                  <Pil variant="merk">{verschilTekst(buur.verschilPct)}</Pil>
                </p>
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
