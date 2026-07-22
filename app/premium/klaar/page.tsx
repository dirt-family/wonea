import type { Metadata } from "next";
import { KnopPrimair, KnopSecundair, Kaart, SectieLabel } from "@/components/ui";
import { veiligeVanUrl } from "@/app/premium/logic";
import { parseProduct, PRODUCTEN } from "@/app/premium/producten";

export const metadata: Metadata = { title: "Aankoop afgerond" };

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
      <h1 className="text-3xl font-semibold">{alGekocht ? "Je had dit al" : "Je aankoop is rond"}</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        {alGekocht
          ? `Je account had de ${naam} al. We hebben dus niets opnieuw aangemaakt en er is niets veranderd.`
          : `De ${naam} staat nu op je account. Rustig aan de rest: hieronder staat precies wat er is gebeurd.`}
      </p>

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
