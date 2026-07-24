import type { Metadata } from "next";
import Link from "next/link";
import { IcoonRondje, Kaart } from "@/components/ui";
import { Illustratie } from "@/components/illustraties";

export const metadata: Metadata = {
  title: "Privacy en jouw data",
  description:
    "Wat Wonea toont uit openbare registers, wat alleen met jouw toestemming gebeurt en hoe je je woning in twee stappen verwijdert.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPagina() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <IcoonRondje naam="schild" tint="merk" maat="l" />
          <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Privacy en jouw data</h1>
        </div>
        <Illustratie naam="jouw-data" className="hidden w-40 shrink-0 sm:block" />
      </div>

      <Kaart className="mt-6 bg-accent-wash">
        <p className="text-sm leading-relaxed text-inkt">
          <strong>Concept.</strong> Dit is een werkversie. Een Nederlandse privacyjurist beoordeelt en ondertekent deze
          verklaring voordat Wonea echte woningdata publiceert. Tot die tijd draait Wonea als openbare testversie: alle
          woningen en waardes zijn voorbeelddata en er wordt geen echte woningdata gepubliceerd.
        </p>
      </Kaart>

      <div className="prose-wonea mt-8 space-y-8 text-[15px] leading-relaxed text-inkt-zacht">
        <section>
          <h2 className="text-xl font-semibold text-merk">Wat Wonea toont, en waarom dat mag</h2>
          <p className="mt-3">
            Wonea toont per woning gegevens uit openbare registers: adres, bouwjaar, oppervlakte, woningtype (BAG),
            buurtcijfers (CBS) en een modelmatige waardeschatting met bandbreedte. In deze testfase zijn verkoopprijzen
            gelabelde voorbeelddata op buurtniveau, nooit gekoppeld aan een echt adres.
          </p>
          <p className="mt-3">
            Een woningwaarde bij een adres kan een persoonsgegeven zijn. Wij verwerken die op grond van gerechtvaardigd
            belang (artikel 6 lid 1f AVG): woningzoekers en eigenaren hebben baat bij transparante, uitgelegde informatie
            over de woningmarkt. Daar hoort een belangenafweging bij, en vooral: een verwijderrecht dat echt werkt.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-merk">Wat alleen met jouw toestemming gebeurt</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Je woning claimen en waarde-alerts ontvangen: alleen na jouw aanmelding, en alerts en aanbiedingen zijn gescheiden keuzes.</li>
            <li>Je e-mailadres gebruiken: alleen waarvoor je het gaf. We leggen elke toestemming vast met datum en de letterlijke tekst waar je mee instemde.</li>
            <li>Een aanvraag doorsturen (hypotheekadviseur, makelaar, taxateur, verduurzamingsbedrijf): we zeggen vooraf aan welk type partij, en sturen niets door zonder jouw expliciete akkoord.</li>
            <li>Je eigen WOZ-waarde: de WOZ-check vergelijkt in je browser en slaat niets op.</li>
          </ul>
        </section>

        <section id="verwijderen">
          <h2 className="text-xl font-semibold text-merk">Je woning verwijderen</h2>
          <p className="mt-3">
            Verwijderen kan altijd, in twee stappen, zonder account: aanvragen en bevestigen. Daarna verdwijnt het adres
            overal op Wonea (pagina, gedeelde rapporten, alerts, zoekresultaten) en zetten we het op een verwijderlijst die
            elke nieuwe data-import respecteert. Het adres komt dus niet stilletjes terug.
          </p>
          <p className="mt-3">
            <Link href="/verwijderen" className="font-semibold text-merk underline underline-offset-4">
              Start de verwijdering
            </Link>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-merk">Bewaartermijnen</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>E-mailberichten in ons verzendsysteem: 90 dagen.</li>
            <li>Onbevestigde aanmeldingen via de widget: 30 dagen, daarna automatisch gewist.</li>
            <li>Aanvragen (leads): 12 maanden na afronding.</li>
            <li>De verwijderlijst zelf bewaren we permanent; dat is nodig om je verwijdering te blijven garanderen.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-merk">Je rechten</h2>
          <p className="mt-3">
            Inzage, correctie, verwijdering, bezwaar tegen verwerking en overdracht van je gegevens: mail ons en we
            handelen het binnen een maand af. Klachten kunnen ook bij de Autoriteit Persoonsgegevens. Contact: het
            e-mailadres wordt hier ingevuld voor livegang.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-merk">Nog te doen voor livegang</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Belangenafweging (LIA) voor gerechtvaardigd belang, schriftelijk vastgelegd.</li>
            <li>Invulling van de informatieplicht (artikel 14 AVG) richting bewoners.</li>
            <li>Beoordeling of een DPIA nodig is (grootschalige verwerking).</li>
            <li>Juridische ondertekening door een Nederlandse privacyjurist.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
