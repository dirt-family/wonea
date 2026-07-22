import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, municipalities, wozValues } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro, normalizePostcode } from "@/lib/util";
import { BronLabel, Kaart, SectieLabel, VoorbeelddataLabel } from "@/components/ui";
import { MarktSignalenKaart } from "@/components/markt/signalen";

type Params = { postcode: string; nummerslug: string };

function vindAdres(params: Params) {
  const postcode = normalizePostcode(params.postcode);
  if (!postcode) return null;
  const nummerslug = params.nummerslug.toLowerCase();
  const adres = db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
    .get();
  if (!adres) return null;
  if (adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) return null;
  return adres;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const adres = vindAdres(await params);
  if (!adres) return { title: "Woning niet gevonden" };
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  return {
    title: `${naam}, ${adres.postcode} ${adres.plaats}: woningwaarde en bandbreedte`,
    description: `Geschatte waarde van ${naam} in ${adres.plaats}, met eerlijke bandbreedte, de verkopen erachter en een uitgelegde methode.`,
    robots: { index: false, follow: false }, // indexatie-gating beslist in Fase 5
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

export default async function WoningPagina({ params }: { params: Promise<Params> }) {
  const adres = vindAdres(await params);
  if (!adres) notFound();

  const { valuation, comparables, buurt } = getOrCreateValuation(adres);
  const gemeente = buurt ? db.select().from(municipalities).where(eq(municipalities.code, buurt.gemeenteCode)).get() : undefined;
  const woz = db.select().from(wozValues).where(eq(wozValues.adresId, adres.id)).orderBy(wozValues.peiljaar).all().at(-1);
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  const adresQuery = `postcode=${adres.postcode}&nummer=${adres.nummerslug}`;
  const labelSlecht = ["D", "E", "F", "G"].includes((adres.energielabel ?? "").toUpperCase());
  const maandFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> / {adres.plaats} / {adres.straat}
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{naam}</h1>
      <p className="mt-1 text-inkt-zacht">{adres.postcode} {adres.plaats}{buurt ? `, buurt ${buurt.naam}` : ""}</p>

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
                Dit is een modelmatige schatting ({valuation.modelVersie}), geen taxatie. <Link href="/methode" className="underline underline-offset-2 hover:text-merk">Zo rekenen we</Link>.
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

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Kaart className="lg:col-span-2">
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

        <div className="space-y-5">
          <Kaart>
            <SectieLabel>WOZ-waarde</SectieLabel>
            {woz ? (
              <>
                <p className="mt-3 font-display text-2xl font-semibold text-merk">{formatEuro(woz.waarde)}</p>
                <p className="mt-1 text-xs text-gedempt">peiljaar {woz.peiljaar}</p>
                {woz.bron === "seed" ? <p className="mt-2"><BronLabel>voorbeeldwaarde, niet je echte WOZ</BronLabel></p> : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-inkt-zacht">Wij tonen hier geen WOZ-waarde zonder bron.</p>
            )}
            <Link href={`/woz-check?${adresQuery}`} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
              Vergelijk met je eigen WOZ-beschikking
            </Link>
          </Kaart>

          {buurt ? (
            <Kaart>
              <SectieLabel>
                Buurt{" "}
                {gemeente ? (
                  <Link href={`/buurt/${gemeente.slug}/${buurt.slug}`} className="underline underline-offset-2 hover:text-merk">
                    {buurt.naam}
                  </Link>
                ) : (
                  buurt.naam
                )}
              </SectieLabel>
              <dl className="mt-3 space-y-3 text-sm">
                {buurt.gemWoz ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gedempt">Gemiddelde WOZ</dt>
                    <dd className="font-medium">{formatEuro(buurt.gemWoz)}</dd>
                  </div>
                ) : null}
                {buurt.inwoners ? (
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">Inwoners</dt><dd className="font-medium">{buurt.inwoners}</dd></div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs text-gedempt">Afgeleid van CBS-buurtcijfers.</p>
            </Kaart>
          ) : null}

          {buurt ? (
            <MarktSignalenKaart
              variant="compact"
              buurtCode={buurt.buurtCode}
              buurtNaam={buurt.naam}
              buurtHref={gemeente ? `/buurt/${gemeente.slug}/${buurt.slug}` : undefined}
            />
          ) : null}

          {labelSlecht ? (
            <Kaart className="bg-accent-wash">
              <SectieLabel>Verduurzamen</SectieLabel>
              <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
                Label {adres.energielabel}: isolatie, zonnepanelen of een warmtepomp verlagen je energierekening en tellen mee
                in de waarde.
              </p>
              <Link href={`/verduurzamen?${adresQuery}`} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
                Bekijk wat dit oplevert
              </Link>
            </Kaart>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Kaart className="bg-merk-wash">
          <SectieLabel>Jouw woning?</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Volg de waarde van dit adres</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Claim deze woning en ontvang maandelijks de waardeontwikkeling. Gratis, en je zit nergens aan vast.
          </p>
          <Link href={`/claim?${adresQuery}`} className="mt-4 inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht">
            Dit is mijn woning
          </Link>
        </Kaart>
        <Kaart>
          <SectieLabel>Biedadvies</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Wat is een realistisch bod?</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Bekijk wat er in deze buurt over of onder de vraagprijs wordt geboden en wat dat betekent voor jouw bod.
          </p>
          <Link
            href={`/biedadvies/${adres.postcode}/${adres.nummerslug}`}
            className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4"
          >
            Naar het biedadvies
          </Link>
        </Kaart>
      </div>

      <div className="mt-10 rounded-[14px] border border-lijn bg-paneel p-6">
        <h2 className="text-base font-semibold">Liever niet op Wonea?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Dit is openbare data, maar het blijft jouw huis. Verwijderen kan altijd, in twee stappen, zonder account. Na
          verwijdering komt dit adres ook bij nieuwe data-imports niet terug.
        </p>
        <Link
          href={`/verwijderen?${adresQuery}`}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk"
        >
          Deze woningpagina verwijderen
        </Link>
      </div>
    </div>
  );
}
