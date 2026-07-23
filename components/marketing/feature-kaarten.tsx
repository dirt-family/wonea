import Link from "next/link";
import type { ReactNode } from "react";
import { Bandbreedte, StatTegel } from "@/components/ui";
import { SPANNING_TEKST } from "@/lib/biedadvies";
import { BESPARING_SPOUWMUUR } from "@/lib/normen/besparing";
import { formatEuro } from "@/lib/format";
import type { VoorbeeldWoning } from "@/lib/homepage-data";

/**
 * Drie feature-kaarten met echte mini-previews van onze eigen UI, gevuld met
 * echte data van het voorbeeldadres en echte kentallen. De previews zijn
 * decoratief (aria-hidden) en niet interactief; de kaart eronder legt uit en
 * linkt naar de tool.
 */

function PreviewVak({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none rounded-lg border border-lijn bg-achtergrond p-4">
      {children}
    </div>
  );
}

function PreviewLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-gedempt">{children}</p>;
}

export function FeatureKaarten({ voorbeeld }: { voorbeeld: VoorbeeldWoning | null }) {
  const valuation = voorbeeld?.valuation ?? null;
  const biedadvies = voorbeeld?.biedadvies ?? null;
  const woningUrl = voorbeeld ? `/woning/${voorbeeld.adres.postcode}/${voorbeeld.adres.nummerslug}` : "/";
  const biedadviesUrl = voorbeeld ? `/biedadvies/${voorbeeld.adres.postcode}/${voorbeeld.adres.nummerslug}` : "/tools";

  return (
    <section className="mx-auto max-w-5xl px-5 py-16">
      <h2 className="text-2xl font-semibold">Rekenen aan waarde, bieden en verduurzamen</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {/* Waarde met bandbreedte */}
        <div className="flex flex-col rounded-[14px] border border-lijn bg-paneel p-5">
          <PreviewVak>
            <PreviewLabel>Geschatte waarde</PreviewLabel>
            {valuation ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
                <Bandbreedte laag={valuation.intervalLaag} waarde={valuation.waarde} hoog={valuation.intervalHoog} />
              </>
            ) : (
              <p className="mt-2 text-sm text-inkt-zacht">Nog geen schatting beschikbaar in het testgebied.</p>
            )}
          </PreviewVak>
          <h3 className="mt-4 text-lg font-semibold">Woningwaarde</h3>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-inkt-zacht">
            Elke schatting komt met een bandbreedte en de verkopen waarop die rust. Nooit schijnprecisie.
          </p>
          <Link href={woningUrl} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Bekijk de voorbeeldpagina
          </Link>
        </div>

        {/* Biedadvies */}
        <div className="flex flex-col rounded-[14px] border border-lijn bg-paneel p-5">
          <PreviewVak>
            <PreviewLabel>Realistische biedrange</PreviewLabel>
            {biedadvies ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-merk">
                  {formatEuro(biedadvies.biedrangeLaag)} tot {formatEuro(biedadvies.biedrangeHoog)}
                </p>
                <Bandbreedte
                  laag={biedadvies.biedrangeLaag}
                  waarde={Math.round((biedadvies.biedrangeLaag + biedadvies.biedrangeHoog) / 2)}
                  hoog={biedadvies.biedrangeHoog}
                />
                <p className="mt-2 text-sm text-inkt-zacht">
                  Nu een {SPANNING_TEKST[biedadvies.spanning]}
                  {biedadvies.overbiedingPct6m != null
                    ? `, gemiddeld ${Math.abs(biedadvies.overbiedingPct6m).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}% ${biedadvies.overbiedingPct6m >= 0 ? "boven" : "onder"} de vraagprijs`
                    : ""}
                  .
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-inkt-zacht">Nog geen marktcijfers voor deze buurt.</p>
            )}
          </PreviewVak>
          <h3 className="mt-4 text-lg font-semibold">Biedadvies</h3>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-inkt-zacht">
            Een biedrange op basis van de overbieding en doorlooptijd in de buurt, met de uitleg erbij.
          </p>
          <Link href={biedadviesUrl} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Probeer het biedadvies
          </Link>
        </div>

        {/* Verduurzaming */}
        <div className="flex flex-col rounded-[14px] border border-lijn bg-paneel p-5">
          {/* Echte StatTegel-component als preview, zoals hij ook in de tool staat. */}
          <div aria-hidden="true" className="pointer-events-none select-none">
            <StatTegel
              label={BESPARING_SPOUWMUUR.label}
              waarde={`${formatEuro(BESPARING_SPOUWMUUR.eurPerJaar)} per jaar`}
              delta="Indicatie gemiddelde tussenwoning, Milieu Centraal"
              deltaRichting="neutraal"
            />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Verduurzamen</h3>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-inkt-zacht">
            Per maatregel de indicatieve besparing per jaar, altijd met bron en peildatum erbij.
          </p>
          <Link href="/verduurzamen" className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Start de verduurzamingscheck
          </Link>
        </div>
      </div>
    </section>
  );
}
