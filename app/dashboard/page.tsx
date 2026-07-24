import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { getOrCreateValuation, valuationHistorie } from "@/lib/valuation";
import { formatDatumNl, formatEuro } from "@/lib/util";
import {
  AlertRij,
  DotMatrix,
  EnergieLabelBadge,
  GrootCijfer,
  IcoonRondje,
  KnopPrimair,
  KnopSecundair,
  Pil,
  SectieLabel,
  VoortgangsBalk,
  type VoortgangSegment,
} from "@/components/ui";
import { Illustratie } from "@/components/illustraties";
import { Blok, BlokKop } from "@/components/dossier/blok";
import { WaardeAnalyse } from "@/components/dossier/waarde-analyse";
import { waardeDelta } from "@/components/dossier/data";
import { uitloggen } from "@/app/dashboard/actions";

/**
 * Mijn woningen: het overzicht van geclaimde woningen als flux-dashboard
 * (BRAND.md "Dashboard-shell-patroon"): witte blokken (radius 24) in een
 * gemengd grid op het canvas, het oversized waarde-cijfer met lime delta-pill,
 * precies een donkere analysekaart (de waardehistorie van de eerste woning),
 * de activiteitenfeed met kleurdots, en de buurt-verkopen met dot-matrix en
 * woningtype-verdeling op de echte comparables. Accountpagina: altijd noindex.
 */

export const metadata: Metadata = { title: "Mijn woningen", robots: { index: false, follow: false } };

const FOUTEN: Record<string, string> = {
  claim: "Deze claim bestaat niet (meer) of hoort niet bij jouw account.",
  ongeldig: "Er ging iets mis met dat verzoek. Probeer het opnieuw.",
};

const OK: Record<string, string> = {
  opgezegd: "Claim opgezegd. Alerts zijn gestopt en deelbare links ingetrokken.",
};

function verkoopMaand(datumIso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(`${datumIso}T00:00:00Z`));
}

