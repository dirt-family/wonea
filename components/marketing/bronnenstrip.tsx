/**
 * Bronnenstrip: geen verzonnen social proof, wel de echte open bronnen waar
 * Wonea op draait. Tekstmerken in onze eigen stijl; we gebruiken bewust geen
 * logo's van derden.
 */
const STRIP_BRONNEN = ["Kadaster", "CBS", "RVO", "DNB", "OpenStreetMap"] as const;

export function Bronnenstrip() {
  return (
    <section aria-label="Databronnen" className="border-y border-lijn bg-achtergrond">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-10 gap-y-3 px-5 py-7">
        <p className="text-sm text-gedempt">Gebouwd op open data van</p>
        <ul className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
          {STRIP_BRONNEN.map((bron) => (
            <li key={bron} className="font-display text-lg font-semibold tracking-wide text-merk-500">
              {bron}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
