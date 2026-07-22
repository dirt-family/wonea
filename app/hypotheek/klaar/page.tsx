import type { Metadata } from "next";
import Link from "next/link";
import { Kaart, KnopSecundair, SectieLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Aanvraag ontvangen" };

/**
 * Rustige bevestigingspagina na de hypotheekfunnel. Herhaalt wat er gebeurt
 * (en dat er in de testfase niets echt wordt doorgestuurd) en bevat de
 * taxatierapport-upsell (Fase 4.3-koppeling). Bewust zonder druk of timers.
 */
export default async function HypotheekKlaarPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string }>;
}) {
  const sp = await searchParams;
  const upsell = new URLSearchParams({ van: "hypotheek" });
  if (sp.postcode) upsell.set("postcode", sp.postcode);
  if (sp.nummer) upsell.set("nummer", sp.nummer);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">We hebben je aanvraag</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Je krijgt een bevestiging per e-mail. Zoals in het formulier stond, geven we je aanvraag eenmalig door aan een
        onafhankelijke hypotheekadviseur; die neemt contact met je op. Niet aan anderen, en niet vaker dan hiervoor nodig
        is.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-gedempt">
        In deze testfase wordt er nog niets echt doorgestuurd. Dat gebeurt pas als Wonea live is en jij daarvoor tekende.
        Van gedachten veranderd? Antwoord op de bevestigingsmail en we trekken de aanvraag in.
      </p>

      <Kaart className="mt-8">
        <SectieLabel>Handig om te weten</SectieLabel>
        <h2 className="mt-2 text-lg font-semibold">Taxatierapport voor je hypotheek</h2>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Voor een hypotheek heb je een gevalideerd taxatierapport nodig (NWWI, doorgaans 450 tot 800 euro). Wonea kan de
          aanvraag voor je klaarzetten.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gedempt">
          Geen haast: dit kan ook later, en je adviseur kan erbij helpen.
        </p>
        <div className="mt-4">
          <KnopSecundair href={`/taxatierapport?${upsell.toString()}`}>Bekijk hoe dat werkt</KnopSecundair>
        </div>
      </Kaart>

      <p className="mt-8 text-sm">
        {sp.postcode && sp.nummer ? (
          <Link href={`/woning/${sp.postcode}/${sp.nummer}`} className="font-semibold text-merk underline underline-offset-4">
            Terug naar je woningpagina
          </Link>
        ) : (
          <Link href="/" className="font-semibold text-merk underline underline-offset-4">
            Terug naar de homepage
          </Link>
        )}
      </p>
    </div>
  );
}
