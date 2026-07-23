import type { Metadata } from "next";
import { getActueleRentes, peilmaandLabel } from "@/lib/bronnen/rentes";
import { getVerstrekkersRentes, groepeerVoorTabel } from "@/lib/bronnen/rentes-verstrekkers";
import { formatDatumNl } from "@/lib/util";
import { HYPOTHEEK_PARTIJ_TYPE } from "@/app/hypotheek/consent-tekst";
import { Kaart, LeadCta, SectieLabel, Sparkline, StatTegel, UitklapUitleg, VergelijkTabel } from "@/components/ui";
import { MaandlastenTabel } from "@/app/hypotheek-rentes/maandlasten";
import { formatPct, renteHistorie, sparklineReeks } from "@/app/hypotheek-rentes/logic";

/**
 * Actuele rentestanden (DNB-gemiddelden per rentevast-bucket) plus een
 * client-side maandlastentabel voor een instelbaar leenbedrag. Geen adresdata
 * op deze pagina, dus geen suppressiecheck nodig.
 */
export const metadata: Metadata = {
  title: "Actuele hypotheekrentes per rentevaste periode",
  description:
    "De actuele gemiddelde hypotheekrente per rentevaste periode volgens DNB, met de bruto maandlast voor jouw leenbedrag.",
  alternates: { canonical: "/hypotheek-rentes" },
  // Bewust indexeerbaar (rekenhulpen = index): statische pagina zonder
  // adresdata. Staat daarom ook in /sitemaps/statisch.xml (lib/seo/sitemap.ts);
  // indexeren en opnemen in de sitemap horen bij elkaar.
  robots: { index: true, follow: true },
};

