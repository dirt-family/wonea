import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { createLead } from "@/lib/leads";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro, normalizePostcode } from "@/lib/util";
import { IcoonRondje, inputClass, Kaart, KnopPrimair, SectieLabel, StappenBalk, Veld } from "@/components/ui";
import { CONSENT_TEKST, CONSENT_TEKSTVERSIE, consentTekstversie } from "@/app/verkopen/consent-teksten";

export const metadata: Metadata = { title: "Je woning verkopen", robots: { index: false, follow: false } };

/**
 * Makelaarslead-funnel: adres, drie kwalificatievragen, e-mail + consent.
 * Stepper op 1 pagina: de tussenstappen zijn GET-formulieren (antwoorden
 * reizen mee in de URL, niets wordt opgeslagen), alleen de laatste stap is
 * een server action die via lib/leads.createLead de lead vastlegt.
 */

const TERMIJNEN = {
  "binnen-3-mnd": "Binnen 3 maanden",
  "3-12-mnd": "Binnen 3 tot 12 maanden",
  orienterend: "Ik ben me nog aan het oriënteren",
} as const;

const REDENEN = {
  groter: "Ik wil groter wonen",
  kleiner: "Ik wil kleiner wonen",
  "andere-stad": "Ik verhuis naar een andere stad of regio",
  anders: "Anders",
} as const;

const MAKELAAR_OPTIES = {
  ja: "Ja, ik heb al met een makelaar gesproken",
  nee: "Nee, nog niet",
} as const;

type Termijn = keyof typeof TERMIJNEN;
type Reden = keyof typeof REDENEN;
type MakelaarKeuze = keyof typeof MAKELAAR_OPTIES;

function isTermijn(v: string | undefined): v is Termijn {
  return v != null && v in TERMIJNEN;
}
function isReden(v: string | undefined): v is Reden {
  return v != null && v in REDENEN;
}
function isMakelaarKeuze(v: string | undefined): v is MakelaarKeuze {
  return v != null && v in MAKELAAR_OPTIES;
}

