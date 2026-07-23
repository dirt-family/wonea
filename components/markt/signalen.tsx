import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { marketStats } from "@/db/schema";
import { berekenMarktsignalen, type DoorlooptijdTrend, type Momentum } from "@/lib/marktsignalen";
import { formatEuro } from "@/lib/util";
import { Kaart, SectieLabel, VoorbeelddataLabel } from "@/components/ui";

/**
 * Marktsignalen van een buurt (server component). Twee varianten:
 * - "volledig": buurtpagina; kerncijfers + inline SVG-lijn van de mediaanprijs
 *   per maand + uitlegregels in gewone taal.
 * - "compact": adrespagina (rechterkolom); drie regels met momentum,
 *   doorlooptijd en overbieding, plus een link naar de buurtpagina.
 * Seed-data krijgt het VoorbeelddataLabel. Geen bruikbare data: de volledige
 * variant zegt dat eerlijk, de compacte variant toont liever niets.
 */

type Props = {
  variant: "volledig" | "compact";
  buurtCode: string;
  /** Alleen voor "compact": naam en link van de buurtpagina. */
  buurtNaam?: string;
  buurtHref?: string;
  className?: string;
};

const MOMENTUM_WOORD: Record<Momentum, string> = {
  stijgend: "stijgend",
  vlak: "vlak",
  dalend: "dalend",
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

function maandLabel(maand: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" }).format(new Date(`${maand}-01`));
}

function Kerncijfer({ label, waarde, detail }: { label: string; waarde: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-merk-wash p-4">
      <SectieLabel>{label}</SectieLabel>
      <p className="mt-2 font-display text-2xl font-semibold text-merk">{waarde}</p>
      {detail ? <p className="mt-1 text-xs text-gedempt">{detail}</p> : null}
    </div>
  );
}

/** Kleine inline lijngrafiek van de mediaanprijs per maand. Kleur via currentColor (token text-merk). */
function MediaanLijn({ punten }: { punten: { maand: string; mediaan: number }[] }) {
  const w = 560;
  const h = 110;
  const pad = 8;
  const waarden = punten.map((p) => p.mediaan);
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const span = max - min || 1;
  const stap = punten.length > 1 ? (w - pad * 2) / (punten.length - 1) : 0;
  const coords = punten
    .map((p, i) => `${(pad + i * stap).toFixed(1)},${(h - pad - ((p.mediaan - min) / span) * (h - pad * 2)).toFixed(1)}`)
    .join(" ");
  const eerste = punten[0];
  const laatste = punten[punten.length - 1];
  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full text-merk"
        role="img"
        aria-label={`Mediaanprijs per maand, van ${formatEuro(eerste.mediaan)} in ${maandLabel(eerste.maand)} naar ${formatEuro(laatste.mediaan)} in ${maandLabel(laatste.maand)}`}
      >
        <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-gedempt">
        <span>{maandLabel(eerste.maand)}: {formatEuro(eerste.mediaan)}</span>
        <span>{maandLabel(laatste.maand)}: {formatEuro(laatste.mediaan)}</span>
      </figcaption>
    </figure>
  );
}

export async function MarktSignalenKaart({ variant, buurtCode, buurtNaam, buurtHref, className = "" }: Props) {
  const rijen = (
    await db.select().from(marketStats).where(eq(marketStats.buurtCode, buurtCode)).orderBy(marketStats.maand)
  ).slice(-12);
  const signalen = berekenMarktsignalen(rijen);
  const heeftSeed = rijen.some((r) => r.bron === "seed");

  if (variant === "compact") {
    // Adrespagina: liever geen kaart dan een lege kaart.
    if (!signalen) return null;
    return (
      <Kaart className={className}>
        <SectieLabel>Marktsignalen in de buurt</SectieLabel>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gedempt">Prijzen</dt>
            <dd className="text-right font-medium">
              {signalen.momentum === "vlak" ? "vlak" : `${MOMENTUM_WOORD[signalen.momentum]} (${pctMetTeken(signalen.momentumPct)})`}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gedempt">Doorlooptijd</dt>
            <dd className="text-right font-medium">
              {signalen.doorlooptijdNu != null
                ? `${signalen.doorlooptijdNu} dagen${signalen.doorlooptijdTrend !== "gelijk" ? `, ${DOORLOOPTIJD_WOORD[signalen.doorlooptijdTrend]}` : ""}`
                : "geen data"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gedempt">Overbieden</dt>
            <dd className="text-right font-medium">{signalen.overbiedingNu != null ? pctMetTeken(signalen.overbiedingNu) : "geen data"}</dd>
          </div>
        </dl>
        {heeftSeed ? <p className="mt-3"><VoorbeelddataLabel /></p> : null}
        {buurtHref ? (
          <Link href={buurtHref} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Alle marktsignalen van {buurtNaam ? `buurt ${buurtNaam}` : "deze buurt"}
          </Link>
        ) : null}
      </Kaart>
    );
  }

  return (
    <Kaart className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectieLabel>Marktsignalen</SectieLabel>
        {heeftSeed ? <VoorbeelddataLabel /> : null}
      </div>
      {!signalen ? (
        <p className="mt-3 text-sm text-inkt-zacht">
          Nog te weinig maandcijfers om marktsignalen te tonen. Liever geen signaal dan een verzonnen signaal.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kerncijfer
              label="Prijsmomentum"
              waarde={MOMENTUM_WOORD[signalen.momentum]}
              detail={`${pctMetTeken(signalen.momentumPct)} vergeleken met de drie maanden ervoor`}
            />
            <Kerncijfer label="Prijs over 12 maanden" waarde={pctMetTeken(signalen.prijsontwikkeling12mPct)} detail="mediaanprijs, per saldo" />
            <Kerncijfer
              label="Doorlooptijd"
              waarde={signalen.doorlooptijdNu != null ? `${signalen.doorlooptijdNu} dagen` : "geen data"}
              detail={signalen.doorlooptijdNu != null ? DOORLOOPTIJD_WOORD[signalen.doorlooptijdTrend] : undefined}
            />
            <Kerncijfer
              label="Overbieden"
              waarde={signalen.overbiedingNu != null ? pctMetTeken(signalen.overbiedingNu) : "geen data"}
              detail={signalen.overbiedingNu != null ? "ten opzichte van de vraagprijs" : undefined}
            />
          </div>
          {signalen.prijsReeks.length >= 2 ? (
            <>
              <p className="mt-5 text-sm text-inkt-zacht">Mediaanprijs per maand, laatste {signalen.prijsReeks.length} maanden.</p>
              <MediaanLijn punten={signalen.prijsReeks} />
            </>
          ) : null}
          <ul className="mt-5 space-y-2 text-sm leading-relaxed text-inkt-zacht">
            {signalen.uitlegregels.map((regel) => (
              <li key={regel} className="flex gap-2">
                <span aria-hidden="true" className="text-merk">&middot;</span>
                <span>{regel}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Kaart>
  );
}
