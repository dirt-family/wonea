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
    </div>
  );
}
