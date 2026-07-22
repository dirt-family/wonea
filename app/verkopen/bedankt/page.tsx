import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Aanvraag verstuurd" };

/** Rustige bevestiging: herhaalt wat er gebeurt en dat de testfase niets echt doorstuurt. */
export default function VerkopenBedanktPagina() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Je aanvraag is verstuurd</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        We hebben je een bevestiging gemaild. Zoals in het formulier stond, geven we je aanvraag eenmalig door aan een
        lokale verkoopmakelaar; die neemt daarna contact met je op. Niet aan meerdere partijen, en je e-mailadres gebruiken
        we nergens anders voor.
      </p>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Goed om te weten: Wonea zit in de testfase. Er wordt nu nog niets echt doorgestuurd; dat gebeurt pas als Wonea live
        is. Van gedachten veranderd? Antwoord op de bevestigingsmail en we halen je aanvraag weg.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-merk underline underline-offset-4">
        Terug naar de homepage
      </Link>
    </div>
  );
}
