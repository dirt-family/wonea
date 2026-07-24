import type { Metadata } from "next";
import Link from "next/link";
import { Bandbreedte, KnopPrimair, KnopSecundair } from "@/components/ui";
import { WoneaLogo } from "@/components/logo";
import { formatEuro } from "@/lib/util";

export const metadata: Metadata = {
  title: "Over Wonea: eerlijk inzicht in woningwaarde",
  description: "Waarom Wonea bestaat: een woningmarkt vol zwevende getallen verdient een platform dat uitlegt, bronnen toont en jou de regie geeft.",
  alternates: { canonical: "/over-ons" },
};

/**
 * Merkverhaal als rustige leespagina: serif-koppen, het huisvorm-motief als
 * zacht achtergrond-element en als sectie-scheider. Huisstijl v3: de belofte
 * krijgt het ene merkgradient-accent van de pagina (navy naar amber, als
 * smalle staander naast het citaat) en "Jouw huis, jouw data" is de warme
 * amber-wash-sectie (de menselijke sectie; de rest blijft wit). Geen
 * verzonnen team of geschiedenis: het platform is nieuw en dat staat er
 * gewoon.
 */

function Scheider() {
  return (
    <div aria-hidden="true" className="my-12 flex items-center gap-4">
      <span className="h-px flex-1 bg-lijn" />
      <WoneaLogo variant="mono" className="h-5 w-5 text-merk-200" />
      <span className="h-px flex-1 bg-lijn" />
    </div>
  );
}

export default function OverOnsPagina() {
  return (
    <div className="relative overflow-hidden">
      <style>{`@keyframes wonea-enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-10 text-merk-100">
        <WoneaLogo variant="mono" className="h-96 w-96" />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 pt-14">
        <div style={{ animation: "wonea-enter var(--duur-normaal) var(--ease-uit) both" }}>
          <h1 className="text-3xl font-semibold sm:text-4xl">Waarom Wonea bestaat</h1>
          <p className="mt-5 text-lg leading-relaxed text-inkt-zacht">
            Je huis kopen of verkopen is voor de meeste mensen de grootste financiële beslissing van hun leven. Toch
            begint die vaak met een getal van internet waarvan niemand kan uitleggen waar het vandaan komt. Het schommelt
            per maand, kent geen marge en duwt je vooral snel richting een formulier. Dat kan eerlijker.
          </p>
        </div>

        {/* Het ene accent-moment van de pagina: de belofte, met het toegestane
            kleine merkgradient-moment (navy naar amber) als staander. */}
        <blockquote className="relative mt-10 pl-6">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-0 w-1 rounded-full"
            style={{ backgroundImage: "var(--gradient-merk)" }}
          />
          <p className="font-display text-2xl font-semibold italic leading-snug text-merk">Eerlijk inzicht zonder schijnzekerheid.</p>
          <p className="mt-2 text-sm text-gedempt">Dat is de belofte waaraan we elke keuze op Wonea toetsen.</p>
        </blockquote>

        <Scheider />

        <section>
          <h2 className="text-2xl font-semibold">Waarom we altijd een bandbreedte tonen</h2>
          <p className="mt-4 leading-relaxed text-inkt-zacht">
            Elke modelmatige schatting heeft onzekerheid: een model kent jouw verbouwing of achterstallig onderhoud
            niet, en kan er daardoor flink naast zitten, ook dat van ons. Wie je dan één strak getal toont, verkoopt
            schijnzekerheid. Wij tonen daarom de marge, hoe zeker we zijn en de verkopen waarop de schatting rust.
          </p>
          <div className="mt-6 rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef">
            <p className="text-sm font-medium text-inkt">Zo ziet dat eruit</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-merk">{formatEuro(412000)}</p>
            <Bandbreedte laag={379000} waarde={412000} hoog={445000} />
            <p className="mt-3 text-xs leading-relaxed text-gedempt">
              Rekenvoorbeeld, geen echt adres. De breedte van de marge volgt uit de spreiding van de gebruikte verkopen.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">De methode is openbaar, de bronnen ook</h2>
          <p className="mt-4 leading-relaxed text-inkt-zacht">
            Onze rekenstappen en correctiefactoren staan gewoon op de site, met getallen en al. Kun je het niet
            controleren, dan hoef je het niet te vertrouwen. We bouwen op open data:
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {["BAG (Kadaster)", "CBS", "RVO en EP-Online", "DNB", "OpenStreetMap"].map((bron) => (
              <li
                key={bron}
                className="rounded-[14px] bg-merk-wash px-4 py-3 text-center font-display text-sm font-semibold text-merk"
              >
                {bron}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/methode" className="font-semibold text-merk underline underline-offset-4 transition-colors hover:text-merk-licht">
              Lees precies hoe we rekenen
            </Link>
          </p>
        </section>
      </div>

      {/* De menselijke sectie op warme amber-wash (huisstijl v3): volle breedte,
          de leeskolom loopt er gewoon in door. */}
      <section className="mt-12 border-y border-accent-100 bg-wash-amber">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="text-2xl font-semibold">Jouw huis, jouw data</h2>
          <p className="mt-4 leading-relaxed text-inkt-zacht">
            Wij tonen openbare data over woningen. Alles wat jou als persoon raakt, je e-mail, je claim, je aanvraag,
            gebeurt alleen met jouw toestemming. Wil je niet op Wonea staan, dan verwijder je je woningpagina in twee
            stappen, zonder account. Die keuze overleeft ook elke nieuwe data-import.
          </p>
          <p className="mt-3 leading-relaxed text-inkt-zacht">
            We verdienen geld door mensen die zelf een volgende stap willen, bijvoorbeeld hypotheekadvies of
            verduurzaming, in contact te brengen met professionals. Dat gebeurt alleen op jouw verzoek, en vooraf staat
            er altijd bij naar welk type partij je aanvraag gaat. Je wordt bij ons niet ongevraagd doorverkocht. En je
            ziet hier geen popups, afteltimers of vooraangevinkte vakjes: een woningbeslissing verdient bedenktijd.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/verwijderen" className="font-semibold text-merk underline underline-offset-4 transition-colors hover:text-merk-licht">
              Je woning verwijderen
            </Link>
          </p>
        </div>
      </section>

      <div className="relative mx-auto max-w-3xl px-5 pb-14">
        <section className="mt-12 rounded-[14px] border border-lijn bg-paneel p-6 shadow-zweef">
          <h2 className="text-xl font-semibold">Eerlijk over waar we staan</h2>
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            Wonea is nieuw. Er is geen kantoor vol taxateurs en geen tienjarig trackrecord: er is een testgebied, een
            openbare methode en een platform in opbouw. De verkoopprijzen in deze testfase zijn gelabelde voorbeelddata;
            echte koopsommen sluiten we aan voor livegang. Tot die tijd staat er bij elk cijfer wat het wel en niet is.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <KnopPrimair href="/">Zoek een adres</KnopPrimair>
          <KnopSecundair href="/tools">Bekijk de rekenhulpen</KnopSecundair>
        </div>
      </div>
    </div>
  );
}
