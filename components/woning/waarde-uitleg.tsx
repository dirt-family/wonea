import Link from "next/link";
import { BronLabel, DeltaPil, Kaart, ModuleTag } from "@/components/ui";
import { formatEuro } from "@/lib/util";
import { deltaRichting, formatPct, type MaandPunt, type WozReeksRij } from "@/components/woning/data";

/**
 * Module 4: "Wat is dit huis waard?" De uitlegkaart in gewone taal
 * (copy-voice uit PROTOTYPE-OOGST.md) met twee subkaarten: de
 * waardeontwikkeling als staafjes uit de valuation-historie en de WOZ door de
 * jaren. Te weinig meetpunten = eerlijk zeggen, geen grafiek forceren.
 */

function ConfidenceZin({ confidence, n, niveau }: { confidence: string; n: number; niveau: "straat" | "buurt" }) {
  const plek = niveau === "straat" ? "in deze straat" : "in deze buurt";
  if (confidence === "hoog") return <>De schatting leunt op {n} recente verkopen {plek}. Dat geeft een relatief zekere schatting.</>;
  if (confidence === "middel") return <>De schatting leunt op {n} recente verkopen {plek}. Voldoende voor een richting, niet voor zekerheid.</>;
  return <>Er zijn weinig recente verkopen {plek} ({n}), dus de marge is bewust breed. Zo eerlijk is het.</>;
}

const maandLabelFmt = new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" });

function maandLabel(maand: string): string {
  const [jaar, mnd] = maand.split("-").map(Number);
  if (!jaar || !mnd) return maand;
  return maandLabelFmt.format(new Date(Date.UTC(jaar, mnd - 1, 1)));
}

function WaardeStaafjes({ punten }: { punten: MaandPunt[] }) {
  if (punten.length < 2) {
    return (
      <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
        De ontwikkeling bouwen we op vanaf de eerste berekening voor dit adres. Er zijn nog te weinig meetpunten voor een
        eerlijke grafiek.
      </p>
    );
  }
  const waarden = punten.map((p) => p.waarde);
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const span = max - min || 1;
  const eerste = punten[0];
  const laatste = punten[punten.length - 1];
  return (
    <>
      <div className="mt-4 flex h-24 items-end gap-1.5" aria-hidden="true">
        {punten.map((p) => (
          <div
            key={p.maand}
            className="flex-1 rounded-t bg-merk-200 last:bg-merk"
            style={{ height: `${25 + ((p.waarde - min) / span) * 75}%` }}
          />
        ))}
      </div>
      <p className="mt-3 text-sm tabular-nums text-inkt-zacht">
        Van {formatEuro(eerste.waarde)} ({maandLabel(eerste.maand)}) naar {formatEuro(laatste.waarde)} ({maandLabel(laatste.maand)}).
      </p>
    </>
  );
}

function WozJaren({ rijen }: { rijen: WozReeksRij[] }) {
  if (rijen.length === 0) {
    return <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">Voor dit adres kennen we geen WOZ-waarde met een bron. Dan tonen we er ook geen.</p>;
  }
  const nieuwsteEerst = [...rijen].reverse();
  return (
    <>
      <ul className="mt-3">
        {nieuwsteEerst.map((rij) => (
          <li key={rij.peiljaar} className="flex items-center justify-between gap-3 border-b border-lijn py-2 text-sm last:border-0">
            <span className="text-inkt-zacht">{rij.peiljaar}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">{formatEuro(rij.waarde)}</span>
              {rij.deltaPct !== null ? <DeltaPil richting={deltaRichting(rij.deltaPct)}>{formatPct(rij.deltaPct)}</DeltaPil> : null}
            </span>
          </li>
        ))}
      </ul>
      {rijen.some((rij) => rij.bron === "seed") ? (
        <p className="mt-3">
          <BronLabel>voorbeeldwaarden, niet de echte WOZ</BronLabel>
        </p>
      ) : null}
    </>
  );
}

export function WaardeUitleg({
  valuation,
  niveau,
  punten,
  wozRijen,
}: {
  valuation: { waarde: number; confidence: string; nComparables: number; modelVersie: string } | null;
  niveau: "straat" | "buurt";
  punten: MaandPunt[];
  wozRijen: WozReeksRij[];
}) {
  return (
    <Kaart>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">Wat is dit huis waard?</h2>
        <ModuleTag>indicatie</ModuleTag>
      </div>
      {valuation ? (
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Ons model schat dit huis op {formatEuro(valuation.waarde)}. Het is een indicatie, geen taxatie, dus zie het als
          een goed startpunt voor je gesprek of je bod. <ConfidenceZin confidence={valuation.confidence} n={valuation.nComparables} niveau={niveau} />{" "}
          <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
            Zo rekenen we
          </Link>
          .
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Voor dit adres kunnen we nog geen eerlijke schatting maken: er zijn te weinig recente verkopen in de buurt en geen
          bruikbaar buurtgemiddelde. Liever geen getal dan een verzonnen getal.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-lijn p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">Waardeontwikkeling</p>
          <WaardeStaafjes punten={punten} />
        </div>
        <div className="rounded-lg border border-lijn p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">WOZ door de jaren</p>
          <WozJaren rijen={wozRijen} />
        </div>
      </div>
    </Kaart>
  );
}
