import Link from "next/link";
import type { PlaatsLink } from "@/lib/homepage-data";

/**
 * Plaatsen-ticker: de ENIGE marquee op de site (BRAND.md). CSS-only:
 * keyframes staan in globals.css, pauzeert on hover en valt bij
 * prefers-reduced-motion terug op een gewone horizontale scroller.
 * Links gaan naar de plaatspagina's op /woningmarkt/<slug>.
 */

function TickerBaan({ plaatsen, verborgen }: { plaatsen: PlaatsLink[]; verborgen?: boolean }) {
  return (
    <div className="marquee-baan" aria-hidden={verborgen || undefined}>
      {plaatsen.map((p, i) => (
        <Link
          key={`${p.slug}-${i}`}
          href={`/woningmarkt/${p.slug}`}
          tabIndex={verborgen ? -1 : undefined}
          className="whitespace-nowrap text-sm font-medium text-inkt-zacht transition-colors hover:text-merk"
        >
          {p.naam}
        </Link>
      ))}
    </div>
  );
}

export function PlaatsenTicker({ plaatsen }: { plaatsen: PlaatsLink[] }) {
  if (plaatsen.length === 0) return null;
  // Vul de baan tot minstens 12 items zodat de lus ook met weinig gemeenten
  // gevuld oogt; de tweede baan is de naadloze kopie (aria-hidden).
  const herhalingen = Math.max(1, Math.ceil(12 / plaatsen.length));
  const baan = Array.from({ length: herhalingen }, () => plaatsen).flat();
  return (
    <section aria-label="Plaatsen op Wonea" className="border-y border-lijn bg-paneel py-6">
      <div className="marquee">
        <TickerBaan plaatsen={baan} />
        <TickerBaan plaatsen={baan} verborgen />
      </div>
    </section>
  );
}
