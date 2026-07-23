import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, claims } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro } from "@/lib/util";
import { BronLabel, Kaart, KnopPrimair, KnopSecundair, SectieLabel } from "@/components/ui";
import { uitloggen } from "@/app/dashboard/actions";

/**
 * Mijn woningen: het overzicht van geclaimde woningen. Elke woning heeft een
 * eigen dossier (/dashboard/woning/[claimId]) met vijf secties: overzicht,
 * WOZ, energie, hypotheek en rapporten. Accountpagina: altijd noindex.
 */

export const metadata: Metadata = { title: "Mijn woningen", robots: { index: false, follow: false } };

const FOUTEN: Record<string, string> = {
  claim: "Deze claim bestaat niet (meer) of hoort niet bij jouw account.",
  ongeldig: "Er ging iets mis met dat verzoek. Probeer het opnieuw.",
};

const OK: Record<string, string> = {
  opgezegd: "Claim opgezegd. Alerts zijn gestopt en deelbare links ingetrokken.",
};

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
        const { valuation } = await getOrCreateValuation(adres);
        return { claim, adres, valuation };
      }),
    )
  ).filter((k): k is NonNullable<typeof k> => k !== null);

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
        <p className="mt-6 rounded-lg border border-negatief/30 bg-negatief-wash px-4 py-3 text-sm text-negatief">
          {FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw."}
        </p>
      ) : null}
      {sp.ok && OK[sp.ok] ? (
        <p className="mt-6 rounded-lg border border-positief/30 bg-positief-wash px-4 py-3 text-sm text-positief">{OK[sp.ok]}</p>
      ) : null}

      {kaarten.length === 0 ? (
        <Kaart className="mt-8">
          <SectieLabel>Nog geen woning</SectieLabel>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-inkt-zacht">
            Je hebt op dit moment geen actieve claim. Zoek je adres en klik op de woningpagina op &quot;Dit is mijn
            woning&quot; om de waarde te volgen en je dossier op te bouwen.
          </p>
          <div className="mt-4">
            <KnopPrimair href="/">Zoek je adres</KnopPrimair>
          </div>
        </Kaart>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {kaarten.map(({ claim, adres, valuation }) => {
            const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
            return (
              <Kaart key={claim.id} className="flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{naam}</h2>
                    <p className="text-sm text-inkt-zacht">
                      {adres.postcode} {adres.plaats}
                    </p>
                  </div>
                  <BronLabel>zelfverklaard {claim.rol}</BronLabel>
                </div>

                <div className="mt-4 flex-1 border-t border-lijn pt-4">
                  <SectieLabel>Geschatte waarde</SectieLabel>
                  {valuation ? (
                    <>
                      <p className="mt-2 font-display text-3xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
                      <p className="mt-1 text-sm text-inkt-zacht">
                        Bandbreedte {formatEuro(valuation.intervalLaag)} tot {formatEuro(valuation.intervalHoog)}, op basis
                        van {valuation.nComparables} verkopen (betrouwbaarheid: {valuation.confidence}).
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                      Nog geen eerlijke schatting mogelijk: te weinig recente verkopen in de buurt. Liever geen getal dan
                      een verzonnen getal.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <KnopPrimair href={`/dashboard/woning/${claim.id}`}>Open het dossier</KnopPrimair>
                  <Link
                    href={`/woning/${adres.postcode}/${adres.nummerslug}`}
                    className="text-sm font-semibold text-merk underline underline-offset-4"
                  >
                    Publieke woningpagina
                  </Link>
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
