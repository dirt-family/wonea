import type { Metadata } from "next";
import Link from "next/link";
import { adresNaam, vindVerduurzaamAdres } from "@/app/verduurzamen/logic";
import { getEnergielabel } from "@/lib/bronnen/energielabel";
import { formatDatumNl } from "@/lib/util";
import { PlanStepper, type AdresContext } from "./plan-stepper";

/**
 * Verduurzamings-totaalplan op het rekenmodule-framework. Deze serverpagina
 * doet alleen het adres-pad: adres opzoeken (bestaan plus suppressie via
 * vindVerduurzaamAdres, opt-out is leidend) en het echte energielabel via
 * EP-Online als er een key of cache is; anders de bouwjaar-indicatie,
 * eerlijk gelabeld. Zonder adres werkt de rekenhulp ook: de bezoeker kiest
 * dan zelf woningtype en bouwjaar in stap 1. De stappen, de optelling en de
 * uitkomst staan in plan-stepper.tsx en app/verduurzamen/berekening.ts.
 */

export const metadata: Metadata = {
  title: "Verduurzamen: totaalplan met besparing en subsidie",
  robots: { index: false, follow: false },
};

type Zoek = { postcode?: string; nummer?: string };

export default async function VerduurzaamPlanPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  const sp = await searchParams;
  const gezocht = Boolean(sp.postcode && sp.nummer);
  const adres = gezocht ? await vindVerduurzaamAdres(sp.postcode!, sp.nummer!) : null;

  let context: AdresContext | null = null;
  if (adres) {
    const ep = await getEnergielabel(adres.postcode, adres.huisnummer, adres.toevoeging);
    const label = (ep?.label ?? adres.energielabel)?.toUpperCase() ?? null;
    const labelEcht = Boolean(ep) || adres.energielabelBron === "echt";
    context = {
      naam: adresNaam(adres),
      postcode: adres.postcode,
      nummerslug: adres.nummerslug,
      woningtype: adres.woningtype,
      bouwjaar: adres.bouwjaar,
      label,
      labelEcht,
      labelBron: labelEcht
        ? `geregistreerd label (EP-Online/RVO${ep?.registratiedatum ? `, geregistreerd op ${formatDatumNl(ep.registratiedatum)}` : ""})`
        : label
          ? `indicatie op basis van bouwjaar ${adres.bouwjaar}, geen gemeten label`
          : "geen label bekend",
    };
  }

  const adresQuery = adres ? `postcode=${adres.postcode}&nummer=${encodeURIComponent(adres.nummerslug)}` : "";

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> /{" "}
        <Link href={adresQuery ? `/verduurzamen?${adresQuery}` : "/verduurzamen"} className="hover:text-merk">
          Verduurzamen
        </Link>{" "}
        / Totaalplan
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
        {context ? `Verduurzamingsplan voor ${context.naam}` : "Jouw verduurzamingsplan"}
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Kies je maatregelen en zie wat het per jaar scheelt, welke ISDE-subsidie er in 2026 is, wat je netto investeert
        en hoe snel het zich terugverdient. Alles is een indicatie op basis van openbare bronnen, met bron en peildatum
        bij elk cijfer.
      </p>

      <div className="mt-8 max-w-3xl">
        <PlanStepper
          adres={context}
          adresNietGevonden={gezocht && !adres}
          initPostcode={sp.postcode ?? ""}
          initNummer={sp.nummer ?? ""}
        />
      </div>

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-gedempt">
        Alle bedragen op deze pagina zijn indicaties op basis van openbare bronnen (RVO, Milieu Centraal en de
        Staatscourant); geen offerte en geen financieel advies. Subsidie vraag je zelf aan bij de RVO.{" "}
        <Link href={adresQuery ? `/verduurzamen?${adresQuery}` : "/verduurzamen"} className="underline underline-offset-2 hover:text-merk">
          Terug naar het verduurzamen-overzicht
        </Link>
        .
      </p>
    </div>
  );
}
