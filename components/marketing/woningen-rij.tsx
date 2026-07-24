import { LegeStaat, VoorbeelddataLabel, WoningKaart } from "@/components/ui";
import { formatEuro } from "@/lib/format";
import type { WoningKaartData } from "@/lib/homepage-data";

/**
 * Horizontaal scrollende rij met echte adrespagina's uit het testgebied.
 * CSS-only: scroll-snap, geen JavaScript. Huisstijl v3: de rijke
 * WoningKaart-signatuur (illustratie-hoek op tint, EU-labelbadge, waarde met
 * bandbreedte, hover-lift). Het voorbeelddata-label staat 1x boven de rij;
 * een indicatief energielabel wordt eerlijk als tag op de kaart benoemd.
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
            <div key={w.id} role="listitem" className="w-[272px] shrink-0 snap-start">
              <WoningKaart
                href={`/woning/${w.postcode}/${w.nummerslug}`}
                adres={`${w.straat} ${w.huisnummer}${w.toevoeging ? ` ${w.toevoeging}` : ""}`}
                plaats={`${w.postcode} ${w.plaats}`}
                waarde={formatEuro(w.waarde)}
                bandbreedte={`${formatEuro(w.intervalLaag)} tot ${formatEuro(w.intervalHoog)}`}
                energielabel={w.energielabel}
                tag={w.energielabel && w.energielabelBron === "indicatie" ? "Label indicatie" : undefined}
                className="h-full"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
