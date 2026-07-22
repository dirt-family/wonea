import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { addresses, optouts } from "@/db/schema";
import { applyOptoutCascade } from "@/lib/suppression";
import { nowIso } from "@/lib/util";
import { stuurOptoutAfgerond } from "@/emails/optout";
import { Kaart, KnopPrimair } from "@/components/ui";

export const metadata: Metadata = { title: "Verwijdering bevestigen" };

async function bevestig(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const optout = db.select().from(optouts).where(eq(optouts.token, token)).get();
  if (!optout) redirect("/verwijderen?fout=onbekend");
  if (!optout.bevestigdAt) {
    db.update(optouts).set({ bevestigdAt: nowIso() }).where(eq(optouts.id, optout.id)).run();
    applyOptoutCascade(optout.adresId);
    const adres = db.select().from(addresses).where(eq(addresses.id, optout.adresId)).get();
    if (optout.email && adres) {
      stuurOptoutAfgerond(optout.email, `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`);
    }
    revalidatePath(`/woning/${optout.postcode}/${optout.nummerslug}`);
  }
  redirect("/verwijderen/klaar");
}

export default async function BevestigPagina({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === "klaar") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Verwijderd</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          De woningpagina is weg: de pagina zelf, gedeelde rapporten en waarde-alerts voor dit adres. Het adres staat nu op
          onze verwijderlijst en komt ook bij nieuwe data-imports niet terug.
        </p>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Bedenk je je later? Mail ons via het adres in de <Link href="/privacy" className="font-semibold text-merk underline underline-offset-4">privacyverklaring</Link>, dan zetten we de pagina terug.
        </p>
      </div>
    );
  }

  const optout = db.select().from(optouts).where(eq(optouts.token, token)).get();
  if (!optout) notFound();

  const adres = db.select().from(addresses).where(eq(addresses.id, optout.adresId)).get();
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
