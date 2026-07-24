import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumeMagicToken, createSession } from "@/lib/auth";
import { IcoonRondje, Kaart, KnopPrimair } from "@/components/ui";
import { Illustratie } from "@/components/illustraties";
import { checkoutQuery, veiligeVanUrl } from "@/app/premium/logic";
import { parseProduct, PRODUCTEN } from "@/app/premium/producten";

export const metadata: Metadata = { title: "Inloggen", robots: { index: false, follow: false } };

/**
 * De inloglink uit de mail opent deze pagina; de token wordt pas verbruikt
 * bij de expliciete bevestigingsklik (server action). Zo kan een mailscanner
 * die links voor-opent de eenmalige token niet ongeldig maken, en wordt de
 * sessiecookie netjes in een action gezet. Zelfde patroon als /claim/verzilver.
 */

const verzilverSchema = z.object({
  token: z.string().min(10).max(200),
  product: z.enum(["biedadvies", "marktanalyse"]),
  van: z.string().max(500).optional().or(z.literal("")),
});

async function bevestigLogin(formData: FormData) {
  "use server";
  const parsed = verzilverSchema.safeParse({
    token: formData.get("token") ?? "",
    product: formData.get("product") ?? "",
    van: formData.get("van") ?? "",
  });
  if (!parsed.success) redirect("/premium");

  const van = veiligeVanUrl(parsed.data.van);
  const q = checkoutQuery(parsed.data.product, van);

  const userId = await consumeMagicToken(parsed.data.token);
  if (userId === null) redirect(`/premium/verzilver?fout=verlopen&${q}`);

  await createSession(userId);
  redirect(`/premium/afrekenen?${q}`);
}

type SearchParams = { token?: string; product?: string; van?: string; fout?: string };

export default async function PremiumVerzilverPagina({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const productVoorFout = parseProduct(sp.product);
  const vanVoorFout = veiligeVanUrl(sp.van);

  if (sp.fout === "verlopen") {
    const terug = productVoorFout ? `/premium/afrekenen?${checkoutQuery(productVoorFout, vanVoorFout)}` : "/premium";
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">Deze link werkt niet meer</h1>
            <p className="mt-4 leading-relaxed text-inkt-zacht">
              De inloglink is verlopen of al gebruikt. Geen zorgen: vraag gewoon een nieuwe aan, dat kost je een halve minuut.
            </p>
            <div className="mt-8">
              <KnopPrimair href={terug}>Vraag een nieuwe link aan</KnopPrimair>
            </div>
          </div>
          <Illustratie naam="lege-staat" className="hidden w-40 shrink-0 sm:block" />
        </div>
      </div>
    );
  }

  const parsed = verzilverSchema.safeParse({
    token: sp.token ?? "",
    product: sp.product ?? "",
    van: sp.van ?? "",
  });
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">Deze link klopt niet helemaal</h1>
            <p className="mt-4 leading-relaxed text-inkt-zacht">
              De link mist een deel of is beschadigd geraakt, bijvoorbeeld door het kopiëren uit de mail. Vraag op de
              afrekenpagina een nieuwe inloglink aan.
            </p>
            <div className="mt-8">
              <KnopPrimair href="/premium">Naar het premium-overzicht</KnopPrimair>
            </div>
          </div>
          <Illustratie naam="lege-staat" className="hidden w-40 shrink-0 sm:block" />
        </div>
      </div>
    );
  }

  const info = PRODUCTEN[parsed.data.product];
  const van = veiligeVanUrl(parsed.data.van);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">Bijna ingelogd</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Eén klik op de knop hieronder en je bent ingelogd. Daarna kom je terug op de afrekenpagina van de{" "}
        {info.naam.toLowerCase()}. Er wordt nog niets gekocht: dat doe je daar zelf, met een aparte knop.
      </p>
      <Kaart className="mt-8">
        <div className="flex items-center gap-3">
          <IcoonRondje naam="schild" tint="merk" />
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-merk">Je bevestigt</p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-inkt">
          Dat jij dit e-mailadres beheert en wilt inloggen bij Wonea. Meer niet: geen aankoop, geen mails, geen abonnement.
        </p>
        <form action={bevestigLogin} className="mt-6">
          <input type="hidden" name="token" value={parsed.data.token} />
          <input type="hidden" name="product" value={parsed.data.product} />
          <input type="hidden" name="van" value={van ?? ""} />
          <KnopPrimair type="submit">Log in en ga naar afrekenen</KnopPrimair>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-gedempt">
          Klik je niet, dan gebeurt er niets en verloopt de link vanzelf na 15 minuten.
        </p>
      </Kaart>
    </div>
  );
}
