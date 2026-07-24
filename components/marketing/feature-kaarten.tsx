import Link from "next/link";
import type { ReactNode } from "react";
import { Bandbreedte, IcoonRondje, StatTegel, TintSectie } from "@/components/ui";
import type { IcoonNaam } from "@/components/iconen";
import { SPANNING_TEKST } from "@/lib/biedadvies";
import { BESPARING_SPOUWMUUR } from "@/lib/normen/besparing";
import { formatEuro } from "@/lib/format";
import type { VoorbeeldWoning } from "@/lib/homepage-data";

/**
 * Drie feature-kaarten met echte mini-previews van onze eigen UI, gevuld met
 * echte data van het voorbeeldadres en echte kentallen. De previews zijn
 * decoratief (aria-hidden) en niet interactief; de kaart eronder legt uit en
 * linkt naar de tool. Huisstijl v3 + flux-echo (blokken-taal): geen drie
 * gelijke kolommen maar een gemengd blokken-grid, met het vlaggenschip
 * (woningwaarde) als hoge tegel links en de twee andere kaarten gestapeld
 * rechts. Previews als stat-vak op navy-tint, icoon-in-tint-rondje bij de
 * kaartkop, zwevende kaarten met hover-lift, de hele sectie als witte
 * paneel-band in de wash-dramaturgie.
 */

function PreviewVak({ children, groot = false }: { children: ReactNode; groot?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none rounded-lg bg-merk-wash ${groot ? "flex flex-1 flex-col justify-center p-6" : "p-4"}`}
    >
      {children}
    </div>
  );
}

function PreviewLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-merk-600">{children}</p>;
}

function KaartKop({ icoon, tint, children }: { icoon: IcoonNaam; tint: "merk" | "amber"; children: ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <IcoonRondje naam={icoon} tint={tint} />
      <h3 className="text-lg font-semibold">{children}</h3>
    </div>
  );
}

export function FeatureKaarten({ voorbeeld }: { voorbeeld: VoorbeeldWoning | null }) {
  const valuation = voorbeeld?.valuation ?? null;
  const biedadvies = voorbeeld?.biedadvies ?? null;
  const woningUrl = voorbeeld ? `/woning/${voorbeeld.adres.postcode}/${voorbeeld.adres.nummerslug}` : "/";
  const biedadviesUrl = voorbeeld ? `/biedadvies/${voorbeeld.adres.postcode}/${voorbeeld.adres.nummerslug}` : "/tools";

  return (
    <TintSectie wash="paneel">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-semibold">Rekenen aan waarde, bieden en verduurzamen</h2>
        {/* Gemengd blokken-grid: het waarde-blok beslaat links twee rijen. */}
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {/* Waarde met bandbreedte: de hoge vlaggenschip-tegel */}
          <div className="til-op flex flex-col rounded-[14px] border border-lijn bg-paneel p-6 shadow-zweef lg:row-span-2">
            <PreviewVak groot>
              <PreviewLabel>Geschatte waarde</PreviewLabel>
              {valuation ? (
                <>
                  <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-merk">{formatEuro(valuation.waarde)}</p>
                  <Bandbreedte laag={valuation.intervalLaag} waarde={valuation.waarde} hoog={valuation.intervalHoog} />
                </>
              ) : (
                <p className="mt-2 text-sm text-inkt-zacht">Nog geen schatting beschikbaar in het testgebied.</p>
              )}
            </PreviewVak>
            <KaartKop icoon="grafiek" tint="merk">Woningwaarde</KaartKop>
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Elke schatting komt met een bandbreedte en de verkopen waarop die rust. Nooit schijnprecisie.
            </p>
            <Link href={woningUrl} className="mt-3 inline-block self-start text-sm font-semibold text-merk underline underline-offset-4">
              Bekijk de voorbeeldpagina
            </Link>
          </div>

          {/* Biedadvies */}
          <div className="til-op flex flex-col rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef">
            <PreviewVak>
              <PreviewLabel>Realistische biedrange</PreviewLabel>
              {biedadvies ? (
                <>
                  <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-merk">
                    {formatEuro(biedadvies.biedrangeLaag)} tot {formatEuro(biedadvies.biedrangeHoog)}
                  </p>
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
            <KaartKop icoon="euro" tint="merk">Biedadvies</KaartKop>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-inkt-zacht">
              Een biedrange op basis van de overbieding en doorlooptijd in de buurt, met de uitleg erbij.
            </p>
            <Link href={biedadviesUrl} className="mt-3 inline-block self-start text-sm font-semibold text-merk underline underline-offset-4">
              Probeer het biedadvies
            </Link>
          </div>

          {/* Verduurzaming */}
          <div className="til-op flex flex-col rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef">
            {/* Echte StatTegel-component als preview, zoals hij ook in de tool staat. */}
            <div aria-hidden="true" className="pointer-events-none select-none">
              <StatTegel
                tint="amber"
                label={BESPARING_SPOUWMUUR.label}
                waarde={`${formatEuro(BESPARING_SPOUWMUUR.eurPerJaar)} per jaar`}
                delta="Indicatie gemiddelde tussenwoning, Milieu Centraal"
                deltaRichting="neutraal"
              />
            </div>
            <KaartKop icoon="blad" tint="amber">Verduurzamen</KaartKop>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-inkt-zacht">
              Per maatregel de indicatieve besparing per jaar, altijd met bron en peildatum erbij.
            </p>
            <Link href="/verduurzamen" className="mt-3 inline-block self-start text-sm font-semibold text-merk underline underline-offset-4">
              Start de verduurzamingscheck
            </Link>
          </div>
        </div>
      </div>
    </TintSectie>
  );
}
