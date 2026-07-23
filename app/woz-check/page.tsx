import type { Metadata } from "next";
import { Kaart, SectieLabel } from "@/components/ui";
import { WozCheckStepper } from "./stepper";
import { zoekWozAdres } from "./zoek";

export const metadata: Metadata = {
  title: "Gratis WOZ-check: klopt je WOZ-waarde met de markt?",
  description: "Vergelijk de WOZ-waarde van je beschikking met een eerlijke marktschatting. Gratis, zonder account. Wij verdienen niets aan WOZ-bezwaar.",
  alternates: { canonical: "/woz-check" },
  // Bewust indexeerbaar: de WOZ-check is de gratis organische haak (PLAN par.
  // 4.3) en staat in /sitemaps/statisch.xml; een noindex-pagina mag nooit in
  // een sitemap staan, dus indexeren en opnemen horen hier bij elkaar.
  robots: { index: true, follow: true },
};

export default async function WozCheckPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string }>;
}) {
  const sp = await searchParams;
  // Deep-links (?postcode&nummer, o.a. vanaf de woningpagina en Mijn Woning)
  // lossen we op de server op; de stepper start dan met het adres al gevonden.
  const initieel = sp.postcode && sp.nummer ? await zoekWozAdres(sp.postcode, sp.nummer) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Gratis WOZ-check</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Je WOZ-waarde bepaalt je onroerendezaakbelasting. Wijkt hij flink af van de marktwaarde, dan kan bezwaar lonen.
        Dat doe je gratis en rechtstreeks bij je gemeente; Wonea verdient hier niets aan en stuurt je niet door naar een
        bezwaarbureau. Vul in twee korte stappen je beschikking en je adres in; daarna zie je meteen hoe je WOZ zich
        verhoudt tot onze marktschatting.
      </p>

      <Kaart className="mt-8">
        <WozCheckStepper initieel={initieel} initieleZoek={{ postcode: sp.postcode ?? "", nummer: sp.nummer ?? "" }} />
      </Kaart>

      <div className="mt-10 space-y-5">
        <Kaart>
          <SectieLabel>Wat als je WOZ te hoog is</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Een te hoge WOZ kost je elk jaar geld</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            De WOZ-waarde is niet alleen een getal op een brief: hij werkt door in meerdere heffingen. Staat hij te hoog,
            dan betaal je jaar na jaar te veel. Dit zijn de drie plekken waar je hem terugziet.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Onroerendezaakbelasting (OZB)</h3>
              <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
                Je gemeente heft OZB als percentage van je WOZ-waarde. Een lagere WOZ betekent dus direct een lagere
                aanslag. Het tarief verschilt per gemeente; het echte percentage staat op je aanslag en op de site van je
                gemeente.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Inkomstenbelasting: het eigenwoningforfait</h3>
              <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
                Woon je zelf in de woning, dan telt een percentage van de WOZ-waarde als bijtelling bij je inkomen in box
                1. Voor de meeste woningen was dat 0,35% (tarief 2025, bron: Belastingdienst). Een lagere WOZ betekent een
                lagere bijtelling en dus minder inkomstenbelasting.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold">Tweede woning: box 3 en de vrije voet</h3>
              <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
                Een woning die niet je hoofdverblijf is, telt voor de WOZ-waarde mee als vermogen in box 3. Een deel van je
                vermogen is vrijgesteld: het heffingsvrij vermogen, ook wel de vrije voet. Kom je daarboven, dan betaal je
                belasting over het meerdere. Een lagere WOZ verkleint die grondslag. Het actuele vrijstellingsbedrag staat
                op belastingdienst.nl.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-achtergrond p-4">
            <p className="text-sm font-semibold">Rekenvoorbeeld, bewust fictief</p>
            <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
              Stel dat je WOZ 25.000 euro te hoog staat en bezwaar dat corrigeert. Bij een voorbeeldtarief van 0,1% OZB
              scheelt dat 25 euro per jaar. Het eigenwoningforfait daalt met 0,35% van 25.000 euro, dus ongeveer 88 euro
              minder bijtelling; betaal je daarover 37% belasting (voorbeeldtarief), dan is dat zo'n 32 euro per jaar.
              Samen in dit voorbeeld ongeveer 57 euro per jaar, en een correctie werkt vaak jaren door. De echte bedragen
              hangen af van jouw gemeente en jouw situatie.
            </p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
            Eerlijk is ook: een hogere WOZ kan in je voordeel werken. Sommige geldverstrekkers verlagen de rente-opslag op
            je hypotheek als je woningwaarde stijgt ten opzichte van je schuld. Bezwaar is dus geen automatisme; het loont
            vooral als je WOZ duidelijk boven de marktwaarde ligt.
          </p>
          <p className="mt-3 text-xs text-gedempt">
            Bronnen: Belastingdienst (eigenwoningforfait 2025, box 3), je eigen gemeente (OZB-tarief). Uitleg
            gecontroleerd op 23 juli 2026. De bedragen en tarieven in het rekenvoorbeeld zijn voorbeelden, niet die van
            jouw gemeente of jouw aangifte.
          </p>
        </Kaart>

        <Kaart>
          <SectieLabel>Officiële WOZ-waarde</SectieLabel>
          <h2 className="mt-2 text-lg font-semibold">Automatisch je officiële WOZ tonen: hier werken we aan</h2>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Het liefst tonen we hier meteen de officiële WOZ-waarde van je adres, zodat je niets hoeft over te typen. We
            hebben die route in juli 2026 onderzocht bij het Kadaster. De eerlijke stand: de gratis WOZ-koppeling van het
            Kadaster is alleen beschikbaar voor overheden en organisaties met een wettelijke taak, en daar valt Wonea niet
            onder. Het publieke WOZ-waardeloket automatisch uitlezen verbieden de gebruiksvoorwaarden, dus dat doen we
            niet.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            Wat nu al kan: zoek je officiële WOZ-waarde gratis op via{" "}
            <a
              href="https://www.wozwaardeloket.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-merk underline underline-offset-4"
            >
              wozwaardeloket.nl
            </a>{" "}
            en gebruik die in deze check. Zodra er een nette officiële route komt, bijvoorbeeld wanneer WOZ-waarden echte
            open data worden, tonen we hier de officiële WOZ automatisch. Een datum beloven we niet; we melden het zodra
            het kan.
          </p>
          <p className="mt-3 text-xs text-gedempt">Bron: kadaster.nl en wozwaardeloket.nl, geraadpleegd op 23 juli 2026.</p>
        </Kaart>
      </div>
    </div>
  );
}
