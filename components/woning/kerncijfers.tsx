import type { ReactNode } from "react";
import { BronLabel, EnergieLabelBadge } from "@/components/ui";
import { formatEuro } from "@/lib/util";
import { deltaRichting, formatPct, type WozReeksRij } from "@/components/woning/data";

/**
 * Module 3: de kerncijfer-strip. Vier tegels in het StatTegel-stramien, maar
 * lokaal gebouwd omdat twee tegels geen platte tekst zijn (energielabel-badge,
 * bronlabels). GEEN vraagprijs: die data hebben we niet (PROTOTYPE-OOGST.md).
 * Tegels zonder data worden weggelaten, nooit gevuld met een verzonnen getal.
 *
 * v3: stat-tiles op tint (prototype-patroon): navy-wash als basis, de
 * bandbreedte-tegel op amber-wash als het ene warme accent (de bandbreedte is
 * de Wonea-eerlijkheid, dus die mag warm oplichten). Labelkleuren volgen de
 * contrast-paren uit BRAND.md (merk-600 en accent-800 op wash).
 */

function Tegel({ label, children, sub, tint = "merk" }: { label: string; children: ReactNode; sub?: ReactNode; tint?: "merk" | "amber" }) {
  const vlak = tint === "amber" ? "bg-accent-wash" : "bg-merk-wash";
  const labelKleur = tint === "amber" ? "text-accent-800" : "text-merk-600";
  return (
    <div className={`rounded-[14px] p-5 ${vlak}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${labelKleur}`}>{label}</p>
      <div className="mt-2">{children}</div>
      {sub}
    </div>
  );
}

function Groot({ children }: { children: ReactNode }) {
  return <p className="font-display text-2xl font-semibold tabular-nums text-merk">{children}</p>;
}

export function KerncijferStrip({
  woz,
  prijsPerM2,
  buurtM2Prijs,
  energielabel,
  energielabelBron,
  bandbreedte,
}: {
  /** Laatste WOZ-rij met jaarontwikkeling, uit wozReeks; null = geen WOZ met bron. */
  woz: WozReeksRij | null;
  /** Geschatte waarde gedeeld door oppervlakte, hele euro's; null zonder valuation. */
  prijsPerM2: number | null;
  /** Buurtanker (gemWoz / gemiddelde oppervlakte), hele euro's; null indien onbekend. */
  buurtM2Prijs: number | null;
  energielabel: string | null;
  energielabelBron: "echt" | "indicatie";
  bandbreedte: { laag: number; hoog: number } | null;
}) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tegel
        label="WOZ-waarde"
        sub={
          woz ? (
            <>
              {woz.deltaPct !== null ? (
                <p
                  className={`mt-1 text-sm tabular-nums ${
                    deltaRichting(woz.deltaPct) === "op" ? "text-positief" : deltaRichting(woz.deltaPct) === "neer" ? "text-negatief" : "text-gedempt"
                  }`}
                >
                  {formatPct(woz.deltaPct)} t.o.v. {woz.peiljaar - 1}
                </p>
              ) : (
                <p className="mt-1 text-sm text-inkt-zacht">peiljaar {woz.peiljaar}</p>
              )}
              {woz.bron === "seed" ? (
                <p className="mt-2">
                  <BronLabel>voorbeeldwaarde, niet de echte WOZ</BronLabel>
                </p>
              ) : null}
            </>
          ) : undefined
        }
      >
        {woz ? <Groot>{formatEuro(woz.waarde)}</Groot> : <p className="text-sm text-inkt-zacht">Geen WOZ-waarde met bron bekend.</p>}
      </Tegel>

      <Tegel
        label="Prijs per m2"
        sub={
          prijsPerM2 !== null && buurtM2Prijs !== null ? (
            <p className="mt-1 text-sm tabular-nums text-inkt-zacht">buurt: {formatEuro(buurtM2Prijs)} per m2, afgeleid van WOZ</p>
          ) : undefined
        }
      >
        {prijsPerM2 !== null ? <Groot>{formatEuro(prijsPerM2)}</Groot> : <p className="text-sm text-inkt-zacht">Geen schatting, dus geen m2-prijs.</p>}
      </Tegel>

      <Tegel
        label="Energielabel"
        sub={
          energielabel ? (
            <p className="mt-2">
              {energielabelBron === "echt" ? (
                <span className="text-sm text-inkt-zacht">geregistreerd label (EP-Online)</span>
              ) : (
                <BronLabel>indicatie op basis van bouwjaar</BronLabel>
              )}
            </p>
          ) : undefined
        }
      >
        {energielabel ? <EnergieLabelBadge label={energielabel} /> : <p className="text-sm text-inkt-zacht">Onbekend voor dit adres.</p>}
      </Tegel>

      <Tegel label="Bandbreedte" tint="amber" sub={bandbreedte ? <p className="mt-1 text-sm text-inkt-zacht">de eerlijke marge rond de schatting</p> : undefined}>
        {bandbreedte ? (
          <p className="font-display text-xl font-semibold tabular-nums text-merk">
            {formatEuro(bandbreedte.laag)} tot {formatEuro(bandbreedte.hoog)}
          </p>
        ) : (
          <p className="text-sm text-inkt-zacht">Nog geen schatting voor dit adres.</p>
        )}
      </Tegel>
    </div>
  );
}
