import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { marketStats, type addresses, type valuations } from "@/db/schema";
import { berekenMarktsignalen, formatDoorlooptijd, type DoorlooptijdTrend, type Momentum } from "@/lib/marktsignalen";
import { formatEuro } from "@/lib/util";
import { Bandbreedte, BronLabel, Kaart, LegeStaat, SectieLabel, StatTegel, VoorbeelddataLabel } from "@/components/ui";
import { WaardeGrafiek } from "@/components/dossier/waarde-grafiek";

/**
 * Sectie 1 van het woningdossier: huidige waarde met bandbreedte en
 * betrouwbaarheid, de opgebouwde waardehistorie, de kenmerken en de
 * belangrijkste buurtsignalen als kerncijfers. Geen data = eerlijk leeg.
 */

type Adres = typeof addresses.$inferSelect;
type Valuation = typeof valuations.$inferSelect;

const MOMENTUM_WOORD: Record<Momentum, string> = { stijgend: "stijgend", vlak: "vlak", dalend: "dalend" };
const MOMENTUM_RICHTING: Record<Momentum, "positief" | "negatief" | "neutraal"> = {
  stijgend: "positief",
  dalend: "negatief",
  vlak: "neutraal",
};
const DOORLOOPTIJD_WOORD: Record<DoorlooptijdTrend, string> = {
  korter: "korter dan eerder",
  gelijk: "stabiel",
  langer: "langer dan eerder",
};

function pctMetTeken(x: number): string {
  const abs = Math.abs(x).toLocaleString("nl-NL", { maximumFractionDigits: 1 });
  return `${x > 0 ? "+" : x < 0 ? "-" : ""}${abs}%`;
}

function ConfidenceTekst({ valuation, niveau }: { valuation: Valuation; niveau: "straat" | "buurt" }) {
  const plek = niveau === "straat" ? "in deze straat" : "in deze buurt";
  if (valuation.confidence === "hoog")
    return <>Op basis van {valuation.nComparables} recente verkopen {plek}. Dat geeft een relatief zekere schatting.</>;
  if (valuation.confidence === "middel")
    return <>Op basis van {valuation.nComparables} recente verkopen {plek}. Voldoende voor een richting, niet voor zekerheid.</>;
  return (
    <>Er zijn weinig recente verkopen {plek} ({valuation.nComparables}), dus de marge is bewust breed. Zo eerlijk is het.</>
  );
}

export async function OverzichtSectie({
  adres,
  valuation,
  niveau,
  historie,
  buurtNaam,
}: {
  adres: Adres;
  valuation: Valuation | null;
  niveau: "straat" | "buurt";
  historie: { datum: string; waarde: number }[];
  buurtNaam: string | null;
}) {
  const statRijen = (
    await db.select().from(marketStats).where(eq(marketStats.buurtCode, adres.buurtCode)).orderBy(marketStats.maand)
  ).slice(-12);
  const signalen = berekenMarktsignalen(statRijen);
  const heeftSeedStats = statRijen.some((r) => r.bron === "seed");

  return (
    <section id="overzicht" aria-label="Overzicht" className="scroll-mt-6">
      <h2 className="text-2xl font-semibold">Overzicht</h2>

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <Kaart className="lg:col-span-2">
          <SectieLabel>Geschatte woningwaarde</SectieLabel>
          {valuation ? (
            <>
              <p className="mt-3 font-display text-5xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
              <Bandbreedte laag={valuation.intervalLaag} waarde={valuation.waarde} hoog={valuation.intervalHoog} />
              <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
                <ConfidenceTekst valuation={valuation} niveau={niveau} />
              </p>
              <p className="mt-3 text-xs text-gedempt">
                Modelmatige schatting ({valuation.modelVersie}), geen taxatie.{" "}
                <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
                  Zo rekenen we
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
              Voor dit adres kunnen we nog geen eerlijke schatting maken: te weinig recente verkopen in de buurt. Liever
              geen getal dan een verzonnen getal.
            </p>
          )}
        </Kaart>

        <Kaart>
          <SectieLabel>Kenmerken</SectieLabel>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Bouwjaar</dt>
              <dd className="font-medium">{adres.bouwjaar}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Woonoppervlakte</dt>
              <dd className="font-medium">{adres.oppervlakteM2} m2</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Type</dt>
              <dd className="font-medium">{adres.woningtype}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Energielabel</dt>
              <dd className="text-right font-medium">
                {adres.energielabel ?? "onbekend"}
                {adres.energielabel && adres.energielabelBron === "indicatie" ? (
                  <span className="mt-1 block">
                    <BronLabel>indicatie op basis van bouwjaar</BronLabel>
                  </span>
                ) : null}
              </dd>
            </div>
            {buurtNaam ? (
              <div className="flex justify-between gap-4">
                <dt className="text-gedempt">Buurt</dt>
                <dd className="text-right font-medium">{buurtNaam}</dd>
              </div>
            ) : null}
          </dl>
        </Kaart>
      </div>

      <Kaart className="mt-5">
        <SectieLabel>Waardehistorie</SectieLabel>
        <WaardeGrafiek historie={historie} />
        {historie.length >= 2 ? (
          <p className="mt-2 text-xs text-gedempt">
            Elke berekening van ons model is een punt; de waarde schommelt dus nooit onverklaard.
          </p>
        ) : null}
      </Kaart>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectieLabel>Signalen uit de buurt</SectieLabel>
          {heeftSeedStats && signalen ? <VoorbeelddataLabel /> : null}
        </div>
        {signalen ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <StatTegel
              label="Buurtmomentum"
              waarde={MOMENTUM_WOORD[signalen.momentum]}
              delta={`${pctMetTeken(signalen.momentumPct)} vergeleken met de drie maanden ervoor`}
              deltaRichting={MOMENTUM_RICHTING[signalen.momentum]}
            />
            <StatTegel
              label="Doorlooptijd"
              waarde={signalen.doorlooptijdNu != null ? formatDoorlooptijd(signalen.doorlooptijdNu) : "geen data"}
              delta={signalen.doorlooptijdNu != null ? DOORLOOPTIJD_WOORD[signalen.doorlooptijdTrend] : undefined}
            />
            <StatTegel
              label="Overbieden"
              waarde={signalen.overbiedingNu != null ? pctMetTeken(signalen.overbiedingNu) : "geen data"}
              delta={signalen.overbiedingNu != null ? "ten opzichte van de vraagprijs" : undefined}
            />
          </div>
        ) : (
          <div className="mt-3">
            <LegeStaat
              titel="Nog geen buurtsignalen"
              tekst="Er zijn te weinig maandcijfers over deze buurt om momentum, doorlooptijd of overbieding te tonen. Liever geen signaal dan een verzonnen signaal."
            />
          </div>
        )}
      </div>
    </section>
  );
}
