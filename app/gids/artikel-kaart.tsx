import Link from "next/link";
import type { GidsArtikel } from "@/lib/gids";
import { formatDatumNl } from "@/lib/format";

/**
 * Artikelkaart voor de hub en de categoriepagina's: titel, lead, leestijd.
 * Huisstijl v3: zwevende kaart met hover-lift (til-op + shadow-zweef).
 */
export function ArtikelKaart({ artikel }: { artikel: GidsArtikel }) {
  return (
    <Link
      href={`/gids/${artikel.categorie}/${artikel.slug}`}
      className="til-op group flex flex-col rounded-[14px] border border-lijn bg-paneel p-6 shadow-zweef transition-colors hover:border-merk-300 focus:outline-2 focus:outline-offset-2 focus:outline-merk"
    >
      <h3 className="text-lg font-semibold transition-colors group-hover:text-merk-licht">{artikel.titel}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-inkt-zacht">{artikel.beschrijving}</p>
      <p className="mt-4 text-xs text-gedempt">
        {artikel.leestijdMinuten} min leestijd · bijgewerkt {formatDatumNl(artikel.bijgewerkt)}
      </p>
    </Link>
  );
}
