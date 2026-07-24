import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { municipalities, wozValues } from "@/db/schema";
import { findComparables } from "@/lib/comparables";
import { isAdresIndexeerbaar } from "@/lib/seo/gating";
import { breadcrumbJsonLd, jsonLdScriptProps, woningJsonLd, type Kruimel } from "@/lib/seo/jsonld";
import { getOrCreateValuation, valuationHistorie } from "@/lib/valuation";
import { getRenteBucket, peilmaandLabel } from "@/lib/bronnen/rentes";
import { baseUrl, formatEuro } from "@/lib/util";
import { GrootCijfer, Kaart, ModuleTag } from "@/components/ui";
import {
  deltaRichting,
  formatPct,
  jaarDelta,
  maandPunten,
  vindWoningAdres,
  wozBuurtVergelijk,
  wozReeks,
  type WoningParams,
} from "@/components/woning/data";
import { KerncijferStrip } from "@/components/woning/kerncijfers";
import { WaardeUitleg } from "@/components/woning/waarde-uitleg";
import { BiedModule } from "@/components/woning/biedmodule";
import { EnergieModule } from "@/components/woning/energie";
import { WozCheckModule } from "@/components/woning/woz-check";
import { MaandlastMini } from "@/components/woning/maandlast";
import { KenmerkenModule } from "@/components/woning/kenmerken";
import { WoningSidebar } from "@/components/woning/sidebar";

