import type { Metadata } from "next";
import Link from "next/link";
import { MODEL_VERSIE } from "@/lib/avm";
import { Kaart, UitklapUitleg } from "@/components/ui";

export const metadata: Metadata = {
  title: "Onze methode: zo rekenen we",
  description: "Precies hoe Wonea woningwaarde schat: welke verkopen we gebruiken, welke correcties we toepassen en waarom we altijd een bandbreedte tonen.",
  alternates: { canonical: "/methode" },
};

/**
 * Methode-pagina: eerst het model in gewone taal (met de details in
 * uitklap-blokken), dan per tool de bron en peildatum, dan eerlijk wat we
 * niet weten. De getallen komen uit lib/avm.ts en horen daar 1-op-1 mee te
 * kloppen; wijzigt het model, wijzig dan ook deze pagina.
 */

function Stap({ nummer, titel, children }: { nummer: string; titel: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-5">
      <p aria-hidden="true" className="font-display text-3xl font-semibold text-merk-300">{nummer}</p>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl font-semibold">{titel}</h3>
        {children}
      </div>
    </section>
  );
}

export default function MethodePagina() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <style>{`@keyframes wonea-enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ animation: "wonea-enter var(--duur-normaal) var(--ease-uit) both" }}>
        <h1 className="text-3xl font-semibold sm:text-4xl">Zo rekenen we</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
          Geen black box: hieronder staat precies hoe onze schatting tot stand komt, inclusief de getallen en wat we
          niet weten.
        </p>
      </div>

      {/* Het model in het kort. */}
      <div className="mt-8 rounded-[14px] border border-lijn bg-paneel p-6">
        <h2 className="text-xl font-semibold">Het model in het kort</h2>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">Modelversie</dt>
            <dd className="mt-1 font-display text-lg font-semibold text-merk">{MODEL_VERSIE}</dd>
            <dd className="mt-1 text-sm leading-relaxed text-inkt-zacht">Deterministisch en uitlegbaar: zelfde invoer, zelfde uitkomst.</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">Basis</dt>
            <dd className="mt-1 font-display text-lg font-semibold text-merk">Vergelijkbare verkopen</dd>
            <dd className="mt-1 text-sm leading-relaxed text-inkt-zacht">De mediaan prijs per vierkante meter van verkopen die op jouw woning lijken.</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">Bandbreedte</dt>
            <dd className="mt-1 font-display text-lg font-semibold text-merk">5 tot 15 procent</dd>
            <dd className="mt-1 text-sm leading-relaxed text-inkt-zacht">Volgt uit de spreiding van die verkopen (de interkwartielafstand).</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">Betrouwbaarheid</dt>
            <dd className="mt-1 font-display text-lg font-semibold text-merk">Hoog, middel of laag</dd>
            <dd className="mt-1 text-sm leading-relaxed text-inkt-zacht">Bepaald door het aantal verkopen achter de schatting.</dd>
          </div>
        </dl>
        <div className="mt-5">
          <UitklapUitleg titel="Waar de woningdata vandaan komt">
            <ul className="list-disc space-y-2 pl-5">
              <li>Adressen, bouwjaar, oppervlakte en woningtype: BAG (Basisregistratie Adressen en Gebouwen).</li>
              <li>Buurtcijfers en gemiddelde WOZ per buurt: CBS.</li>
              <li>Energielabel: via EP-Online (RVO) waar geregistreerd, anders een indicatie op bouwjaar, altijd zo gelabeld.</li>
              <li>Verkoopprijzen: in deze testfase gelabelde voorbeelddata op buurtniveau, nooit gekoppeld aan een echt adres. Echte koopsommen (Kadaster) volgen voor livegang.</li>
            </ul>
          </UitklapUitleg>
        </div>
      </div>

      {/* De drie rekenstappen; de precieze getallen zitten in de uitklap-blokken. */}
      <div className="mt-12 space-y-10">
        <Stap nummer="1" titel="We zoeken echte verkopen bij jou in de buurt">
          <p className="mt-3 leading-relaxed text-inkt-zacht">
            Eerst kijken we naar jouw straat, daarna naar de buurt. De gebruikte verkopen staan altijd onder de
            schatting, zodat je zelf kunt controleren waar het getal vandaan komt.
          </p>
          <div className="mt-4">
            <UitklapUitleg titel="De precieze selectieregels">
              Zijn er in jouw straat de afgelopen 24 maanden minstens 5 woningen verkocht van hetzelfde type en
              vergelijkbare grootte (tussen 0,7 en 1,4 keer jouw oppervlakte), dan rekenen we daarmee. Anders nemen we de
              verkopen uit de buurt.
            </UitklapUitleg>
          </div>
        </Stap>

        <Stap nummer="2" titel="Mediaan prijs per vierkante meter, plus drie correcties">
          <p className="mt-3 leading-relaxed text-inkt-zacht">
            De basis is de mediaan van de prijs per vierkante meter van die verkopen, keer jouw woonoppervlakte. Daarop
            passen we drie zichtbare correcties toe: voor bouwjaar, woningtype en energielabel.
          </p>
          <div className="mt-4">
            <UitklapUitleg titel="Alle correctiefactoren">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                      <th className="py-2 pr-4 font-medium">Correctie</th>
                      <th className="py-2 font-medium">Factor</th>
                    </tr>
                  </thead>
                  <tbody>
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
              <p className="mt-3">
                Zijn er te weinig verkopen, dan vallen we terug op een buurt-anker: de gemiddelde WOZ-waarde van de buurt
                (CBS) gedeeld door de gemiddelde woninggrootte. Dat labelen we op de pagina als afgeleide.
              </p>
            </UitklapUitleg>
          </div>
        </Stap>

        <Stap nummer="3" titel="De bandbreedte is geen versiering">
          <p className="mt-3 leading-relaxed text-inkt-zacht">
            De breedte van de bandbreedte volgt uit de spreiding van de gebruikte verkopen. Lijken ze sterk op elkaar,
            dan is de marge smal. Lopen ze uiteen, of zijn er weinig, dan is de marge breed en zeggen we dat erbij:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-inkt-zacht">
            <li>8 of meer verkopen: betrouwbaarheid hoog</li>
            <li>4 tot 7 verkopen: betrouwbaarheid middel</li>
            <li>minder dan 4: betrouwbaarheid laag, brede marge</li>
          </ul>
          <div className="mt-4">
            <UitklapUitleg titel="Hoe de marge precies wordt berekend">
              We nemen de interkwartielafstand (IQR) van de prijzen per vierkante meter: het verschil tussen het 25e en
              75e percentiel, oftewel de spreiding van de middelste helft van de verkopen. Die spreiding, gedeeld door de
              mediaan en gehalveerd, bepaalt de marge, met een ondergrens van 5 en een bovengrens van 15 procent. Bij
              minder dan 4 verkopen gebruiken we automatisch de maximale marge van 15 procent.
            </UitklapUitleg>
          </div>
        </Stap>
      </div>

      <div className="mt-12">
        <Kaart className="bg-merk-wash">
          <h2 className="text-xl font-semibold">Waarom elke onlineschatting ernaast zit, ook die van ons</h2>
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            Een rekenmodel kent jouw keuken, achterstallig onderhoud of nieuwe dakkapel niet. Zonder recente verkoop van
            precies jouw huis kan elke modelmatige schatting er duizenden euro&apos;s naast zitten, ook die van Wonea. Wie je
            dan één strak getal toont, verkoopt schijnzekerheid. Daarom tonen wij de bandbreedte, de verkopen en de
            rekenstappen, zodat je zelf ziet hoe stevig de schatting is. En een modelmatige schatting is nooit een
            taxatie: voor een hypotheek heb je een gevalideerd taxatierapport nodig.
          </p>
        </Kaart>
      </div>

      {/* Per tool: bron en peildatum. */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Per tool: bron en peildatum</h2>
        <p className="mt-3 leading-relaxed text-inkt-zacht">
          Elke tool op Wonea draait op openbare bronnen, en bij elk cijfer in de tools staat de bron en de peildatum.
          Dit is het overzicht:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                <th className="py-2 pr-4 font-medium">Tool</th>
                <th className="py-2 pr-4 font-medium">Bron</th>
                <th className="py-2 font-medium">Peildatum</th>
              </tr>
            </thead>
            <tbody className="align-top text-inkt-zacht">
              <tr className="border-b border-lijn">
                <td className="py-2.5 pr-4 font-medium text-inkt">Budgetberekenaar</td>
                <td className="py-2.5 pr-4">De wettelijke leennormen 2026 (Tijdelijke regeling hypothecair krediet) en de NHG-kostengrens 2026 (470.000 euro).</td>
                <td className="py-2.5">Geldend vanaf 1 januari 2026, door ons nagelezen op 23 juli 2026.</td>
              </tr>
              <tr className="border-b border-lijn">
                <td className="py-2.5 pr-4 font-medium text-inkt">Hypotheekrentes</td>
                <td className="py-2.5 pr-4">DNB: de gemiddelde bankrente op nieuw afgesloten hypotheken, per rentevaste periode.</td>
                <td className="py-2.5">Maandcijfer; DNB publiceert met ongeveer twee maanden vertraging. De peilmaand staat bij elk cijfer.</td>
              </tr>
              <tr className="border-b border-lijn">
                <td className="py-2.5 pr-4 font-medium text-inkt">Woningwaarde</td>
                <td className="py-2.5 pr-4">BAG (kenmerken) en CBS (buurtcijfers). Verkoopprijzen zijn in deze testfase gelabelde voorbeelddata op buurtniveau.</td>
                <td className="py-2.5">BAG en CBS lopen doorlopend mee; voorbeelddata is altijd als zodanig gelabeld.</td>
              </tr>
              <tr className="border-b border-lijn">
                <td className="py-2.5 pr-4 font-medium text-inkt">WOZ-check</td>
                <td className="py-2.5 pr-4">Je eigen WOZ-beschikking. Zonder bron tonen we geen WOZ-waarde.</td>
                <td className="py-2.5">Het peiljaar van jouw beschikking.</td>
              </tr>
              <tr className="border-b border-lijn">
                <td className="py-2.5 pr-4 font-medium text-inkt">Verduurzamen</td>
                <td className="py-2.5 pr-4">Energielabels via EP-Online (RVO) waar geregistreerd, anders een indicatie op bouwjaar. Subsidiebedragen uit de ISDE-regeling (RVO), besparingen op basis van kentallen van Milieu Centraal.</td>
                <td className="py-2.5">ISDE-bedragen en kentallen opgehaald op 23 juli 2026.</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-inkt">Biedadvies</td>
                <td className="py-2.5 pr-4">De waardebandbreedte hierboven plus buurtcijfers over overbieding en doorlooptijd, in deze testfase voorbeelddata.</td>
                <td className="py-2.5">Staat bij de cijfers op de pagina.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Eerlijk over de grenzen. */}
      <section className="mt-12 rounded-[14px] border border-lijn bg-paneel p-6">
        <h2 className="text-2xl font-semibold">Wat we niet weten</h2>
        <p className="mt-3 leading-relaxed text-inkt-zacht">
          Een eerlijke methode benoemt ook zijn grenzen. Dit weten we niet, en dat beloven we dus ook niet:
        </p>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-inkt-zacht">
          <li>
            <strong className="font-semibold text-inkt">Echte verkoopprijzen per woning.</strong> NVM-transactiecijfers
            zijn niet vrij beschikbaar en Kadaster-koopsommen kosten geld per opvraging. Daarom rekenen we in deze
            testfase met gelabelde voorbeelddata, tot we die bron aansluiten.
          </li>
          <li>
            <strong className="font-semibold text-inkt">Rentetarieven per geldverstrekker.</strong> DNB publiceert alleen
            gemiddelden, dus een eerlijke vergelijker per bank kan niet op open data en vind je hier niet.
          </li>
          <li>
            <strong className="font-semibold text-inkt">De binnenkant van jouw huis.</strong> Een verbouwde keuken,
            achterstallig onderhoud of een grote tuin: het model rekent met bouwjaar, type, oppervlakte en energielabel,
            en ziet de rest niet.
          </li>
          <li>
            <strong className="font-semibold text-inkt">Energielabels die niet geregistreerd zijn.</strong> Waar
            EP-Online geen label kent, tonen we een indicatie op basis van bouwjaar, altijd zo gelabeld.
          </li>
        </ul>
        <p className="mt-4 text-sm text-inkt-zacht">
          Vragen over de methode?{" "}
          <Link href="/over-ons" className="font-semibold text-merk underline underline-offset-4 transition-colors hover:text-merk-licht">
            Lees waarom we Wonea bouwen
          </Link>.
        </p>
      </section>
    </div>
  );
}
