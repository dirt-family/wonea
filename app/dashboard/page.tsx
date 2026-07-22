import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims, consents, mortgageInfo, sharedReports } from "@/db/schema";
import { currentUser, destroySession } from "@/lib/auth";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { getOrCreateValuation, valuationHistorie } from "@/lib/valuation";
import { formatDatumNl, formatEuro, nowIso } from "@/lib/util";
import { BronLabel, inputClass, Kaart, KnopPrimair, KnopSecundair, SectieLabel, Veld } from "@/components/ui";
import { CONSENT_TEKST_ALERTS, consentTekstversie } from "@/app/claim/consent-teksten";
import { DeelRapport } from "@/app/dashboard/deel-rapport";

export const metadata: Metadata = { title: "Mijn woningen" };

// ---------------------------------------------------------------------------
// Server actions. Elke action verifieert de sessie en het eigenaarschap van
// de claim opnieuw; een claimId uit een formulier is nooit te vertrouwen.
// ---------------------------------------------------------------------------

async function eigenActieveClaim(claimId: number) {
  const user = await currentUser();
  if (!user) redirect("/claim");
  const claim = db
    .select()
    .from(claims)
    .where(and(eq(claims.id, claimId), eq(claims.userId, user.id), isNull(claims.endedAt)))
    .get();
  if (!claim) redirect("/dashboard?fout=claim");
  return { user, claim };
}

const alertsSchema = z.object({
  claimId: z.coerce.number().int().positive(),
  actie: z.enum(["aan", "uit"]),
  consent: z.literal("1").optional(),
});

async function zetAlerts(formData: FormData) {
  "use server";
  const parsed = alertsSchema.safeParse({
    claimId: formData.get("claimId") ?? "",
    actie: formData.get("actie") ?? "",
    consent: formData.get("consent") ?? undefined,
  });
  if (!parsed.success) redirect("/dashboard?fout=ongeldig");
  const { user, claim } = await eigenActieveClaim(parsed.data.claimId);

  const abonnement = db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claim.id)).get();

  if (parsed.data.actie === "uit") {
    if (abonnement) db.update(alertSubscriptions).set({ actief: false }).where(eq(alertSubscriptions.id, abonnement.id)).run();
    redirect("/dashboard?ok=alerts-uit");
  }

  // Aanzetten mag alleen met een niet-ingetrokken alerts-consent; anders is
  // het vinkje (nooit vooraangevinkt) verplicht en loggen we de consent nu.
  const actieveConsent = db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.email, user.email), eq(consents.doel, "alerts"), isNull(consents.revokedAt)))
    .get();
  if (!actieveConsent) {
    if (!parsed.data.consent) redirect("/dashboard?fout=alerts-consent");
    db.insert(consents)
      .values({
        userId: user.id,
        email: user.email,
        doel: "alerts",
        tekstversie: consentTekstversie("alerts"),
        bron: "dashboard",
        consentedAt: nowIso(),
      })
      .run();
  }

  if (abonnement) {
    db.update(alertSubscriptions).set({ actief: true }).where(eq(alertSubscriptions.id, abonnement.id)).run();
  } else {
    db.insert(alertSubscriptions).values({ claimId: claim.id, frequentie: "maandelijks", actief: true }).run();
  }
  redirect("/dashboard?ok=alerts-aan");
}

const hypotheekSchema = z.object({
  claimId: z.coerce.number().int().positive(),
  restant: z.string().min(1).max(12),
  rente: z.string().max(8).optional(),
  rentevastTot: z.string().max(10).optional(),
});

