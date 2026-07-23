import { formatDatumNl, formatEuro } from "@/lib/format";

/**
 * Waardehistorie van een woning als rustige SVG-lijn met maandlabels
 * (server-side, currentColor via text-merk). Elke waardeberekening is een
 * punt; bij minder dan 2 punten vertellen we eerlijk dat de historie zich
 * nog opbouwt.
 */

type Punt = { datum: string; waarde: number };

function maandLabel(datumIso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" }).format(new Date(`${datumIso}T00:00:00Z`));
}

export function WaardeGrafiek({ historie }: { historie: Punt[] }) {
  if (historie.length < 2) {
    return (
      <p className="mt-3 text-sm leading-relaxed text-gedempt">
        De waardehistorie bouwt zich vanaf nu op: elke nieuwe berekening komt hier als punt bij. Kom later terug voor de lijn.
      </p>
    );
  }

  const w = 560;
  const h = 120;
  const pad = 8;
  const waarden = historie.map((p) => p.waarde);
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const span = max - min || 1;
  const stap = (w - pad * 2) / (historie.length - 1);
  const coords = historie.map((p, i) => ({
    x: pad + i * stap,
    y: h - pad - ((p.waarde - min) / span) * (h - pad * 2),
  }));
  const lijn = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const eerste = historie[0];
  const laatste = historie[historie.length - 1];
  const midden = historie.length >= 4 ? historie[Math.floor((historie.length - 1) / 2)] : null;
  const toonMiddenLabel = midden && maandLabel(midden.datum) !== maandLabel(eerste.datum) && maandLabel(midden.datum) !== maandLabel(laatste.datum);

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full text-merk"
        role="img"
        aria-label={`Waardeontwikkeling van ${formatEuro(eerste.waarde)} op ${formatDatumNl(eerste.datum)} naar ${formatEuro(laatste.waarde)} op ${formatDatumNl(laatste.datum)}`}
      >
        <polyline points={lijn} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="4" fill="currentColor" />
      </svg>
      <figcaption className="mt-2 flex justify-between gap-2 text-xs text-gedempt">
        <span>
          {maandLabel(eerste.datum)}: {formatEuro(eerste.waarde)}
        </span>
        {toonMiddenLabel && midden ? <span className="hidden sm:inline">{maandLabel(midden.datum)}</span> : null}
        <span className="text-right">
          {maandLabel(laatste.datum)}: {formatEuro(laatste.waarde)}
        </span>
      </figcaption>
    </figure>
  );
}
