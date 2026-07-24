import type { Metadata } from "next";
import { IcoonRondje, Kaart, KnopPrimair, SectieLabel } from "@/components/ui";
import { isMoment, MOMENTEN, vindAdres } from "@/app/taxatierapport/helpers";

export const metadata: Metadata = { title: "Taxatierapport: betaalstap", robots: { index: false, follow: false } };

/**
 * PLACEHOLDER-checkout. Er is bewust geen betaalprovider gekoppeld: de knop
 * rekent niets af en leidt alleen naar de bevestiging. Betalen werkt pas bij
 * livegang; dat staat er ook duidelijk bij.
 */
export default async function TaxatieCheckoutPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string; moment?: string }>;
}) {
  const sp = await searchParams;
  const adres = sp.postcode && sp.nummer ? await vindAdres(sp.postcode, sp.nummer) : null;
  const moment = isMoment(sp.moment) ? MOMENTEN[sp.moment] : null;
  const naam = adres ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}` : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Nog één stap: de betaalstap</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        {naam ? "We hebben je aanvraag genoteerd en je een bevestiging gemaild. " : ""}
        Zo ziet de betaalstap eruit. In deze testfase is betalen nog niet actief: er wordt niets afgerekend en er wordt
        niets doorgestuurd.
      </p>

      <Kaart className="mt-8">
        <div className="flex items-center gap-3">
          <IcoonRondje naam="document" tint="merk" />
          <SectieLabel>Overzicht</SectieLabel>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          {naam ? (
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Adres</dt>
              <dd className="text-right font-medium">{naam}</dd>
            </div>
          ) : null}
          {moment ? (
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Gewenst moment</dt>
              <dd className="text-right font-medium">{moment}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-gedempt">Gevalideerd taxatierapport (NWWI)</dt>
            <dd className="text-right font-medium tabular-nums">450 tot 800 euro</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gedempt">Aanvraagkosten via Wonea</dt>
            <dd className="text-right font-medium">worden verrekend met het rapport</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-gedempt">
          De uiteindelijke prijs hangt af van regio en taxateur; die betaal je rechtstreeks aan de taxateur. Je betaalt
          niet dubbel: wat je hier als aanvraagkosten betaalt, gaat van de rapportprijs af.
        </p>

        <div className="mt-5 border-t border-lijn pt-5">
          <KnopPrimair href="/taxatierapport/bedankt">Betalen (nog niet actief in de testfase)</KnopPrimair>
          <p className="mt-3 text-xs leading-relaxed text-gedempt">
            Betalen werkt pas als Wonea live is. Deze knop rekent nu niets af en brengt je alleen naar de bevestiging; er
            is geen betaalprovider gekoppeld.
          </p>
        </div>
      </Kaart>
    </div>
  );
}
