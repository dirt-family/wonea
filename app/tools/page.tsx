import type { Metadata } from "next";
import Link from "next/link";
import { Kaart, SectieLabel } from "@/components/ui";
import { Zoekbalk } from "@/components/zoekbalk";

export const metadata: Metadata = {
  title: "Tools: gratis inzicht in waarde, hypotheek en verduurzamen",
  description:
    "Alle gratis tools van Wonea op een rij: woningwaarde, WOZ-check, budget, hypotheekrentes, verduurzamen, biedadvies en makelaars. Zonder account, met bron per tool.",
  // Bewust indexeerbaar: dit is een statische landingspagina zonder adresdata.
  // Hij staat daarom ook in /sitemaps/statisch.xml (lib/seo/sitemap.ts);
  // indexeren en opnemen in de sitemap horen bij elkaar.
  robots: { index: true, follow: true },
};

/**
 * Tools-hub: alle tools op een rij, elk met 1 eerlijke zin en de bron waar de
 * tool op draait. Geen cijfers op deze pagina; bron en peildatum per getal
 * staan in de tools zelf. Biedadvies hoort bij een adres en krijgt daarom
 * uitleg plus zoekbalk in plaats van een directe link.
 */

type Tool = { titel: string; zin: string; bron: string; href: string; linkTekst: string };

const TOOLS: Tool[] = [
  {
    titel: "Woningwaarde-check",
    zin: "De geschatte waarde van een adres in ons testgebied, altijd als bandbreedte met de verkopen erachter.",
    bron: "eigen rekenmodel op recente verkopen in de buurt en CBS-buurtcijfers. In deze testfase zijn de verkopen voorbeelddata.",
    href: "/",
    linkTekst: "Zoek een adres",
  },
  {
    titel: "WOZ-check",
    zin: "Vergelijk de WOZ-waarde van je beschikking met onze marktschatting; bij een groot verschil leggen we uit hoe bezwaar werkt, gratis via je gemeente.",
    bron: "jouw eigen WOZ-beschikking naast onze marktschatting. Je invoer wordt niet opgeslagen.",
    href: "/woz-check",
    linkTekst: "Start de WOZ-check",
  },
  {
    titel: "Budgetberekenaar",
    zin: "Bereken hoeveel hypotheek je ongeveer kunt krijgen: een indicatie volgens de officiële leennormen, geen hypotheekadvies.",
    bron: "de wettelijke leennormen 2026 (Staatscourant) en de NHG-voorwaarden.",
    href: "/budget",
    linkTekst: "Bereken je budget",
  },
  {
    titel: "Actuele hypotheekrentes",
    zin: "De gemiddelde rente op nieuwe hypotheken per rentevaste periode, en wat die betekent voor je maandlasten.",
    bron: "DNB-gemiddelden per rentevaste periode. Geen vergelijking per geldverstrekker: die cijfers zijn niet openbaar.",
    href: "/hypotheek-rentes",
    linkTekst: "Bekijk de rentes",
  },
  {
    titel: "Verduurzamingscheck",
    zin: "Zie per adres wat isolatie, zonnepanelen of een warmtepomp je opleveren aan energierekening en comfort.",
    bron: "het energielabel (of een indicatie op bouwjaar, altijd gelabeld), ISDE-subsidieregels en besparingskentallen.",
    href: "/verduurzamen",
    linkTekst: "Start de verduurzamingscheck",
  },
  {
    titel: "Vind een makelaar",
    zin: "Makelaars bij jou in de buurt op een rij, zonder ranking en zonder betaalde posities.",
    bron: "OpenStreetMap (ODbL). De dekking wisselt per gebied, dus dit overzicht is niet compleet.",
    href: "/makelaars",
    linkTekst: "Vind een makelaar",
  },
];

function ToolKaart({ tool }: { tool: Tool }) {
  return (
    <Kaart className="flex flex-col">
      <h2 className="text-lg font-semibold">{tool.titel}</h2>
      <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">{tool.zin}</p>
      <p className="mt-3 flex-1 text-xs leading-relaxed text-gedempt">Bron: {tool.bron}</p>
      <Link href={tool.href} className="mt-4 self-start text-sm font-semibold text-merk underline underline-offset-4">
        {tool.linkTekst}
      </Link>
    </Kaart>
  );
}

export default function ToolsPagina() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> / Tools
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Gratis inzicht, zonder account</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Zeven tools rond wonen, kopen en verduurzamen. Allemaal gratis en zonder account, en bij elke tool staat op welke
        bron hij draait en wat hij niet weet. Cijfers in de tools zelf komen altijd met bron en peildatum.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <ToolKaart key={tool.titel} tool={tool} />
        ))}
      </div>

      <div id="biedadvies" className="mt-5">
        <Kaart className="bg-merk-wash">
          <SectieLabel>Biedadvies</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Wat is een realistisch bod?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            Het biedadvies hoort bij een specifieke woning: een realistische biedrange op basis van de waardebandbreedte,
            plus de overbieding en doorlooptijd in de buurt. Context, geen aankoopadvies.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-gedempt">
            Bron: onze waardebandbreedte en buurtcijfers over overbieding en doorlooptijd. In deze testfase zijn dat
            voorbeelddata.
          </p>
          <p className="mt-4 text-sm font-medium text-inkt">Zoek de woning; op de woningpagina staat de link naar het biedadvies.</p>
          <div className="mt-3">
            <Zoekbalk />
          </div>
        </Kaart>
      </div>

      <div className="mt-10 rounded-[14px] border border-lijn bg-paneel p-6">
        <h2 className="text-base font-semibold">Hoe zit het met gratis?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Alle tools zijn gratis en werken zonder account. Sommige eindigen in een vrijblijvende vervolgstap, zoals een
          voorstel voor verduurzaming. Verstuur je zo&apos;n aanvraag, dan staat er altijd vooraf bij naar welk type partij hij
          gaat, en zonder jouw akkoord gaat er niets de deur uit.
        </p>
        <p className="mt-4 space-x-5 text-sm">
          <Link href="/methode" className="font-semibold text-merk underline underline-offset-4">Zo rekenen we</Link>
          <Link href="/privacy" className="font-semibold text-merk underline underline-offset-4">Privacy en verwijderen</Link>
        </p>
      </div>
    </div>
  );
}
