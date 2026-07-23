import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, sharedReports } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { baseUrl, formatEuro } from "@/lib/util";
import { BronLabel, Kaart, SectieLabel, VoorbeelddataLabel } from "@/components/ui";

/**
 * Publieke deel-pagina van een woningwaarde-rapport. Toont UITSLUITEND data
 * die ook op de publieke adrespagina staat, alleen via een geldig,
 * niet-ingetrokken token. Opt-out van het adres wint altijd (suppressie).
 */

type Params = { token: string };

async function vindRapport(token: string) {
  const rapport = (await db.select().from(sharedReports).where(eq(sharedReports.token, token)).limit(1))[0];
  if (!rapport || rapport.revokedAt) return null;
  const adres = (await db.select().from(addresses).where(eq(addresses.id, rapport.adresId)).limit(1))[0];
  if (!adres || adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug))) return null;
  return { rapport, adres };
}

function adresNaam(adres: NonNullable<Awaited<ReturnType<typeof vindRapport>>>["adres"]): string {
  return `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const data = await vindRapport(token);
  if (!data) return { title: "Rapport niet gevonden", robots: { index: false, follow: false } };
  const naam = adresNaam(data.adres);
  const titel = `Woningwaarde-rapport: ${naam}, ${data.adres.plaats}`;
  const omschrijving = `Gedeeld rapport met de geschatte waarde van ${naam} in ${data.adres.plaats}, altijd met bandbreedte en de verkopen erachter.`;
  return {
    title: titel,
    description: omschrijving,
    robots: { index: false, follow: false },
    openGraph: {
      title: titel,
      description: omschrijving,
      images: [{ url: `${baseUrl()}/api/og?token=${encodeURIComponent(token)}`, width: 1200, height: 630 }],
    },
  };
}

function ConfidenceTekst({ confidence, n, niveau }: { confidence: string; n: number; niveau: "straat" | "buurt" }) {
  const plek = niveau === "straat" ? "in deze straat" : "in deze buurt";
  if (confidence === "hoog") return <>Gebaseerd op {n} recente verkopen {plek}. Dat geeft een relatief zekere schatting.</>;
  if (confidence === "middel") return <>Gebaseerd op {n} recente verkopen {plek}. Voldoende voor een richting, niet voor zekerheid.</>;
  return <>Er zijn weinig recente verkopen {plek} ({n}), dus de marge is bewust breed. Zo eerlijk is het.</>;
}

function Bandbreedte({ laag, waarde, hoog }: { laag: number; waarde: number; hoog: number }) {
  const positie = hoog === laag ? 50 : ((waarde - laag) / (hoog - laag)) * 100;
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-merk-wash">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full border border-lijn" />
        <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-merk shadow" style={{ left: `calc(${positie}% - 8px)` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-inkt-zacht">
        <span>{formatEuro(laag)}</span>
        <span>{formatEuro(hoog)}</span>
      </div>
    </div>
  );
}

export default async function RapportPagina({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const data = await vindRapport(token);
  if (!data) notFound();

  const { adres } = data;
  const { valuation, comparables, buurt } = await getOrCreateValuation(adres);
  const naam = adresNaam(adres);
  const maandFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <SectieLabel>Woningwaarde-rapport</SectieLabel>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{naam}</h1>
      <p className="mt-1 text-inkt-zacht">
        {adres.postcode} {adres.plaats}
        {buurt ? `, buurt ${buurt.naam}` : ""}
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <Kaart className="lg:col-span-2">
          <SectieLabel>Geschatte woningwaarde</SectieLabel>
          {valuation ? (
            <>
              <p className="mt-3 font-display text-5xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
              <Bandbreedte laag={valuation.intervalLaag} waarde={valuation.waarde} hoog={valuation.intervalHoog} />
              <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
                <ConfidenceTekst confidence={valuation.confidence} n={valuation.nComparables} niveau={comparables.niveau} />
              </p>
              <p className="mt-3 text-xs text-gedempt">
                Dit is een modelmatige schatting ({valuation.modelVersie}), geen taxatie.{" "}
                <Link href="/methode" className="underline underline-offset-2 hover:text-merk">Zo rekenen we</Link>.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
              Voor dit adres kunnen we nog geen eerlijke schatting maken: er zijn te weinig recente verkopen in de buurt en
              geen bruikbaar buurtgemiddelde. Liever geen getal dan een verzonnen getal.
            </p>
          )}
        </Kaart>

        <Kaart>
          <SectieLabel>Kenmerken</SectieLabel>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-gedempt">Bouwjaar</dt><dd className="font-medium">{adres.bouwjaar}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-gedempt">Woonoppervlakte</dt><dd className="font-medium">{adres.oppervlakteM2} m2</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-gedempt">Type</dt><dd className="font-medium">{adres.woningtype}</dd></div>
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Energielabel</dt>
              <dd className="text-right font-medium">
                {adres.energielabel ?? "onbekend"}
                {adres.energielabel && adres.energielabelBron === "indicatie" ? (
                  <span className="mt-1 block"><BronLabel>indicatie op basis van bouwjaar</BronLabel></span>
                ) : null}
              </dd>
            </div>
          </dl>
        </Kaart>
      </div>

      <Kaart className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectieLabel>De verkopen achter deze schatting</SectieLabel>
          {comparables.comparables.some((c) => c.bron === "seed") ? <VoorbeelddataLabel /> : null}
        </div>
        {comparables.comparables.length > 0 ? (
          <>
            <p className="mt-3 text-sm text-inkt-zacht">
              {comparables.niveau === "straat" ? "Recente verkopen in deze straat" : "Recente verkopen in deze buurt"}, zelfde
              woningtype en vergelijkbare grootte.
            </p>
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
                  {comparables.comparables.map((c) => (
                    <tr key={c.id} className="border-b border-lijn last:border-0">
                      <td className="py-2.5 pr-4">{maandFmt.format(new Date(c.datum))}</td>
                      <td className="py-2.5 pr-4">{c.straat ?? "onbekend"}</td>
                      <td className="py-2.5 pr-4 font-medium">{formatEuro(c.prijs)}</td>
                      <td className="py-2.5 pr-4">{c.oppervlakteM2} m2</td>
                      <td className="py-2.5">{c.woningtype}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-inkt-zacht">
            Geen recente vergelijkbare verkopen gevonden. De schatting hierboven leunt daarom op het buurtgemiddelde en heeft
            een brede marge.
          </p>
        )}
      </Kaart>

      <div className="mt-10 border-t border-lijn pt-6 text-sm text-inkt-zacht">
        <p>Gedeeld via Wonea door de bewoner/eigenaar. Schatting met bandbreedte, geen taxatie.</p>
        <p className="mt-2">
          <Link href={`/woning/${adres.postcode}/${adres.nummerslug}`} className="font-semibold text-merk underline underline-offset-4">
            Bekijk de volledige woningpagina
          </Link>
          {" of lees "}
          <Link href="/methode" className="font-semibold text-merk underline underline-offset-4">
            hoe we rekenen
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
