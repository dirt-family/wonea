"use client";

import { useState } from "react";
import { annuiteitMaandlast, TOETS_LOOPTIJD_MAANDEN } from "@/lib/hypotheek";
import { formatEuro } from "@/lib/format";

/**
 * Module 8: inline maandlast-minirekenhulp. Client component omdat de twee
 * sliders (bod en rente) directe interactie zijn; de rekenkern is de echte
 * annuiteitenformule uit lib/hypotheek (30 jaar). De standaardrente (DNB-
 * gemiddelde) en het startbod komen als props van de server, met bron en
 * peildatum ernaast in de statische uitleg op de pagina.
 */

const BOD_STAP = 5000;
const RENTE_MIN = 0.5;
const RENTE_MAX = 8;

function rondOpStap(n: number): number {
  return Math.round(n / BOD_STAP) * BOD_STAP;
}

export function MaandlastMini({ standaardBod, standaardRentePct }: { standaardBod: number; standaardRentePct: number }) {
  const start = rondOpStap(standaardBod);
  const bodMin = Math.max(BOD_STAP, rondOpStap(start * 0.6));
  const bodMax = rondOpStap(start * 1.4);
  const renteStart = Math.min(RENTE_MAX, Math.max(RENTE_MIN, Math.round(standaardRentePct * 10) / 10));

  const [bod, setBod] = useState(start);
  const [rentePct, setRentePct] = useState(renteStart);

  const maandlast = Math.round(annuiteitMaandlast(bod, rentePct, TOETS_LOOPTIJD_MAANDEN));
  const renteLabel = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rentePct);

  return (
    <div className="mt-4 grid gap-5 sm:grid-cols-2">
      <div className="space-y-5">
        <label className="block">
          <span className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-inkt">Jouw bod</span>
            <span className="font-semibold tabular-nums">{formatEuro(bod)}</span>
          </span>
          <input
            type="range"
            min={bodMin}
            max={bodMax}
            step={BOD_STAP}
            value={bod}
            onChange={(e) => setBod(Number(e.target.value))}
            className="mt-2 w-full accent-merk"
            aria-valuetext={formatEuro(bod)}
          />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-inkt">Hypotheekrente</span>
            <span className="font-semibold tabular-nums">{renteLabel}%</span>
          </span>
          <input
            type="range"
            min={RENTE_MIN}
            max={RENTE_MAX}
            step={0.1}
            value={rentePct}
            onChange={(e) => setRentePct(Number(e.target.value))}
            className="mt-2 w-full accent-merk"
            aria-valuetext={`${renteLabel} procent`}
          />
        </label>
      </div>
      <div className="rounded-lg bg-merk-wash p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">Bruto maandlast</p>
        <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-merk">{formatEuro(maandlast)}</p>
        <p className="mt-1 text-sm text-gedempt">per maand, 30 jaar annuitair</p>
      </div>
    </div>
  );
}
