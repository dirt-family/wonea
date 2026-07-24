import type { Metadata } from "next";
import { IcoonRondje, KnopPrimair, KnopSecundair, Kaart, SectieLabel } from "@/components/ui";
import { Illustratie } from "@/components/illustraties";
import { veiligeVanUrl } from "@/app/premium/logic";
import { parseProduct, PRODUCTEN } from "@/app/premium/producten";

export const metadata: Metadata = { title: "Aankoop afgerond", robots: { index: false, follow: false } };

/**
 * Rustige bevestigingspagina na de gemockte checkout. Herhaalt wat er is
 * gebeurd en wat niet (testfase: niets afgeschreven). Met al=1 tonen we de
 * "je had dit al"-variant: melden, niet dubbel aanmaken.
 */
export default async function PremiumKlaarPagina({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; van?: string; al?: string }>;
}) {
  const sp = await searchParams;
  const product = parseProduct(sp.product);
  const info = product ? PRODUCTEN[product] : null;
  const van = veiligeVanUrl(sp.van);
  const alGekocht = sp.al === "1";
  const naam = info ? info.naam.toLowerCase() : "premium-verdieping";

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <IcoonRondje naam="vinkje" tint="amber" maat="l" />
          <h1 className="mt-5 text-3xl font-semibold">{alGekocht ? "Je had dit al" : "Je aankoop is rond"}</h1>
          <p className="mt-4 leading-relaxed text-inkt-zacht">
            {alGekocht
              ? `Je account had de ${naam} al. We hebben dus niets opnieuw aangemaakt en er is niets veranderd.`
              : `De ${naam} staat nu op je account. Rustig aan de rest: hieronder staat precies wat er is gebeurd.`}
          </p>
        </div>
        <Illustratie naam="bieden" className="hidden w-44 shrink-0 sm:block" />
      </div>

      <Kaart className="mt-8">
        <SectieLabel>Wat er {alGekocht ? "al stond" : "is gebeurd"}</SectieLabel>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-inkt">
          <li>
            De {naam} is aan je account gekoppeld. Je ziet de verdieping op de biedadvies- en marktanalyse-onderdelen van
            de adressen en buurten die je bekijkt.
          </li>
          <li>
            Er is niets afgeschreven en er zijn geen betaalgegevens gevraagd of doorgestuurd. Wonea zit in de testfase en
            de checkout is een oefenversie.
          </li>
          <li>
            Dit is een eenmalig product: geen abonnement, geen automatische verlenging, geen vervolgkosten. Je hoeft dus
            ook niets op te zeggen.
          </li>
          <li>De gratis basis verandert niet. Basis-biedcontext en basis-marktsignalen blijven altijd gratis.</li>
        </ul>
      </Kaart>

      <div className="mt-8 flex flex-wrap gap-3">
        {van ? (
          <KnopPrimair href={van}>Verder waar je was</KnopPrimair>
        ) : (
          <KnopPrimair href="/dashboard">Naar mijn dashboard</KnopPrimair>
        )}
        <KnopSecundair href="/premium">Naar het premium-overzicht</KnopSecundair>
      </div>
    </div>
  );
}
