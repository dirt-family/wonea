import Link from "next/link";
import { Kaart, SectieLabel } from "@/components/ui";
import { Zoekbalk } from "@/components/zoekbalk";

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-lijn bg-paneel">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h1 className="max-w-2xl text-4xl font-semibold sm:text-5xl">
            Wat je huis waard is, en waarom
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-inkt-zacht">
            Geen zwevend getal, maar een eerlijke bandbreedte met de verkopen eronder en een methode die we gewoon uitleggen.
          </p>
          <div className="mt-8">
            <Zoekbalk />
          </div>
          <p className="mt-4 text-sm text-gedempt">
            Gratis, zonder account. Liever niet op Wonea staan? Verwijderen kan altijd, in twee stappen.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <SectieLabel>Zo werkt het</SectieLabel>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <Kaart>
            <p className="font-display text-3xl font-semibold text-merk">1</p>
            <h2 className="mt-3 text-lg font-semibold">Zoek je adres</h2>
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Elke woning in ons testgebied heeft een eigen pagina met kenmerken uit openbare registers.
            </p>
          </Kaart>
          <Kaart>
            <p className="font-display text-3xl font-semibold text-merk">2</p>
            <h2 className="mt-3 text-lg font-semibold">Zie de waarde, met marge</h2>
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Je krijgt een bandbreedte, hoe zeker we zijn, en de verkopen waarop de schatting rust. Nooit schijnprecisie.
            </p>
          </Kaart>
          <Kaart>
            <p className="font-display text-3xl font-semibold text-merk">3</p>
            <h2 className="mt-3 text-lg font-semibold">Jij houdt de regie</h2>
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Claim je woning om de waarde te volgen, of verwijder de pagina juist. Allebei in een paar klikken.
            </p>
          </Kaart>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="grid gap-5 sm:grid-cols-2">
          <Kaart className="bg-merk-wash">
            <SectieLabel>Waarom een bandbreedte</SectieLabel>
            <h2 className="mt-3 text-xl font-semibold">Elke onlineschatting zit ernaast. Wij zeggen hoeveel.</h2>
            <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
              Zonder vraagprijs zit elk rekenmodel er gemiddeld zo'n zeven procent naast, ook dat van ons. Daarom tonen we een
              bandbreedte en de verkopen waarop die is gebaseerd, in plaats van een getal dat zekerheid veinst.
            </p>
            <Link href="/methode" className="mt-4 inline-block text-sm font-semibold text-merk underline underline-offset-4">
              Lees hoe we rekenen
            </Link>
          </Kaart>
          <Kaart>
            <SectieLabel>Gratis WOZ-check</SectieLabel>
            <h2 className="mt-3 text-xl font-semibold">Klopt je WOZ-waarde met de markt?</h2>
            <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
              Vergelijk de WOZ-waarde van je beschikking met onze marktschatting. Scheelt het veel, dan leggen we uit hoe
              bezwaar werkt, rechtstreeks bij je gemeente en gratis. Wij verdienen daar niets aan.
            </p>
            <Link href="/woz-check" className="mt-4 inline-block text-sm font-semibold text-merk underline underline-offset-4">
              Start de WOZ-check
            </Link>
          </Kaart>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <SectieLabel>Tools</SectieLabel>
        <h2 className="mt-3 text-2xl font-semibold">Gratis inzicht, zonder account</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Zeven tools rond wonen, kopen en verduurzamen. Elke tool noemt de bron waar hij op draait, en cijfers komen
          altijd met bron en peildatum.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { titel: "Woningwaarde-check", zin: "De waarde van een adres, altijd als bandbreedte.", href: "/" },
            { titel: "WOZ-check", zin: "Klopt de WOZ-waarde van je beschikking met de markt?", href: "/woz-check" },
            { titel: "Budgetberekenaar", zin: "Wat je kunt lenen volgens de leennormen van 2026.", href: "/budget" },
            { titel: "Actuele hypotheekrentes", zin: "Gemiddelde rentes per rentevaste periode, van DNB.", href: "/hypotheek-rentes" },
            { titel: "Verduurzamingscheck", zin: "Wat isolatie, zonnepanelen of een warmtepomp opleveren.", href: "/verduurzamen" },
            { titel: "Biedadvies", zin: "Een realistische biedrange per woning, met buurtcontext.", href: "/tools#biedadvies" },
            { titel: "Vind een makelaar", zin: "Makelaars in de buurt, zonder betaalde posities.", href: "/makelaars" },
          ].map((tool) => (
            <Link
              key={tool.titel}
              href={tool.href}
              className="block rounded-[14px] border border-lijn bg-paneel p-5 transition-colors hover:border-merk"
            >
              <p className="font-semibold text-inkt">{tool.titel}</p>
              <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">{tool.zin}</p>
            </Link>
          ))}
          <Link href="/tools" className="block rounded-[14px] border border-lijn bg-merk-wash p-5 transition-colors hover:border-merk">
            <p className="font-semibold text-merk">Alle tools</p>
            <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">Bekijk alle tools met uitleg en de bron per tool.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
