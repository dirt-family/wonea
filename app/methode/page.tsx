import type { Metadata } from "next";
import Link from "next/link";
import { MODEL_VERSIE } from "@/lib/avm";
import { Kaart, SectieLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Onze methode: zo rekenen we",
  description: "Precies hoe Wonea woningwaarde schat: welke verkopen we gebruiken, welke correcties we toepassen en waarom we altijd een bandbreedte tonen.",
};

export default function MethodePagina() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Zo rekenen we</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Geen black box. Hieronder staat exact hoe onze schatting tot stand komt, inclusief de getallen. Modelversie: {MODEL_VERSIE}.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <SectieLabel>Stap 1</SectieLabel>
          <h2 className="mt-2 text-xl font-semibold">We zoeken echte verkopen bij jou in de buurt</h2>
          <p className="mt-3 leading-relaxed text-inkt-zacht">
            Eerst kijken we naar jouw straat: zijn daar de afgelopen 24 maanden minstens 5 woningen verkocht van hetzelfde
            type en vergelijkbare grootte (tussen 0,7 en 1,4 keer jouw oppervlakte), dan rekenen we daarmee. Anders nemen we
            de buurt. We tonen die verkopen altijd onder de schatting, zodat je zelf kunt controleren waar het getal vandaan
            komt.
          </p>
        </section>

        <section>
          <SectieLabel>Stap 2</SectieLabel>
          <h2 className="mt-2 text-xl font-semibold">Mediaan prijs per vierkante meter, plus drie correcties</h2>
          <p className="mt-3 leading-relaxed text-inkt-zacht">
            De basis is de mediaan van de prijs per vierkante meter van die verkopen, keer jouw woonoppervlakte. Daarop
            passen we drie zichtbare correcties toe:
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                  <th className="py-2 pr-4 font-medium">Correctie</th>
                  <th className="py-2 font-medium">Factor</th>
                </tr>
              </thead>
              <tbody className="text-inkt-zacht">
                <tr className="border-b border-lijn"><td className="py-2 pr-4">Bouwjaar 2015 of later</td><td>+8%</td></tr>
                <tr className="border-b border-lijn"><td className="py-2 pr-4">Bouwjaar 2000-2014</td><td>+4%</td></tr>
                <tr className="border-b border-lijn"><td className="py-2 pr-4">Bouwjaar 1980-1999</td><td>0%</td></tr>
                <tr className="border-b border-lijn"><td className="py-2 pr-4">Bouwjaar 1960-1979</td><td>-4%</td></tr>
                <tr className="border-b border-lijn"><td className="py-2 pr-4">Bouwjaar 1930-1959</td><td>-6%</td></tr>
                <tr className="border-b border-lijn"><td className="py-2 pr-4">Bouwjaar voor 1930</td><td>-3%</td></tr>
                <tr className="border-b border-lijn"><td className="py-2 pr-4">Vrijstaand / twee-onder-een-kap / hoekwoning</td><td>+15% / +8% / +2%</td></tr>
                <tr><td className="py-2 pr-4">Energielabel A tot G</td><td>+4% tot -6%</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-gedempt">
            Zijn er te weinig verkopen, dan vallen we terug op een buurt-anker: de gemiddelde WOZ-waarde van de buurt (CBS)
            gedeeld door de gemiddelde woninggrootte. Dat labelen we op de pagina als afgeleide.
          </p>
        </section>

        <section>
          <SectieLabel>Stap 3</SectieLabel>
          <h2 className="mt-2 text-xl font-semibold">De bandbreedte is geen versiering</h2>
          <p className="mt-3 leading-relaxed text-inkt-zacht">
            De breedte van de bandbreedte volgt uit de spreiding van de gebruikte verkopen (de interkwartielafstand), met een
            ondergrens van 5 en een bovengrens van 15 procent. Lijken de verkopen sterk op elkaar, dan is de marge smal.
            Lopen ze uiteen, of zijn er weinig, dan is de marge breed en zeggen we dat erbij:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-inkt-zacht">
            <li>8 of meer verkopen: betrouwbaarheid hoog</li>
            <li>4 tot 7 verkopen: betrouwbaarheid middel</li>
            <li>minder dan 4: betrouwbaarheid laag, brede marge</li>
          </ul>
        </section>

        <Kaart className="bg-merk-wash">
          <h2 className="text-xl font-semibold">Waarom elke onlineschatting ernaast zit, ook die van ons</h2>
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            Zonder vraagprijs om op te ankeren zit elk rekenmodel er voor een willekeurige woning gemiddeld zo'n zeven
            procent naast. Dat geldt voor de grootste internationale platforms en dus ook voor Wonea. Wie je één strak getal
            toont, verkoopt schijnzekerheid. Daarom tonen wij de bandbreedte, de verkopen en de rekenstappen, zodat je zelf
            ziet hoe stevig de schatting is. En een modelmatige schatting is nooit een taxatie: voor een hypotheek heb je een
            gevalideerd taxatierapport nodig.
          </p>
        </Kaart>

        <section>
          <SectieLabel>Bronnen</SectieLabel>
          <h2 className="mt-2 text-xl font-semibold">Waar de data vandaan komt</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-inkt-zacht">
            <li>Adressen, bouwjaar, oppervlakte en woningtype: BAG (Basisregistratie Adressen en Gebouwen).</li>
            <li>Buurtcijfers en gemiddelde WOZ per buurt: CBS.</li>
            <li>Energielabel: in deze testfase een indicatie op basis van bouwjaar, altijd zo gelabeld. Echte labels volgen via EP-Online.</li>
            <li>Verkoopprijzen: in deze testfase gelabelde voorbeelddata op buurtniveau, nooit gekoppeld aan een echt adres. Echte koopsommen (Kadaster) volgen voor livegang.</li>
          </ul>
          <p className="mt-4 text-sm text-inkt-zacht">
            Vragen over de methode? <Link href="/over-ons" className="font-semibold text-merk underline underline-offset-4">Lees waarom we Wonea bouwen</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
