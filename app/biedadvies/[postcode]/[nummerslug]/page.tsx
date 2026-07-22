import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, marketStats } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { currentUser } from "@/lib/auth";
import { hasEntitlement, PREMIUM_PRIJZEN } from "@/lib/premium";
import { berekenBiedadvies, SPANNING_TEKST, type Biedadvies, type MarktMaand } from "@/lib/biedadvies";
import { formatEuro, normalizePostcode } from "@/lib/util";
import { Kaart, KnopPrimair, SectieLabel, VoorbeelddataLabel } from "@/components/ui";

/**
 * Biedadvies met context. Gratis voor iedereen: biedrange, overbiedings-trend,
 * doorlooptijd, spanning en de uitlegregels. Premium-verdieping eronder
 * (product "biedadvies"): maandtrend 12 mnd, spreiding winnende biedingen per
 * maand, scenario-tabel. Alles herleidbaar uit valuations + market_stats;
 * geen data betekent eerlijk geen advies.
 */

type Params = { postcode: string; nummerslug: string };

function vindAdres(params: Params) {
  const postcode = normalizePostcode(params.postcode);
  if (!postcode) return null;
  const nummerslug = params.nummerslug.toLowerCase();
  const adres = db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
    .get();
  if (!adres) return null;
  if (adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) return null;
  return adres;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const adres = vindAdres(await params);
  if (!adres) return { title: "Woning niet gevonden", robots: { index: false, follow: false } };
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  return {
    title: `Biedadvies ${naam}, ${adres.postcode} ${adres.plaats}`,
    description: `Realistische biedrange voor ${naam} in ${adres.plaats}, op basis van de waardebandbreedte en de overbieding en doorlooptijd in de buurt. Context, geen aankoopadvies.`,
    robots: { index: false, follow: false }, // indexatie-gating beslist in Fase 5
  };
}

function maandLabel(maand: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "short", year: "numeric" }).format(new Date(`${maand}-01`));
}

