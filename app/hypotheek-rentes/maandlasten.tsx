"use client";

import { useState } from "react";
import type { RenteBucket } from "@/lib/bronnen/rentes";
import { formatEuro } from "@/lib/format";
import { inputClass, VergelijkTabel } from "@/components/ui";
import { formatPct, klemLeenbedrag, LEEN_DEFAULT, LEEN_MAX, LEEN_MIN, LEEN_STAP, maandlastRijen } from "@/app/hypotheek-rentes/logic";

/**
 * Maandlastentabel met instelbaar leenbedrag. Rekent volledig client-side
 * (pure functies uit logic.ts / lib/hypotheek.ts); er wordt niets opgeslagen
 * of verstuurd. De tabel rekent altijd met het geklemde bedrag, ook als er
 * in het invoerveld tijdelijk iets onvolledigs staat.
 */
export function MaandlastenTabel({ buckets, peilmaand }: { buckets: RenteBucket[]; peilmaand: string }) {
  const [invoer, setInvoer] = useState(String(LEEN_DEFAULT));
  const bedrag = klemLeenbedrag(Number(invoer.replace(/[^\d]/g, "")));
  const rijen = maandlastRijen(bedrag, buckets);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-inkt">Leenbedrag</span>
          <input
            type="range"
            min={LEEN_MIN}
            max={LEEN_MAX}
            step={LEEN_STAP}
            value={bedrag}
            onChange={(e) => setInvoer(e.target.value)}
            className="w-full accent-merk"
            aria-label="Leenbedrag instellen"
          />
          <span className="mt-1 flex justify-between text-xs text-gedempt">
            <span>{formatEuro(LEEN_MIN)}</span>
            <span>{formatEuro(LEEN_MAX)}</span>
          </span>
        </label>
        <label className="block sm:w-44">
          <span className="mb-1 block text-sm font-medium text-inkt">Of typ een bedrag</span>
          <input
            inputMode="numeric"
            placeholder={`bv. ${LEEN_DEFAULT}`}
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-5">
        <VergelijkTabel
          koppen={["Rentevaste periode", "Gemiddelde rente", `Bruto maandlast bij ${formatEuro(bedrag)}`]}
          rijen={rijen.map((rij) => [
            rij.label,
            <span key="pct" className="font-medium">{formatPct(rij.rentePct)}</span>,
            <span key="last" className="font-medium">{formatEuro(rij.maandlast)} per maand</span>,
          ])}
          bron={`Rente: DNB-maandgemiddelde over banken, peilmaand ${peilmaand}. Maandlast: bruto, annuiteitenhypotheek van 30 jaar over ${formatEuro(bedrag)}, zonder belastingeffect. De rente van een concrete geldverstrekker wijkt hiervan af.`}
        />
      </div>
    </div>
  );
}
