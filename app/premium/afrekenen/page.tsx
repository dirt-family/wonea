import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createMagicToken, currentUser, magicLinkRateLimited } from "@/lib/auth";
import { hasEntitlement } from "@/lib/premium";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { baseUrl, formatEuro } from "@/lib/util";
import { inputClass, Kaart, KnopPrimair, KnopSecundair, SectieLabel, Veld } from "@/components/ui";
import { checkoutQuery, koopPremium, veiligeVanUrl } from "@/app/premium/logic";
import { parseProduct, PRODUCTEN } from "@/app/premium/producten";
import { stuurPremiumLoginMail } from "@/app/premium/login-mail";

export const metadata: Metadata = { title: "Afrekenen", robots: { index: false, follow: false } };

/**
 * Gemockte checkout (Fase 4.5). Sessie vereist: de aankoop hangt aan een
 * account, anders is de verdieping na een browserwissel kwijt.
 *
 * KEUZE inlogroute: een eigen mini magic-link-stap op deze pagina, met
 * hergebruik van lib/auth (createMagicToken/consumeMagicToken/createSession)
 * en verzilvering op /premium/verzilver. NIET doorsturen naar /claim: die
 * flow eist een woningclaim (zelfverklaring over een adres) en eindigt in
 * /dashboard. Een koper hoeft geen woning te claimen om iets te kopen, en
 * een gedwongen omweg zou tegen de geen-dark-patterns-regel schuren.
 * Dit is de eenvoudigste nette route: 1 e-mailveld, 1 klik in de mail.
 */

const loginSchema = z.object({
  email: z.string().email().max(200),
  bedrijfsnaam: z.string().max(0).optional(), // honeypot: mensen laten dit leeg
});

async function stuurLoginLink(formData: FormData) {
  "use server";
  const product = parseProduct(String(formData.get("product") ?? ""));
  if (!product) redirect("/premium");
  const van = veiligeVanUrl(String(formData.get("van") ?? ""));
  const q = checkoutQuery(product, van);

  const parsed = loginSchema.safeParse({
    email: formData.get("email") ?? "",
    bedrijfsnaam: formData.get("bedrijfsnaam") ?? "",
  });
  if (!parsed.success) redirect(`/premium/afrekenen?${q}&fout=ongeldig`);

  const hdrs = await headers();
  const ip = clientIp(hdrs);
  if (rateLimited(`premium-login:${ip}`)) redirect(`/premium/afrekenen?${q}&fout=te-vaak`);
  const email = parsed.data.email.toLowerCase().trim();
  if (magicLinkRateLimited(email)) redirect(`/premium/afrekenen?${q}&fout=te-vaak`);

  const token = await createMagicToken(email);
  const verzilverParams = new URLSearchParams({ token, product });
  if (van) verzilverParams.set("van", van);
  const info = PRODUCTEN[product];
  await stuurPremiumLoginMail({
    to: email,
    productNaam: info.naam,
    prijs: info.prijs,
    verzilverUrl: `${baseUrl()}/premium/verzilver?${verzilverParams.toString()}`,
  });

  redirect(`/premium/afrekenen?${q}&stap=mail`);
}

async function rekenAf(formData: FormData) {
  "use server";
  const product = parseProduct(String(formData.get("product") ?? ""));
  if (!product) redirect("/premium");
  const van = veiligeVanUrl(String(formData.get("van") ?? ""));
  const q = checkoutQuery(product, van);

  const user = await currentUser();
  if (!user) redirect(`/premium/afrekenen?${q}`);

  const hdrs = await headers();
  const ip = clientIp(hdrs);
  if (rateLimited(`premium-koop:${ip}`, 10)) redirect(`/premium/afrekenen?${q}&fout=te-vaak`);

  const resultaat = await koopPremium(user.id, product);
  // Al gekocht (bv. dubbelklik of tweede tabblad): melden, niet dubbel aanmaken.
  if (resultaat.status === "al_gekocht") redirect(`/premium/klaar?${q}&al=1`);
  redirect(van ?? `/premium/klaar?${q}`);
}

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een paar minuten opnieuw.",
  ongeldig: "Controleer je e-mailadres en probeer het opnieuw.",
};

