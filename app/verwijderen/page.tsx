import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { count, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, optouts } from "@/db/schema";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { normalizePostcode, nowIso, randomToken } from "@/lib/util";
import { stuurOptoutBevestiging } from "@/emails/optout";
import { IcoonRondje, inputClass, Kaart, KnopPrimair, Veld } from "@/components/ui";
import { Illustratie } from "@/components/illustraties";

export const metadata: Metadata = { title: "Woningpagina verwijderen", robots: { index: false, follow: false } };

const formSchema = z.object({
  postcode: z.string().min(6),
  nummer: z.string().min(1).max(12),
  email: z.string().email().optional().or(z.literal("")),
  reden: z.string().max(500).optional(),
  bedrijfsnaam: z.string().max(0).optional(), // honeypot: mensen laten dit leeg
});

/**
 * Misbruik-rem (naast de per-IP-limiet): suppressie is permanent, dus een
 * scriptbare massa-opt-out zou de dataset onherstelbaar leegtrekken. Zolang
 * e-mailbevestiging optioneel is, geldt een globale dagcap op nieuwe
 * aanvragen; echte eigenaren halen die nooit, scripts wel.
 */
const OPTOUT_DAGCAP = 20;

async function dagcapBereikt(): Promise<boolean> {
  const vandaag = `${new Date().toISOString().slice(0, 10)}T00:00:00`;
  const rijen = await db.select({ n: count() }).from(optouts).where(gte(optouts.aangevraagdAt, vandaag));
  return (rijen[0]?.n ?? 0) >= OPTOUT_DAGCAP;
}

async function startVerwijdering(formData: FormData) {
  "use server";
  const hdrs = await headers();
  const ip = clientIp(hdrs);
  if (rateLimited(`optout:${ip}`)) redirect("/verwijderen?fout=te-vaak");
  if (await dagcapBereikt()) redirect("/verwijderen?fout=dagcap");

  const parsed = formSchema.safeParse({
    postcode: formData.get("postcode") ?? "",
    nummer: formData.get("nummer") ?? "",
    email: formData.get("email") ?? "",
    reden: formData.get("reden") ?? "",
    bedrijfsnaam: formData.get("bedrijfsnaam") ?? "",
  });
  if (!parsed.success) redirect("/verwijderen?fout=ongeldig");

  const postcode = normalizePostcode(parsed.data.postcode);
  if (!postcode) redirect("/verwijderen?fout=postcode");
  const nummerslug = parsed.data.nummer.toLowerCase().replace(/\s+/g, "");

  const adres = (
    await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
      .limit(1)
  )[0];
  if (!adres) redirect("/verwijderen?fout=onbekend");

  const bestaand = (
    await db
      .select()
      .from(optouts)
      .where(and(eq(optouts.postcode, postcode), eq(optouts.nummerslug, nummerslug)))
      .limit(1)
  )[0];

  const email = parsed.data.email || null;
  let token: string;
  if (bestaand) {
    if (bestaand.bevestigdAt) redirect("/verwijderen/klaar");
    token = bestaand.token;
    if (email) await db.update(optouts).set({ email }).where(eq(optouts.id, bestaand.id));
  } else {
    token = randomToken(24);
    await db.insert(optouts).values({
      adresId: adres.id,
      postcode,
      nummerslug,
      email,
      reden: parsed.data.reden || null,
      token,
      aangevraagdAt: nowIso(),
    });
  }

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`;
  if (email) {
    await stuurOptoutBevestiging(email, naam, token);
    redirect("/verwijderen?stap=mail");
  }
  // Zonder e-mail: stap 2 is een expliciete bevestigingsklik op de tokenpagina.
  redirect(`/verwijderen/${token}?bevestig=0`);
}

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw.",
  dagcap:
    "Er zijn vandaag ongebruikelijk veel verwijderverzoeken gedaan. Om misbruik te voorkomen kan het nu even niet; probeer het morgen opnieuw of mail ons via de privacyverklaring.",
  ongeldig: "Controleer je invoer en probeer het opnieuw.",
  postcode: "Die postcode herkennen we niet. Gebruik het formaat 1234 AB.",
  onbekend: "Dit adres staat niet (meer) op Wonea. Dan valt er ook niets te verwijderen.",
};

export default async function VerwijderenPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string; fout?: string; stap?: string }>;
}) {
  const sp = await searchParams;

  if (sp.stap === "mail") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <IcoonRondje naam="vinkje" tint="merk" maat="l" />
            <h1 className="mt-5 text-3xl font-semibold">Check je mail</h1>
            <p className="mt-4 leading-relaxed text-inkt-zacht">
              We hebben je een bevestigingslink gestuurd. Eén klik daarop en de woningpagina is verwijderd. Zonder die klik
              verandert er niets, zo weten we zeker dat het verzoek van jou komt.
            </p>
          </div>
          <Illustratie naam="jouw-data" className="hidden w-44 shrink-0 sm:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      {/* Bewust sober (trust-flow); het ene familie-accent is dit merk-rondje,
          zelfde patroon als de "Check je mail"-stap hierboven. */}
      <IcoonRondje naam="schild" tint="merk" maat="l" />
      <h1 className="mt-5 text-3xl font-semibold">Je woningpagina verwijderen</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Jouw huis, jouw keuze. Verwijderen gaat in twee stappen: je vraagt het hier aan en bevestigt daarna. Na bevestiging
        verdwijnt het adres overal op Wonea (pagina, rapporten, alerts) en komt het ook bij nieuwe data-imports niet terug.
      </p>
      {sp.fout ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-lg border border-negatief/30 bg-negatief-wash px-4 py-3 text-sm text-negatief">
          <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-negatief" />
          {FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw."}
        </p>
      ) : null}
      <Kaart className="mt-8">
        <form action={startVerwijdering} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Veld label="Postcode">
              <input name="postcode" defaultValue={sp.postcode ?? ""} placeholder="1234 AB" required className={inputClass} />
            </Veld>
            <Veld label="Huisnummer" hint="Met toevoeging, bv. 12a of 12-2">
              <input name="nummer" defaultValue={sp.nummer ?? ""} placeholder="12" required className={inputClass} />
            </Veld>
          </div>
          <Veld label="E-mailadres (aanbevolen)" hint="Voor de bevestigingslink en ons antwoord. Zonder e-mail kan het ook: dan bevestig je direct op de volgende pagina.">
            <input name="email" type="email" placeholder="jij@voorbeeld.nl" className={inputClass} />
          </Veld>
          <Veld label="Reden (optioneel)" hint="Helpt ons, maar je hoeft niets uit te leggen.">
            <textarea name="reden" rows={2} className={inputClass} />
          </Veld>
          <input type="text" name="bedrijfsnaam" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <KnopPrimair type="submit">Verwijdering aanvragen</KnopPrimair>
        </form>
      </Kaart>
    </div>
  );
}
