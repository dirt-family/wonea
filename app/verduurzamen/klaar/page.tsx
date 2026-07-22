import type { Metadata } from "next";
import Link from "next/link";
import { isVerticaal, PARTIJ_TYPE, VERTICALEN } from "@/app/verduurzamen/verticalen";
import { Kaart, KnopSecundair, SectieLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Aanvraag ontvangen" };

/**
 * Rustige bevestigingspagina na de funnel: herhaalt wat er gebeurt, aan welk
 * type partij wordt doorgegeven en dat er in de testfase niets echt wordt
 * doorgestuurd. Geen vervolg-aanbiedingen, geen druk.
 */

export default async function KlaarPagina({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const sp = await searchParams;
  const titel = sp.v && isVerticaal(sp.v) ? VERTICALEN[sp.v].titel.toLowerCase() : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Je aanvraag is binnen</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Bedankt. We hebben je {titel ? `aanvraag voor ${titel}` : "verduurzamingsaanvraag"} ontvangen en je krijgt er
        een bevestiging van per e-mail.
      </p>

      <Kaart className="mt-8">
        <SectieLabel>Wat er nu gebeurt</SectieLabel>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-inkt-zacht">
          <li>
            Je aanvraag wordt eenmalig doorgegeven aan {PARTIJ_TYPE}. Niet aan anderen, en niet vaker dan hiervoor
            nodig is.
          </li>
          <li>Die bedrijven nemen contact met je op via het e-mailadres dat je opgaf. Je zit nergens aan vast.</li>
          <li>Van gedachten veranderd? Antwoord op de bevestigingsmail en we trekken de aanvraag in.</li>
        </ol>
        <p className="mt-4 border-t border-lijn pt-4 text-sm leading-relaxed text-gedempt">
          Eerlijk is eerlijk: Wonea is in testfase, dus er wordt nu nog niets echt doorgestuurd. Dat gebeurt pas als
          Wonea live is en jij daarvoor tekende.
        </p>
      </Kaart>

      <div className="mt-8">
        <KnopSecundair href="/">Terug naar de homepage</KnopSecundair>
      </div>
    </div>
  );
}
