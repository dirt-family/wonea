import type { Metadata } from "next";
import { formatDatumNl } from "@/lib/util";
import {
  ODBL_URL,
  OSM_ATTRIBUTIE,
  OSM_COPYRIGHT_URL,
  zoekMakelaars,
  type Makelaar,
  type MakelaarsResultaat,
} from "@/lib/bronnen/makelaars";
import { inputClass, Kaart, KnopPrimair, LeadCta, LegeStaat, SectieLabel, UitklapUitleg, Veld } from "@/components/ui";

export const metadata: Metadata = {
  title: "Vind een makelaar",
  description: "Zoek makelaarskantoren per plaats, op basis van de open kaartendatabase OpenStreetMap.",
  alternates: { canonical: "/makelaars" },
  // Bewust indexeerbaar (rekenhulpen = index): statische pagina zonder
  // adresdata. Staat daarom ook in /sitemaps/statisch.xml (lib/seo/sitemap.ts);
  // indexeren en opnemen in de sitemap horen bij elkaar.
  robots: { index: true, follow: true },
};

/**
 * Vind een makelaar: plaats-zoekveld (GET, geen opslag), lijst uit
 * OpenStreetMap/Overpass (lib/bronnen/makelaars.ts). De echte funnel blijft
 * /verkopen; deze pagina is een open naslaglijst met verplichte
 * ODbL-attributie en een eerlijke dekkingsdisclaimer.
 */

function Bronvermelding({ opgehaaldOp }: { opgehaaldOp?: string }) {
  return (
    <p className="mt-3 text-xs text-gedempt">
      <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
        {OSM_ATTRIBUTIE}
      </a>
      {" "}(licentie:{" "}
      <a href={ODBL_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
        ODbL
      </a>
      ){opgehaaldOp ? <>. Opgehaald op {formatDatumNl(opgehaaldOp)}.</> : "."}
    </p>
  );
}

function MakelaarsLijst({ resultaat }: { resultaat: Extract<MakelaarsResultaat, { status: "ok" }> }) {
  const n = resultaat.makelaars.length;
  if (n === 0) {
    return (
      <div className="mt-5">
        <LegeStaat
          titel={`Geen makelaars gevonden in ${resultaat.plaats}`}
          tekst="OpenStreetMap kent hier nog geen makelaars; de dekking is onvolledig. Probeer eventueel de gemeentenaam in plaats van de plaatsnaam."
        />
        <Bronvermelding opgehaaldOp={resultaat.opgehaaldOp} />
      </div>
    );
  }
  return (
    <Kaart className="mt-5">
      <SectieLabel>
        {n === 1 ? "1 makelaarskantoor" : `${n} makelaarskantoren`} in {resultaat.plaats}
      </SectieLabel>
      <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
        Alfabetisch gesorteerd. Vermelding is geen aanbeveling: Wonea heeft geen band met deze kantoren en ontvangt hier
        niets voor. De lijst komt uit een open kaartendatabase en kan onvolledig of verouderd zijn.
      </p>
      <ul className="mt-4 divide-y divide-lijn">
        {resultaat.makelaars.map((m: Makelaar) => (
          <li key={`${m.naam}|${m.adres ?? ""}`} className="py-4 first:pt-0 last:pb-0">
            <p className="font-semibold text-inkt">{m.naam}</p>
            {m.adres ? <p className="mt-0.5 text-sm text-inkt-zacht">{m.adres}</p> : null}
            {m.website || m.telefoon ? (
              <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                {m.website ? (
                  <a
                    href={m.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-semibold text-merk underline underline-offset-4"
                  >
                    Website
                  </a>
                ) : null}
                {m.telefoon ? <span className="text-inkt-zacht">{m.telefoon}</span> : null}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <Bronvermelding opgehaaldOp={resultaat.opgehaaldOp} />
    </Kaart>
  );
}

export default async function MakelaarsPagina({ searchParams }: { searchParams: Promise<{ plaats?: string }> }) {
  const sp = await searchParams;
  const plaatsInput = (sp.plaats ?? "").trim();
  const resultaat = plaatsInput ? await zoekMakelaars(plaatsInput) : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Vind een makelaar</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Zoek makelaarskantoren in jouw plaats. De lijst komt uit OpenStreetMap, een open kaartendatabase die door
        vrijwilligers wordt bijgehouden: gratis en openbaar, maar niet compleet. Staat een kantoor er niet in, dan bestaat
        het dus best.
      </p>

      <Kaart className="mt-8">
        <form method="get" action="/makelaars" className="space-y-5">
          <SectieLabel>In welke plaats zoek je?</SectieLabel>
          <Veld label="Plaats" hint="Bijvoorbeeld Eindhoven, of de gemeentenaam.">
            <input name="plaats" defaultValue={plaatsInput} placeholder="Eindhoven" required maxLength={60} className={inputClass} />
          </Veld>
          <KnopPrimair type="submit">Zoek makelaars</KnopPrimair>
          <p className="text-xs leading-relaxed text-gedempt">
            We slaan je zoekopdracht niet op; de plaatsnaam gaat alleen naar de openbare kaartendatabase.
          </p>
        </form>
      </Kaart>

      {resultaat?.status === "ongeldige-plaats" ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
          Die plaatsnaam herkennen we niet. Gebruik alleen letters, bijvoorbeeld Eindhoven of Bergen op Zoom.
        </p>
      ) : null}

      {resultaat?.status === "bron-fout" ? (
        <div className="mt-5">
          <LegeStaat
            titel="De bron is nu niet bereikbaar"
            tekst="OpenStreetMap (Overpass) gaf binnen tien seconden geen bruikbaar antwoord. Dit ligt niet aan jouw zoekopdracht: probeer het over een paar minuten opnieuw."
          />
          <Bronvermelding />
        </div>
      ) : null}

      {resultaat?.status === "ok" ? <MakelaarsLijst resultaat={resultaat} /> : null}

      <div className="mt-8">
        <UitklapUitleg titel="Waar komt deze lijst vandaan?">
          <p>
            We vragen de openbare Overpass-API van OpenStreetMap naar alle punten die als makelaarskantoor zijn gemarkeerd
            (tag office=estate_agent) binnen de bestuurlijke grens van de plaats of gemeente die je invult. Het resultaat
            bewaren we 24 uur op de server, daarna halen we het opnieuw op; de peildatum staat onder de lijst.
          </p>
          <p className="mt-3">
            OpenStreetMap wordt door vrijwilligers bijgehouden. Daardoor is de dekking per plaats verschillend en kunnen
            naam, adres of website verouderd zijn. Wij voegen zelf niets toe en laten ook niets weg: wat je ziet is precies
            wat de kaartendatabase kent, alfabetisch gesorteerd. Een vermelding is geen aanbeveling van Wonea.
          </p>
          <p className="mt-3">
            De data valt onder de Open Database License (
            <a href={ODBL_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
              ODbL
            </a>
            ): {OSM_ATTRIBUTIE},{" "}
            <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
              openstreetmap.org/copyright
            </a>
            .
          </p>
        </UitklapUitleg>
      </div>

      <div className="mt-8">
        <LeadCta
          titel="Liever dat wij het uitzoeken?"
          tekst="Wil je verkopen, dan hoef je niet zelf te bellen. Beantwoord drie korte vragen over je woning en verkoopplannen, dan brengen we je in contact met een lokale verkoopmakelaar die je buurt kent. Gratis en vrijblijvend."
          knopTekst="Start de verkoopcheck"
          href="/verkopen"
          ontvanger="een lokale verkoopmakelaar"
        />
      </div>
    </div>
  );
}