/** Verkopen geteld per maand, oudste eerst; alleen weergave van echte data. */
function verkopenPerMaand(verkopen: { datum: string }[], maanden: number): number[] {
  const nu = new Date();
  const teller: number[] = new Array(maanden).fill(0);
  for (const v of verkopen) {
    const d = new Date(`${v.datum}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    const diff = (nu.getUTCFullYear() - d.getUTCFullYear()) * 12 + (nu.getUTCMonth() - d.getUTCMonth());
    if (diff >= 0 && diff < maanden) teller[maanden - 1 - diff] += 1;
  }
  return teller;
}

/** Woningtype-verdeling van de gebruikte verkopen; hooguit 3 types + overig. */
function typeVerdeling(verkopen: { woningtype: string }[]): VoortgangSegment[] {
  const teller = new Map<string, number>();
  for (const v of verkopen) teller.set(v.woningtype, (teller.get(v.woningtype) ?? 0) + 1);
  const gesorteerd = [...teller.entries()].sort((a, b) => b[1] - a[1]);
  const kleuren: NonNullable<VoortgangSegment["kleur"]>[] = ["merk", "lavendel", "lime"];
  const top = gesorteerd.slice(0, 3).map(([label, waarde], i) => ({ label, waarde, kleur: kleuren[i] }));
  const rest = gesorteerd.slice(3).reduce((som, [, n]) => som + n, 0);
  return rest > 0 ? [...top, { label: "overig", waarde: rest, kleur: "neutraal" as const }] : top;
}

export default async function DashboardPagina({ searchParams }: { searchParams: Promise<{ fout?: string; ok?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/claim");
  const sp = await searchParams;

  const actieveClaims = await db
    .select()
    .from(claims)
    .where(and(eq(claims.userId, user.id), isNull(claims.endedAt)))
    .orderBy(desc(claims.createdAt));

  const kaarten = (
    await Promise.all(
      actieveClaims.map(async (claim) => {
        const adres = (await db.select().from(addresses).where(eq(addresses.id, claim.adresId)).limit(1))[0];
        if (!adres || adres.status === "opted_out" || (await isAddressIdSuppressed(adres.id))) return null;
        const { valuation, comparables } = await getOrCreateValuation(adres);
        const historie = await valuationHistorie(adres.id);
        const abonnement = (
          await db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claim.id)).limit(1)
        )[0];
        return { claim, adres, valuation, comparables, historie, alertsActief: !!abonnement?.actief };
      }),
    )
  ).filter((k): k is NonNullable<typeof k> => k !== null);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Mijn woningen</h1>
          <p className="mt-1 text-sm text-inkt-zacht">Ingelogd als {user.email}</p>
        </div>
        <form action={uitloggen}>
          <KnopSecundair type="submit">Uitloggen</KnopSecundair>
        </form>
      </div>

      {sp.fout ? (
        <p className="mt-6 rounded-lg border border-negatief/30 bg-negatief-wash px-4 py-3 text-sm text-negatief">
          {FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw."}
        </p>
      ) : null}
      {sp.ok && OK[sp.ok] ? (
        <p className="mt-6 rounded-lg border border-positief/30 bg-positief-wash px-4 py-3 text-sm text-positief">{OK[sp.ok]}</p>
      ) : null}

      {kaarten.length === 0 ? (
        <Blok className="mt-6 overflow-hidden p-0">
          <div className="grid items-stretch sm:grid-cols-[1fr_auto]">
            <div className="p-7">
              <SectieLabel>Nog geen woning</SectieLabel>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-inkt-zacht">
                Je hebt op dit moment geen actieve claim. Zoek je adres en klik op de woningpagina op &quot;Dit is mijn
                woning&quot; om de waarde te volgen en je dossier op te bouwen.
              </p>
              <div className="mt-4">
                <KnopPrimair href="/">Zoek je adres</KnopPrimair>
              </div>
            </div>
            <div className="hidden items-end bg-lavendel-wash px-8 pt-6 sm:flex">
              <Illustratie naam="lege-staat" className="h-32 w-auto" />
            </div>
          </div>
        </Blok>
      ) : (
        kaarten.map(({ claim, adres, valuation, comparables, historie, alertsActief }, kaartIndex) => {
          const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
          const dossierHref = `/dashboard/woning/${claim.id}`;
          const delta = waardeDelta(historie);
          const feedHistorie = [...historie].slice(-2).reverse();
          const alleVerkopen = comparables.comparables;
          const verkopen = [...alleVerkopen].sort((a, b) => (a.datum < b.datum ? 1 : -1)).slice(0, 4);
          const heeftSeedVerkopen = verkopen.some((v) => v.bron === "seed");
          const maandTelling = verkopenPerMaand(alleVerkopen, 12);
          const maandTotaal = maandTelling.reduce((som, n) => som + n, 0);
          const verdeling = typeVerdeling(alleVerkopen);

          return (
            <section key={claim.id} className="mt-10 first:mt-8" aria-label={naam}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <IcoonRondje naam="huis" tint="merk" maat="l" />
                  <div>
                    <h2 className="font-display text-2xl font-semibold">{naam}</h2>
                    <p className="text-sm text-inkt-zacht">
                      {adres.postcode} {adres.plaats}
                    </p>
                  </div>
                </div>
                <Pil variant="lavendel">zelfverklaard {claim.rol}</Pil>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-5">
                <Blok className="reveal flex flex-col lg:col-span-3">
                  <SectieLabel>Geschatte waarde</SectieLabel>
                  {valuation ? (
                    <div className="mt-3 flex-1">
                      <GrootCijfer
                        waarde={valuation.waarde.toLocaleString("nl-NL")}
                        eenheid="euro"
                        delta={delta?.tekst}
                        deltaRichting={delta?.richting}
                        deltaTint="lime"
                      />
                      <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
                        Bandbreedte {formatEuro(valuation.intervalLaag)} tot {formatEuro(valuation.intervalHoog)}, op basis
                        van {valuation.nComparables} verkopen (betrouwbaarheid: {valuation.confidence}).
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-inkt-zacht">
                      Nog geen eerlijke schatting mogelijk: te weinig recente verkopen in de buurt. Liever geen getal dan
                      een verzonnen getal.
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-lijn pt-5">
                    <KnopPrimair href={dossierHref}>Open het dossier</KnopPrimair>
                    <Link
                      href={`/woning/${adres.postcode}/${adres.nummerslug}`}
                      className="text-sm font-semibold text-merk underline underline-offset-4"
                    >
                      Publieke woningpagina
                    </Link>
                  </div>
                </Blok>

                <Blok className="reveal lg:col-span-2">
                  <BlokKop icoon="waarschuwing" titel="Laatste activiteit" />
                  <div className="mt-2 divide-y divide-lijn">
                    {feedHistorie.map((punt) => (
                      <AlertRij
                        key={punt.datum + String(punt.waarde)}
                        kleur="lavendel"
                        titel={`Waarde herberekend: ${formatEuro(punt.waarde)}`}
                        meta={formatDatumNl(punt.datum)}
                        href={dossierHref}
                      />
                    ))}
                    {alertsActief ? (
                      <AlertRij
                        kleur="lime"
                        titel="Waarde-alerts staan aan"
                        meta="Je krijgt maandelijks de waardeontwikkeling per mail."
                        href={`${dossierHref}#alerts`}
                      />
                    ) : (
                      <AlertRij
                        kleur="merk"
                        titel="Waarde-alerts staan uit"
                        meta="Weer aanzetten kan met één klik."
                        href={`${dossierHref}#alerts`}
                      />
                    )}
                    <AlertRij kleur="merk" titel="Woning geclaimd" meta={`Sinds ${formatDatumNl(claim.createdAt)}`} />
                  </div>
                </Blok>

                {kaartIndex === 0 ? (
                  <div className="reveal lg:col-span-3">
                    <WaardeAnalyse historie={historie.map((v) => ({ datum: v.datum, waarde: v.waarde }))} />
                  </div>
                ) : (
                  <Blok className="reveal lg:col-span-3">
                    <WaardeAnalyse
                      historie={historie.map((v) => ({ datum: v.datum, waarde: v.waarde }))}
                      variant="licht"
                    />
                  </Blok>
                )}

                <Blok className="reveal lg:col-span-2">
                  <BlokKop icoon="info" titel="Kenmerken" />
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-gedempt">Bouwjaar</dt>
                      <dd className="font-medium tabular-nums">{adres.bouwjaar}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gedempt">Woonoppervlakte</dt>
                      <dd className="font-medium tabular-nums">{adres.oppervlakteM2} m2</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gedempt">Type</dt>
                      <dd className="font-medium">{adres.woningtype}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-gedempt">Energielabel</dt>
                      <dd className="font-medium">
                        {adres.energielabel ? <EnergieLabelBadge label={adres.energielabel} klein /> : "onbekend"}
                      </dd>
                    </div>
                  </dl>
                </Blok>

                {verkopen.length > 0 ? (
                  <Blok className="reveal lg:col-span-3">
                    <BlokKop
                      icoon="locatie"
                      titel="Recente verkopen in de buurt"
                      actie={
                        heeftSeedVerkopen ? (
                          <span className="block max-w-64 text-right text-[11px] font-medium leading-snug text-lavendel-diep">
                            Voorbeelddata: in deze testfase tonen we fictieve verkopen op buurtniveau, niet gekoppeld aan
                            echte adressen
                          </span>
                        ) : undefined
                      }
                    />
                    <div className="mt-2 divide-y divide-lijn">
                      {verkopen.map((v) => (
                        <div key={v.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-inkt">
                              {v.straat ? `${v.straat}, ` : ""}
                              {v.woningtype}, {v.oppervlakteM2} m2
                            </p>
                            <p className="mt-0.5 text-xs text-gedempt">verkocht in {verkoopMaand(v.datum)}</p>
                          </div>
                          <p className="font-display text-lg font-semibold tabular-nums text-merk">{formatEuro(v.prijs)}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-gedempt">
                      Dezelfde verkopen waarop de waardeschatting van deze woning rekent, op {comparables.niveau}niveau.
                    </p>
                  </Blok>
                ) : null}

                {maandTotaal > 0 || verdeling.length > 0 ? (
                  <Blok className="reveal lg:col-span-2">
                    <BlokKop icoon="grafiek" titel="De verkopen geteld" />
                    {maandTotaal > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-inkt">Per maand, laatste 12 maanden</p>
                        <div className="mt-3">
                          <DotMatrix
                            waarden={maandTelling}
                            kolommen={12}
                            omschrijving={`Verkopen per maand waarop de schatting rekent, laatste 12 maanden: ${maandTotaal} in totaal`}
                          />
                        </div>
                      </div>
                    ) : null}
                    {verdeling.length > 0 ? (
                      <div className="mt-5">
                        <p className="text-sm font-medium text-inkt">Woningtypen in de gebruikte verkopen</p>
                        <VoortgangsBalk className="mt-3" segmenten={verdeling} />
                      </div>
                    ) : null}
                    <p className="mt-4 text-xs text-gedempt">
                      Geteld over alle verkopen waarop de schatting van deze woning rekent.
                    </p>
                  </Blok>
                ) : null}
              </div>
            </section>
          );
        })
      )}

      <p className="mt-8 text-sm text-inkt-zacht">
        Nog een woning volgen?{" "}
        <Link href="/" className="font-semibold text-merk underline underline-offset-4">
          Zoek het adres
        </Link>{" "}
        en klik daar op &quot;Dit is mijn woning&quot;.
      </p>
    </div>
  );
}
