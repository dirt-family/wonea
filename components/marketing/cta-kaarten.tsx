import Link from "next/link";
import { IcoonRondje } from "@/components/ui";
import { Icoon, type IcoonNaam } from "@/components/iconen";

/**
 * Twee CTA's onder de hero: budget berekenen en de WOZ-check. Bewust een
 * horizontale keuze-rij (tekst links, pijl rechts) en geen kaarten-grid,
 * zodat deze sectie een andere layout-familie is dan de feature-kaarten.
 */
export function CtaKaarten() {
  const ctas: { href: string; icoon: IcoonNaam; titel: string; tekst: string; actie: string }[] = [
    {
      href: "/budget",
      icoon: "rekenhulp",
      titel: "Wat kun je lenen?",
      tekst: "Bereken je maximale hypotheek met de wettelijke leennormen van 2026, inclusief het effect van je energielabel.",
      actie: "Bereken je budget",
    },
    {
      href: "/woz-check",
      icoon: "weegschaal",
      titel: "Klopt je WOZ-waarde?",
      tekst: "Vergelijk de WOZ-waarde uit je beschikking met onze marktschatting en zie of bezwaar zin heeft. Gratis, wij verdienen er niets aan.",
      actie: "Start de WOZ-check",
    },
  ];
  return (
    <div className="divide-y divide-lijn overflow-hidden rounded-[14px] border border-lijn bg-paneel shadow-zweef">
      {ctas.map((cta) => (
        <Link key={cta.href} href={cta.href} className="group flex items-center gap-5 p-6 transition-colors hover:bg-merk-50">
          <IcoonRondje naam={cta.icoon} tint={cta.href === "/woz-check" ? "amber" : "merk"} maat="l" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{cta.titel}</h2>
            <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">{cta.tekst}</p>
            <span className="mt-2 inline-block text-sm font-semibold text-merk underline-offset-4 group-hover:underline">
              {cta.actie}
            </span>
          </div>
          <span
            aria-hidden="true"
            className="text-merk-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-merk"
          >
            <Icoon naam="pijlRechts" maat="l" />
          </span>
        </Link>
      ))}
    </div>
  );
}