async function vindAdres(postcodeInput: string, nummerInput: string) {
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

const verzendSchema = z.object({
  postcode: z.string().min(6).max(7),
  nummer: z.string().min(1).max(12),
  termijn: z.enum(["binnen-3-mnd", "3-12-mnd", "orienterend"]),
  reden: z.enum(["groter", "kleiner", "andere-stad", "anders"]),
  makelaar: z.enum(["ja", "nee"]),
  email: z.string().email().max(200),
  consent: z.literal("1"),
  bedrijfsnaam: z.string().max(0).optional(), // honeypot: mensen laten dit leeg
});

async function verstuurAanvraag(formData: FormData) {
  "use server";
  const hdrs = await headers();
  const ip = clientIp(hdrs);

  const parsed = verzendSchema.safeParse({
    postcode: formData.get("postcode") ?? "",
    nummer: formData.get("nummer") ?? "",
    termijn: formData.get("termijn") ?? "",
    reden: formData.get("reden") ?? "",
    makelaar: formData.get("makelaar") ?? "",
    email: formData.get("email") ?? "",
    consent: formData.get("consent") ?? "",
    bedrijfsnaam: formData.get("bedrijfsnaam") ?? "",
  });
  if (!parsed.success) redirect("/verkopen?fout=ongeldig");

  const postcode = normalizePostcode(parsed.data.postcode);
  if (!postcode) redirect("/verkopen?fout=postcode");
  const nummerslug = parsed.data.nummer.toLowerCase().replace(/\s+/g, "");
  const terug = new URLSearchParams({
    postcode,
    nummer: nummerslug,
    termijn: parsed.data.termijn,
    reden: parsed.data.reden,
    makelaar: parsed.data.makelaar,
  }).toString();

  if (rateLimited(`verkopen:${ip}`)) redirect(`/verkopen?fout=te-vaak&${terug}`);

  const adres = await vindAdres(postcode, nummerslug);
  if (!adres) redirect(`/verkopen?fout=onbekend&${terug}`);

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`;
  let gelukt = false;
  try {
    await createLead({
      type: "makelaar",
      adresId: adres.id,
      email: parsed.data.email.toLowerCase().trim(),
      antwoorden: {
        termijn: TERMIJNEN[parsed.data.termijn],
        reden: REDENEN[parsed.data.reden],
        alMakelaarGesproken: parsed.data.makelaar === "ja",
      },
      consentTekst: consentTekstversie(),
      bron: "funnel:verkopen",
      partijType: "een lokale verkoopmakelaar",
      adresNaam: naam,
    });
    gelukt = true;
  } catch {
    // createLead weigert gesuppresseerde adressen; hieronder een nette fout.
  }
  redirect(gelukt ? "/verkopen/bedankt" : `/verkopen?fout=onbekend&${terug}`);
}

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw.",
  ongeldig: "Controleer je invoer en probeer het opnieuw.",
  postcode: "Die postcode herkennen we niet. Gebruik het formaat 1234 AB.",
  onbekend: "Dit adres staat niet (meer) op Wonea. Controleer je invoer of probeer een ander adres.",
};

const STAP_LABELS = ["Adres", "Termijn", "Reden", "Makelaar", "Versturen"];

/**
 * Optie-rij met zichtbare gekozen-staat. Deze stappen zijn server-gerenderde
 * GET-formulieren (geen client state), dus de gekozen-stijl komt uit CSS:
 * has-[:checked] kleurt de rij zodra de radio erin aangevinkt is.
 */
const optieRijCls =
  "flex cursor-pointer items-center gap-3 rounded-lg border border-lijn bg-paneel px-4 py-3 transition-colors hover:border-merk has-[:checked]:border-merk has-[:checked]:bg-merk-wash";

export default async function VerkopenPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string; termijn?: string; reden?: string; makelaar?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  const heeftAdresParams = Boolean(sp.postcode && sp.nummer);
  const adres = heeftAdresParams ? await vindAdres(sp.postcode!, sp.nummer!) : null;
  const termijn = isTermijn(sp.termijn) ? sp.termijn : null;
  const reden = isReden(sp.reden) ? sp.reden : null;
  const makelaar = isMakelaarKeuze(sp.makelaar) ? sp.makelaar : null;

  const stap = !adres ? 1 : !termijn ? 2 : !reden ? 3 : !makelaar ? 4 : 5;
  const foutmelding = sp.fout
    ? (FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw.")
    : heeftAdresParams && !adres
      ? FOUTEN.onbekend
      : null;

  const view = adres ? await getOrCreateValuation(adres) : null;
  const naam = adres ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}` : null;
  const stapUrl = (extra: Record<string, string>) =>
    adres ? `/verkopen?${new URLSearchParams({ postcode: adres.postcode, nummer: adres.nummerslug, ...extra }).toString()}` : "/verkopen";

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 [background-image:var(--gradient-hero-wash)]" />
      <div className="relative mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Je woning verkopen</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Verkoopplannen, of gewoon aan het verkennen? Beantwoord drie korte vragen, dan brengen we je in contact met een
        lokale verkoopmakelaar die je buurt kent. Gratis en vrijblijvend, je zit nergens aan vast.
      </p>
      <div className="mt-6">
        <StappenBalk stappen={STAP_LABELS} actief={stap - 1} />
      </div>

      {foutmelding ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-lg border border-negatief/30 bg-negatief-wash px-4 py-3 text-sm text-negatief">
          <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-negatief" />
          {foutmelding}
        </p>
      ) : null}

      {adres && view ? (
        <Kaart className="mt-8 border-merk-200 bg-merk-wash">
          <div className="flex items-start gap-4">
            <IcoonRondje naam="huis" tint="merk" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-merk">Je woning</p>
              <p className="mt-2 text-lg font-semibold text-inkt">{naam}</p>
              <p className="text-sm text-inkt-zacht">
                {adres.postcode} {adres.plaats}
              </p>
              {view.valuation ? (
                <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
                  Geschatte Wonea-waarde: <span className="font-semibold tabular-nums text-merk">{formatEuro(view.valuation.waarde)}</span>,
                  bandbreedte {formatEuro(view.valuation.intervalLaag)} tot {formatEuro(view.valuation.intervalHoog)}, op basis
                  van {view.valuation.nComparables} verkopen. Dit is een modelmatige schatting, geen taxatie; een makelaar kijkt
                  ook naar staat en afwerking.
                </p>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
                  Voor dit adres hebben we nog geen eerlijke schatting: er zijn te weinig recente verkopen in de buurt. Een
                  makelaar kan de waarde wel ter plekke bepalen.
                </p>
              )}
              <Link href="/verkopen" className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
                Ander adres kiezen
              </Link>
            </div>
          </div>
        </Kaart>
      ) : null}

      {stap === 1 ? (
        <Kaart className="mt-8">
          <form method="get" action="/verkopen" className="space-y-5">
            <SectieLabel>Stap 1: je adres</SectieLabel>
            <div className="grid gap-5 sm:grid-cols-2">
              <Veld label="Postcode">
                <input name="postcode" defaultValue={sp.postcode ?? ""} placeholder="1234 AB" required className={inputClass} />
              </Veld>
              <Veld label="Huisnummer" hint="Met toevoeging, bv. 12a of 12-2">
                <input name="nummer" defaultValue={sp.nummer ?? ""} placeholder="12" required className={inputClass} />
              </Veld>
            </div>
            <KnopPrimair type="submit">Naar de vragen</KnopPrimair>
            <p className="text-xs leading-relaxed text-gedempt">
              We gebruiken je adres alleen om je woning en buurt te tonen. Er wordt in deze stap niets opgeslagen of
              verstuurd.
            </p>
          </form>
        </Kaart>
      ) : null}

      {stap === 2 && adres ? (
        <Kaart className="mt-5">
          <form method="get" action="/verkopen" className="space-y-5">
            <input type="hidden" name="postcode" value={adres.postcode} />
            <input type="hidden" name="nummer" value={adres.nummerslug} />
            <fieldset>
              <legend className="text-sm font-medium text-inkt">Op welke termijn wil je verkopen?</legend>
              <div className="mt-3 space-y-2 text-sm text-inkt">
                {(Object.entries(TERMIJNEN) as [Termijn, string][]).map(([waarde, label]) => (
                  <label key={waarde} className={optieRijCls}>
                    <input type="radio" name="termijn" value={waarde} required className="accent-merk" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <KnopPrimair type="submit">Volgende</KnopPrimair>
          </form>
        </Kaart>
      ) : null}

      {stap === 3 && adres && termijn ? (
        <Kaart className="mt-5">
          <form method="get" action="/verkopen" className="space-y-5">
            <input type="hidden" name="postcode" value={adres.postcode} />
            <input type="hidden" name="nummer" value={adres.nummerslug} />
            <input type="hidden" name="termijn" value={termijn} />
            <fieldset>
              <legend className="text-sm font-medium text-inkt">Wat is de belangrijkste reden om te verhuizen?</legend>
              <div className="mt-3 space-y-2 text-sm text-inkt">
                {(Object.entries(REDENEN) as [Reden, string][]).map(([waarde, label]) => (
                  <label key={waarde} className={optieRijCls}>
                    <input type="radio" name="reden" value={waarde} required className="accent-merk" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center gap-4">
              <KnopPrimair type="submit">Volgende</KnopPrimair>
              <Link href={stapUrl({})} className="text-sm text-gedempt underline underline-offset-4 hover:text-merk">
                Vorige vraag
              </Link>
            </div>
          </form>
        </Kaart>
      ) : null}

      {stap === 4 && adres && termijn && reden ? (
        <Kaart className="mt-5">
          <form method="get" action="/verkopen" className="space-y-5">
            <input type="hidden" name="postcode" value={adres.postcode} />
            <input type="hidden" name="nummer" value={adres.nummerslug} />
            <input type="hidden" name="termijn" value={termijn} />
            <input type="hidden" name="reden" value={reden} />
            <fieldset>
              <legend className="text-sm font-medium text-inkt">Heb je al een makelaar gesproken?</legend>
              <div className="mt-3 space-y-2 text-sm text-inkt">
                {(Object.entries(MAKELAAR_OPTIES) as [MakelaarKeuze, string][]).map(([waarde, label]) => (
                  <label key={waarde} className={optieRijCls}>
                    <input type="radio" name="makelaar" value={waarde} required className="accent-merk" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center gap-4">
              <KnopPrimair type="submit">Volgende</KnopPrimair>
              <Link href={stapUrl({ termijn })} className="text-sm text-gedempt underline underline-offset-4 hover:text-merk">
                Vorige vraag
              </Link>
            </div>
          </form>
        </Kaart>
      ) : null}

      {stap === 5 && adres && termijn && reden && makelaar ? (
        <Kaart className="mt-5">
          <SectieLabel>Laatste stap: versturen</SectieLabel>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Termijn</dt>
              <dd className="text-right font-medium">
                {TERMIJNEN[termijn]}{" "}
                <Link href={stapUrl({})} className="font-normal text-gedempt underline underline-offset-2 hover:text-merk">
                  wijzig
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Reden</dt>
              <dd className="text-right font-medium">
                {REDENEN[reden]}{" "}
                <Link href={stapUrl({ termijn })} className="font-normal text-gedempt underline underline-offset-2 hover:text-merk">
                  wijzig
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gedempt">Makelaar gesproken</dt>
              <dd className="text-right font-medium">
                {makelaar === "ja" ? "Ja" : "Nee"}{" "}
                <Link href={stapUrl({ termijn, reden })} className="font-normal text-gedempt underline underline-offset-2 hover:text-merk">
                  wijzig
                </Link>
              </dd>
            </div>
          </dl>

          <form action={verstuurAanvraag} className="mt-5 space-y-5 border-t border-lijn pt-5">
            <input type="hidden" name="postcode" value={adres.postcode} />
            <input type="hidden" name="nummer" value={adres.nummerslug} />
            <input type="hidden" name="termijn" value={termijn} />
            <input type="hidden" name="reden" value={reden} />
            <input type="hidden" name="makelaar" value={makelaar} />

            <Veld label="E-mailadres" hint="Voor de bevestiging van je aanvraag en het contact met de makelaar.">
              <input name="email" type="email" required placeholder="jij@voorbeeld.nl" className={inputClass} />
            </Veld>

            <label className="flex items-start gap-3 text-sm text-inkt">
              <input type="checkbox" name="consent" value="1" required className="mt-0.5 accent-merk" />
              <span>
                {CONSENT_TEKST} <span className="text-xs text-gedempt">({CONSENT_TEKSTVERSIE})</span>
              </span>
            </label>

            <input type="text" name="bedrijfsnaam" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <p className="text-sm leading-relaxed text-inkt-zacht">
              Na verzending geven we je aanvraag eenmalig door aan een lokale verkoopmakelaar. Niet aan meerdere partijen,
              en je e-mailadres gebruiken we nergens anders voor.
            </p>

            <KnopPrimair type="submit">Verstuur mijn aanvraag</KnopPrimair>
            <p className="text-xs leading-relaxed text-gedempt">
              In deze testfase wordt er nog niets echt doorgestuurd. Zie ook ons{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-merk">
                privacybeleid
              </Link>
              .
            </p>
          </form>
        </Kaart>
      ) : null}
      </div>
    </div>
  );
}