export default async function AfrekenenPagina({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; van?: string; stap?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  const product = parseProduct(sp.product);
  if (!product) redirect("/premium");
  const info = PRODUCTEN[product];
  const van = veiligeVanUrl(sp.van);
  const q = checkoutQuery(product, van);

  if (sp.stap === "mail") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Check je mail</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          We hebben je een inloglink gestuurd. Die is 15 minuten geldig en werkt één keer. Klik erop en je komt terug op
          deze afrekenpagina, ingelogd en wel. Geen mail? Kijk even in je spamfolder.
        </p>
        <p className="mt-4 text-sm text-gedempt">Zonder die klik gebeurt er niets: geen account, geen aankoop.</p>
      </div>
    );
  }

  const foutmelding = sp.fout ? (FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw.") : null;
  const user = await currentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Eerst even inloggen</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Je wilt de {info.naam.toLowerCase()} ({formatEuro(info.prijs)}, eenmalig) afrekenen. Die aankoop koppelen we aan
          een account, zodat je de verdieping niet kwijtraakt. Inloggen gaat met een e-maillink, zonder wachtwoord.
        </p>
        {foutmelding ? (
          <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{foutmelding}</p>
        ) : null}
        <Kaart className="mt-8">
          <form action={stuurLoginLink} className="space-y-5">
            <input type="hidden" name="product" value={product} />
            <input type="hidden" name="van" value={van ?? ""} />
            <Veld label="E-mailadres" hint="Alleen voor de inloglink en je account. Geen nieuwsbrief, geen aanbiedingen.">
              <input name="email" type="email" required placeholder="jij@voorbeeld.nl" className={inputClass} />
            </Veld>
            <input type="text" name="bedrijfsnaam" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <KnopPrimair type="submit">Stuur mij de inloglink</KnopPrimair>
          </form>
        </Kaart>
        <p className="mt-4 text-sm text-gedempt">
          Liever eerst nog even kijken?{" "}
          <Link href={`/premium?${q}`} className="underline underline-offset-2 hover:text-merk">
            Terug naar het overzicht
          </Link>
          .
        </p>
      </div>
    );
  }

  if (await hasEntitlement(user.id, product)) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Je hebt dit al</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Je account ({user.email}) heeft de {info.naam.toLowerCase()} al. We maken geen tweede aankoop aan; er valt hier
          niets af te rekenen.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {van ? <KnopPrimair href={van}>Verder waar je was</KnopPrimair> : <KnopPrimair href="/dashboard">Naar mijn dashboard</KnopPrimair>}
          <KnopSecundair href="/premium">Naar het overzicht</KnopSecundair>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Afrekenen</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Ingelogd als {user.email}. Controleer je aankoop; met één klik hieronder rond je hem af.
      </p>
      {foutmelding ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{foutmelding}</p>
      ) : null}

      <Kaart className="mt-8">
        <SectieLabel>Je aankoop</SectieLabel>
        <h2 className="mt-2 text-xl font-semibold">{info.naam}</h2>
        <p className="mt-1 font-display text-3xl font-semibold text-merk">{formatEuro(info.prijs)}</p>
        <p className="text-xs text-gedempt">eenmalig, geen abonnement, geen automatische verlenging</p>

        <ul className="mt-4 space-y-2 border-t border-lijn pt-4 text-sm leading-relaxed text-inkt-zacht">
          {info.krijgt.map((punt) => (
            <li key={punt} className="flex gap-2">
              <span aria-hidden="true" className="mt-0.5 text-merk">+</span>
              <span>{punt}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">{info.gratisBlijft}</p>

        <div className="mt-5 rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt">
          Testfase: dit is een oefen-checkout. Er wordt niets afgeschreven en we vragen geen betaalgegevens. Je aankoop
          wordt wel echt aan je account gekoppeld, zodat je de verdieping kunt bekijken.
        </div>

        <form action={rekenAf} className="mt-6">
          <input type="hidden" name="product" value={product} />
          <input type="hidden" name="van" value={van ?? ""} />
          <KnopPrimair type="submit">Afrekenen (testfase: er wordt niets afgeschreven)</KnopPrimair>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-gedempt">
          Klik je niet, dan gebeurt er niets. Geen verborgen stappen: dit is de hele checkout.
        </p>
      </Kaart>

      <p className="mt-4 text-sm text-gedempt">
        Toch niet?{" "}
        <Link href={van ?? "/premium"} className="underline underline-offset-2 hover:text-merk">
          {van ? "Terug naar waar je was" : "Terug naar het overzicht"}
        </Link>
        .
      </p>
    </div>
  );
}
