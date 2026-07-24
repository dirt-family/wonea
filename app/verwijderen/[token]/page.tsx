import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq, gte, isNotNull } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { addresses, municipalities, neighborhoods, optouts } from "@/db/schema";
import { applyOptoutCascade } from "@/lib/suppression";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { nowIso } from "@/lib/util";
import { stuurOptoutAfgerond } from "@/emails/optout";
import { IcoonRondje, Kaart, KnopPrimair } from "@/components/ui";
import { Illustratie } from "@/components/illustraties";

export const metadata: Metadata = { title: "Verwijdering bevestigen", robots: { index: false, follow: false } };

/**
 * Misbruik-rem op de bevestiging zelf (suppressie is permanent): naast de
 * per-IP-limiet een globale dagcap op BEVESTIGDE verwijderingen. Echte
 * eigenaren halen die nooit; een script dat de dataset wil leegtrekken wel.
 */
const BEVESTIG_DAGCAP = 20;

async function bevestigDagcapBereikt(): Promise<boolean> {
  const vandaag = `${new Date().toISOString().slice(0, 10)}T00:00:00`;
  const rijen = await db
    .select({ n: count() })
    .from(optouts)
    .where(gte(optouts.bevestigdAt, vandaag));
  return (rijen[0]?.n ?? 0) >= BEVESTIG_DAGCAP;
}

async function bevestig(formData: FormData) {
  "use server";
  const hdrs = await headers();
  if (rateLimited(`optout-bevestig:${clientIp(hdrs)}`, 3)) redirect("/verwijderen?fout=te-vaak");

  const token = String(formData.get("token") ?? "");
  const optout = (await db.select().from(optouts).where(eq(optouts.token, token)).limit(1))[0];
  if (!optout) redirect("/verwijderen?fout=onbekend");
  if (!optout.bevestigdAt) {
    if (await bevestigDagcapBereikt()) redirect("/verwijderen?fout=dagcap");
    await db.update(optouts).set({ bevestigdAt: nowIso() }).where(eq(optouts.id, optout.id));
    await applyOptoutCascade(optout.adresId);
    const adres = (await db.select().from(addresses).where(eq(addresses.id, optout.adresId)).limit(1))[0];
    if (optout.email && adres) {
      await stuurOptoutAfgerond(optout.email, `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`);
    }

    // AVG/merkbelofte: alle ISR-pagina's die dit adres kunnen tonen meteen
    // verversen, niet alleen de woningpagina (anders blijft het adres tot een
    // dag zichtbaar op buurt- en woningmarktpagina's).
    revalidatePath(`/woning/${optout.postcode}/${optout.nummerslug}`);
    revalidatePath("/woningmarkt");
    revalidateTag("homepage");
    const plek = (
      await db
        .select({ gemeenteSlug: municipalities.slug, buurtSlug: neighborhoods.slug })
        .from(addresses)
        .innerJoin(neighborhoods, eq(addresses.buurtCode, neighborhoods.buurtCode))
        .innerJoin(municipalities, eq(neighborhoods.gemeenteCode, municipalities.code))
        .where(eq(addresses.id, optout.adresId))
        .limit(1)
    )[0];
    if (plek) {
      revalidatePath(`/woningmarkt/${plek.gemeenteSlug}`);
      revalidatePath(`/buurt/${plek.gemeenteSlug}/${plek.buurtSlug}`);
    }
  }
  redirect("/verwijderen/klaar");
}

export default async function BevestigPagina({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === "klaar") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <IcoonRondje naam="schild" tint="merk" maat="l" />
            <h1 className="mt-5 text-3xl font-semibold">Verwijderd</h1>
            <p className="mt-4 leading-relaxed text-inkt-zacht">
              De woningpagina is weg: de pagina zelf, gedeelde rapporten en waarde-alerts voor dit adres. Het adres staat nu op
              onze verwijderlijst en komt ook bij nieuwe data-imports niet terug.
            </p>
            <p className="mt-4 leading-relaxed text-inkt-zacht">
              Bedenk je je later? Mail ons via het adres in de <Link href="/privacy" className="font-semibold text-merk underline underline-offset-4">privacyverklaring</Link>, dan zetten we de pagina terug.
            </p>
          </div>
          <Illustratie naam="jouw-data" className="hidden w-44 shrink-0 sm:block" />
        </div>
      </div>
    );
  }

  const optout = (await db.select().from(optouts).where(eq(optouts.token, token)).limit(1))[0];
  if (!optout) notFound();

  const adres = (await db.select().from(addresses).where(eq(addresses.id, optout.adresId)).limit(1))[0];
  const naam = adres ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}` : "dit adres";

  if (optout.bevestigdAt) redirect("/verwijderen/klaar");

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Bevestig de verwijdering</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Dit is stap twee van twee. Na je bevestiging verdwijnt <strong>{naam}</strong> overal op Wonea en blijft het adres op
        onze verwijderlijst staan, ook bij nieuwe data-imports.
      </p>
      <Kaart className="mt-8">
        <form action={bevestig}>
          <input type="hidden" name="token" value={optout.token} />
          <KnopPrimair type="submit">Ja, verwijder deze woningpagina</KnopPrimair>
        </form>
        <p className="mt-4 text-sm text-gedempt">Toch niet? Sluit deze pagina; zonder bevestiging verandert er niets.</p>
      </Kaart>
    </div>
  );
}