async function bewaarHypotheek(formData: FormData) {
  "use server";
  const parsed = hypotheekSchema.safeParse({
    claimId: formData.get("claimId") ?? "",
    restant: formData.get("restant") ?? "",
    rente: formData.get("rente") ?? "",
    rentevastTot: formData.get("rentevastTot") ?? "",
  });
  if (!parsed.success) redirect("/dashboard?fout=hypotheek");
  const { claim } = await eigenActieveClaim(parsed.data.claimId);

  const restantRuw = parsed.data.restant.replace(/[.\s]/g, "");
  if (!/^\d{1,9}$/.test(restantRuw)) redirect("/dashboard?fout=hypotheek");
  const restantEur = Number(restantRuw);

  let rentePct: number | null = null;
  if (parsed.data.rente && parsed.data.rente.trim() !== "") {
    const r = Number(parsed.data.rente.trim().replace(",", "."));
    if (!Number.isFinite(r) || r < 0 || r > 20) redirect("/dashboard?fout=hypotheek");
    rentePct = Math.round(r * 100) / 100;
  }

  let rentevastTot: string | null = null;
  if (parsed.data.rentevastTot && parsed.data.rentevastTot.trim() !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.rentevastTot.trim())) redirect("/dashboard?fout=hypotheek");
    rentevastTot = parsed.data.rentevastTot.trim();
  }

  const bestaand = db.select().from(mortgageInfo).where(eq(mortgageInfo.claimId, claim.id)).get();
  if (bestaand) {
    db.update(mortgageInfo).set({ restantEur, rentePct, rentevastTot, updatedAt: nowIso() }).where(eq(mortgageInfo.id, bestaand.id)).run();
  } else {
    db.insert(mortgageInfo).values({ claimId: claim.id, restantEur, rentePct, rentevastTot, updatedAt: nowIso() }).run();
  }
  redirect("/dashboard?ok=hypotheek");
}

const opzegSchema = z.object({ claimId: z.coerce.number().int().positive() });

async function zegClaimOp(formData: FormData) {
  "use server";
  const parsed = opzegSchema.safeParse({ claimId: formData.get("claimId") ?? "" });
  if (!parsed.success) redirect("/dashboard?fout=ongeldig");
  const { claim } = await eigenActieveClaim(parsed.data.claimId);

  const now = nowIso();
  db.update(claims).set({ endedAt: now }).where(eq(claims.id, claim.id)).run();
  db.update(alertSubscriptions).set({ actief: false }).where(eq(alertSubscriptions.claimId, claim.id)).run();
  db.update(sharedReports)
    .set({ revokedAt: now })
    .where(and(eq(sharedReports.claimId, claim.id), isNull(sharedReports.revokedAt)))
    .run();
  redirect("/dashboard?ok=opgezegd");
}

async function uitloggen() {
  "use server";
  await destroySession();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Weergave
// ---------------------------------------------------------------------------

const FOUTEN: Record<string, string> = {
  claim: "Deze claim bestaat niet (meer) of hoort niet bij jouw account.",
  ongeldig: "Er ging iets mis met dat verzoek. Probeer het opnieuw.",
  "alerts-consent": "Zonder vinkje geen alerts: zet eerst het vinkje aan, dan leggen we je toestemming vast.",
  hypotheek: "Controleer je hypotheekgegevens: restant in hele euro's, rente als percentage, datum als jjjj-mm-dd.",
};

const OK: Record<string, string> = {
  "alerts-aan": "Waarde-alerts staan aan. Je krijgt maandelijks de waardeontwikkeling per mail.",
  "alerts-uit": "Waarde-alerts staan uit. Je toestemming blijft bewaard; weer aanzetten kan met één klik.",
  hypotheek: "Hypotheekgegevens opgeslagen. Alleen jij ziet ze.",
  opgezegd: "Claim opgezegd. Alerts zijn gestopt en deelbare links ingetrokken.",
};

function Sparkline({ historie }: { historie: { datum: string; waarde: number }[] }) {
  if (historie.length < 2) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-gedempt">
        Waardehistorie bouwt zich vanaf nu op; elke nieuwe berekening komt hier als punt bij.
      </p>
    );
  }
  const w = 280;
  const h = 56;
  const pad = 6;
  const waarden = historie.map((x) => x.waarde);
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const span = max - min || 1;
  const punten = historie
    .map((x, i) => {
      const px = pad + (i * (w - 2 * pad)) / (historie.length - 1);
      const py = h - pad - ((x.waarde - min) * (h - 2 * pad)) / span;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const eerste = historie[0];
  const laatste = historie[historie.length - 1];

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-14 w-full max-w-[280px] text-merk"
        role="img"
        aria-label={`Waardeontwikkeling van ${formatEuro(eerste.waarde)} naar ${formatEuro(laatste.waarde)}`}
      >
        <polyline points={punten} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="mt-1 text-xs text-gedempt">
        Van {formatEuro(eerste.waarde)} ({formatDatumNl(eerste.datum)}) naar {formatEuro(laatste.waarde)} ({formatDatumNl(laatste.datum)}).
      </p>
    </div>
  );
}

