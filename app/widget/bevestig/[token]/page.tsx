import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, widgetCaptures } from "@/db/schema";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { nowIso } from "@/lib/util";
import { Kaart } from "@/components/ui";

/**
 * Stap 2 van de double opt-in: de klik op de link in de bevestigingsmail.
 * Opent in een gewone browsertab (niet in het widget-iframe), dus met de
 * normale site-chrome. Zet bevestigdAt; al bevestigd krijgt ook een nette
 * melding. Verlopen of gepurgede tokens: eerlijke uitleg, geen harde 404.
 */

export const metadata: Metadata = { title: "Aanmelding bevestigen", robots: { index: false, follow: false } };

export default async function WidgetBevestigPagina({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const capture = (await db.select().from(widgetCaptures).where(eq(widgetCaptures.bevestigToken, token)).limit(1))[0];

  if (!capture) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Deze link is niet (meer) geldig</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Onbevestigde aanmeldingen verwijderen we na 30 dagen automatisch. Wil je alsnog waarde-updates ontvangen? Meld je
          dan opnieuw aan via de widget of claim je woning op Wonea.
        </p>
        <p className="mt-4">
          <Link href="/" className="font-semibold text-merk underline underline-offset-4">Naar Wonea</Link>
        </p>
      </div>
    );
  }

  const alBevestigd = !!capture.bevestigdAt;
  if (!alBevestigd) {
    await db.update(widgetCaptures).set({ bevestigdAt: nowIso() }).where(eq(widgetCaptures.id, capture.id));
  }

  // Link naar de woningpagina alleen als het adres bekend en nog toonbaar is.
  let woning: { href: string; naam: string } | null = null;
  if (capture.adresId) {
    const adres = (await db.select().from(addresses).where(eq(addresses.id, capture.adresId)).limit(1))[0];
    if (adres && adres.status === "actief" && !(await isAddressIdSuppressed(adres.id))) {
      woning = {
        href: `/woning/${adres.postcode}/${adres.nummerslug}`,
        naam: `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`,
      };
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">{alBevestigd ? "Je aanmelding stond al" : "Aanmelding bevestigd"}</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        {alBevestigd
          ? "Deze aanmelding was al bevestigd; je hoeft niets meer te doen."
          : "Dank je. Vanaf nu houden we je per mail op de hoogte van de waardeontwikkeling."}{" "}
        Afmelden kan altijd via de link onderin elke mail.
      </p>
      {woning ? (
        <Kaart className="mt-8">
          <p className="text-sm text-gedempt">Je volgt de waarde van</p>
          <p className="mt-1 font-display text-xl font-semibold text-merk">{woning.naam}</p>
          <Link href={woning.href} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
            Bekijk de woningpagina
          </Link>
        </Kaart>
      ) : null}
    </div>
  );
}