/**
 * Woningpagina v2: de 10-punts module-opbouw uit docs/PROTOTYPE-OOGST.md
 * (broodkruimel, titelblok met waarde en jaarpil, kerncijfer-strip,
 * waarde-uitleg, biedmodule, energie, WOZ-check, maandlast-minirekenhulp,
 * kenmerken, sticky sidebar). Bewust NIET gebouwd: interesse/populariteit
 * (geen kijkcijfer-bron), omgevingsrisico (geen bron gekoppeld) en een
 * fotogallerij (geen foto's; geen placeholder-nep).
 *
 * ISR on-demand (PLAN par. 1 "Rendering"): niets prerenderen bij build (lege
 * generateStaticParams), elke bezochte URL wordt na de eerste request 24 uur
 * gecachet. Dit gaat SAMEN met de write in getOrCreateValuation, en is zelfs de
 * veiligste variant: de valuation-insert (max 1 rij per adres per dag) gebeurt
 * alleen bij (re)generatie van de pagina, dus hooguit ~1x per 24u per adres in
 * plaats van bij elke bezoeker. Dat verlaagt de druk op de database.
 * Lege generateStaticParams betekent ook: geen DB-writes tijdens `next build`.
 * Opt-out blijft direct zichtbaar: de verwijderflow purget deze route al via
 * revalidatePath (app/verwijderen/[token]). Onderbouwing: docs/PERFORMANCE.md.
 */
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams(): WoningParams[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<WoningParams> }): Promise<Metadata> {
  const adres = await vindWoningAdres(await params);
  if (!adres) return { title: "Woning niet gevonden", robots: { index: false, follow: false } };
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;

  // Indexatie-gating op twee niveaus (lib/seo/gating.ts): gebiedswhitelist
  // EN datadiepte. Default is noindex; alleen een pagina met echte inhoud in
  // een vrijgegeven gebied mag de index in.
  const comparables = await findComparables({
    buurtCode: adres.buurtCode,
    straat: adres.straat,
    woningtype: adres.woningtype,
    oppervlakteM2: adres.oppervlakteM2,
  });
  const indexeerbaar = await isAdresIndexeerbaar(adres, { nComparables: comparables.comparables.length });

  return {
    // Zonder postcode en zonder "en bandbreedte": zo blijft de gerenderde
    // titel (met " | Wonea") bij normale adressen onder de 60 tekens; de
    // postcode staat al in de URL en de bandbreedte in de description.
    title: `${naam}, ${adres.plaats}: woningwaarde`,
    description: `Geschatte waarde van ${naam} in ${adres.plaats}, met eerlijke bandbreedte, de verkopen erachter en een uitgelegde methode.`,
    robots: indexeerbaar ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function WoningPagina({ params }: { params: Promise<WoningParams> }) {
  const adres = await vindWoningAdres(await params);
  if (!adres) notFound();

  const { valuation, comparables, buurt } = await getOrCreateValuation(adres);
  const gemeente = buurt
    ? (await db.select().from(municipalities).where(eq(municipalities.code, buurt.gemeenteCode)).limit(1))[0]
    : undefined;

  const wozRijen = wozReeks(await db.select().from(wozValues).where(eq(wozValues.adresId, adres.id)));
  const laatsteWoz = wozRijen.at(-1) ?? null;
  const historie = await valuationHistorie(adres.id);
  const punten = maandPunten(historie.map((rij) => ({ datum: rij.datum, waarde: rij.waarde })));
  const jaarPct = valuation ? jaarDelta(historie.map((rij) => ({ datum: rij.datum, waarde: rij.waarde })), valuation.waarde) : null;

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  const adresQuery = `postcode=${adres.postcode}&nummer=${adres.nummerslug}`;

  const wozCheck = laatsteWoz
    ? wozBuurtVergelijk({
        wozWaarde: laatsteWoz.waarde,
        oppervlakteM2: adres.oppervlakteM2,
        gemWoz: buurt?.gemWoz ?? null,
        ankerM2Prijs: buurt?.ankerM2Prijs ?? null,
      })
    : null;

  // Minirekenhulp: startbod uit de schatting (of anders de WOZ), standaard-
  // rente uit het DNB-gemiddelde. Geen van beide bekend = module weglaten.
  const renteBucket = getRenteBucket("vanaf_10");
  const standaardBod = valuation?.waarde ?? laatsteWoz?.waarde ?? null;

  // Structured data: kruimelpad + woningkenmerken. BEWUST zonder prijs of
  // waardeschatting; zie de harde regel in lib/seo/jsonld.ts.
  const kruimels: Kruimel[] = [
    { naam: "Wonea", url: `${baseUrl()}/` },
    ...(gemeente ? [{ naam: adres.plaats, url: `${baseUrl()}/woningmarkt/${gemeente.slug}` }] : []),
    ...(buurt && gemeente ? [{ naam: `Buurt ${buurt.naam}`, url: `${baseUrl()}/buurt/${gemeente.slug}/${buurt.slug}` }] : []),
    { naam, url: `${baseUrl()}/woning/${adres.postcode}/${adres.nummerslug}` },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <script {...jsonLdScriptProps(breadcrumbJsonLd(kruimels))} />
      <script {...jsonLdScriptProps(woningJsonLd(adres))} />

      {/* 1. Broodkruimel: Home / Plaats / Buurt / Adres */}
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">
          Wonea
        </Link>
        {" / "}
        {gemeente ? (
          <Link href={`/woningmarkt/${gemeente.slug}`} className="hover:text-merk">
            {adres.plaats}
          </Link>
        ) : (
          adres.plaats
        )}
        {buurt && gemeente ? (
          <>
            {" / "}
            <Link href={`/buurt/${gemeente.slug}/${buurt.slug}`} className="hover:text-merk">
              {buurt.naam}
            </Link>
          </>
        ) : null}
        {" / "}
        <span className="text-inkt">{naam}</span>
      </nav>

      {/* 2. Titelblok: adres links, geschatte waarde met jaarontwikkeling rechts */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{naam}</h1>
          <p className="mt-2 text-inkt-zacht">
            {adres.postcode} {adres.plaats}
            {buurt ? `, ${buurt.naam}` : ""} · {adres.woningtype} · {adres.oppervlakteM2} m2 · bouwjaar {adres.bouwjaar}
          </p>
        </div>
        {valuation ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">Geschatte waarde</p>
            <div className="mt-1">
              {/* Flux-patroon groot-cijfer-plus-lime-delta: alleen "op" wordt een vol lime-vlak. */}
              <GrootCijfer
                waarde={formatEuro(valuation.waarde)}
                delta={jaarPct !== null ? `${formatPct(jaarPct)} in een jaar` : undefined}
                deltaRichting={jaarPct !== null ? deltaRichting(jaarPct) : undefined}
                deltaTint="lime"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* 3. Kerncijfer-strip (geen vraagprijs: die data hebben we niet) */}
      <KerncijferStrip
        woz={laatsteWoz}
        prijsPerM2={valuation ? Math.round(valuation.waarde / adres.oppervlakteM2) : null}
        buurtM2Prijs={buurt?.ankerM2Prijs ? Math.round(buurt.ankerM2Prijs) : null}
        energielabel={adres.energielabel}
        energielabelBron={adres.energielabelBron}
        bandbreedte={valuation ? { laag: valuation.intervalLaag, hoog: valuation.intervalHoog } : null}
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* 4. Wat is dit huis waard? */}
          <WaardeUitleg valuation={valuation} niveau={comparables.niveau} punten={punten} wozRijen={wozRijen} />

          {/* 5. De eerlijke biedmodule */}
          <BiedModule comparables={comparables.comparables} niveau={comparables.niveau} postcode={adres.postcode} nummerslug={adres.nummerslug} />

          {/* 6. Energie en verduurzamen */}
          <EnergieModule
            energielabel={adres.energielabel}
            energielabelBron={adres.energielabelBron}
            woningtype={adres.woningtype}
            adresQuery={adresQuery}
          />

          {/* 7. WOZ-check; alleen met een WOZ en een buurtgemiddelde om tegen af te zetten */}
          {wozCheck && laatsteWoz ? <WozCheckModule vergelijk={wozCheck} wozBron={laatsteWoz.bron} adresQuery={adresQuery} /> : null}

          {/* 8. Maandlast-minirekenhulp; zonder startbod en DNB-rente laten we hem weg */}
          {standaardBod !== null && renteBucket ? (
            <Kaart>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-semibold">Wat kost dit per maand?</h2>
                <ModuleTag>rekenhulp</ModuleTag>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
                Schuif met je bod en de rente en zie wat dat bruto per maand betekent bij een annuiteitenhypotheek van 30
                jaar over het hele bod.
              </p>
              <MaandlastMini standaardBod={standaardBod} standaardRentePct={renteBucket.rentePct} />
              <p className="mt-4 text-xs leading-relaxed text-gedempt">
                Standaardrente: {renteBucket.rentePct.toLocaleString("nl-NL")}%, het DNB-gemiddelde voor nieuwe hypotheken
                met een rentevaste periode langer dan 10 jaar ({peilmaandLabel()}). Bedoeld om je een gevoel te geven,
                niet om op te baseren.{" "}
                <Link href="/budget" className="underline underline-offset-2 hover:text-merk">
                  Bereken je echte leenruimte
                </Link>
                .
              </p>
            </Kaart>
          ) : null}

          {/* 9. Kenmerken */}
          <KenmerkenModule adres={adres} />
        </div>

        {/* 10. Sticky sidebar */}
        <WoningSidebar
          valuation={valuation ? { waarde: valuation.waarde, intervalLaag: valuation.intervalLaag, intervalHoog: valuation.intervalHoog } : null}
          adresQuery={adresQuery}
        />
      </div>

      {/* Merkbelofte: verwijderen kan altijd. Dit blok blijft, los van de module-opbouw. */}
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
