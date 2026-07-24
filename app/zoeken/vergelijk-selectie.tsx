"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { KnopPrimair } from "@/components/ui";

/**
 * Vergelijk-selectie op de zoekpagina: checkbox per woningkaart plus een vaste
 * balk onderaan zodra er iets gekozen is. Client-side omdat het echte
 * interactie is (selectiestatus); de kaarten zelf blijven server-gerenderd.
 */

type Selectie = { slug: string; naam: string };

type VergelijkContext = {
  selectie: Selectie[];
  toggle: (s: Selectie) => void;
  wis: () => void;
};

const Ctx = createContext<VergelijkContext | null>(null);

export const MAX_VERGELIJK = 3;

export function VergelijkProvider({ children }: { children: ReactNode }) {
  const [selectie, setSelectie] = useState<Selectie[]>([]);

  function toggle(s: Selectie) {
    setSelectie((huidig) => {
      if (huidig.some((x) => x.slug === s.slug)) return huidig.filter((x) => x.slug !== s.slug);
      if (huidig.length >= MAX_VERGELIJK) return huidig;
      return [...huidig, s];
    });
  }

  return <Ctx.Provider value={{ selectie, toggle, wis: () => setSelectie([]) }}>{children}</Ctx.Provider>;
}

export function VergelijkCheckbox({ slug, naam }: Selectie) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const geselecteerd = ctx.selectie.some((s) => s.slug === slug);
  const vol = !geselecteerd && ctx.selectie.length >= MAX_VERGELIJK;
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${vol ? "cursor-not-allowed text-gedempt" : "cursor-pointer text-inkt"}`}>
      <input
        type="checkbox"
        checked={geselecteerd}
        disabled={vol}
        onChange={() => ctx.toggle({ slug, naam })}
        className="h-4 w-4 accent-merk"
        aria-label={`Vergelijk ${naam}`}
      />
      Vergelijk
    </label>
  );
}

export function VergelijkBalk() {
  const ctx = useContext(Ctx);
  if (!ctx || ctx.selectie.length === 0) return null;
  const n = ctx.selectie.length;
  const href = `/vergelijken?w=${ctx.selectie.map((s) => s.slug).join(",")}`;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-lijn bg-paneel/95 shadow-[0_-4px_18px_-4px_rgba(30,41,59,0.14)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-sm text-inkt">
          <span className="font-semibold tabular-nums">{n} van {MAX_VERGELIJK}</span> geselecteerd
          {n < 2 ? <span className="text-gedempt">, kies er minstens twee om te vergelijken</span> : null}
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={ctx.wis} className="text-sm text-gedempt underline underline-offset-4 transition-colors hover:text-merk">
            Wis selectie
          </button>
          {n >= 2 ? <KnopPrimair href={href}>Vergelijk {n} woningen</KnopPrimair> : null}
        </div>
      </div>
    </div>
  );
}
