import type { Metadata } from "next";
import Link from "next/link";
import { formatEuro } from "@/lib/util";
import { AlertRij, IcoonRondje, Kaart, KnopPrimair, ModuleTag, Pil } from "@/components/ui";
import { Icoon, type IcoonNaam } from "@/components/iconen";
import { checkoutQuery, veiligeVanUrl } from "@/app/premium/logic";
import { parseProduct, PRODUCTEN, PRODUCT_VOLGORDE } from "@/app/premium/producten";

/** Icoon per product (biedadvies = weegschaal, marktanalyse = grafiek). */
const PRODUCT_ICONEN: Record<string, IcoonNaam> = {
  biedadvies: "weegschaal",
  marktanalyse: "grafiek",
};

export const metadata: Metadata = { title: "Premium verdieping", robots: { index: false, follow: false } };

/**
 * Overzicht van de twee premium-producten (Fase 4.5). searchParams:
 * - product: voorselectie (kaart wordt uitgelicht)
 * - van: terug-url na aankoop; alleen relatieve paden, anders genegeerd
 */
export default async function PremiumPagina({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; van?: string }>;
}) {
  const sp = await searchParams;
  const voorselectie = parseProduct(sp.product);
  const van = veiligeVanUrl(sp.van);

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 [background-image:var(--gradient-hero-wash)]" />
      <div className="relative mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-semibold sm:text-4xl">Premium verdieping</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Twee losse verdiepingen voor wie meer wil dan de basis. Allebei eenmalig: je betaalt één keer, er is geen
        abonnement en er is geen automatische verlenging.
      </p>
      <p className="mt-3 max-w-2xl text-sm font-medium text-inkt">
        Basis-biedcontext en basis-marktsignalen blijven altijd gratis. Premium is extra verdieping, geen betaalmuur voor
        wat nu gratis is.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {PRODUCT_VOLGORDE.map((product) => {
          const info = PRODUCTEN[product];
          const gekozen = voorselectie === product;
          return (
            <Kaart key={product} className={gekozen ? "border-merk-300 shadow-zweef-md ring-1 ring-merk-200" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <IcoonRondje naam={PRODUCT_ICONEN[product] ?? "euro"} tint={gekozen ? "amber" : "merk"} maat="l" />
                <div className="flex items-center gap-2">
                  <ModuleTag>Eenmalig product</ModuleTag>
                  {gekozen ? <Pil variant="amber">Jouw keuze</Pil> : null}
                </div>
              </div>
              <h2 className="mt-4 text-xl font-semibold">{info.naam}</h2>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tabular-nums text-merk">{formatEuro(info.prijs)}</span>
              </p>
              <p className="text-xs text-gedempt">eenmalig, geen abonnement, geen automatische verlenging</p>
              <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">{info.kern}</p>

              <p className="mt-4 text-sm font-medium text-inkt">Wat je krijgt</p>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-inkt-zacht">
                {info.krijgt.map((punt) => (
                  <li key={punt} className="flex gap-2">
                    <Icoon naam="vinkje" maat="s" className="mt-0.5 shrink-0 text-merk" />
                    <span>{punt}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-sm font-medium text-inkt">Wat gratis blijft</p>
              <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">{info.gratisBlijft}</p>

              <div className="mt-5">
                <KnopPrimair href={`/premium/afrekenen?${checkoutQuery(product, van)}`}>
                  Kies {info.naam.toLowerCase()}
                </KnopPrimair>
              </div>
            </Kaart>
          );
        })}
      </div>

      <Kaart className="mt-5">
        <div className="flex items-center gap-3">
          <IcoonRondje naam="schild" tint="merk" />
          <h2 className="text-lg font-semibold text-inkt">Eerlijk over premium</h2>
        </div>
        <div className="mt-3 divide-y divide-lijn">
          <AlertRij
            kleur="merk"
            titel="Wonea zit in de testfase. Afrekenen is hier een oefen-checkout: er wordt niets afgeschreven en we vragen geen betaalgegevens."
          />
          <AlertRij
            kleur="merk"
            titel="Beide producten zijn eenmalig. We zetten je dus niet in een abonnement en verlengen niets automatisch; dat vinden we net zo belangrijk als de verdieping zelf."
          />
          <AlertRij
            kleur="merk"
            titel="De verdieping hangt aan je account (e-mail volstaat, geen wachtwoord) en verschijnt op de biedadvies- en marktanalyse-onderdelen van de adressen en buurten die je bekijkt."
          />
        </div>
        <p className="mt-4 text-xs text-gedempt">
          Vragen over data of privacy? Zie ons{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-merk">
            privacybeleid
          </Link>
          .
        </p>
      </Kaart>
      </div>
    </div>
  );
}
