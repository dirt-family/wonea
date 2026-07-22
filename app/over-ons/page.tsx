import type { Metadata } from "next";
import { Kaart, KnopPrimair, KnopSecundair, SectieLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Over Wonea: eerlijk inzicht in woningwaarde",
  description: "Waarom Wonea bestaat: een woningmarkt vol zwevende getallen verdient een platform dat uitlegt, bronnen toont en jou de regie geeft.",
};

export default function OverOnsPagina() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Waarom Wonea bestaat</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Je huis kopen of verkopen is de grootste financiele beslissing van je leven. En toch begint die vaak met een getal
        van internet waarvan niemand kan uitleggen waar het vandaan komt: het schommelt per maand, kent geen marge en duwt
        je vooral snel richting een formulier. Dat kan eerlijker.
      </p>

      <div className="mt-10 space-y-5">
        <Kaart>
          <SectieLabel>Belofte 1</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Een bandbreedte in plaats van schijnzekerheid</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Elke modelmatige schatting heeft onzekerheid. Wij tonen die: een bandbreedte, een betrouwbaarheidsniveau en de
            verkopen waarop de schatting rust. Liever een eerlijke marge dan een precies getal dat morgen anders is.
          </p>
        </Kaart>
        <Kaart>
          <SectieLabel>Belofte 2</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">De methode is openbaar</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Onze rekenstappen en correctiefactoren staan gewoon op de site, met getallen en al. Kun je het niet controleren,
            dan hoef je het niet te vertrouwen.
          </p>
        </Kaart>
        <Kaart>
          <SectieLabel>Belofte 3</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Jouw huis, jouw data</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Wij tonen openbare data. Alles wat jou als persoon raakt, je e-mail, je claim, je aanvraag, gebeurt alleen met
            jouw toestemming. En wil je niet op Wonea staan, dan verwijder je je woningpagina in twee stappen, zonder
            account. Die verwijdering overleeft ook elke nieuwe data-import.
          </p>
        </Kaart>
        <Kaart>
          <SectieLabel>Belofte 4</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Geen verkochte verrassingen</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Wonea verdient geld door mensen die zelf een volgende stap willen (hypotheekadvies, verkoop, verduurzaming) in
            contact te brengen met professionals. Dat doen we alleen op jouw verzoek, en we zeggen vooraf aan welk type
            partij we je aanvraag doorgeven. Je wordt bij ons niet ongevraagd doorverkocht.
          </p>
        </Kaart>
        <Kaart>
          <SectieLabel>Belofte 5</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Rust in plaats van druk</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Geen popups, geen afteltimers, geen vooraangevinkte vakjes. Een woningbeslissing verdient bedenktijd, geen
            verkooptrucs.
          </p>
        </Kaart>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <KnopPrimair href="/">Zoek je adres</KnopPrimair>
        <KnopSecundair href="/methode">Lees hoe we rekenen</KnopSecundair>
      </div>
    </div>
  );
}
