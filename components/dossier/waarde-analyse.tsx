"use client";

import { useState } from "react";
import { AnalyseKaart } from "@/components/ui";
import { WaardeGrafiek } from "@/components/grafieken/waarde-grafiek";
import { formatEuro } from "@/lib/format";

/**
 * De waardehistorie-analyse van het dossier (flux-patroon, BRAND.md): de
 * historie als staafgrafiek met de actuele berekening in lime en de rest
 * gedempt. Twee varianten:
 * - "donker" (default): in de shell-zwarte AnalyseKaart; telt als de ene
 *   donkere band van de pagina.
 * - "licht": dezelfde inhoud voor in een wit Blok (bij meer dan een woning
 *   op het dashboard krijgt alleen de eerste de donkere kaart).
 * De periode-switch is een pill in de kop en filtert alleen de weergave van
 * de ECHTE reeks; hij verschijnt pas als de historie meer dan 12 maanden
 * beslaat (een switch met maar een echte optie is nep). Minder dan 2 punten =
 * eerlijk vertellen dat de historie zich nog opbouwt.
 */

type Punt = { datum: string; waarde: number };

type Periode = "alles" | "12m";

function maandKort(datumIso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "short", year: "2-digit" }).format(new Date(`${datumIso}T00:00:00Z`));
}

function dagKort(datumIso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "2-digit" }).format(
    new Date(`${datumIso}T00:00:00Z`),
  );
}

function maandLang(datumIso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(`${datumIso}T00:00:00Z`));
}

/** Labels moeten uniek zijn (band-scale): maandlabels, anders daglabels; zelfde datum = laatste berekening wint. */
function naarGrafiekData(punten: Punt[]): { label: string; waarde: number }[] {
  const perDatum = new Map<string, number>();
  for (const p of punten) perDatum.set(p.datum, p.waarde);
  const uniek = [...perDatum.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const maandLabels = uniek.map(([datum]) => maandKort(datum));
  const maandUniek = new Set(maandLabels).size === maandLabels.length;
  return uniek.map(([datum, waarde], i) => ({ label: maandUniek ? maandLabels[i] : dagKort(datum), waarde }));
}

export function WaardeAnalyse({ historie, variant = "donker" }: { historie: Punt[]; variant?: "donker" | "licht" }) {
  const [periode, setPeriode] = useState<Periode>("alles");
  const donker = variant === "donker";

  const gesorteerd = [...historie].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  const eerste = gesorteerd[0];
  const laatste = gesorteerd[gesorteerd.length - 1];

  // Periode-switch alleen als de reeks echt verder terugkijkt dan 12 maanden.
  const grens = laatste ? new Date(`${laatste.datum}T00:00:00Z`) : null;
  if (grens) grens.setUTCFullYear(grens.getUTCFullYear() - 1);
  const grensIso = grens ? grens.toISOString().slice(0, 10) : null;
  const heeftOuder = Boolean(grensIso && gesorteerd.some((p) => p.datum < grensIso));
  const zichtbaar = periode === "12m" && grensIso ? gesorteerd.filter((p) => p.datum >= grensIso) : gesorteerd;

  const meta =
    gesorteerd.length >= 2
      ? `${maandLang(eerste.datum)} tot ${maandLang(laatste.datum)}, ${gesorteerd.length} berekeningen`
      : undefined;

  const pill = (waarde: Periode, label: string) => {
    const actief = periode === waarde;
    const kleur = donker
      ? actief
        ? "bg-op-shell text-shell"
        : "text-op-shell-zacht hover:text-op-shell"
      : actief
        ? "bg-shell text-op-shell"
        : "text-inkt-zacht hover:text-inkt";
    return (
      <button
        key={waarde}
        type="button"
        onClick={() => setPeriode(waarde)}
        aria-pressed={actief}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
          donker ? "focus-visible:outline-lime" : "focus-visible:outline-merk"
        } ${kleur}`}
      >
        {label}
      </button>
    );
  };

  const periodeSwitch =
    heeftOuder && gesorteerd.length >= 2 ? (
      <div className={`flex gap-1 rounded-full p-1 ${donker ? "bg-shell-hoog" : "bg-canvas"}`}>
        {pill("12m", "1 jaar")}
        {pill("alles", "alles")}
      </div>
    ) : undefined;

  const inhoud =
    gesorteerd.length < 2 ? (
      <p className={`text-sm leading-relaxed ${donker ? "text-op-shell-zacht" : "text-gedempt"}`}>
        De waardehistorie bouwt zich vanaf nu op: elke nieuwe berekening komt hier als punt bij. Kom later terug voor de
        lijn.
      </p>
    ) : (
      <>
        <WaardeGrafiek data={naarGrafiekData(zichtbaar)} />
        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs ${
            donker ? "text-op-shell-zacht" : "text-gedempt"
          }`}
        >
          <p className="leading-relaxed">
            Elke berekening van ons model is een punt; de waarde schommelt dus nooit onverklaard.
          </p>
          <p className="tabular-nums">
            {formatEuro((zichtbaar[0] ?? eerste).waarde)} naar {formatEuro(laatste.waarde)}
          </p>
        </div>
      </>
    );

  if (donker) {
    return (
      <AnalyseKaart titel="Waardehistorie" meta={meta} actie={periodeSwitch}>
        {inhoud}
      </AnalyseKaart>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-inkt">Waardehistorie</p>
          {meta ? <p className="mt-0.5 text-xs text-gedempt">{meta}</p> : null}
        </div>
        {periodeSwitch ? <div className="shrink-0">{periodeSwitch}</div> : null}
      </div>
      <div className="mt-5">{inhoud}</div>
    </div>
  );
}