export default async function DashboardPagina({ searchParams }: { searchParams: Promise<{ fout?: string; ok?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/claim");
  const sp = await searchParams;

  const actieveClaims = db
    .select()
    .from(claims)
    .where(and(eq(claims.userId, user.id), isNull(claims.endedAt)))
    .orderBy(desc(claims.createdAt))
    .all();

  const heeftAlertsConsent = !!db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.email, user.email), eq(consents.doel, "alerts"), isNull(consents.revokedAt)))
    .get();

  const kaarten = actieveClaims
    .map((claim) => {
      const adres = db.select().from(addresses).where(eq(addresses.id, claim.adresId)).get();
      if (!adres || adres.status === "opted_out" || isAddressIdSuppressed(adres.id)) return null;
      const { valuation } = getOrCreateValuation(adres);
      const historie = valuationHistorie(adres.id).map((v) => ({ datum: v.datum, waarde: v.waarde }));
      const abonnement = db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claim.id)).get();
      const hypotheek = db.select().from(mortgageInfo).where(eq(mortgageInfo.claimId, claim.id)).get();
      const deelLinks = db
        .select({ token: sharedReports.token, createdAt: sharedReports.createdAt })
        .from(sharedReports)
        .where(and(eq(sharedReports.claimId, claim.id), isNull(sharedReports.revokedAt)))
        .orderBy(desc(sharedReports.createdAt))
        .all();
      return { claim, adres, valuation, historie, abonnement, hypotheek, deelLinks };
    })
    .filter((k): k is NonNullable<typeof k> => k !== null);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
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
        <p className="mt-6 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
          {FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw."}
        </p>
      ) : null}
      {sp.ok && OK[sp.ok] ? (
        <p className="mt-6 rounded-lg border border-positief/30 bg-positief/5 px-4 py-3 text-sm text-positief">{OK[sp.ok]}</p>
      ) : null}

      {kaarten.length === 0 ? (
        <Kaart className="mt-8">
          <SectieLabel>Nog geen woning</SectieLabel>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-inkt-zacht">
            Je hebt op dit moment geen actieve claim. Zoek je adres en klik op de woningpagina op &quot;Dit is mijn
            woning&quot; om de waarde te volgen.
          </p>
          <div className="mt-4">
            <KnopPrimair href="/">Zoek je adres</KnopPrimair>
          </div>
        </Kaart>
      ) : (
        <div className="mt-8 space-y-8">
          {kaarten.map(({ claim, adres, valuation, historie, abonnement, hypotheek, deelLinks }) => {
            const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
            const alertsActief = !!abonnement?.actief;
            const overwaarde = valuation && hypotheek ? valuation.waarde - hypotheek.restantEur : null;
            return (
              <Kaart key={claim.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{naam}</h2>
                    <p className="text-sm text-inkt-zacht">
                      {adres.postcode} {adres.plaats}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <BronLabel>zelfverklaard {claim.rol}</BronLabel>
                    <Link
                      href={`/woning/${adres.postcode}/${adres.nummerslug}`}
                      className="text-sm font-semibold text-merk underline underline-offset-4"
                    >
                      Bekijk woningpagina
                    </Link>
                  </div>
                </div>

                <div className="mt-5 border-t border-lijn pt-5">
                  <SectieLabel>Geschatte waarde</SectieLabel>
                  {valuation ? (
                    <>
                      <p className="mt-2 font-display text-4xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
                      <p className="mt-1 text-sm text-inkt-zacht">
                        Bandbreedte {formatEuro(valuation.intervalLaag)} tot {formatEuro(valuation.intervalHoog)}, op basis
                        van {valuation.nComparables} verkopen (betrouwbaarheid: {valuation.confidence}).
                      </p>
                      <Sparkline historie={historie} />
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                      Voor dit adres kunnen we nog geen eerlijke schatting maken: te weinig recente verkopen in de buurt.
                      Liever geen getal dan een verzonnen getal.
                    </p>
                  )}
                </div>

                <div className="mt-5 grid gap-5 border-t border-lijn pt-5 lg:grid-cols-2">
                  <div>
                    <SectieLabel>Waarde-alerts</SectieLabel>
                    {alertsActief ? (
                      <>
                        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                          Staan aan: je krijgt maandelijks de waardeontwikkeling per mail. Uitzetten kan altijd.
                        </p>
                        <form action={zetAlerts} className="mt-3">
                          <input type="hidden" name="claimId" value={claim.id} />
                          <input type="hidden" name="actie" value="uit" />
                          <KnopSecundair type="submit">Zet alerts uit</KnopSecundair>
                        </form>
                      </>
                    ) : (
                      <form action={zetAlerts} className="mt-2 space-y-3">
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="actie" value="aan" />
                        {heeftAlertsConsent ? (
                          <p className="text-sm leading-relaxed text-inkt-zacht">
                            Staan uit. Je toestemming voor alerts is al vastgelegd, dus aanzetten is één klik.
                          </p>
                        ) : (
                          <label className="flex items-start gap-3 text-sm text-inkt">
                            <input type="checkbox" name="consent" value="1" className="mt-0.5 accent-merk" />
                            <span>{CONSENT_TEKST_ALERTS}</span>
                          </label>
                        )}
                        <KnopSecundair type="submit">Zet alerts aan</KnopSecundair>
                      </form>
                    )}
                  </div>

                  <div>
                    <SectieLabel>Hypotheek</SectieLabel>
                    <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                      Waarom we dit vragen: zo zie je je overwaarde en of oversluiten interessant wordt. Alleen zichtbaar
                      voor jou.
                    </p>
                    {overwaarde !== null ? (
                      <p className="mt-2 text-sm">
                        Indicatie overwaarde:{" "}
                        <span className={`font-semibold ${overwaarde >= 0 ? "text-positief" : "text-negatief"}`}>
                          {formatEuro(overwaarde)}
                        </span>{" "}
                        <span className="text-xs text-gedempt">(modelwaarde min restant, geen taxatie)</span>
                      </p>
                    ) : null}
                    <form action={bewaarHypotheek} className="mt-3 space-y-3">
                      <input type="hidden" name="claimId" value={claim.id} />
                      <Veld label="Hypotheekrestant (euro)">
                        <input
                          name="restant"
                          inputMode="numeric"
                          required
                          placeholder="250000"
                          defaultValue={hypotheek ? String(hypotheek.restantEur) : ""}
                          className={inputClass}
                        />
                      </Veld>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Veld label="Rente (%, optioneel)">
                          <input
                            name="rente"
                            inputMode="decimal"
                            placeholder="3,4"
                            defaultValue={hypotheek?.rentePct != null ? String(hypotheek.rentePct).replace(".", ",") : ""}
                            className={inputClass}
                          />
                        </Veld>
                        <Veld label="Rentevast tot (optioneel)">
                          <input name="rentevastTot" type="date" defaultValue={hypotheek?.rentevastTot ?? ""} className={inputClass} />
                        </Veld>
                      </div>
                      <KnopSecundair type="submit">Bewaar hypotheekgegevens</KnopSecundair>
                    </form>
                  </div>
                </div>

                <div className="mt-5 border-t border-lijn pt-5">
                  <SectieLabel>Deel je rapport</SectieLabel>
                  <p className="mt-2 mb-3 text-sm leading-relaxed text-inkt-zacht">
                    Een deelbare link toont alleen gegevens die ook op de publieke woningpagina staan, niets uit je
                    dashboard. Intrekken kan altijd.
                  </p>
                  <DeelRapport claimId={claim.id} links={deelLinks} />
                </div>

                <div className="mt-5 border-t border-lijn pt-5">
                  <SectieLabel>Claim opzeggen</SectieLabel>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
                    Opzeggen stopt je alerts en trekt deelbare links in. De publieke woningpagina blijft bestaan; die
                    verwijderen regel je op de woningpagina zelf, in twee stappen.
                  </p>
                  <form action={zegClaimOp} className="mt-3">
                    <input type="hidden" name="claimId" value={claim.id} />
                    <button
                      type="submit"
                      className="text-sm font-semibold text-negatief underline underline-offset-4"
                    >
                      Zeg deze claim op
                    </button>
                  </form>
                </div>
              </Kaart>
            );
          })}
        </div>
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
