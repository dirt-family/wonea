import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createLead } from "@/lib/leads";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { normalizePostcode } from "@/lib/util";
import { inputClass, Kaart, KnopPrimair, SectieLabel, Veld } from "@/components/ui";
import { CONSENT_TEKST, CONSENT_TEKSTVERSIE, consentTekstversie } from "@/app/taxatierapport/consent-teksten";
import { isMoment, MOMENTEN, vindAdres, type Moment } from "@/app/taxatierapport/helpers";

export const metadata: Metadata = { title: "Gevalideerd taxatierapport aanvragen", robots: { index: false, follow: false } };

/**
 * Taxatierapport-funnel: uitleg (wat is NWWI, wanneer nodig, echte prijsrange
 * 450 tot 800 euro) plus een aanvraagformulier. Na verzending volgt een
 * placeholder-checkout; er is bewust geen betaalprovider gekoppeld.
 */

const formSchema = z.object({
  postcode: z.string().min(6).max(7),
  nummer: z.string().min(1).max(12),
  moment: z.enum(["zo-snel-mogelijk", "binnen-een-maand", "1-3-maanden", "orienterend"]),
  email: z.string().email().max(200),
  consent: z.literal("1"),
  bedrijfsnaam: z.string().max(0).optional(), // honeypot: mensen laten dit leeg
});

async function vraagRapportAan(formData: FormData) {
  "use server";
  const hdrs = await headers();
  const ip = clientIp(hdrs);

  const parsed = formSchema.safeParse({
    postcode: formData.get("postcode") ?? "",
    nummer: formData.get("nummer") ?? "",
    moment: formData.get("moment") ?? "",
    email: formData.get("email") ?? "",
    consent: formData.get("consent") ?? "",
    bedrijfsnaam: formData.get("bedrijfsnaam") ?? "",
  });
  if (!parsed.success) redirect("/taxatierapport?fout=ongeldig");

  const postcode = normalizePostcode(parsed.data.postcode);
  if (!postcode) redirect("/taxatierapport?fout=postcode");
  const nummerslug = parsed.data.nummer.toLowerCase().replace(/\s+/g, "");
  const terug = new URLSearchParams({ postcode, nummer: nummerslug, moment: parsed.data.moment }).toString();

  if (rateLimited(`taxatie:${ip}`)) redirect(`/taxatierapport?fout=te-vaak&${terug}`);

  const adres = await vindAdres(postcode, nummerslug);
  if (!adres) redirect(`/taxatierapport?fout=onbekend&${terug}`);

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`;
  let gelukt = false;
  try {
    await createLead({
      type: "taxatie",
      adresId: adres.id,
      email: parsed.data.email.toLowerCase().trim(),
      antwoorden: { gewenstMoment: MOMENTEN[parsed.data.moment] },
      consentTekst: consentTekstversie(),
      bron: "funnel:taxatierapport",
      partijType: "een gecertificeerde taxateur",
      adresNaam: naam,
    });
    gelukt = true;
  } catch {
    // createLead weigert gesuppresseerde adressen; hieronder een nette fout.
  }
  redirect(gelukt ? `/taxatierapport/checkout?${terug}` : `/taxatierapport?fout=onbekend&${terug}`);
}

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw.",
  ongeldig: "Controleer je invoer en probeer het opnieuw.",
  postcode: "Die postcode herkennen we niet. Gebruik het formaat 1234 AB.",
  onbekend: "Dit adres staat niet (meer) op Wonea. Controleer je invoer of probeer een ander adres.",
};

export default async function TaxatierapportPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string; moment?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  const foutmelding = sp.fout ? (FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw.") : null;
  const gekozenMoment: Moment | "" = isMoment(sp.moment) ? sp.moment : "";

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Gevalideerd taxatierapport (NWWI)</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        De Wonea-schatting is een modelmatige waarde met bandbreedte: handig om richting te krijgen, maar geen taxatie.
        Voor een hypotheek eist je bank een gevalideerd rapport van een gecertificeerde taxateur. Dat vraag je hier aan.
      </p>

      {foutmelding ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{foutmelding}</p>
      ) : null}

      <Kaart className="mt-8">
        <SectieLabel>Wat is een gevalideerd rapport?</SectieLabel>
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Een gecertificeerde taxateur bekijkt je woning ter plekke en stelt een rapport op. Het NWWI (Nederlands Woning
          Waarde Instituut) controleert dat rapport daarna op kwaliteit en onderbouwing; pas na die controle heet het
          &quot;gevalideerd&quot;. Banken en andere geldverstrekkers accepteren alleen zo&apos;n gevalideerd rapport.
        </p>
      </Kaart>

      <Kaart className="mt-5">
        <SectieLabel>Wanneer heb je het nodig?</SectieLabel>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-inkt-zacht">
          <li>Bij het afsluiten of oversluiten van een hypotheek.</li>
          <li>Bij een verbouwing die je meefinanciert in je hypotheek.</li>
          <li>
            Niet nodig als je alleen nieuwsgierig bent naar de waarde: daarvoor is de gratis schatting op je woningpagina
            genoeg.
          </li>
        </ul>
      </Kaart>

      <Kaart className="mt-5">
        <SectieLabel>Wat kost het?</SectieLabel>
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Een gevalideerd taxatierapport kost in de praktijk 450 tot 800 euro, afhankelijk van regio en taxateur. Je
          betaalt de taxateur; de aanvraagkosten via Wonea worden verrekend met het rapport, dus je betaalt niet dubbel.
        </p>
      </Kaart>

      <Kaart className="mt-5">
        <SectieLabel>Vraag je rapport aan</SectieLabel>
        <form action={vraagRapportAan} className="mt-4 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Veld label="Postcode">
              <input name="postcode" defaultValue={sp.postcode ?? ""} placeholder="1234 AB" required className={inputClass} />
            </Veld>
            <Veld label="Huisnummer" hint="Met toevoeging, bv. 12a of 12-2">
              <input name="nummer" defaultValue={sp.nummer ?? ""} placeholder="12" required className={inputClass} />
            </Veld>
          </div>

          <Veld label="Wanneer wil je het rapport?">
            <select name="moment" required defaultValue={gekozenMoment} className={inputClass}>
              <option value="" disabled>
                Kies een moment
              </option>
              {(Object.entries(MOMENTEN) as [Moment, string][]).map(([waarde, label]) => (
                <option key={waarde} value={waarde}>
                  {label}
                </option>
              ))}
            </select>
          </Veld>

          <Veld label="E-mailadres" hint="Voor de bevestiging van je aanvraag en het contact met de taxateur.">
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
            Na verzending geven we je aanvraag eenmalig door aan een gecertificeerde taxateur. Niet aan meerdere partijen,
            en je e-mailadres gebruiken we nergens anders voor.
          </p>

          <KnopPrimair type="submit">Vraag het rapport aan</KnopPrimair>
          <p className="text-xs leading-relaxed text-gedempt">
            In deze testfase wordt er nog niets echt doorgestuurd. Zie ook ons{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-merk">
              privacybeleid
            </Link>
            .
          </p>
        </form>
      </Kaart>
    </div>
  );
}
