import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims, consents, mortgageInfo, sharedReports } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { getOrCreateValuation, valuationHistorie } from "@/lib/valuation";
import { BronLabel } from "@/components/ui";
import { DossierNav } from "@/components/dossier/nav";
import { OverzichtSectie } from "@/components/dossier/overzicht";
import { WozSectie } from "@/components/dossier/woz";
import { EnergieSectie } from "@/components/dossier/energie";
import { HypotheekSectie } from "@/components/dossier/hypotheek";
import { RapportenSectie } from "@/components/dossier/rapporten";
import { marktschattingPerJaar } from "@/components/dossier/data";
import { wozDossierVoorAdres } from "@/components/dossier/woz-data";

/**
 * Het woningdossier: één plek per geclaimde woning met vijf rustige secties
 * (overzicht, WOZ, energie, hypotheek, rapporten en alerts), bereikbaar via
 * een ankernavigatie in de linkerkolom. Accountpagina: altijd noindex.
 */

export const metadata: Metadata = { title: "Woningdossier", robots: { index: false, follow: false } };

const FOUTEN: Record<string, string> = {
  "alerts-consent": "Zonder vinkje geen alerts: zet eerst het vinkje aan, dan leggen we je toestemming vast.",
  hypotheek: "Controleer je hypotheekgegevens: restant in hele euro's, rente als percentage, datum als jjjj-mm-dd.",
  "woz-peiljaar": "Dat peiljaar kunnen we niet plaatsen. Kies het jaar dat op je WOZ-beschikking staat.",
  "woz-waarde": "Controleer de WOZ-waarde: hele euro's, zoals op je beschikking.",
};

const OK: Record<string, string> = {
  "alerts-aan": "Waarde-alerts staan aan. Je krijgt maandelijks de waardeontwikkeling per mail.",
  "alerts-uit": "Waarde-alerts staan uit. Je toestemming blijft bewaard; weer aanzetten kan met één klik.",
  hypotheek: "Hypotheekgegevens opgeslagen. Alleen jij ziet ze.",
  "woz-toegevoegd": "WOZ-waarde vastgelegd in je dossier.",
  "woz-bijgewerkt": "WOZ-waarde voor dat peiljaar bijgewerkt.",
};

export default async function WoningDossierPagina({
  params,
  searchParams,
}: {
  params: Promise<{ claimId: string }>;
  searchParams: Promise<{ fout?: string; ok?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/claim");

  const { claimId: claimIdRuw } = await params;
  const claimId = Number(claimIdRuw);
  if (!Number.isInteger(claimId) || claimId <= 0) redirect("/dashboard?fout=claim");

  const claim = (
    await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, claimId), eq(claims.userId, user.id), isNull(claims.endedAt)))
      .limit(1)
  )[0];
  if (!claim) redirect("/dashboard?fout=claim");

  const adres = (await db.select().from(addresses).where(eq(addresses.id, claim.adresId)).limit(1))[0];
  if (!adres || adres.status === "opted_out" || (await isAddressIdSuppressed(adres.id))) {
    redirect("/dashboard?fout=claim");
  }

  const sp = await searchParams;
  const { valuation, comparables, buurt } = await getOrCreateValuation(adres);
  const historie = await valuationHistorie(adres.id);
  const wozRijen = await wozDossierVoorAdres(adres.id);
  const hypotheek = (await db.select().from(mortgageInfo).where(eq(mortgageInfo.claimId, claim.id)).limit(1))[0] ?? null;
  const abonnement = (
    await db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claim.id)).limit(1)
  )[0];
  const deelLinks = await db
    .select({ token: sharedReports.token, createdAt: sharedReports.createdAt })
    .from(sharedReports)
    .where(and(eq(sharedReports.claimId, claim.id), isNull(sharedReports.revokedAt)))
    .orderBy(desc(sharedReports.createdAt));
  const heeftAlertsConsent = !!(
    await db
      .select({ id: consents.id })
      .from(consents)
      .where(and(eq(consents.email, user.email), eq(consents.doel, "alerts"), isNull(consents.revokedAt)))
      .limit(1)
  )[0];

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  const adresQuery = `postcode=${adres.postcode}&nummer=${adres.nummerslug}`;
  const jaarSchattingen = marktschattingPerJaar(historie);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/dashboard" className="hover:text-merk">
          Mijn woningen
        </Link>{" "}
        / {naam}
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{naam}</h1>
          <p className="mt-1 text-sm text-inkt-zacht">
            {adres.postcode} {adres.plaats}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BronLabel>zelfverklaard {claim.rol}</BronLabel>
          <Link
            href={`/woning/${adres.postcode}/${adres.nummerslug}`}
            className="text-sm font-semibold text-merk underline underline-offset-4"
          >
            Bekijk de publieke woningpagina
          </Link>
        </div>
      </div>

      {sp.fout && FOUTEN[sp.fout] ? (
        <p className="mt-6 rounded-lg border border-negatief/30 bg-negatief-wash px-4 py-3 text-sm text-negatief">
          {FOUTEN[sp.fout]}
        </p>
      ) : null}
      {sp.ok && OK[sp.ok] ? (
        <p className="mt-6 rounded-lg border border-positief/30 bg-positief-wash px-4 py-3 text-sm text-positief">{OK[sp.ok]}</p>
      ) : null}

      <div className="mt-8 gap-10 lg:grid lg:grid-cols-[200px_1fr] lg:items-start">
        <DossierNav terugHref="/dashboard" />
        <div className="mt-6 space-y-14 lg:mt-0">
          <OverzichtSectie
            adres={adres}
            valuation={valuation}
            niveau={comparables.niveau}
            historie={historie.map((v) => ({ datum: v.datum, waarde: v.waarde }))}
            buurtNaam={buurt?.naam ?? null}
          />
          <WozSectie claimId={claim.id} adresQuery={adresQuery} wozRijen={wozRijen} jaarSchattingen={jaarSchattingen} />
          <EnergieSectie adres={adres} adresQuery={adresQuery} />
          <HypotheekSectie claimId={claim.id} hypotheek={hypotheek} valuation={valuation} adresQuery={adresQuery} />
          <RapportenSectie
            claimId={claim.id}
            alertsActief={!!abonnement?.actief}
            heeftAlertsConsent={heeftAlertsConsent}
            deelLinks={deelLinks}
            adresQuery={adresQuery}
          />
        </div>
      </div>
    </div>
  );
}
