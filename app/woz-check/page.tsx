import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, wozValues } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro, normalizePostcode } from "@/lib/util";
import { BronLabel, inputClass, Kaart, KnopPrimair, LeadCta, SectieLabel, Veld } from "@/components/ui";
import { WozVergelijker } from "./vergelijker";

export const metadata: Metadata = {
  title: "Gratis WOZ-check: klopt je WOZ-waarde met de markt?",
  description: "Vergelijk de WOZ-waarde van je beschikking met een eerlijke marktschatting. Gratis, zonder account. Wij verdienen niets aan WOZ-bezwaar.",
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
  const postcode = sp.postcode ? normalizePostcode(sp.postcode) : null;
  const nummerslug = sp.nummer?.toLowerCase().replace(/\s+/g, "") ?? null;

  let adres = null;
  if (postcode && nummerslug) {
    const kandidaat = (
      await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
        .limit(1)
    )[0];
    if (kandidaat && kandidaat.status === "actief" && !(await isSuppressed(kandidaat.postcode, kandidaat.nummerslug))) {
      adres = kandidaat;
    }
  }

  const adresQuery = adres ? `?postcode=${adres.postcode}&nummer=${adres.nummerslug}` : "";

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Gratis WOZ-check</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Je WOZ-waarde bepaalt je onroerendezaakbelasting. Wijkt hij flink af van de marktwaarde, dan kan bezwaar lonen. Dat
        doe je gratis en rechtstreeks bij je gemeente; Wonea verdient hier niets aan en stuurt je niet door naar een
        bezwaarbureau.
      </p>

      {!adres ? (
        <Kaart className="mt-8">
          <SectieLabel>Stap 1: zoek je adres</SectieLabel>
          <form method="get" className="mt-4 grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Veld label="Postcode">
              <input name="postcode" placeholder="1234 AB" required className={inputClass} defaultValue={sp.postcode ?? ""} />
            </Veld>
            <Veld label="Huisnummer">
              <input name="nummer" placeholder="12" required className={inputClass} defaultValue={sp.nummer ?? ""} />
            </Veld>
            <KnopPrimair type="submit">Zoek</KnopPrimair>
          </form>
          {postcode && nummerslug ? (
            <p className="mt-4 text-sm text-negatief">Dit adres staat niet op Wonea. Controleer je invoer.</p>
          ) : null}
        </Kaart>
      ) : (
        <WozResultaat adresId={adres.id} />
      )}

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

        <div className="grid gap-5 sm:grid-cols-2">
          <Kaart>
            <SectieLabel>Woningwaarde-check</SectieLabel>
            <h2 className="mt-2 text-lg font-semibold">Wat is je woning nu echt waard?</h2>
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              De marktschatting in deze check komt uit onze woningwaarde-check: altijd met bandbreedte, de verkopen
              erachter en een uitgelegde methode.
            </p>
            <Link
              href={adres ? `/woning/${adres.postcode}/${adres.nummerslug}` : "/"}
              className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4"
            >
              {adres ? "Naar de woningwaarde van dit adres" : "Zoek je adres op de homepagina"}
            </Link>
          </Kaart>
          <Kaart>
            <SectieLabel>Budget</SectieLabel>
            <h2 className="mt-2 text-lg font-semibold">Wat kun je maximaal lenen?</h2>
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Reken met de officiële leennormen van 2026 uit wat je kunt lenen en wat dat betekent voor je maandlasten.
            </p>
            <Link href="/budget" className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
              Naar de budgetberekenaar
            </Link>
          </Kaart>
        </div>

        <LeadCta
          titel="Grotere vragen dan je WOZ?"
          tekst="Overwaarde benutten, oversluiten of je maandlasten opnieuw bekijken: een onafhankelijke adviseur rekent het door met jouw echte cijfers. WOZ-bezwaar zelf blijft gratis: dat regel je rechtstreeks bij je gemeente, zonder bureau en zonder ons."
          knopTekst="Stel je hypotheekvraag"
          href={`/hypotheek${adresQuery}`}
          ontvanger="een onafhankelijke hypotheekadviseur"
        />
      </div>
    </div>
  );
}

async function WozResultaat({ adresId }: { adresId: number }) {
  const adres = (await db.select().from(addresses).where(eq(addresses.id, adresId)).limit(1))[0];
  if (!adres) return null;
  const { valuation } = await getOrCreateValuation(adres);
  const woz = (await db.select().from(wozValues).where(eq(wozValues.adresId, adres.id)).orderBy(wozValues.peiljaar)).at(-1);
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.postcode} ${adres.plaats}`;

  return (
    <div className="mt-8 space-y-5">
      <Kaart>
        <SectieLabel>Stap 2: jouw adres</SectieLabel>
        <p className="mt-2 text-lg font-semibold">{naam}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gedempt">Marktschatting Wonea</p>
            {valuation ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
                <p className="mt-1 text-xs text-gedempt">
                  bandbreedte {formatEuro(valuation.intervalLaag)} tot {formatEuro(valuation.intervalHoog)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-inkt-zacht">Nog geen eerlijke schatting mogelijk voor dit adres.</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gedempt">Bekende WOZ-waarde</p>
            {woz ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-merk">{formatEuro(woz.waarde)}</p>
                <p className="mt-1 text-xs text-gedempt">peiljaar {woz.peiljaar}</p>
                {woz.bron === "seed" ? <p className="mt-2"><BronLabel>voorbeeldwaarde, niet je echte WOZ</BronLabel></p> : null}
              </>
            ) : (
              <p className="mt-1 text-sm text-inkt-zacht">Wij tonen geen WOZ zonder bron. Vul hieronder die van je beschikking in.</p>
            )}
          </div>
        </div>
      </Kaart>

      {valuation ? (
        <Kaart>
          <SectieLabel>Stap 3: vergelijk met je beschikking</SectieLabel>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Vul de WOZ-waarde van je eigen beschikking in. We vergelijken ter plekke en slaan niets op: invullen op andermans
            adres heeft dus geen zin, en jouw invoer belandt nergens in een database. WOZ vastleggen en volgen kan straks wel,
            maar alleen voor je eigen geclaimde woning.
          </p>
          <WozVergelijker marktwaarde={valuation.waarde} intervalLaag={valuation.intervalLaag} intervalHoog={valuation.intervalHoog} />
        </Kaart>
      ) : null}

      <Kaart className="bg-merk-wash">
        <SectieLabel>Bezwaar maken?</SectieLabel>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Ligt je WOZ duidelijk boven de bandbreedte, dan kan bezwaar zinvol zijn. Doe dat binnen zes weken na de beschikking,
          gratis via de site van je gemeente. Bureaus die het "gratis" voor je doen worden betaald uit gemeenschapsgeld en
          sinds 2024 flink beperkt; je hebt ze niet nodig.
        </p>
        <Link href={`/woning/${adres.postcode}/${adres.nummerslug}`} className="mt-4 inline-block text-sm font-semibold text-merk underline underline-offset-4">
          Bekijk de volledige woningpagina
        </Link>
      </Kaart>
    </div>
  );
}
