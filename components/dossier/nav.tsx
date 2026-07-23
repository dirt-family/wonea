import Link from "next/link";

/**
 * Rustige sectienavigatie van het woningdossier: op grote schermen een
 * linkerkolom die meescrolt (sticky), op kleine schermen een horizontale
 * rij. Gewone ankerlinks, geen tabs en geen JavaScript: elke sectie staat
 * gewoon op de pagina en is direct linkbaar.
 */

export const DOSSIER_SECTIES = [
  { id: "overzicht", titel: "Overzicht" },
  { id: "woz", titel: "WOZ-dossier" },
  { id: "energie", titel: "Energie en verduurzaming" },
  { id: "hypotheek", titel: "Hypotheek en overwaarde" },
  { id: "rapporten", titel: "Rapporten en alerts" },
] as const;

export type DossierSectieId = (typeof DOSSIER_SECTIES)[number]["id"];

export function DossierNav({ terugHref }: { terugHref: string }) {
  return (
    <nav aria-label="Dossiersecties" className="lg:sticky lg:top-6">
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {DOSSIER_SECTIES.map((sectie) => (
          <li key={sectie.id} className="shrink-0">
            <a
              href={`#${sectie.id}`}
              className="block whitespace-nowrap rounded-full border border-lijn bg-paneel px-4 py-2 text-sm font-medium text-inkt-zacht transition-colors hover:border-merk hover:text-merk lg:whitespace-normal lg:rounded-lg lg:border-0 lg:bg-transparent lg:px-3"
            >
              {sectie.titel}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-2 hidden border-t border-lijn pt-3 lg:block">
        <Link href={terugHref} className="block px-3 text-sm text-gedempt transition-colors hover:text-merk">
          Terug naar mijn woningen
        </Link>
      </div>
    </nav>
  );
}
