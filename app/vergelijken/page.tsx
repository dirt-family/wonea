import type { Metadata } from "next";
import Link from "next/link";
import { dnbIndicatieRente, getVergelijkWoningen, watValtOp } from "@/lib/zoeken";
import { formatEuro } from "@/lib/util";
import { BronLabel, EnergieLabelBadge, Kaart, KnopPrimair } from "@/components/ui";

/**
 * /vergelijken: 2 of 3 woningen naast elkaar via ?w=slug,slug,slug.
 * Bewust GEEN winnaar-highlight: wij vellen geen oordeel. De kaart
 * "Wat valt op?" benoemt alleen feitelijke verschillen uit de data.
 * Adresdiepe pagina, dus noindex (zelfde gating-lijn als /zoeken).
 */

export const metadata: Metadata = {
  title: "Vergelijk woningen",
  description: "Zet twee of drie woningen naast elkaar: geschatte waarde, WOZ, prijs per m2 en indicatieve maandlast.",
  robots: { index: false, follow: false },
};

function fmtPct(pct: number): string {
  return `${pct.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

const rijLabelClass = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gedempt align-top";
const celClass = "px-4 py-3 align-top tabular-nums";

function GeenData({ tekst }: { tekst: string }) {
  return <span className="text-sm text-gedempt">{tekst}</span>;
}

export default async function VergelijkenPagina({
  searchParams,
}: {
  searchParams: Promise<{ w?: string | string[] }>;
}) {
  const { w } = await searchParams;
  const woningen = await getVergelijkWoningen(w);

  if (woningen.length < 2) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-semibold sm:text-4xl">Vergelijk woningen</h1>
        <Kaart className="mt-8 max-w-xl">
          <p className="text-sm leading-relaxed text-inkt-zacht">
            {woningen.length === 1
              ? "Er staat nu maar één woning klaar om te vergelijken, en vergelijken begint bij twee."
              : "Er staan nog geen woningen klaar om te vergelijken."}{" "}
            Kies twee of drie woningen op de zoekpagina met het vakje Vergelijk op de woningkaarten.
          </p>
          <div className="mt-5">
            <KnopPrimair href="/zoeken">Naar zoeken</KnopPrimair>
          </div>
        </Kaart>
      </div>
    );
  }

  const rente = dnbIndicatieRente();
  const opvallend = watValtOp(
    woningen.map((won) => ({
      naam: won.naam,
      oppervlakteM2: won.adres.oppervlakteM2,
      bouwjaar: won.adres.bouwjaar,
      energielabel: won.adres.energielabel,
      prijsPerM2: won.prijsPerM2,
    })),
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-semibold sm:text-4xl">Vergelijk woningen</h1>
      <p className="mt-2 max-w-2xl text-inkt-zacht">
        {woningen.length} woningen naast elkaar. Alle waardes zijn indicaties met een bandbreedte, geen taxaties: zie het
        als een goed startpunt voor je gesprek of je bod.
      </p>

      <div className="mt-8 overflow-x-auto rounded-[14px] border border-lijn bg-paneel">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-lijn align-bottom">
              <th scope="col" className="w-44 px-4 py-4" aria-label="Kenmerk" />
              {woningen.map((won) => (
                <th key={won.slug} scope="col" className="px-4 py-4 text-left">
                  <Link
                    href={`/woning/${won.adres.postcode}/${won.adres.nummerslug}`}
                    className="font-display text-lg font-semibold text-merk hover:underline"
                  >
                    {won.naam}
                  </Link>
                  <p className="mt-0.5 text-xs font-normal text-gedempt">
                    {won.adres.plaats} · {won.adres.woningtype}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-lijn">
              <th scope="row" className={rijLabelClass}>Geschatte waarde</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>
                  {won.valuation ? (
                    <span className="font-display text-lg font-semibold text-merk">{formatEuro(won.valuation.waarde)}</span>
                  ) : (
                    <GeenData tekst="Nog geen schatting" />
                  )}
                </td>
              ))}
            </tr>
            <tr className="border-b border-lijn">
              <th scope="row" className={rijLabelClass}>Bandbreedte</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>
                  {won.valuation ? (
                    <>
                      {formatEuro(won.valuation.intervalLaag)} tot {formatEuro(won.valuation.intervalHoog)}
                    </>
                  ) : (
                    <GeenData tekst="Geen bandbreedte" />
                  )}
                </td>
              ))}
            </tr>
            <tr className="border-b border-lijn">
              <th scope="row" className={rijLabelClass}>WOZ-waarde</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>
                  {won.woz ? (
                    <>
                      <span className="font-semibold">{formatEuro(won.woz.waarde)}</span>
                      <span className="block text-xs text-gedempt">peiljaar {won.woz.peiljaar}</span>
                      {won.woz.bron === "seed" ? (
                        <span className="mt-1 block">
                          <BronLabel>voorbeeldwaarde, niet de echte WOZ</BronLabel>
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <GeenData tekst="Geen WOZ met bron" />
                  )}
                </td>
              ))}
            </tr>
            <tr className="border-b border-lijn">
              <th scope="row" className={rijLabelClass}>Prijs per m2</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>
                  {won.prijsPerM2 !== null ? `${formatEuro(won.prijsPerM2)} per m2` : <GeenData tekst="Geen schatting" />}
                </td>
              ))}
            </tr>
            <tr className="border-b border-lijn">
              <th scope="row" className={rijLabelClass}>Oppervlakte</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>{won.adres.oppervlakteM2} m2</td>
              ))}
            </tr>
            <tr className="border-b border-lijn">
              <th scope="row" className={rijLabelClass}>Bouwjaar</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>{won.adres.bouwjaar}</td>
              ))}
            </tr>
            <tr className="border-b border-lijn">
              <th scope="row" className={rijLabelClass}>Energielabel</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>
                  {won.adres.energielabel ? (
                    <>
                      <EnergieLabelBadge label={won.adres.energielabel} klein />
                      {won.adres.energielabelBron === "indicatie" ? (
                        <span className="mt-1 block">
                          <BronLabel>indicatie op basis van bouwjaar</BronLabel>
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <GeenData tekst="Onbekend" />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={rijLabelClass}>Indicatieve maandlast</th>
              {woningen.map((won) => (
                <td key={won.slug} className={celClass}>
                  {won.maandlast !== null ? (
                    <span className="font-semibold">{formatEuro(won.maandlast)} per maand</span>
                  ) : (
                    <GeenData tekst="Geen schatting" />
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-gedempt">
        {rente
          ? `Indicatieve maandlast: annuiteitenhypotheek over de volledige geschatte waarde, 30 jaar looptijd, tegen het DNB-gemiddelde van ${fmtPct(rente.pct)} (${rente.peilmaand}), zonder eigen geld en zonder kosten koper. Je echte maandlast hangt af van je rente, je aflossingsvorm en je eigen inbreng. `
          : ""}
        Waardes zijn modelmatige schattingen, geen taxaties.{" "}
        <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
          Zo rekenen we
        </Link>
        .
      </p>

      {opvallend.length > 0 ? (
        <Kaart className="mt-6">
          <h2 className="text-lg font-semibold">Wat valt op?</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-inkt-zacht">
            {opvallend.map((zin) => (
              <li key={zin}>{zin}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gedempt">
            Feitelijke verschillen uit de cijfers hierboven. Welke woning bij jou past, bepaal je zelf: rustig, niet onder
            druk.
          </p>
        </Kaart>
      ) : null}

      <p className="mt-6 text-sm text-inkt-zacht">
        Andere woningen kiezen of er een toevoegen?{" "}
        <Link href="/zoeken" className="font-semibold text-merk underline underline-offset-4">
          Terug naar zoeken
        </Link>
      </p>
    </div>
  );
}
