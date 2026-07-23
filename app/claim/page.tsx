import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { createMagicToken, magicLinkRateLimited } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { isSuppressed } from "@/lib/suppression";
import { baseUrl, normalizePostcode } from "@/lib/util";
import { stuurMagicLink } from "@/emails/magic-link";
import { inputClass, Kaart, KnopPrimair, SectieLabel, Veld } from "@/components/ui";
import { CONSENT_TEKST_ALERTS, CONSENT_TEKST_MARKETING } from "@/app/claim/consent-teksten";

export const metadata: Metadata = { title: "Claim je woning", robots: { index: false, follow: false } };

const formSchema = z.object({
  postcode: z.string().min(6).max(7),
  nummer: z.string().min(1).max(12),
  email: z.string().email().max(200),
  rol: z.enum(["eigenaar", "bewoner"]),
  alerts: z.literal("1").optional(),
  marketing: z.literal("1").optional(),
  bedrijfsnaam: z.string().max(0).optional(), // honeypot: mensen laten dit leeg
});

async function vindClaimbaarAdres(postcodeInput: string, nummerInput: string) {
  const postcode = normalizePostcode(postcodeInput);
  if (!postcode) return null;
  const slug = nummerInput.toLowerCase().replace(/\s+/g, "");
  const adres = (
    await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, slug)))
      .limit(1)
  )[0];
  if (!adres) return null;
  if (adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug))) return null;
  return adres;
}

