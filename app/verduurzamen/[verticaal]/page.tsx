import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adresNaam, vindVerduurzaamAdres } from "@/app/verduurzamen/logic";
import { isVerticaal, VERTICALEN } from "@/app/verduurzamen/verticalen";
import { BronLabel } from "@/components/ui";
import { VerduurzaamStepper } from "./stepper";

/**
 * Stepper-pagina voor een verticaal (zonnepanelen, warmtepomp, isolatie).
 * Vereist een geldig, niet-gesupprimeerd adres via searchParams; anders
 * terug naar de verduurzamen-ingang om eerst een adres te kiezen.
 */

type Params = { verticaal: string };
type Zoek = { postcode?: string; nummer?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { verticaal } = await params;
  if (!isVerticaal(verticaal)) return { title: "Niet gevonden" };
  return { title: `${VERTICALEN[verticaal].titel} aanvragen` };
}

export default async function VerticaalPagina({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Zoek>;
}) {
  const { verticaal } = await params;
  if (!isVerticaal(verticaal)) notFound();
  const config = VERTICALEN[verticaal];

  const sp = await searchParams;
  const adres = sp.postcode && sp.nummer ? vindVerduurzaamAdres(sp.postcode, sp.nummer) : null;
  if (!adres) {
    const qs = new URLSearchParams();
    if (sp.postcode) qs.set("postcode", sp.postcode);
    if (sp.nummer) qs.set("nummer", sp.nummer);
    const query = qs.toString();
    redirect(query ? `/verduurzamen?${query}` : "/verduurzamen");
  }

  const naam = adresNaam(adres);
  const adresQuery = `postcode=${adres.postcode}&nummer=${encodeURIComponent(adres.nummerslug)}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> /{" "}
        <Link href={`/verduurzamen?${adresQuery}`} className="hover:text-merk">Verduurzamen</Link> / {config.titel}
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{config.titel} voor {naam}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-inkt-zacht">
        {adres.energielabel ? (
          <>
            Energielabel {adres.energielabel}
            {adres.energielabelBron === "indicatie" ? <BronLabel>indicatie op basis van bouwjaar</BronLabel> : <BronLabel>geregistreerd label</BronLabel>}
          </>
        ) : (
          <>Geen energielabel bekend</>
        )}
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-inkt-zacht">{config.kaartZin}</p>

      <VerduurzaamStepper
        verticaal={verticaal}
        adresNaam={naam}
        postcode={adres.postcode}
        nummerslug={adres.nummerslug}
        bouwjaar={adres.bouwjaar}
      />

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-gedempt">
        Vrijblijvend: je zit nergens aan vast en we geven niets door zonder jouw expliciete toestemming in de laatste
        stap. Liever een andere maatregel?{" "}
        <Link href={`/verduurzamen?${adresQuery}`} className="underline underline-offset-2 hover:text-merk">
          Terug naar het overzicht
        </Link>
        .
      </p>
    </div>
  );
}
