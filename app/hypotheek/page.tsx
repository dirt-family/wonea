import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro, normalizePostcode } from "@/lib/util";
import { Kaart, KnopSecundair, SectieLabel } from "@/components/ui";
import { HypotheekStepper, type StepperWaarde } from "@/app/hypotheek/stepper";
import { HYPOTHEEK_SUBTYPES, isHypotheekSubtype, SUBTYPE_META } from "@/app/hypotheek/schema";

export const metadata: Metadata = { title: "Hypotheekadvies aanvragen", robots: { index: false, follow: false } };

/**
 * Hypotheekfunnel (Fase 4.1). Startpagina met drie ingangen die het subtype
 * bepalen; per subtype een korte stepper met kwalificatievragen en als
 * laatste stap e-mail + consent. Dashboard en adrespagina kunnen subtype en
 * adres voorkiezen via searchParams (subtype, postcode, nummer).
 */

type SearchParams = { subtype?: string; postcode?: string; nummer?: string; fout?: string };

async function vindAdres(postcodeInput?: string, nummerInput?: string) {
  if (!postcodeInput || !nummerInput) return null;
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
  // Suppressie is leidend: een verwijderd adres tonen we nergens, ook hier niet.
  if (adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug))) return null;
  return adres;
}

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw.",
  ongeldig: "Controleer je antwoorden en probeer het opnieuw.",
  consent: "Zonder jouw toestemming geven we niets door. Vink het akkoord aan als je de aanvraag wilt versturen.",
  "adres-verwijderd":
    "Dit adres is op verzoek verwijderd van Wonea. Daarom maken we er geen aanvraag voor aan. Je kunt de vragen wel zonder adres beantwoorden.",
};

export default async function HypotheekPagina({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const adres = await vindAdres(sp.postcode, sp.nummer);
  const adresQuery = adres ? `&postcode=${adres.postcode}&nummer=${adres.nummerslug}` : "";
  const foutmelding = sp.fout ? (FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw.") : null;

  // Zonder (geldig) subtype: de startpagina met de drie ingangen.
  if (!isHypotheekSubtype(sp.subtype)) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Hypotheekvraag? Begin bij je situatie</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Kies hieronder wat op jou van toepassing is en beantwoord een paar korte vragen. Alleen als jij dat in de laatste
          stap goedkeurt, geven we je aanvraag door aan een onafhankelijke hypotheekadviseur. Gratis, zonder account, en je
          zit nergens aan vast.
        </p>

        {foutmelding ? (
          <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{foutmelding}</p>
        ) : null}

        {adres ? (
          <p className="mt-4 text-sm text-inkt-zacht">
            Je startte vanaf{" "}
            <strong>
              {adres.straat} {adres.huisnummer}
              {adres.toevoeging ? ` ${adres.toevoeging}` : ""}, {adres.plaats}
            </strong>
            . Dat adres nemen we mee in je aanvraag.
          </p>
        ) : null}

        <div className="mt-8 space-y-5">
          {HYPOTHEEK_SUBTYPES.map((subtype) => {
            const meta = SUBTYPE_META[subtype];
            return (
              <Kaart key={subtype}>
                <SectieLabel>{meta.titel}</SectieLabel>
                <h2 className="mt-2 text-lg font-semibold">{meta.vraag}</h2>
                <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">{meta.omschrijving}</p>
                <div className="mt-4">
                  <KnopSecundair href={`/hypotheek?subtype=${subtype}${adresQuery}`}>Beantwoord de vragen</KnopSecundair>
                </div>
              </Kaart>
            );
          })}
        </div>

        <p className="mt-8 text-sm leading-relaxed text-gedempt">
          Eerlijk is eerlijk: Wonea is geen hypotheekadviseur en geeft geen advies. Wij stellen de vragen die een adviseur
          nodig heeft en geven je aanvraag alleen met jouw toestemming door.
        </p>
      </div>
    );
  }

  const subtype = sp.subtype;
  const meta = SUBTYPE_META[subtype];

  // Bekend adres: Wonea-waarde als context; in de overwaarde-flow rekent de
  // stepper er de overwaarde mee voor (met bandbreedte, gelabeld als indicatie).
  let waarde: StepperWaarde | null = null;
  if (adres) {
    const { valuation } = await getOrCreateValuation(adres);
    if (valuation) waarde = { waarde: valuation.waarde, laag: valuation.intervalLaag, hoog: valuation.intervalHoog };
  }
  const adresNaam = adres
    ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}`
    : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href={`/hypotheek${adresQuery ? `?${adresQuery.slice(1)}` : ""}`} className="hover:text-merk">
          Hypotheek
        </Link>{" "}
        / {meta.titel}
      </nav>
      <h1 className="mt-3 text-3xl font-semibold">{meta.vraag}</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Een paar korte vragen. Daarna beslis jij of we je aanvraag doorgeven aan een onafhankelijke hypotheekadviseur.
      </p>

      {foutmelding ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{foutmelding}</p>
      ) : null}

      {adres && adresNaam ? (
        <Kaart className="mt-8 bg-merk-wash">
          <SectieLabel>Je aanvraag gaat over</SectieLabel>
          <p className="mt-2 text-lg font-semibold text-inkt">{adresNaam}</p>
          {waarde ? (
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Wonea-waarde: <strong className="text-merk">{formatEuro(waarde.waarde)}</strong>, bandbreedte{" "}
              {formatEuro(waarde.laag)} tot {formatEuro(waarde.hoog)}. Een modelmatige indicatie, geen taxatie.
            </p>
          ) : null}
          <Link
            href={`/hypotheek?subtype=${subtype}`}
            className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4"
          >
            Niet jouw adres? Ga verder zonder adres
          </Link>
        </Kaart>
      ) : null}

      <Kaart className="mt-5">
        <HypotheekStepper
          subtype={subtype}
          adres={adres ? { naam: adresNaam!, postcode: adres.postcode, nummerslug: adres.nummerslug } : null}
          waarde={waarde}
        />
      </Kaart>
    </div>
  );
}