async function startClaim(formData: FormData) {
  "use server";
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "lokaal";

  const parsed = formSchema.safeParse({
    postcode: formData.get("postcode") ?? "",
    nummer: formData.get("nummer") ?? "",
    email: formData.get("email") ?? "",
    rol: formData.get("rol") ?? "",
    alerts: formData.get("alerts") ?? undefined,
    marketing: formData.get("marketing") ?? undefined,
    bedrijfsnaam: formData.get("bedrijfsnaam") ?? "",
  });
  if (!parsed.success) redirect("/claim?fout=ongeldig");

  const postcode = normalizePostcode(parsed.data.postcode);
  if (!postcode) redirect("/claim?fout=postcode");
  const nummerslug = parsed.data.nummer.toLowerCase().replace(/\s+/g, "");
  const terug = `postcode=${postcode}&nummer=${encodeURIComponent(nummerslug)}`;

  if (rateLimited(`claim:${ip}`)) redirect(`/claim?fout=te-vaak&${terug}`);
  const email = parsed.data.email.toLowerCase().trim();
  if (magicLinkRateLimited(email)) redirect(`/claim?fout=te-vaak&${terug}`);

  const adres = await vindClaimbaarAdres(postcode, nummerslug);
  if (!adres) redirect("/claim?fout=onbekend");

  const token = await createMagicToken(email);
  const verzilverUrl =
    `${baseUrl()}/claim/verzilver?` +
    new URLSearchParams({
      token,
      postcode,
      nummer: nummerslug,
      rol: parsed.data.rol,
      alerts: parsed.data.alerts ? "1" : "0",
      marketing: parsed.data.marketing ? "1" : "0",
    }).toString();

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`;
  await stuurMagicLink({
    to: email,
    adresNaam: naam,
    rol: parsed.data.rol,
    alerts: parsed.data.alerts === "1",
    marketing: parsed.data.marketing === "1",
    verzilverUrl,
  });

  redirect("/claim?stap=mail");
}

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een paar minuten opnieuw.",
  ongeldig: "Controleer je invoer en probeer het opnieuw.",
  postcode: "Die postcode herkennen we niet. Gebruik het formaat 1234 AB.",
  onbekend: "Dit adres staat niet (meer) op Wonea en kan daarom niet geclaimd worden.",
};

export default async function ClaimPagina({
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
          We hebben je een bevestigingslink gestuurd. Die is 15 minuten geldig en werkt één keer. Klik erop en je woning
          staat in je dashboard. Geen mail? Kijk even in je spamfolder.
        </p>
        <p className="mt-4 text-sm text-gedempt">
          Zonder die klik gebeurt er niets: geen claim, geen mails.
        </p>
      </div>
    );
  }

  const heeftParams = Boolean(sp.postcode && sp.nummer);
  const adres = heeftParams ? await vindClaimbaarAdres(sp.postcode!, sp.nummer!) : null;
  const foutmelding = sp.fout ? (FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw.") : heeftParams && !adres ? FOUTEN.onbekend : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Claim je woning</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Claim je woning en volg de waarde vanuit je eigen dashboard. Gratis, en opzeggen kan altijd met één klik.
      </p>

      {foutmelding ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{foutmelding}</p>
      ) : null}

      {!adres ? (
        <Kaart className="mt-8">
          <SectieLabel>Eerst je adres</SectieLabel>
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            Zoek eerst je adres op de homepage en klik op de woningpagina op de knop &quot;Dit is mijn woning&quot;. Dan
            staat je adres hier klaar.
          </p>
          <KnopPrimair href="/">Zoek je adres</KnopPrimair>
        </Kaart>
      ) : (
        <>
          <Kaart className="mt-8 bg-merk-wash">
            <SectieLabel>Je claimt</SectieLabel>
            <p className="mt-2 text-lg font-semibold text-inkt">
              {adres.straat} {adres.huisnummer}
              {adres.toevoeging ? ` ${adres.toevoeging}` : ""}
            </p>
            <p className="text-sm text-inkt-zacht">
              {adres.postcode} {adres.plaats}
            </p>
            <Link
              href={`/woning/${adres.postcode}/${adres.nummerslug}`}
              className="mt-2 inline-block text-sm font-semibold text-merk underline underline-offset-4"
            >
              Bekijk de woningpagina
            </Link>
          </Kaart>

          <Kaart className="mt-5">
            <form action={startClaim} className="space-y-5">
              <input type="hidden" name="postcode" value={adres.postcode} />
              <input type="hidden" name="nummer" value={adres.nummerslug} />

              <Veld label="E-mailadres" hint="We sturen je een bevestigingslink; pas na jouw klik is de claim actief.">
                <input name="email" type="email" required placeholder="jij@voorbeeld.nl" className={inputClass} />
              </Veld>

              <fieldset>
                <legend className="mb-1 block text-sm font-medium text-inkt">Wat is je relatie tot deze woning?</legend>
                <div className="flex gap-6 text-sm text-inkt">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="rol" value="eigenaar" required className="accent-merk" />
                    Eigenaar
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="rol" value="bewoner" required className="accent-merk" />
                    Bewoner
                  </label>
                </div>
                <p className="mt-2 text-xs text-gedempt">
                  Eerlijk is eerlijk: een claim is een zelfverklaring. We controleren geen eigendom; je invoer wordt zo
                  gelabeld.
                </p>
              </fieldset>

              <div className="space-y-3 border-t border-lijn pt-5">
                <label className="flex items-start gap-3 text-sm text-inkt">
                  <input type="checkbox" name="alerts" value="1" className="mt-0.5 accent-merk" />
                  <span>{CONSENT_TEKST_ALERTS}</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-inkt">
                  <input type="checkbox" name="marketing" value="1" className="mt-0.5 accent-merk" />
                  <span>{CONSENT_TEKST_MARKETING}</span>
                </label>
              </div>

              <input type="text" name="bedrijfsnaam" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

              <KnopPrimair type="submit">Stuur mij de bevestigingslink</KnopPrimair>
              <p className="text-xs leading-relaxed text-gedempt">
                We gebruiken je e-mailadres alleen waarvoor je hier tekent. Zie ons{" "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-merk">
                  privacybeleid
                </Link>
                .
              </p>
            </form>
          </Kaart>
        </>
      )}
    </div>
  );
}
