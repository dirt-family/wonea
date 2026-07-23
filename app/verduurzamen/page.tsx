import type { Metadata } from "next";
import Link from "next/link";
import { adresNaam, vindVerduurzaamAdres } from "@/app/verduurzamen/logic";
import { VERTICAAL_SLUGS, VERTICALEN } from "@/app/verduurzamen/verticalen";
import { BronLabel, inputClass, Kaart, KnopPrimair, SectieLabel, Veld } from "@/components/ui";

export const metadata: Metadata = { title: "Verduurzamen: wat levert het jouw huis op?", robots: { index: false, follow: false } };

/**
 * Ingang van de verduurzamingsfunnel. Met adres (searchParams postcode +
 * nummer, zoals de link op de woningpagina): energielabel met bronlabel,
 * eerlijke uitleg en de keuze uit drie verticalen. Zonder adres: eerst
 * adres zoeken. Suppressie loopt via vindVerduurzaamAdres.
 */

export default async function VerduurzamenPagina({
  searchParams,
}: {
  searchParams: Promise<{ postcode?: string; nummer?: string }>;
}) {
  const sp = await searchParams;
  const heeftParams = Boolean(sp.postcode && sp.nummer);
  const adres = heeftParams ? await vindVerduurzaamAdres(sp.postcode!, sp.nummer!) : null;
  const adresQuery = adres ? `postcode=${adres.postcode}&nummer=${encodeURIComponent(adres.nummerslug)}` : "";
  const label = adres?.energielabel?.toUpperCase() ?? null;
  const labelGoed = label !== null && ["A", "B"].includes(label);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> / Verduurzamen
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Verduurzamen: wat levert het jouw huis op?</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Verduurzamen verlaagt je energierekening, maakt je huis comfortabeler en een beter energielabel telt mee in de
        waarde. Wat zinvol is verschilt per huis; daarom beginnen we bij jouw adres.
      </p>

      {!adres ? (
        <>
          {heeftParams ? (
            <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
              Dit adres staat niet (meer) op Wonea. Controleer de postcode en het huisnummer.
            </p>
          ) : null}
          <Kaart className="mt-8 max-w-2xl">
            <SectieLabel>Eerst je adres</SectieLabel>
            <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
              We gebruiken je adres alleen om het energielabel en het bouwjaar op te halen; zo krijg je vragen die bij
              jouw huis passen.
            </p>
            <form method="get" action="/verduurzamen" className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Veld label="Postcode">
                  <input name="postcode" defaultValue={sp.postcode ?? ""} placeholder="1234 AB" required className={inputClass} />
                </Veld>
                <Veld label="Huisnummer" hint="Met toevoeging, bv. 12a of 12-2">
                  <input name="nummer" defaultValue={sp.nummer ?? ""} placeholder="12" required className={inputClass} />
                </Veld>
              </div>
              <KnopPrimair type="submit">Bekijk mijn energielabel</KnopPrimair>
            </form>
          </Kaart>
        </>
      ) : (
        <>
          <Kaart className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <SectieLabel>Energielabel van {adresNaam(adres)}</SectieLabel>
                <div className="mt-3 flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-merk font-display text-3xl font-semibold text-white">
                    {label ?? "?"}
                  </span>
                  <div>
                    {label ? (
                      adres.energielabelBron === "indicatie" ? (
                        <BronLabel>indicatie op basis van bouwjaar {adres.bouwjaar}, geen gemeten label</BronLabel>
                      ) : (
                        <BronLabel>geregistreerd label</BronLabel>
                      )
                    ) : (
                      <BronLabel>geen label bekend</BronLabel>
                    )}
                    <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                      {label
                        ? labelGoed
                          ? `Label ${label} is al goed. Verduurzamen levert dan vooral comfort en een lagere rekening op, geen grote waardesprong.`
                          : `Met label ${label} valt er wat te winnen: een lagere energierekening, meer comfort en een beter label telt mee in de waarde.`
                        : "Zonder bekend label kunnen we alleen op bouwjaar afgaan. De vragen hierna helpen om te zien wat zinvol is."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-sm">
                <Link href={`/woning/${adres.postcode}/${adres.nummerslug}`} className="font-semibold text-merk underline underline-offset-4">
                  Naar de woningpagina
                </Link>
                <br />
                <Link href="/verduurzamen" className="mt-2 inline-block text-gedempt underline underline-offset-4 hover:text-merk">
                  Ander adres kiezen
                </Link>
              </div>
            </div>
          </Kaart>

          <h2 className="mt-10 text-2xl font-semibold">Kies waar je mee wilt beginnen</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            Voor veel maatregelen bestaat ISDE-subsidie; die vraag je aan via de RVO. Of en hoeveel jij krijgt hangt af
            van je situatie, dus daar beloven we hier niets over.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {VERTICAAL_SLUGS.map((slug) => {
              const v = VERTICALEN[slug];
              return (
                <Kaart key={slug} className="flex flex-col">
                  <h3 className="text-lg font-semibold">{v.titel}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-inkt-zacht">{v.kaartZin}</p>
                  <Link
                    href={`/verduurzamen/${slug}?${adresQuery}`}
                    className="mt-4 inline-flex items-center justify-center self-start rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk"
                  >
                    Start met {v.titel.toLowerCase()}
                  </Link>
                </Kaart>
              );
            })}
          </div>
          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-gedempt">
            Een paar korte vragen, daarna vraag je vrijblijvend een voorstel aan. We geven je aanvraag alleen door als
            jij daar expliciet toestemming voor geeft, en in deze testfase wordt er nog niets echt doorgestuurd.
          </p>
        </>
      )}
    </div>
  );
}
