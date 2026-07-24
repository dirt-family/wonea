import { Kaart, KnopSecundair, VoorbeelddataLabel } from "@/components/ui";
import { formatEuro } from "@/lib/util";
import type { Comparable } from "@/lib/comparables";

/**
 * Module 5: "Wat zou je kunnen bieden?" De eerlijke biedmodule: geen beloofde
 * uitkomst, wel de echte verkopen op buurtniveau die je richting geven, plus
 * de route naar het biedadvies. BEWUST geen "+X% boven vraagprijs": we hebben
 * geen vraagprijsdata (PROTOTYPE-OOGST.md). Seed-verkopen hebben nooit een
 * adres, dus we tonen alleen de straat.
 */
export function BiedModule({
  comparables,
  niveau,
  postcode,
  nummerslug,
}: {
  comparables: Comparable[];
  niveau: "straat" | "buurt";
  postcode: string;
  nummerslug: string;
}) {
  const maandFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });
  const heeftSeed = comparables.some((c) => c.bron === "seed");

  return (
    <Kaart>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">Wat zou je kunnen bieden?</h2>
        {heeftSeed ? <VoorbeelddataLabel /> : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
        Eerlijk: niemand kan je vertellen wat het exact wordt, en wees voorzichtig met sites die dat wel beloven. Wat we
        wel kunnen: laten zien wat vergelijkbare huizen in de buurt echt opbrachten.
      </p>

      {comparables.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          {/* Tint-zebra (v3): even rijen op navy-wash, zodat de rij leesbaar blijft zonder zware lijnen. */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                <th className="px-3 py-2 font-medium">Wanneer</th>
                <th className="px-3 py-2 font-medium">Straat</th>
                <th className="px-3 py-2 font-medium">Oppervlakte</th>
                <th className="px-3 py-2 font-medium">Prijs</th>
              </tr>
            </thead>
            <tbody>
              {comparables.map((c) => (
                <tr key={c.id} className="even:bg-merk-50">
                  <td className="rounded-l-lg px-3 py-2.5">{maandFmt.format(new Date(c.datum))}</td>
                  <td className="px-3 py-2.5">{c.straat ?? "onbekend"}</td>
                  <td className="px-3 py-2.5 tabular-nums">{c.oppervlakteM2} m2</td>
                  <td className="rounded-r-lg px-3 py-2.5 font-semibold tabular-nums">{formatEuro(c.prijs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
          {niveau === "straat" ? "In deze straat" : "In deze buurt"} vonden we geen recente vergelijkbare verkopen. We
          tonen hier alleen echte verkopen, dus dan blijft de lijst leeg.
        </p>
      )}

      <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
        Het biedadvies rekent hiermee door wat een redelijk bod is voor dit huis. Concreet, geen verkooppraatje.
      </p>
      <div className="mt-3">
        <KnopSecundair href={`/biedadvies/${postcode}/${nummerslug}`}>Naar het biedadvies</KnopSecundair>
      </div>
    </Kaart>
  );
}
