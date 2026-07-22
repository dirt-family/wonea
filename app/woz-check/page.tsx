import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, wozValues } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro, normalizePostcode } from "@/lib/util";
import { BronLabel, inputClass, Kaart, KnopPrimair, SectieLabel, Veld } from "@/components/ui";
import { WozVergelijker } from "./vergelijker";

export const metadata: Metadata = {
  title: "Gratis WOZ-check: klopt je WOZ-waarde met de markt?",
  description: "Vergelijk de WOZ-waarde van je beschikking met een eerlijke marktschatting. Gratis, zonder account. Wij verdienen niets aan WOZ-bezwaar.",
};

export default async function WozCheckPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string }>;
}) {
  const sp = await searchParams;
  const postcode = sp.postcode ? normalizePostcode(sp.postcode) : null;
  const nummerslug = sp.nummer?.toLowerCase().replace(/\s+/g, "") ?? null;

  let adres = null;
  if (postcode && nummerslug) {
    const kandidaat = db
      .select()
      .from(addresses)
      .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
      .get();
    if (kandidaat && kandidaat.status === "actief" && !isSuppressed(kandidaat.postcode, kandidaat.nummerslug)) {
      adres = kandidaat;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Gratis WOZ-check</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Je WOZ-waarde bepaalt je onroerendezaakbelasting. Wijkt hij flink af van de marktwaarde, dan kan bezwaar lonen. Dat
        doe je gratis en rechtstreeks bij je gemeente; Wonea verdient hier niets aan en stuurt je niet door naar een
        bezwaarbureau.
      </p>

      {!adres ? (
        <Kaart className="mt-8">
          <SectieLabel>Stap 1: zoek je adres</SectieLabel>
          <form method="get" className="mt-4 grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Veld label="Postcode">
              <input name="postcode" placeholder="1234 AB" required className={inputClass} defaultValue={sp.postcode ?? ""} />
            </Veld>
            <Veld label="Huisnummer">
              <input name="nummer" placeholder="12" required className={inputClass} defaultValue={sp.nummer ?? ""} />
            </Veld>
            <KnopPrimair type="submit">Zoek</KnopPrimair>
          </form>
          {postcode && nummerslug ? (
            <p className="mt-4 text-sm text-negatief">Dit adres staat niet op Wonea. Controleer je invoer.</p>
          ) : null}
        </Kaart>
      ) : (
        <WozResultaat adresId={adres.id} />
      )}
    </div>
  );
}

function WozResultaat({ adresId }: { adresId: number }) {
  const adres = db.select().from(addresses).where(eq(addresses.id, adresId)).get();
  if (!adres) return null;
  const { valuation } = getOrCreateValuation(adres);
  const woz = db.select().from(wozValues).where(eq(wozValues.adresId, adres.id)).orderBy(wozValues.peiljaar).all().at(-1);
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.postcode} ${adres.plaats}`;

  return (
    <div className="mt-8 space-y-5">
      <Kaart>
        <SectieLabel>Stap 2: jouw adres</SectieLabel>
        <p className="mt-2 text-lg font-semibold">{naam}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gedempt">Marktschatting Wonea</p>
            {valuation ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
                <p className="mt-1 text-xs text-gedempt">
                  bandbreedte {formatEuro(valuation.intervalLaag)} tot {formatEuro(valuation.intervalHoog)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-inkt-zacht">Nog geen eerlijke schatting mogelijk voor dit adres.</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gedempt">Bekende WOZ-waarde</p>
            {woz ? (
              <>
                <p className="mt-1 font-display text-2xl font-semibold text-merk">{formatEuro(woz.waarde)}</p>
                <p className="mt-1 text-xs text-gedempt">peiljaar {woz.peiljaar}</p>
                {woz.bron === "seed" ? <p className="mt-2"><BronLabel>voorbeeldwaarde, niet je echte WOZ</BronLabel></p> : null}
              </>
            ) : (
              <p className="mt-1 text-sm text-inkt-zacht">Wij tonen geen WOZ zonder bron. Vul hieronder die van je beschikking in.</p>
            )}
          </div>
        </div>
      </Kaart>

      {valuation ? (
        <Kaart>
          <SectieLabel>Stap 3: vergelijk met je beschikking</SectieLabel>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Vul de WOZ-waarde van je eigen beschikking in. We vergelijken ter plekke en slaan niets op: invullen op andermans
            adres heeft dus geen zin, en jouw invoer belandt nergens in een database. WOZ vastleggen en volgen kan straks wel,
            maar alleen voor je eigen geclaimde woning.
          </p>
          <WozVergelijker marktwaarde={valuation.waarde} intervalLaag={valuation.intervalLaag} intervalHoog={valuation.intervalHoog} />
        </Kaart>
      ) : null}

      <Kaart className="bg-merk-wash">
        <SectieLabel>Bezwaar maken?</SectieLabel>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Ligt je WOZ duidelijk boven de bandbreedte, dan kan bezwaar zinvol zijn. Doe dat binnen zes weken na de beschikking,
          gratis via de site van je gemeente. Bureaus die het "gratis" voor je doen worden betaald uit gemeenschapsgeld en
          sinds 2024 flink beperkt; je hebt ze niet nodig.
        </p>
        <Link href={`/woning/${adres.postcode}/${adres.nummerslug}`} className="mt-4 inline-block text-sm font-semibold text-merk underline underline-offset-4">
          Bekijk de volledige woningpagina
        </Link>
      </Kaart>
    </div>
  );
}
