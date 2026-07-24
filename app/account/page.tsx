import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses, claims, consents, users } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { formatDatumNl } from "@/lib/util";
import { IcoonRondje, KnopSecundair, Pil, SectieLabel } from "@/components/ui";
import { Blok } from "@/components/dossier/blok";
import { DOEL_LABELS, telActieveSessies, trekConsentIn } from "@/app/account/logic";

export const metadata: Metadata = { title: "Accountinstellingen", robots: { index: false, follow: false } };

// ---------------------------------------------------------------------------
// Server action: consent intrekken. Sessie en eigenaarschap worden opnieuw
// gecheckt; een consentId uit een formulier is nooit te vertrouwen.
// ---------------------------------------------------------------------------

const intrekSchema = z.object({ consentId: z.coerce.number().int().positive() });

async function trekIn(formData: FormData) {
  "use server";
  const parsed = intrekSchema.safeParse({ consentId: formData.get("consentId") ?? "" });
  if (!parsed.success) redirect("/account?fout=ongeldig");
  const user = await currentUser();
  if (!user) redirect("/claim");
  const resultaat = await trekConsentIn({ userId: user.id, email: user.email, consentId: parsed.data.consentId });
  if (resultaat === "niet-gevonden") redirect("/account?fout=consent");
  redirect("/account?ok=ingetrokken");
}

// ---------------------------------------------------------------------------
// Weergave
// ---------------------------------------------------------------------------

const FOUTEN: Record<string, string> = {
  ongeldig: "Er ging iets mis met dat verzoek. Probeer het opnieuw.",
  consent: "Deze toestemming bestaat niet of hoort niet bij jouw account.",
};

const OK: Record<string, string> = {
  ingetrokken: "Toestemming ingetrokken. Er staat een bevestigingsmail voor je klaar en we gebruiken je gegevens hier niet meer voor.",
};

