import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses, optouts } from "@/db/schema";
import { rateLimited } from "@/lib/ratelimit";
import { normalizePostcode, nowIso, randomToken } from "@/lib/util";
import { stuurOptoutBevestiging } from "@/emails/optout";
import { inputClass, Kaart, KnopPrimair, Veld } from "@/components/ui";

export const metadata: Metadata = { title: "Woningpagina verwijderen", robots: { index: false, follow: false } };

const formSchema = z.object({
  postcode: z.string().min(6),
  nummer: z.string().min(1).max(12),
  email: z.string().email().optional().or(z.literal("")),
  reden: z.string().max(500).optional(),
  bedrijfsnaam: z.string().max(0).optional(), // honeypot: mensen laten dit leeg
});

async function startVerwijdering(formData: FormData) {
  "use server";
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "lokaal";
  if (rateLimited(`optout:${ip}`)) redirect("/verwijderen?fout=te-vaak");

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

  const adres = db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
    .get();
  if (!adres) redirect("/verwijderen?fout=onbekend");

  const bestaand = db
    .select()
    .from(optouts)
    .where(and(eq(optouts.postcode, postcode), eq(optouts.nummerslug, nummerslug)))
    .get();

  const email = parsed.data.email || null;
  let token: string;
  if (bestaand) {
    if (bestaand.bevestigdAt) redirect("/verwijderen/klaar");
    token = bestaand.token;
    if (email) db.update(optouts).set({ email }).where(eq(optouts.id, bestaand.id)).run();
  } else {
    token = randomToken(24);
    db.insert(optouts)
      .values({
        adresId: adres.id,
        postcode,
        nummerslug,
        email,
        reden: parsed.data.reden || null,
        token,
        aangevraagdAt: nowIso(),
      })
      .run();
  }

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`;
  if (email) {
    stuurOptoutBevestiging(email, naam, token);
    redirect("/verwijderen?stap=mail");
  }
  // Zonder e-mail: stap 2 is een expliciete bevestigingsklik op de tokenpagina.
  redirect(`/verwijderen/${token}?bevestig=0`);
}

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw.",
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
        <h1 className="text-3xl font-semibold">Check je mail</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          We hebben je een bevestigingslink gestuurd. Eén klik daarop en de woningpagina is verwijderd. Zonder die klik
          verandert er niets, zo weten we zeker dat het verzoek van jou komt.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Je woningpagina verwijderen</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Jouw huis, jouw keuze. Verwijderen gaat in twee stappen: je vraagt het hier aan en bevestigt daarna. Na bevestiging
        verdwijnt het adres overal op Wonea (pagina, rapporten, alerts) en komt het ook bij nieuwe data-imports niet terug.
      </p>
      {sp.fout ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
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
