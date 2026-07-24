/**
 * Geplande onderwerpen ("In voorbereiding") voor de gids-hub en de
 * categoriepagina's. Flux-echo (BRAND.md "Flux-kleurlaag"): lavendel is de
 * rustige datakant, hier voor wat er nog niet is. Compact twee-koloms raster
 * met lavendel-dots in plaats van een lange rijenlijst; bewust zonder links,
 * want klikbaar wordt pas wat af is. Contrast: inkt op lavendel-wash 13,6:1,
 * lavendel-diep op de wash 6,5:1, dots lavendel-500 op graphics-contrast.
 */
export function GeplandeOnderwerpen({ onderwerpen }: { onderwerpen: string[] }) {
  if (onderwerpen.length === 0) return null;
  return (
    <div className="rounded-[14px] border border-dashed border-lavendel-200 bg-lavendel-wash p-5">
      <p className="text-sm font-semibold text-lavendel-diep">In voorbereiding</p>
      <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {onderwerpen.map((onderwerp) => (
          <li key={onderwerp} className="flex items-start gap-2.5 text-sm leading-relaxed text-inkt">
            <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-lavendel-500" />
            {onderwerp}
          </li>
        ))}
      </ul>
    </div>
  );
}
