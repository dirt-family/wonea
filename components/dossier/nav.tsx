/**
 * Sectienavigatie van het woningdossier: een horizontale rij pill-links onder
 * de dossierkop (de hoofdnavigatie zit sinds de app-shell in de navy
 * sidebar). Gewone ankerlinks, geen tabs en geen JavaScript: elke sectie
 * staat gewoon op de pagina en is direct linkbaar.
 */

export const DOSSIER_SECTIES = [
  { id: "overzicht", titel: "Overzicht" },
  { id: "woz", titel: "WOZ-dossier" },
  { id: "energie", titel: "Energie en verduurzaming" },
  { id: "hypotheek", titel: "Hypotheek en overwaarde" },
  { id: "rapporten", titel: "Rapporten en alerts" },
] as const;

export type DossierSectieId = (typeof DOSSIER_SECTIES)[number]["id"];

export function DossierNav() {
  return (
    <nav aria-label="Dossiersecties">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {DOSSIER_SECTIES.map((sectie) => (
          <li key={sectie.id} className="shrink-0">
            <a
              href={`#${sectie.id}`}
              className="block whitespace-nowrap rounded-full bg-paneel px-4 py-2 text-sm font-medium text-inkt-zacht shadow-zweef transition-colors hover:text-merk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-merk"
            >
              {sectie.titel}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
