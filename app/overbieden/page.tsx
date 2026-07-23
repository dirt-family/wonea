import type { Metadata } from "next";
import Link from "next/link";
import { Kaart } from "@/components/ui";
import { OverbiedenStepper } from "@/app/overbieden/stepper";

/**
 * Overbieden: wat betekent een bod boven de vraagprijs voor je eigen geld?
 * Pure rekenhulp zonder adres-invoer, dus geen suppressie-pad; er wordt
 * niets opgeslagen of verstuurd. Zelfde SEO-patroon als /budget
 * (indexeerbaar, in de statische sitemap-shard).
 */

export const metadata: Metadata = {
  title: "Overbieden: wat betekent je bod?",
  description:
    "Zie wat een bod boven de vraagprijs betekent: banken financieren tot de getaxeerde waarde, de rest betaal je uit eigen zak.",
  alternates: { canonical: "/overbieden" },
  // Bewust indexeerbaar: statische rekenhulp zonder adresdata, zelfde patroon
  // als /tools. Staat daarom ook in /sitemaps/statisch.xml (lib/seo/sitemap.ts).
  robots: { index: true, follow: true },
};

export default function OverbiedenPagina() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold sm:text-4xl">Wat betekent overbieden voor je portemonnee?</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Banken financieren tot de getaxeerde waarde van de woning. Alles wat je daarboven biedt, betaal je uit eigen
        geld. Vul in twee korte stappen je bod en de taxatie in en zie wat dat betekent. Gratis en zonder account; de
        berekening gebeurt in je browser en we slaan niets op.
      </p>

      <Kaart className="mt-8">
        <OverbiedenStepper />
      </Kaart>

      <p className="mt-8 text-sm leading-relaxed text-gedempt">
        Eerlijk: niemand kan je vertellen wat het exact wordt, en wees voorzichtig met sites die dat wel beloven. Deze
        rekenhulp laat alleen de rekensom achter je bod zien. Hoe we rekenen staat bij de uitkomst en op de{" "}
        <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
          methodepagina
        </Link>
        .
      </p>
    </div>
  );
}
