"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import {
  BandbreedteInvaart,
  GerelateerdeRekenhulpen,
  RekenModule,
  RekenmoduleSamenvatting,
  UitkomstMoment,
  type SamenvattingRij,
  type StapDefinitie,
} from "@/components/rekenmodule";
import { BronLabel, DeltaPil, inputClass, LeadCta, SectieLabel, UitklapUitleg, Veld } from "@/components/ui";
import { formatDatumNl, formatEuro } from "@/lib/format";
import {
  leesAdresResultaat,
  ozbVoorbeeldPerJaar,
  OZB_VOORBEELD_TARIEF_PCT,
  parsePeiljaar,
  parseWozBedrag,
  vergelijkWoz,
  type WozAdresResultaat,
} from "@/app/woz-check/berekening";

/**
 * WOZ-check op het rekenmodule-framework. Deze laag levert de twee
 * vraagstappen (jouw WOZ, jouw woning) en de uitkomst-view; het frame regelt
 * StappenBalk, navigatie, ?stap= in de URL, focus en sessie-persistentie.
 * De vergelijkregels staan in berekening.ts, de marktschatting komt van de
 * server (zoek.ts, via de route /woz-check/zoek-adres). De WOZ-invoer van de
 * bezoeker blijft in de browser en gaat nooit naar de server.
 */

const HUIDIG_JAAR = new Date().getFullYear();

// Zelfde stijl als KnopSecundair; ui.tsx kent geen onClick-variant, dus deze
// laag draagt de klassen zelf (zelfde precedent als het framework).
const knopSecundairCls =
  "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk disabled:opacity-60";

