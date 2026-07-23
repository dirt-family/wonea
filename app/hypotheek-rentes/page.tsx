import type { Metadata } from "next";
import { getActueleRentes, peilmaandLabel } from "@/lib/bronnen/rentes";
import { formatDatumNl } from "@/lib/util";
import { HYPOTHEEK_PARTIJ_TYPE } from "@/app/hypotheek/consent-tekst";
import { Kaart, LeadCta, SectieLabel, Sparkline, StatTegel, UitklapUitleg } from "@/components/ui";
import { MaandlastenTabel } from "@/app/hypotheek-rentes/maandlasten";
import { formatPct, renteHistorie, sparklineReeks } from "@/app/hypotheek-rentes/logic";

/**
 * Actuele rentestanden (DNB-gemiddelden per rentevast-bucket) plus een
 * client-side maandlastentabel voor een instelbaar leenbedrag. Geen adresdata
 * op deze pagina, dus geen suppressiecheck nodig. Noindex tot Fase 5-gating
 * daar anders over beslist (CONTRACTS: SEO).
 */
export const metadata: Metadata = {
  title: "Actuele hypotheekrentes: gemiddelden per rentevaste periode",
  description:
    "De actuele gemiddelde hypotheekrente per rentevaste periode volgens DNB, met de bruto maandlast voor jouw leenbedrag.",
  robots: { index: false, follow: false },
};

export default function HypotheekRentesPagina() {
  const rentes = getActueleRentes();
  const peilmaand = peilmaandLabel(rentes.peildatum);
  const historie = renteHistorie();
  const historieBuckets = rentes.buckets
    .map((bucket) => ({ bucket, reeks: sparklineReeks(historie, bucket.bucket) }))
    .filter(({ reeks }) => reeks.length >= 2);

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

      <Kaart className="mt-8">
        <h2 className="text-lg font-semibold">Eerlijk over deze cijfers</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Dit zijn gemiddelden over banken, gepubliceerd door DNB. De rente die een specifieke geldverstrekker jou biedt
          verschilt daarvan: per verstrekker, per risicoklasse en per dag. Die tarieven zijn niet openbaar als open data,
          dus die tonen we niet. Een adviseur ziet het actuele aanbod wel.
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
