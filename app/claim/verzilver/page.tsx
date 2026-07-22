import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { consumeMagicToken, createSession } from "@/lib/auth";
import { isSuppressed } from "@/lib/suppression";
import { normalizePostcode } from "@/lib/util";
import { Kaart, KnopPrimair, SectieLabel } from "@/components/ui";
import { CONSENT_TEKST_ALERTS, CONSENT_TEKST_MARKETING } from "@/app/claim/consent-teksten";
import { verzilverClaim } from "@/app/claim/verzilver/logic";

export const metadata: Metadata = { title: "Bevestig je claim" };

const verzilverSchema = z.object({
  token: z.string().min(10).max(200),
  postcode: z.string().min(6).max(7),
  nummer: z.string().min(1).max(12),
  rol: z.enum(["eigenaar", "bewoner"]),
  alerts: z.enum(["0", "1"]),
  marketing: z.enum(["0", "1"]),
});

/**
 * De verzilverlink uit de mail opent deze pagina; de token wordt pas
 * verbruikt bij de expliciete bevestigingsklik (server action). Zo kan een
 * mailscanner die links voor-opent de eenmalige token niet ongeldig maken,
 * en wordt de sessiecookie netjes in een action gezet.
 */
async function bevestigVerzilver(formData: FormData) {
  "use server";
  const parsed = verzilverSchema.safeParse({
    token: formData.get("token") ?? "",
    postcode: formData.get("postcode") ?? "",
    nummer: formData.get("nummer") ?? "",
    rol: formData.get("rol") ?? "",
    alerts: formData.get("alerts") ?? "",
    marketing: formData.get("marketing") ?? "",
  });
  if (!parsed.success) redirect("/claim?fout=ongeldig");

  const postcode = normalizePostcode(parsed.data.postcode);
  if (!postcode) redirect("/claim?fout=postcode");
  const nummerslug = parsed.data.nummer.toLowerCase().replace(/\s+/g, "");
  const terug = `postcode=${postcode}&nummer=${encodeURIComponent(nummerslug)}`;

  const userId = consumeMagicToken(parsed.data.token);
  if (userId === null) redirect(`/claim/verzilver?fout=verlopen&${terug}`);

  const resultaat = verzilverClaim({
    userId,
    postcode,
    nummerslug,
    rol: parsed.data.rol,
    alerts: parsed.data.alerts === "1",
    marketing: parsed.data.marketing === "1",
  });
  if (!resultaat) redirect("/claim?fout=onbekend");

  await createSession(userId);
  redirect("/dashboard");
}

type SearchParams = {
  token?: string;
  postcode?: string;
  nummer?: string;
  rol?: string;
  alerts?: string;
  marketing?: string;
  fout?: string;
};

function Foutpagina({ titel, tekst, knopHref, knopTekst }: { titel: string; tekst: string; knopHref: string; knopTekst: string }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">{titel}</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">{tekst}</p>
      <div className="mt-8">
        <KnopPrimair href={knopHref}>{knopTekst}</KnopPrimair>
      </div>
    </div>
  );
}

export default async function VerzilverPagina({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  if (sp.fout === "verlopen") {
    const terug = sp.postcode && sp.nummer ? `?postcode=${encodeURIComponent(sp.postcode)}&nummer=${encodeURIComponent(sp.nummer)}` : "";
    return (
      <Foutpagina
        titel="Deze link werkt niet meer"
        tekst="De bevestigingslink is verlopen of al gebruikt. Geen zorgen: vraag gewoon een nieuwe aan, dat kost je een halve minuut."
        knopHref={`/claim${terug}`}
        knopTekst="Vraag een nieuwe link aan"
      />
    );
  }

  const parsed = verzilverSchema.safeParse({
    token: sp.token ?? "",
    postcode: sp.postcode ?? "",
    nummer: sp.nummer ?? "",
    rol: sp.rol ?? "",
    alerts: sp.alerts ?? "",
    marketing: sp.marketing ?? "",
  });
  if (!parsed.success) {
    return (
      <Foutpagina
        titel="Deze link klopt niet helemaal"
        tekst="De link mist een deel of is beschadigd geraakt, bijvoorbeeld door het kopiëren uit de mail. Vraag een nieuwe bevestigingslink aan."
        knopHref="/claim"
        knopTekst="Opnieuw proberen"
      />
    );
  }

  const postcode = normalizePostcode(parsed.data.postcode);
  const nummerslug = parsed.data.nummer.toLowerCase().replace(/\s+/g, "");
  const adres = postcode
    ? db
        .select()
        .from(addresses)
        .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
        .get()
    : null;
  const claimbaar = adres && adres.status !== "opted_out" && !isSuppressed(adres.postcode, adres.nummerslug);
  if (!claimbaar) {
    return (
      <Foutpagina
        titel="Dit adres is niet meer beschikbaar"
        tekst="Dit adres staat niet (meer) op Wonea en kan daarom niet geclaimd worden."
        knopHref="/"
        knopTekst="Zoek een ander adres"
      />
    );
  }

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  const alerts = parsed.data.alerts === "1";
  const marketing = parsed.data.marketing === "1";

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Bijna klaar</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Eén klik op de knop hieronder en je claim is actief. Dit is wat er dan gebeurt, niets meer:
      </p>
      <Kaart className="mt-8">
        <SectieLabel>Je bevestigt</SectieLabel>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-inkt">
          <li>
            Je claimt <strong>{naam}</strong>, {adres.postcode} {adres.plaats}, als {parsed.data.rol}. Dit is een
            zelfverklaring: we controleren geen eigendom en labelen het ook zo.
          </li>
          <li>
            {alerts
              ? `Je gaf toestemming voor: "${CONSENT_TEKST_ALERTS}". We leggen die toestemming vast; intrekken kan altijd in je dashboard.`
              : "Je koos geen maandelijkse waarde-alerts. Aanzetten kan later alsnog in je dashboard."}
          </li>
          <li>
            {marketing
              ? `Je gaf toestemming voor: "${CONSENT_TEKST_MARKETING}". We leggen die toestemming vast; intrekken kan altijd.`
              : "Je koos geen aanbiedingen. Die sturen we dus niet."}
          </li>
        </ul>
        <form action={bevestigVerzilver} className="mt-6">
          <input type="hidden" name="token" value={parsed.data.token} />
          <input type="hidden" name="postcode" value={postcode ?? ""} />
          <input type="hidden" name="nummer" value={nummerslug} />
          <input type="hidden" name="rol" value={parsed.data.rol} />
          <input type="hidden" name="alerts" value={parsed.data.alerts} />
          <input type="hidden" name="marketing" value={parsed.data.marketing} />
          <KnopPrimair type="submit">Bevestig en open mijn dashboard</KnopPrimair>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-gedempt">
          Klik je niet, dan gebeurt er niets en verloopt de link vanzelf na 15 minuten.
        </p>
      </Kaart>
    </div>
  );
}
