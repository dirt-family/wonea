import type { Metadata } from "next";
import Link from "next/link";
import { IcoonRondje } from "@/components/ui";
import { Illustratie } from "@/components/illustraties";

export const metadata: Metadata = { title: "Aanvraag genoteerd", robots: { index: false, follow: false } };

/** Rustige bevestiging: herhaalt wat er gebeurt en dat de testfase niets echt doorstuurt of afrekent. */
export default function TaxatieBedanktPagina() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <IcoonRondje naam="vinkje" tint="amber" maat="l" />
          <h1 className="mt-5 text-3xl font-semibold">Je aanvraag staat genoteerd</h1>
          <p className="mt-4 leading-relaxed text-inkt-zacht">
            We hebben je een bevestiging gemaild. Zoals in het formulier stond, geven we je aanvraag eenmalig door aan een
            gecertificeerde taxateur; die neemt contact met je op over het rapport en de definitieve prijs. Niet aan meerdere
            partijen, en je e-mailadres gebruiken we nergens anders voor.
          </p>
          <p className="mt-4 leading-relaxed text-inkt-zacht">
            Goed om te weten: Wonea zit in de testfase. Je hebt niets betaald en er wordt nog niets echt doorgestuurd; dat
            gebeurt pas als Wonea live is. Van gedachten veranderd? Antwoord op de bevestigingsmail en we halen je aanvraag
            weg.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Terug naar de homepage
          </Link>
        </div>
        <Illustratie naam="rapport" className="hidden w-44 shrink-0 sm:block" />
      </div>
    </div>
  );
}
