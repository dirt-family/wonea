import type { Metadata } from "next";
import Link from "next/link";
import { Kaart } from "@/components/ui";
import { KostenKoperStepper } from "@/app/kosten-koper/stepper";

/**
 * Kosten koper / eigen geld: overdrachtsbelasting 2026 (geverifieerde
 * normlaag in lib/normen/overdrachtsbelasting-2026.ts) plus een ruwe
 * indicatie van de bijkomende kosten. Pure rekenhulp zonder adres-invoer,
 * dus geen suppressie-pad; er wordt niets opgeslagen of verstuurd.
 * Zelfde SEO-patroon als /budget (indexeerbaar, in de statische sitemap-shard).
 */

export const metadata: Metadata = {
  title: "Kosten koper: hoeveel eigen geld heb je nodig?",
  description:
    "Bereken de overdrachtsbelasting 2026 en een eerlijke indicatie van de bijkomende kosten, inclusief de startersvrijstelling en het minimale eigen geld.",
  alternates: { canonical: "/kosten-koper" },
  // Bewust indexeerbaar: statische rekenhulp zonder adresdata, zelfde patroon
  // als /tools. Staat daarom ook in /sitemaps/statisch.xml (lib/seo/sitemap.ts).
  robots: { index: true, follow: true },
};

export default function KostenKoperPagina() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold sm:text-4xl">Wat komt er bovenop de koopsom?</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Kosten koper betaal je uit eigen zak: overdrachtsbelasting plus de kosten voor notaris, hypotheekadvies en
        taxatie. Vul in twee korte stappen de koopsom en je situatie in en zie hoeveel eigen geld je minimaal nodig
        hebt. Gratis en zonder account; de berekening gebeurt in je browser en we slaan niets op.
      </p>

      <Kaart className="mt-8">
        <KostenKoperStepper />
      </Kaart>

      <p className="mt-8 text-sm leading-relaxed text-gedempt">
        Eerlijk is eerlijk: de overdrachtsbelasting rekenen we exact volgens de wet (tarieven 2026), de overige kosten
        zijn een ruwe indicatie. Bedoeld om je een gevoel te geven, niet om op te baseren. Hoe we rekenen staat bij de
        uitkomst en op de{" "}
        <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
          methodepagina
        </Link>
        .
      </p>
    </div>
  );
}
