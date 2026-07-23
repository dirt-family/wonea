import Link from "next/link";
import { Bandbreedte, LegeStaat, VoorbeelddataLabel } from "@/components/ui";
import { EnergielabelChip } from "@/components/marketing/energielabel-chip";
import { formatEuro } from "@/lib/format";
import type { WoningKaartData } from "@/lib/homepage-data";

/**
 * Horizontaal scrollende rij met echte adrespagina's uit het testgebied.
 * CSS-only: scroll-snap, geen JavaScript. Het voorbeelddata-label staat 1x
 * boven de rij.
 */
export function WoningenRij({ woningen }: { woningen: WoningKaartData[] }) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-5xl px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Woningen in het testgebied</h2>
          <VoorbeelddataLabel />
        </div>
      </div>
      {woningen.length === 0 ? (
        <div className="mx-auto mt-6 max-w-5xl px-5">
          <LegeStaat
            titel="Nog geen woningen met een waardering"
            tekst="Zodra de eerste adrespagina's zijn bekeken, verschijnen ze hier met hun geschatte waarde en bandbreedte."
          />
        </div>
      ) : (
        <div
          className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:px-[max(1.25rem,calc((100vw_-_64rem)/2_+_1.25rem))]"
          role="list"
          aria-label="Voorbeeldwoningen met geschatte waarde"
        >
          {woningen.map((w) => (
            <Link
              key={w.id}
              role="listitem"
              href={`/woning/${w.postcode}/${w.nummerslug}`}
              className="block w-[272px] shrink-0 snap-start rounded-[14px] border border-lijn bg-paneel p-5 transition-colors hover:border-merk"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-inkt">
                    {w.straat} {w.huisnummer}
                    {w.toevoeging ? ` ${w.toevoeging}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gedempt">{w.plaats}</p>
                </div>
                {w.energielabel ? <EnergielabelChip label={w.energielabel} bron={w.energielabelBron} /> : null}
              </div>
              <p className="mt-4 font-display text-2xl font-semibold text-merk">{formatEuro(w.waarde)}</p>
              <Bandbreedte laag={w.intervalLaag} waarde={w.waarde} hoog={w.intervalHoog} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
