import Link from "next/link";
import { Bandbreedte, Kaart, KnopPrimair, KnopSecundair, SectieLabel } from "@/components/ui";
import { formatEuro } from "@/lib/util";

/**
 * Module 10: de sticky sidebar. Waarde met "Indicatie, geen taxatie", de twee
 * acties (volgen via de claim-flow, rapport delen via de bestaande
 * dashboard-flow) en de hulp-kaart met de introductie-copy uit
 * PROTOTYPE-OOGST.md: eerlijk benoemen dat partijen ons voor de introductie
 * betalen, en dat gegevens alleen met toestemming worden gedeeld.
 */
export function WoningSidebar({
  valuation,
  adresQuery,
}: {
  valuation: { waarde: number; intervalLaag: number; intervalHoog: number } | null;
  adresQuery: string;
}) {
  return (
    <div className="space-y-5 lg:sticky lg:top-6">
      <Kaart>
        <SectieLabel>Geschatte waarde</SectieLabel>
        {valuation ? (
          <>
            <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-merk">{formatEuro(valuation.waarde)}</p>
            <p className="mt-1 text-sm text-gedempt">Indicatie, geen taxatie.</p>
            <Bandbreedte laag={valuation.intervalLaag} waarde={valuation.waarde} hoog={valuation.intervalHoog} />
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">Nog geen eerlijke schatting mogelijk voor dit adres.</p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <KnopPrimair href={`/claim?${adresQuery}`}>Volg dit huis</KnopPrimair>
          <KnopSecundair href="/dashboard">Deel rapport</KnopSecundair>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gedempt">
          Volgen is gratis en je zit nergens aan vast. Een rapport delen kan zodra je dit huis hebt geclaimd.
        </p>
      </Kaart>

      <Kaart className="bg-merk-wash">
        <h2 className="text-lg font-semibold">Hulp bij de volgende stap</h2>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Wil je een hypotheekadviseur of makelaar spreken? Wij brengen je in contact. Zij betalen ons voor de
          introductie. Zo simpel is het.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">We delen je gegevens alleen met jouw toestemming.</p>
        <div className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          <Link href="/hypotheek" className="text-merk underline underline-offset-4">
            Vind een hypotheekadviseur
          </Link>
          <Link href="/makelaars" className="text-merk underline underline-offset-4">
            Vind een makelaar
          </Link>
        </div>
      </Kaart>
    </div>
  );
}