export default async function AccountPagina({ searchParams }: { searchParams: Promise<{ fout?: string; ok?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/claim");
  const sp = await searchParams;

  const userRij = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
  const actieveSessies = await telActieveSessies(user.id);

  const mijnClaims = await db.select().from(claims).where(eq(claims.userId, user.id)).orderBy(desc(claims.createdAt));
  const claimRegels = await Promise.all(
    mijnClaims.map(async (claim) => {
      const adres = (await db.select().from(addresses).where(eq(addresses.id, claim.adresId)).limit(1))[0];
      const zichtbaar = adres && adres.status === "actief" && !(await isAddressIdSuppressed(adres.id));
      return {
        claim,
        naam: zichtbaar ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.postcode} ${adres.plaats}` : null,
        link: zichtbaar && !claim.endedAt ? `/woning/${adres.postcode}/${adres.nummerslug}` : null,
      };
    }),
  );

  const mijnConsents = await db
    .select()
    .from(consents)
    .where(or(eq(consents.userId, user.id), eq(consents.email, user.email)))
    .orderBy(desc(consents.consentedAt));

  return (
    <div>
      <Link href="/dashboard" className="text-sm font-semibold text-merk underline underline-offset-4">
        Terug naar mijn woningen
      </Link>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Accountinstellingen</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
        Alles wat jou als persoon raakt beheer je hier zelf: je toestemmingen, je gegevens en je account. Zonder
        klantenservice-wachtrij, zoals het hoort.
      </p>

      {sp.fout ? (
        <p className="mt-6 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
          {FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw."}
        </p>
      ) : null}
      {sp.ok && OK[sp.ok] ? (
        <p className="mt-6 rounded-lg border border-positief/30 bg-positief/5 px-4 py-3 text-sm text-positief">{OK[sp.ok]}</p>
      ) : null}

      <div className="mt-8 space-y-8">
        <Blok>
          <div className="flex items-center gap-3">
            <IcoonRondje naam="schild" tint="merk" />
            <SectieLabel>Account</SectieLabel>
          </div>
          <p className="mt-3 text-lg font-semibold">{user.email}</p>
          {userRij ? <p className="mt-1 text-sm text-inkt-zacht">Account sinds {formatDatumNl(userRij.createdAt)}.</p> : null}
          <div className="mt-4 border-t border-lijn pt-4">
            <SectieLabel>Hoe inloggen werkt</SectieLabel>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
              Je logt in met een e-maillink, zonder wachtwoord. Na het inloggen onthoudt dit apparaat je via een beveiligde
              cookie die alleen voor inloggen dient; na 30 dagen verloopt die vanzelf. Op dit moment
              {actieveSessies === 1 ? " is er 1 actieve sessie" : ` zijn er ${actieveSessies} actieve sessies`} (apparaten of
              browsers) voor je account. Uitloggen doe je op je dashboard; opzeggen hieronder verwijdert alle sessies in een
              keer.
            </p>
          </div>
        </Blok>

        <Blok>
          <div className="flex items-center gap-3">
            <IcoonRondje naam="huis" tint="merk" />
            <SectieLabel>Mijn claims</SectieLabel>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            Een claim is jouw zelfverklaring dat dit je woning is. Beheren (alerts, hypotheek, rapport delen) doe je op je
            dashboard; opzeggen per woning kan daar ook.
          </p>
          {claimRegels.length === 0 ? (
            <p className="mt-4 text-sm text-gedempt">Je hebt nog geen woning geclaimd.</p>
          ) : (
            <ul className="mt-4 divide-y divide-lijn">
              {claimRegels.map(({ claim, naam, link }) => (
                <li key={claim.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${claim.endedAt ? "opacity-60" : ""}`}>
                  <div>
                    <p className="text-sm font-semibold text-inkt">
                      {naam ?? "Adres op verzoek verwijderd van Wonea"}
                    </p>
                    <p className="mt-0.5 text-xs text-gedempt">
                      Sinds {formatDatumNl(claim.createdAt)}
                      {claim.endedAt ? `, beeindigd op ${formatDatumNl(claim.endedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pil variant="lavendel">zelfverklaard {claim.rol}</Pil>
                    {link ? (
                      <Link href={link} className="text-sm font-semibold text-merk underline underline-offset-4">
                        Woningpagina
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Blok>

        <Blok>
          <div className="flex items-center gap-3">
            <IcoonRondje naam="vinkje" tint="merk" />
            <SectieLabel>Mijn toestemmingen</SectieLabel>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            Intrekken is net zo makkelijk als geven: een klik. Ingetrokken toestemmingen blijven hier grijs staan als bewijs
            van wat je wanneer gaf en introk; we handelen er niet meer naar.
          </p>
          {mijnConsents.length === 0 ? (
            <p className="mt-4 text-sm text-gedempt">
              Je hebt Wonea nergens toestemming voor gegeven. Zo blijft het tot jij een vinkje zet, nooit andersom.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {mijnConsents.map((consent) => {
                const actief = !consent.revokedAt;
                return (
                  <div
                    key={consent.id}
                    className={`rounded-[14px] border border-lijn p-4 ${actief ? "" : "bg-achtergrond opacity-70"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-inkt">{DOEL_LABELS[consent.doel]}</p>
                      {actief ? (
                        <form action={trekIn}>
                          <input type="hidden" name="consentId" value={consent.id} />
                          <button type="submit" className="text-sm font-semibold text-negatief underline underline-offset-4">
                            Intrekken
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-semibold text-gedempt">
                          Ingetrokken op {formatDatumNl(consent.revokedAt!)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm italic leading-relaxed text-inkt-zacht">&quot;{consent.tekstversie}&quot;</p>
                    <p className="mt-2 text-xs text-gedempt">
                      Gegeven op {formatDatumNl(consent.consentedAt)} via {consent.bron}
                    </p>
                    {actief && consent.doel === "alerts" ? (
                      <p className="mt-1 text-xs text-gedempt">Intrekken zet ook je waarde-alerts uit.</p>
                    ) : null}
                    {actief && consent.doel === "lead_doorgifte" ? (
                      <p className="mt-1 text-xs text-gedempt">
                        Een al doorgestuurde aanvraag haalt intrekken niet terug; voor nieuwe doorgifte gebruiken we je
                        gegevens dan niet meer.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Blok>

        <div className="grid gap-4 lg:grid-cols-2">
          <Blok className="flex flex-col">
            <div className="flex items-center gap-3">
              <IcoonRondje naam="document" tint="merk" />
              <SectieLabel>Inzage in je gegevens</SectieLabel>
            </div>
            <p className="mt-2 max-w-2xl flex-1 text-sm leading-relaxed text-inkt-zacht">
              Download alles wat Wonea aan jouw account of e-mailadres koppelt als JSON-bestand: account, claims (met
              hypotheekgegevens), toestemmingen, aanvragen, WOZ-invoer en abonnementen. Machineleesbaar, zodat je het kunt
              bewaren of meenemen (AVG artikel 15 en 20).
            </p>
            <div className="mt-4">
              <KnopSecundair href="/account/gegevens">Download mijn gegevens</KnopSecundair>
            </div>
          </Blok>

          <Blok className="flex flex-col">
            <div className="flex items-center gap-3">
              <IcoonRondje naam="verwijderen" tint="merk" />
              <SectieLabel>Account opzeggen</SectieLabel>
            </div>
            <p className="mt-2 max-w-2xl flex-1 text-sm leading-relaxed text-inkt-zacht">
              Opzeggen beeindigt je claims, trekt je toestemmingen in en verwijdert je sessies en je account. Je aanvragen
              blijven anoniem in onze statistieken staan, zonder je e-mailadres. Het gebeurt pas na een aparte
              bevestigingsstap; zonder die stap verandert er niets.
            </p>
            <div className="mt-4">
              <Link href="/account/opzeggen" className="text-sm font-semibold text-negatief underline underline-offset-4">
                Account opzeggen
              </Link>
            </div>
          </Blok>
        </div>
      </div>
    </div>
  );
}