export function WozCheckStepper({
  initieel,
  initieleZoek,
}: {
  /** Op de server opgelost adres bij een deep-link met ?postcode&nummer. */
  initieel: WozAdresResultaat | null;
  /** Ruwe zoekvelden uit de URL, voor het voorinvullen van stap 2. */
  initieleZoek: { postcode: string; nummer: string };
}) {
  const [wozInvoer, setWozInvoer] = useState("");
  const [peiljaarInvoer, setPeiljaarInvoer] = useState("");
  const [postcode, setPostcode] = useState(initieel?.postcode ?? initieleZoek.postcode);
  const [nummer, setNummer] = useState(initieel?.nummerslug ?? initieleZoek.nummer);
  const [adres, setAdres] = useState<WozAdresResultaat | null>(initieel);
  const [zoekBezig, setZoekBezig] = useState(false);
  const [zoekMelding, setZoekMelding] = useState<string | null>(null);
  const zoekVolgnummer = useRef(0);

  async function zoek() {
    const p = postcode.trim();
    const n = nummer.trim();
    if (!p || !n) {
      setZoekMelding("Vul postcode en huisnummer in, dan zoeken we het adres op.");
      return;
    }
    const volg = ++zoekVolgnummer.current;
    setZoekBezig(true);
    setZoekMelding(null);
    try {
      const res = await fetch(`/woz-check/zoek-adres?postcode=${encodeURIComponent(p)}&nummer=${encodeURIComponent(n)}`);
      if (volg !== zoekVolgnummer.current) return;
      const data: unknown = res.ok ? await res.json() : null;
      const resultaat =
        data && typeof data === "object" && "resultaat" in data ? leesAdresResultaat((data as { resultaat: unknown }).resultaat) : null;
      if (resultaat) {
        setAdres(resultaat);
      } else if (res.status === 429) {
        setZoekMelding("Even te veel zoekopdrachten achter elkaar. Wacht een minuutje en probeer het opnieuw.");
      } else {
        setZoekMelding("Dit adres staat niet op Wonea. Controleer je invoer; in deze testfase dekken we nog niet heel Nederland.");
      }
    } catch {
      if (volg === zoekVolgnummer.current) setZoekMelding("Zoeken lukte even niet. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      if (volg === zoekVolgnummer.current) setZoekBezig(false);
    }
  }

  function anderAdres() {
    setAdres(null);
    setZoekMelding(null);
  }

  /** Enter in de zoekvelden zoekt het adres; het frame gaat dan niet door. */
  function bijEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !adres) {
      e.preventDefault();
      void zoek();
    }
  }

  function valideerWoz(): string | null {
    if (parseWozBedrag(wozInvoer) == null) return "Vul de WOZ-waarde van je beschikking in, in hele euro's. Bijvoorbeeld 425000.";
    if (parsePeiljaar(peiljaarInvoer, HUIDIG_JAAR) == null)
      return `Vul het peiljaar van je beschikking in als jaartal, bijvoorbeeld ${HUIDIG_JAAR - 1}.`;
    return null;
  }

  function valideerWoning(): string | null {
    if (!adres) return "Zoek eerst je adres op; dan kunnen we je WOZ met onze marktschatting vergelijken.";
    if (!adres.schatting)
      return "We vonden je adres, maar kunnen er nog geen eerlijke marktschatting voor maken. Vergelijken lukt daardoor nog niet.";
    return null;
  }

  /** Herstel uit sessionStorage: elk veld eerst op type controleren. */
  function herstel(data: Record<string, unknown>) {
    if (typeof data.woz === "string") setWozInvoer(data.woz);
    if (typeof data.peiljaar === "string") setPeiljaarInvoer(data.peiljaar);
    // Bij een deep-link wint het vers op de server opgeloste adres van de sessie.
    if (!initieel) {
      if (typeof data.postcode === "string") setPostcode(data.postcode);
      if (typeof data.nummer === "string") setNummer(data.nummer);
      const bewaard = leesAdresResultaat(data.adres);
      if (bewaard) setAdres(bewaard);
    }
  }

  const stappen: StapDefinitie[] = [
    {
      id: "woz",
      titel: "Jouw WOZ",
      vraag: "Wat staat er op je WOZ-beschikking?",
      valideer: valideerWoz,
      inhoud: (
        <>
          <p className="text-sm leading-relaxed text-inkt-zacht">
            Neem het bedrag en het peiljaar over van je beschikking, of zoek ze gratis op via{" "}
            <a
              href="https://www.wozwaardeloket.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-merk underline underline-offset-4"
            >
              wozwaardeloket.nl
            </a>
            . Je invoer blijft in je browser en gaat niet naar onze server.
          </p>
          <Veld label="WOZ-waarde" hint="Het bedrag op je beschikking, in hele euro's.">
            <input
              type="text"
              inputMode="numeric"
              placeholder="425000"
              value={wozInvoer}
              onChange={(e) => setWozInvoer(e.target.value)}
              className={inputClass}
            />
          </Veld>
          <Veld label="Peiljaar" hint="Staat op je beschikking als waardepeildatum, meestal 1 januari van vorig jaar.">
            <input
              type="text"
              inputMode="numeric"
              placeholder={String(HUIDIG_JAAR - 1)}
              value={peiljaarInvoer}
              onChange={(e) => setPeiljaarInvoer(e.target.value)}
              className={inputClass}
            />
          </Veld>
        </>
      ),
    },
    {
      id: "woning",
      titel: "Jouw woning",
      vraag: "Om welke woning gaat het?",
      valideer: valideerWoning,
      inhoud: !adres ? (
        <>
          <p className="text-sm leading-relaxed text-inkt-zacht">
            Zoek het adres op; we vergelijken je WOZ dan met onze marktschatting van die woning. We slaan je zoekopdracht
            niet op.
          </p>
          <div className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Veld label="Postcode">
              <input
                placeholder="1234 AB"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                onKeyDown={bijEnter}
                className={inputClass}
              />
            </Veld>
            <Veld label="Huisnummer">
              <input
                placeholder="12"
                value={nummer}
                onChange={(e) => setNummer(e.target.value)}
                onKeyDown={bijEnter}
                className={inputClass}
              />
            </Veld>
            <button type="button" onClick={() => void zoek()} disabled={zoekBezig} className={knopSecundairCls}>
              {zoekBezig ? "Zoeken..." : "Zoek adres"}
            </button>
          </div>
          {zoekMelding ? (
            <p role="alert" className="text-sm text-negatief">
              {zoekMelding}
            </p>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-lijn bg-achtergrond p-4">
          <p className="text-sm font-semibold">{adres.naam}</p>
          {adres.schatting ? (
            <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
              Onze marktschatting: <span className="font-semibold tabular-nums">{formatEuro(adres.schatting.waarde)}</span>,
              bandbreedte {formatEuro(adres.schatting.laag)} tot {formatEuro(adres.schatting.hoog)}.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
              Voor dit adres kunnen we nog geen eerlijke marktschatting maken; vergelijken lukt daardoor nog niet.{" "}
              <Link href={`/woning/${adres.postcode}/${adres.nummerslug}`} className="font-semibold text-merk underline underline-offset-4">
                Bekijk wat we wel weten
              </Link>
              .
            </p>
          )}
          {adres.bekendeWoz ? (
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Op Wonea staat voor dit adres een WOZ van {formatEuro(adres.bekendeWoz.waarde)} (peiljaar{" "}
              {adres.bekendeWoz.peiljaar}).{" "}
              {adres.bekendeWoz.bron === "seed" ? <BronLabel>voorbeeldwaarde, niet je echte WOZ</BronLabel> : null}
            </p>
          ) : null}
          <button
            type="button"
            onClick={anderAdres}
            className="mt-3 text-sm font-semibold text-merk underline underline-offset-4"
          >
            Ander adres kiezen
          </button>
        </div>
      ),
    },
  ];

  return (
    <RekenModule
      moduleId="woz-check"
      stappen={stappen}
      uitkomstTitel="Uitkomst"
      uitkomstKnopTekst="Bekijk je uitkomst"
      sessie={{
        snapshot: () => ({ woz: wozInvoer, peiljaar: peiljaarInvoer, postcode, nummer, adres }),
        herstel,
      }}
      uitkomst={(api) => (
        <Uitkomst
          woz={parseWozBedrag(wozInvoer) ?? 0}
          peiljaar={parsePeiljaar(peiljaarInvoer, HUIDIG_JAAR) ?? HUIDIG_JAAR}
          adres={adres!}
          gaNaarStap={api.gaNaarStap}
        />
      )}
    />
  );
}

function Uitkomst({
  woz,
  peiljaar,
  adres,
  gaNaarStap,
}: {
  woz: number;
  peiljaar: number;
  adres: WozAdresResultaat;
  gaNaarStap: (stapIndex: number) => void;
}) {
  // Gegate door valideerWoning: zonder schatting kom je hier niet.
  const s = adres.schatting!;
  const v = vergelijkWoz(woz, s.waarde, s.laag, s.hoog);
  const abs = Math.abs(v.verschil);
  const absPct = Math.abs(v.verschilPct);

  const duiding =
    v.categorie === "boven"
      ? {
          kop: `Je WOZ ligt ${formatEuro(abs)} (${absPct}%) boven onze schatting`,
          tekst:
            "Dat is boven onze hele bandbreedte. Bezwaar kan dan zinvol zijn; de vergelijkbare verkopen op de woningpagina helpen als onderbouwing.",
          kleur: "text-negatief",
        }
      : v.categorie === "onder"
        ? {
            kop: `Je WOZ ligt ${formatEuro(abs)} (${absPct}%) onder onze schatting`,
            tekst: "Een lage WOZ betekent minder belasting. Bezwaar is dan meestal niet in je voordeel.",
            kleur: "text-positief",
          }
        : {
            kop: "Je WOZ valt binnen onze bandbreedte",
            tekst:
              "Het verschil met de markt is kleiner dan de onzekerheid van elke schatting. Bezwaar heeft dan weinig kans en levert meestal weinig op.",
            kleur: "text-inkt",
          };

  const samenvatting: SamenvattingRij[] = [
    { label: "WOZ-waarde beschikking", waarde: formatEuro(woz), stapIndex: 0 },
    { label: "Peiljaar", waarde: String(peiljaar), stapIndex: 0 },
    { label: "Woning", waarde: adres.naam, stapIndex: 1 },
  ];

  const adresQuery = `postcode=${adres.postcode}&nummer=${adres.nummerslug}`;

  return (
    <div className="space-y-5">
      <UitkomstMoment label={`Jouw WOZ, peiljaar ${peiljaar}`} waarde={formatEuro(woz)}>
        <p className={`mt-3 text-sm font-semibold ${duiding.kleur}`}>{duiding.kop}</p>
        <BandbreedteInvaart laag={s.laag} waarde={s.waarde} hoog={s.hoog} />
        <p className="mt-2 text-xs text-gedempt">
          Onze marktschatting voor {adres.naam}: {formatEuro(s.waarde)}, op basis van {s.nComparables} vergelijkbare
          verkopen (berekend op {formatDatumNl(s.datum)}). Een indicatie, geen taxatie.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">{duiding.tekst}</p>
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Let wel: je WOZ hoort bij waardepeildatum 1 januari {peiljaar}, onze schatting is van nu. Zit daar tijd tussen,
          dan kan een deel van het verschil gewone marktontwikkeling zijn.
        </p>
      </UitkomstMoment>

      {v.categorie === "boven" ? (
        <div className="rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef">
          {/* Flux-echo: de besparing als lime-pill (tekst shell), hetzelfde
              echte bedrag als in de zin eronder (ozbVoorbeeldPerJaar). */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <SectieLabel>Rekenvoorbeeld OZB</SectieLabel>
            <DeltaPil richting="op" tint="lime">
              scheelt ongeveer {formatEuro(ozbVoorbeeldPerJaar(v.verschil))} per jaar
            </DeltaPil>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Komt je WOZ na bezwaar uit op onze schatting, dan gaat hij {formatEuro(v.verschil)} omlaag. Bij een
            voorbeeldtarief van {String(OZB_VOORBEELD_TARIEF_PCT).replace(".", ",")}% OZB scheelt dat ongeveer{" "}
            {formatEuro(ozbVoorbeeldPerJaar(v.verschil))} per jaar, en een correctie werkt vaak jaren door. Het echte
            tarief staat op de aanslag van je gemeente; het volledige rekenvoorbeeld met eigenwoningforfait staat lager op
            deze pagina.
          </p>
        </div>
      ) : null}

      <div className="rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef">
        <SectieLabel>Bezwaar maken is gratis</SectieLabel>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Denk je dat je WOZ niet klopt? Bezwaar maken doe je gratis en rechtstreeks via de site van je gemeente, binnen
          zes weken na de datum op de beschikking. Bureaus die het "gratis" voor je doen worden betaald uit
          gemeenschapsgeld en zijn sinds 1 januari 2024 flink beperkt (Wet herwaardering proceskostenvergoedingen WOZ en bpm); je hebt ze niet nodig. Wonea verdient niets aan je bezwaar en
          stuurt je nergens heen.
        </p>
        <Link
          href={`/woning/${adres.postcode}/${adres.nummerslug}`}
          className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4"
        >
          Bekijk de vergelijkbare verkopen als onderbouwing
        </Link>
      </div>

      <RekenmoduleSamenvatting rijen={samenvatting} gaNaarStap={gaNaarStap} />

      <UitklapUitleg titel="Zo rekenen we">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Jouw WOZ-waarde en het peiljaar komen uit je eigen beschikking. We vergelijken ter plekke in je browser en
            slaan ze nergens op.
          </li>
          <li>
            De marktschatting komt uit ons eigen waardemodel: {s.nComparables} vergelijkbare verkopen rond dit adres,
            berekend op {formatDatumNl(s.datum)}, betrouwbaarheid {s.confidence}. De bandbreedte hoort er altijd bij; een
            schatting zonder marge is schijnzekerheid.
          </li>
          <li>
            De duiding volgt de bandbreedte: pas als je WOZ boven de hele bandbreedte ligt noemen we bezwaar kansrijk.
            Valt hij erbinnen, dan is het verschil kleiner dan de onzekerheid van elke schatting en zeggen we dat
            eerlijk.
          </li>
          <li>
            Het OZB-voorbeeld rekent met een voorbeeldtarief van {String(OZB_VOORBEELD_TARIEF_PCT).replace(".", ",")}%.
            Het echte tarief verschilt per gemeente en staat op je aanslag en de site van je gemeente.
          </li>
          <li>
            Dit is informatie, geen advies: een modelmatige schatting is geen taxatie, en of bezwaar in jouw situatie
            verstandig is hangt ook af van zaken die wij niet zien.
          </li>
        </ul>
        <p className="mt-3">
          De volledige methode staat op de{" "}
          <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
            methodepagina
          </Link>
          .
        </p>
      </UitklapUitleg>

      <GerelateerdeRekenhulpen
        items={[
          {
            titel: "Woningwaarde",
            zin: "De volledige schatting van dit adres, met de verkopen erachter.",
            href: `/woning/${adres.postcode}/${adres.nummerslug}`,
          },
          { titel: "Budget", zin: "Wat je maximaal kunt lenen volgens de leennormen van 2026.", href: "/budget" },
          {
            titel: "Actuele hypotheekrentes",
            zin: "De gemiddelde rente per rentevaste periode, met peilmaand.",
            href: "/hypotheek-rentes",
          },
        ]}
      />

      <LeadCta
        titel="Grotere vragen dan je WOZ?"
        tekst="Overwaarde benutten, oversluiten of je maandlasten opnieuw bekijken: een onafhankelijke adviseur rekent het door met jouw echte cijfers. WOZ-bezwaar zelf blijft gratis: dat regel je rechtstreeks bij je gemeente, zonder bureau en zonder ons."
        knopTekst="Stel je hypotheekvraag"
        href={`/hypotheek?${adresQuery}`}
        ontvanger="een onafhankelijke hypotheekadviseur"
      />
    </div>
  );
}