function pctNl(n: number): string {
  return Math.abs(n).toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

function tekenPct(n: number): string {
  return `${n >= 0 ? "+" : "-"}${pctNl(n)}%`;
}

/**
 * Zelfde bandbreedte-visual-stijl als op de woningpagina: een rustige balk.
 * De wash-track beslaat waardebandbreedte en biedrange samen; het gevulde
 * segment is de biedrange, zodat je de verschuiving door overbieding ziet.
 */
function BiedrangeBalk({ laag, hoog, basisLaag, basisHoog }: { laag: number; hoog: number; basisLaag: number; basisHoog: number }) {
  const min = Math.min(laag, basisLaag);
  const max = Math.max(hoog, basisHoog);
  const span = max - min || 1;
  const links = ((laag - min) / span) * 100;
  const rechts = ((hoog - min) / span) * 100;
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-merk-wash">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full border border-lijn" />
        <div className="absolute inset-y-0 rounded-full bg-merk" style={{ left: `${links}%`, width: `${Math.max(rechts - links, 2)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-inkt-zacht">
        <span>{formatEuro(laag)}</span>
        <span>{formatEuro(hoog)}</span>
      </div>
    </div>
  );
}

/** Staafjes per maand rond een nullijn; kleur via currentColor (token text-merk). */
function OverbiedingTrend({ punten }: { punten: { maand: string; pct: number }[] }) {
  const w = 560;
  const h = 120;
  const pad = 8;
  const waarden = punten.map((p) => p.pct);
  const min = Math.min(0, ...waarden);
  const max = Math.max(0, ...waarden);
  const span = max - min || 1;
  const yVoor = (v: number) => pad + ((max - v) / span) * (h - pad * 2);
  const slotBreedte = (w - pad * 2) / punten.length;
  const staafBreedte = Math.min(28, slotBreedte * 0.6);
  const eerste = punten[0];
  const laatste = punten[punten.length - 1];
  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full text-merk"
        role="img"
        aria-label={`Gemiddelde overbieding per maand, van ${tekenPct(eerste.pct)} in ${maandLabel(eerste.maand)} naar ${tekenPct(laatste.pct)} in ${maandLabel(laatste.maand)}`}
      >
        <line x1={pad} x2={w - pad} y1={yVoor(0)} y2={yVoor(0)} stroke="var(--color-lijn)" strokeWidth="1" />
        {punten.map((p, i) => {
          const x = pad + i * slotBreedte + (slotBreedte - staafBreedte) / 2;
          const y0 = yVoor(0);
          const y1 = yVoor(p.pct);
          return (
            <rect
              key={p.maand}
              x={x.toFixed(1)}
              y={Math.min(y0, y1).toFixed(1)}
              width={staafBreedte.toFixed(1)}
              height={Math.max(Math.abs(y1 - y0), 1.5).toFixed(1)}
              rx="2"
              fill="currentColor"
              opacity={p.pct >= 0 ? 1 : 0.55}
            />
          );
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-gedempt">
        <span>{maandLabel(eerste.maand)}: {tekenPct(eerste.pct)}</span>
        <span>{maandLabel(laatste.maand)}: {tekenPct(laatste.pct)}</span>
      </figcaption>
    </figure>
  );
}

export default async function BiedadviesPagina({ params }: { params: Promise<Params> }) {
  const adres = vindAdres(await params);
  if (!adres) notFound();

  const { valuation } = getOrCreateValuation(adres);

  const statsAlle = db.select().from(marketStats).where(eq(marketStats.buurtCode, adres.buurtCode)).orderBy(marketStats.maand).all();
  const stats12 = statsAlle.slice(-12);
  const stats6 = stats12.slice(-6);
  const marktMaanden: MarktMaand[] = stats6.map((s) => ({
    maand: s.maand,
    overbiedingPct: s.overbiedingPct,
    doorlooptijdDagen: s.doorlooptijdDagen,
  }));

  const advies = berekenBiedadvies({
    valuation: valuation ? { intervalLaag: valuation.intervalLaag, intervalHoog: valuation.intervalHoog } : null,
    marktMaanden,
  });

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  const woningPad = `/woning/${adres.postcode}/${adres.nummerslug}`;
  const heeftSeedStats = stats12.some((s) => s.bron === "seed");
  const trendPunten6 = stats6
    .filter((s): s is typeof s & { overbiedingPct: number } => s.overbiedingPct != null)
    .map((s) => ({ maand: s.maand, pct: s.overbiedingPct }));

  const user = await currentUser();
  const heeftVerdieping = user ? hasEntitlement(user.id, "biedadvies") : false;
  const premiumUrl = `/premium?product=biedadvies&van=${encodeURIComponent(`/biedadvies/${adres.postcode}/${adres.nummerslug}`)}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> /{" "}
        <Link href={woningPad} className="hover:text-merk">{naam}</Link> / Biedadvies
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Biedadvies: {naam}</h1>
      <p className="mt-1 text-inkt-zacht">{adres.postcode} {adres.plaats}</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
        Dit is context bij je bod, geen aankoopadvies. We laten zien wat de buurtcijfers zeggen; beslissen doe je zelf.
      </p>

      {advies && valuation ? (
        <>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <Kaart className="lg:col-span-2">
              <SectieLabel>Realistische biedrange</SectieLabel>
              <p className="mt-3 font-display text-4xl font-semibold text-merk sm:text-5xl">
                {formatEuro(advies.biedrangeLaag)} <span className="text-2xl text-inkt-zacht sm:text-3xl">tot</span> {formatEuro(advies.biedrangeHoog)}
              </p>
              <BiedrangeBalk
                laag={advies.biedrangeLaag}
                hoog={advies.biedrangeHoog}
                basisLaag={valuation.intervalLaag}
                basisHoog={valuation.intervalHoog}
              />
              <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
                Gebaseerd op de geschatte waardebandbreedte ({formatEuro(valuation.intervalLaag)} tot {formatEuro(valuation.intervalHoog)}),
                gecorrigeerd met wat kopers in deze buurt gemiddeld boven of onder de vraagprijs betalen.
              </p>
              <p className="mt-3 text-xs text-gedempt">
                Modelmatige context, geen taxatie en geen aankoopadvies.{" "}
                <Link href="/methode" className="underline underline-offset-2 hover:text-merk">Zo komt de waarde tot stand</Link>.
              </p>
            </Kaart>

            <Kaart>
              <SectieLabel>Marktspanning</SectieLabel>
              <p className="mt-3 font-display text-2xl font-semibold text-merk">{SPANNING_TEKST[advies.spanning]}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gedempt">Overbieding (6 mnd)</dt>
                  <dd className="font-medium">{advies.overbiedingPct6m != null ? tekenPct(advies.overbiedingPct6m) : "geen cijfer"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gedempt">Doorlooptijd (6 mnd)</dt>
                  <dd className="font-medium">{advies.doorlooptijd6m != null ? `${advies.doorlooptijd6m} dagen` : "geen cijfer"}</dd>
                </div>
              </dl>
              {heeftSeedStats ? <p className="mt-4"><VoorbeelddataLabel /></p> : null}
            </Kaart>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Kaart className="lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectieLabel>Overbieding in deze buurt, laatste 6 maanden</SectieLabel>
                {heeftSeedStats ? <VoorbeelddataLabel /> : null}
              </div>
              {trendPunten6.length >= 2 ? (
                <>
                  <p className="mt-3 text-sm text-inkt-zacht">
                    Hoeveel het gemiddelde winnende bod per maand boven of onder de vraagprijs lag.
                  </p>
                  <OverbiedingTrend punten={trendPunten6} />
                </>
              ) : (
                <p className="mt-3 text-sm text-inkt-zacht">
                  Te weinig maandcijfers om een trend te tonen. Liever geen trend dan een verzonnen trend.
                </p>
              )}
            </Kaart>

            <Kaart>
              <SectieLabel>Zo komen we hierop</SectieLabel>
              <ol className="mt-3 list-decimal space-y-3 pl-4 text-sm leading-relaxed text-inkt-zacht">
                {advies.uitlegregels.map((regel) => (
                  <li key={regel}>{regel}</li>
                ))}
              </ol>
            </Kaart>
          </div>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Verdieping</h2>
            {heeftVerdieping ? (
              <Verdieping stats12={stats12} advies={advies} waarde={valuation.waarde} heeftSeedStats={heeftSeedStats} />
            ) : (
              <Kaart className="mt-4">
                <SectieLabel>Premium</SectieLabel>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
                  De verdieping werkt dezelfde buurtcijfers dieper uit. Je krijgt er geen andere data bij; wel meer context:
                </p>
                <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-inkt-zacht">
                  <li>De maandtrend van de overbieding in deze buurt over de laatste 12 maanden.</li>
                  <li>De spreiding van winnende biedingen per maand: gemiddelde overbieding, mediaan verkoopprijs en aantal verkopen.</li>
                  <li>Een scenario-tabel: wat bieden op -5%, 0% of +5% ten opzichte van de vraagprijs betekent in deze markt.</li>
                </ul>
                <p className="mt-4 text-sm text-inkt-zacht">Eenmalig {formatEuro(PREMIUM_PRIJZEN.biedadvies)} voor dit adres-overzicht.</p>
                <div className="mt-4">
                  <KnopPrimair href={premiumUrl}>Bekijk de verdieping</KnopPrimair>
                </div>
              </Kaart>
            )}
          </section>
        </>
      ) : (
        <Kaart className="mt-8">
          <SectieLabel>Nog geen biedadvies mogelijk</SectieLabel>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            {!valuation
              ? "Voor dit adres kunnen we nog geen eerlijke waarde-schatting maken, en zonder die basis geven we liever geen biedrange dan een verzonnen biedrange."
              : "Voor deze buurt hebben we nog geen marktcijfers (overbieding en doorlooptijd), en zonder die context geven we liever geen biedrange dan een verzonnen biedrange."}
          </p>
          <p className="mt-3 text-sm text-inkt-zacht">
            <Link href={woningPad} className="font-semibold text-merk underline underline-offset-4">Terug naar de woningpagina</Link>
            {" "}of lees{" "}
            <Link href="/methode" className="font-semibold text-merk underline underline-offset-4">hoe we rekenen</Link>.
          </p>
        </Kaart>
      )}

      <div className="mt-10 rounded-[14px] border border-lijn bg-paneel p-6">
        <h2 className="text-base font-semibold">Context, geen aankoopadvies</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Deze cijfers beschrijven de buurt, niet deze ene woning of jouw situatie. Wat je uiteindelijk biedt, bepaal je zelf,
          het liefst samen met je eigen adviseur. Benieuwd hoe de waarde tot stand komt? Kijk bij{" "}
          <Link href="/methode" className="underline underline-offset-2 hover:text-merk">onze methode</Link>.
        </p>
      </div>
    </div>
  );
}

type StatsRij = typeof marketStats.$inferSelect;

/**
 * Premium-verdieping, alleen gerenderd met entitlement "biedadvies".
 * Alles komt uit market_stats (12 maanden) en de valuation; niets verzonnen.
 */
function Verdieping({ stats12, advies, waarde, heeftSeedStats }: { stats12: StatsRij[]; advies: Biedadvies; waarde: number; heeftSeedStats: boolean }) {
  const trendPunten12 = stats12
    .filter((s): s is StatsRij & { overbiedingPct: number } => s.overbiedingPct != null)
    .map((s) => ({ maand: s.maand, pct: s.overbiedingPct }));
  const laagsteMaand = trendPunten12.length > 0 ? trendPunten12.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;
  const hoogsteMaand = trendPunten12.length > 0 ? trendPunten12.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;

  const gemOverbieding = advies.overbiedingPct6m;
  const scenarios =
    gemOverbieding != null
      ? [-5, 0, 5].map((bodPct) => {
          const bedrag = Math.round(waarde * (1 + bodPct / 100));
          const verschilPt = Math.round((bodPct - gemOverbieding) * 10) / 10;
          let duiding: string;
          if (verschilPt <= -0.5) {
            duiding = "Onder het gemiddelde winnende bod. Vooral kansrijk als er weinig andere bieders zijn of de woning al langer te koop staat.";
          } else if (verschilPt < 0.5) {
            duiding = "Rond het gemiddelde winnende bod in deze buurt.";
          } else {
            duiding = "Boven het gemiddelde winnende bod. Dat vergroot je kans, maar je betaalt meer dan de gemiddelde koper.";
          }
          return { bodPct, bedrag, verschilPt, duiding };
        })
      : null;

  return (
    <div className="mt-4 space-y-5">
      <Kaart>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectieLabel>Maandtrend overbieding, laatste 12 maanden</SectieLabel>
          {heeftSeedStats ? <VoorbeelddataLabel /> : null}
        </div>
        {trendPunten12.length >= 2 ? (
          <>
            <p className="mt-3 text-sm text-inkt-zacht">
              Gemiddelde overbieding per maand over {trendPunten12.length} maanden met cijfers. Zo zie je of de markt aantrekt of afkoelt.
            </p>
            <OverbiedingTrend punten={trendPunten12} />
          </>
        ) : (
          <p className="mt-3 text-sm text-inkt-zacht">Te weinig maandcijfers voor een 12-maandstrend in deze buurt.</p>
        )}
      </Kaart>

      <Kaart>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectieLabel>Spreiding van winnende biedingen per maand</SectieLabel>
          {heeftSeedStats ? <VoorbeelddataLabel /> : null}
        </div>
        {stats12.length > 0 ? (
          <>
            <p className="mt-3 text-sm text-inkt-zacht">
              Per maand: hoeveel het gemiddelde winnende bod boven of onder de vraagprijs lag, de mediaan van de verkoopprijzen
              en het aantal verkopen erachter.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                    <th className="py-2 pr-4 font-medium">Maand</th>
                    <th className="py-2 pr-4 font-medium">Winnend bod t.o.v. vraagprijs</th>
                    <th className="py-2 pr-4 font-medium">Mediaan verkoopprijs</th>
                    <th className="py-2 font-medium">Verkopen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats12.map((s) => (
                    <tr key={s.maand} className="border-b border-lijn last:border-0">
                      <td className="py-2.5 pr-4">{maandLabel(s.maand)}</td>
                      <td className="py-2.5 pr-4 font-medium">{s.overbiedingPct != null ? tekenPct(s.overbiedingPct) : "geen cijfer"}</td>
                      <td className="py-2.5 pr-4">{s.mediaanPrijs != null ? formatEuro(s.mediaanPrijs) : "geen cijfer"}</td>
                      <td className="py-2.5">{s.volume ?? "geen cijfer"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {laagsteMaand && hoogsteMaand && laagsteMaand.maand !== hoogsteMaand.maand ? (
              <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
                De maandgemiddelden liepen uiteen van {tekenPct(laagsteMaand.pct)} ({maandLabel(laagsteMaand.maand)}) tot{" "}
                {tekenPct(hoogsteMaand.pct)} ({maandLabel(hoogsteMaand.maand)}). Hoe groter die spreiding, hoe minder je op een
                enkel maandcijfer kunt bouwen.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-inkt-zacht">Geen maandcijfers voor deze buurt.</p>
        )}
      </Kaart>

      <Kaart>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectieLabel>Scenario's: jouw bod ten opzichte van de vraagprijs</SectieLabel>
          {heeftSeedStats ? <VoorbeelddataLabel /> : null}
        </div>
        {scenarios ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
              Rekenvoorbeeld met als aanname dat de vraagprijs gelijk is aan de geschatte waarde ({formatEuro(waarde)}). Het
              gemiddelde winnende bod in deze buurt lag de afgelopen zes maanden {tekenPct(gemOverbieding!)}{" "}
              {gemOverbieding! >= 0 ? "boven" : "onder"} de vraagprijs.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                    <th className="py-2 pr-4 font-medium">Jouw bod</th>
                    <th className="py-2 pr-4 font-medium">Bedrag</th>
                    <th className="py-2 pr-4 font-medium">T.o.v. gemiddeld winnend bod</th>
                    <th className="py-2 font-medium">Wat dit betekent</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.bodPct} className="border-b border-lijn last:border-0 align-top">
                      <td className="py-2.5 pr-4 font-medium">{tekenPct(s.bodPct)}</td>
                      <td className="py-2.5 pr-4">{formatEuro(s.bedrag)}</td>
                      <td className="py-2.5 pr-4">
                        {pctNl(s.verschilPt)} procentpunt {s.verschilPt >= 0 ? "hoger" : "lager"}
                      </td>
                      <td className="py-2.5 leading-relaxed text-inkt-zacht">{s.duiding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-inkt-zacht">
            Zonder overbiedingscijfers voor deze buurt kunnen we geen eerlijke scenario's doorrekenen.
          </p>
        )}
      </Kaart>
    </div>
  );
}