export default function HypotheekRentesPagina() {
  const rentes = getActueleRentes();
  const peilmaand = peilmaandLabel(rentes.peildatum);
  const historie = renteHistorie();
  const historieBuckets = rentes.buckets
    .map((bucket) => ({ bucket, reeks: sparklineReeks(historie, bucket.bucket) }))
    .filter(({ reeks }) => reeks.length >= 2);

  const verstrekkers = getVerstrekkersRentes();
  const verstrekkerRijen = groepeerVoorTabel(verstrekkers.rijen);
  // Condities per verstrekker voor de uitklap: 1 regel als NHG en niet-NHG
  // dezelfde voorwaarden hebben, anders per NHG-status een regel.
  const verstrekkerCondities = [...new Set(verstrekkerRijen.map((r) => r.verstrekker))].map((naam) => {
    const entries = verstrekkerRijen
      .filter((r) => r.verstrekker === naam && r.opmerkingen.length > 0)
      .map((r) => ({
        label: r.nhg === "ja" ? "met NHG" : r.nhg === "nee" ? "zonder NHG" : "NHG onbekend",
        tekst: r.opmerkingen.join("; "),
      }));
    const uniek = [...new Set(entries.map((e) => e.tekst))];
    return { naam, regels: uniek.length <= 1 ? uniek : entries.map((e) => `${e.label}: ${e.tekst}`) };
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-semibold sm:text-4xl">Actuele hypotheekrentes</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-inkt-zacht">
        De gemiddelde rente die banken rekenden op nieuw afgesloten woninghypotheken, per rentevaste periode.
        {rentes.totaalRentePct !== null ? (
          <> Over alle rentevaste perioden samen was het gemiddelde {formatPct(rentes.totaalRentePct)}.</>
        ) : null}
      </p>
      <p className="mt-2 text-sm text-gedempt">
        Bron: DNB, peilmaand {peilmaand}. Opgehaald op {formatDatumNl(rentes.opgehaaldOp)}. DNB publiceert deze cijfers met
        ongeveer twee maanden vertraging.
      </p>

      <div className="mt-8">
        <SectieLabel>Gemiddelde rente per rentevaste periode</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {rentes.buckets.map((bucket) => (
            <StatTegel
              key={bucket.bucket}
              label={bucket.label}
              waarde={formatPct(bucket.rentePct)}
              delta={`DNB, ${peilmaand}`}
              deltaRichting="neutraal"
            />
          ))}
        </div>
      </div>

      {historieBuckets.length > 0 ? (
        <Kaart className="mt-8">
          <SectieLabel>Verloop van de gemiddelde rente</SectieLabel>
          <p className="mt-2 text-sm text-inkt-zacht">
            Maandgemiddelden van {peilmaandLabel(historie[0].maand)} tot en met {peilmaandLabel(historie[historie.length - 1].maand)}.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {historieBuckets.map(({ bucket, reeks }) => (
              <div key={bucket.bucket}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">{bucket.label}</p>
                <Sparkline waarden={reeks} />
                <p className="text-sm text-inkt-zacht">
                  van {formatPct(reeks[0])} naar {formatPct(reeks[reeks.length - 1])}
                </p>
              </div>
            ))}
          </div>
        </Kaart>
      ) : null}

      <Kaart className="mt-8">
        <SectieLabel>Wat betekent dit voor je maandlasten?</SectieLabel>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Stel je leenbedrag in en zie per rentevaste periode wat de gemiddelde rente betekent voor je bruto maandlast bij
          een annuiteitenhypotheek van 30 jaar. Dit is een indicatie met gemiddelden, geen offerte.
        </p>
        <div className="mt-5">
          <MaandlastenTabel buckets={rentes.buckets} peilmaand={peilmaand} />
        </div>
      </Kaart>

      {verstrekkers.beschikbaar ? (
        <Kaart className="mt-8">
          <SectieLabel>Rentes per geldverstrekker</SectieLabel>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            De actuele rente voor 10 en 20 jaar vast zoals de banken die zelf op hun website publiceren, met en zonder
            NHG. Elke rij is de standaardweergave van de rentepagina van die bank; de voorwaarden per tarief staan
            onder de tabel.
          </p>
          <div className="mt-5">
            <VergelijkTabel
              koppen={["Verstrekker", "10 jaar", "20 jaar", "NHG"]}
              rijen={verstrekkerRijen.map((rij) => [
                <div key={`${rij.verstrekker}-${rij.nhg}`}>
                  <a href={rij.bronUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 hover:text-merk">
                    {rij.verstrekker}
                  </a>
                  <p className="mt-0.5 text-xs text-gedempt">{rij.product}</p>
                </div>,
                <span key="p10" className="tabular-nums">{rij.pct10 === null ? "geen opgave" : formatPct(rij.pct10)}</span>,
                <span key="p20" className="tabular-nums">{rij.pct20 === null ? "geen opgave" : formatPct(rij.pct20)}</span>,
                rij.nhg === "ja" ? "Ja" : rij.nhg === "nee" ? "Nee" : "Onbekend",
              ])}
              bron={`Rechtstreeks van de websites van de banken, peildatum ${formatDatumNl(verstrekkers.peildatum)}. Controleer altijd de actuele tarieven bij de bank zelf.`}
            />
          </div>
          <div className="mt-4">
            <UitklapUitleg titel="Welke voorwaarden horen bij deze tarieven?">
              <p>
                Elk tarief hoort bij een specifiek product en een tariefklasse (de verhouding tussen je hypotheek en de
                waarde van je huis). Jouw persoonlijke rente kan dus anders zijn. Dit is wat de banken bij de getoonde
                tarieven vermelden:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {verstrekkerCondities.map(({ naam, regels }) => (
                  <li key={naam}>
                    <span className="font-medium">{naam}</span>
                    {regels.length === 1 ? <>: {regels[0]}</> : (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {regels.map((regel) => (
                          <li key={regel}>{regel}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                Niet elke geldverstrekker staat in de tabel: sommige banken blokkeren geautomatiseerd ophalen of
                publiceren hun tarieven alleen als pdf of in een rekentool. Die banken ontbreken dan eerlijk, we nemen
                nooit cijfers over van vergelijkingssites.
              </p>
            </UitklapUitleg>
          </div>
        </Kaart>
      ) : (
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-gedempt">
          Tarieven per geldverstrekker kunnen we nu niet tonen: onze laatste controle van de bankwebsites ontbreekt of
          is te lang geleden. Verouderde rentes tonen we liever niet.
        </p>
      )}

      <Kaart className="mt-8">
        <h2 className="text-lg font-semibold">Eerlijk over deze cijfers</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          De gemiddelden hierboven komen van DNB. De rente die een specifieke geldverstrekker jou biedt verschilt
          daarvan: per verstrekker, per risicoklasse en per dag.{" "}
          {verstrekkers.beschikbaar
            ? "De tabel per geldverstrekker is een momentopname van de eigen websites van de banken; jouw persoonlijke rente kan daar nog van afwijken."
            : "Die tarieven per verstrekker zijn niet openbaar als open data, dus die tonen we nu niet."}{" "}
          Een adviseur ziet het actuele aanbod wel.
        </p>
      </Kaart>

      <div className="mt-5">
        <LeadCta
          titel="Weten welke rente jij echt kunt krijgen?"
          tekst="Een onafhankelijke hypotheekadviseur ziet de actuele tarieven per geldverstrekker en rekent met jouw situatie: inkomen, woning en rentevaste periode."
          knopTekst="Stel je hypotheekvraag"
          href="/hypotheek"
          ontvanger={HYPOTHEEK_PARTIJ_TYPE}
        />
      </div>

      <div className="mt-8">
        <UitklapUitleg titel="Zo komen we aan deze cijfers, en wat ze niet zijn">
          <p>
            De rentes komen uit {rentes.bron}. Dat is de gemiddelde bancaire rente op zuiver nieuw afgesloten
            woninghypotheken aan huishoudens, per rentevaste periode. Peilmaand: {peilmaand}, opgehaald op{" "}
            {formatDatumNl(rentes.opgehaaldOp)}. DNB publiceert met ongeveer twee maanden vertraging, dus actueler dan dit
            wordt open data niet.
          </p>
          <p className="mt-3">Wat deze cijfers niet zijn:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Geen tarieven per geldverstrekker: DNB publiceert alleen het gemiddelde over banken.</li>
            <li>Geen splitsing naar NHG of risicoklasse, terwijl die je werkelijke rente wel bepalen.</li>
            <li>Geen advies: welke rentevaste periode bij je past hangt af van je situatie.</li>
          </ul>
          <p className="mt-3">
            De maandlast rekenen we uit met de standaard annuiteitenformule: een vast bruto maandbedrag dat het leenbedrag
            in 30 jaar precies aflost, hetzelfde uitgangspunt als de wettelijke leennormen. Het is een bruto bedrag, dus
            zonder belastingeffect, en zonder verplichte verzekeringen of andere kosten.
          </p>
          <p className="mt-3">
            Bron:{" "}
            <a href={rentes.bronUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-merk">
              DNB Tabel 5.2.7.1 (data-zoeken)
            </a>{" "}
            en het{" "}
            <a href={rentes.dashboardUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-merk">
              DNB-dashboard hypotheekrentes
            </a>
            .
          </p>
        </UitklapUitleg>
      </div>
    </div>
  );
}
