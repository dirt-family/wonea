import type { Metadata } from "next";
import Link from "next/link";
import { allePlaatsen } from "@/lib/woningmarkt";
import { breadcrumbJsonLd, jsonLdScriptProps, type Kruimel } from "@/lib/seo/jsonld";
import { baseUrl, formatEuro } from "@/lib/util";
import { IcoonRondje, LegeStaat } from "@/components/ui";

/**
 * /woningmarkt: overzicht van alle plaatsen met een eigen plaatspagina.
 * Interne linklaag (home > woningmarkt > plaats > buurt > woning), zelfde
 * skelet als de plaatsenstructuur van de marktleiders. Puur leeswerk, dus
 * ISR met 24 uur cache; noindex tot de indexatie-gating dit vrijgeeft.
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Woningmarkt per plaats",
  description:
    "Bekijk per plaats de buurten, gemiddelde WOZ-waarden en recente verkopen, met bronnen en uitleg bij elk cijfer.",
  robots: { index: false, follow: true },
};

export default async function WoningmarktOverzicht() {
  const plaatsen = await allePlaatsen();

  const kruimels: Kruimel[] = [
    { naam: "Wonea", url: `${baseUrl()}/` },
    { naam: "Woningmarkt", url: `${baseUrl()}/woningmarkt` },
  ];

  return (
    <div>
      <script {...jsonLdScriptProps(breadcrumbJsonLd(kruimels))} />

      {/* Navy hero-wash (v3): koele adem boven de datahub, vervloeit naar de achtergrond. */}
      <div style={{ backgroundImage: "var(--gradient-hero-wash-navy)" }}>
        <div className="mx-auto max-w-5xl px-5 pt-10">
          <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
            <Link href="/" className="hover:text-merk">Wonea</Link> / Woningmarkt
          </nav>

          <h1 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">De woningmarkt per plaats</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
            Kies een plaats en zie de buurten, de gemiddelde WOZ-waarden en de recente verkopen. Elk cijfer komt met
            zijn bron, en een schatting is bij ons altijd een bandbreedte.
          </p>
          {plaatsen.length === 1 && plaatsen[0] ? (
            <p className="mt-2 max-w-2xl text-sm text-gedempt">
              We beginnen in {plaatsen[0].naam}; meer plaatsen volgen.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 pb-10">
      {plaatsen.length > 0 ? (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plaatsen.map((plaats) => (
              <Link
                key={plaats.code}
                href={`/woningmarkt/${plaats.slug}`}
                className="til-op block rounded-[14px] border border-lijn bg-paneel p-6 shadow-zweef focus:outline-2 focus:outline-offset-2 focus:outline-merk"
              >
                <div className="flex items-center gap-3">
                  <IcoonRondje naam="locatie" tint="merk" />
                  <h2 className="text-xl font-semibold">{plaats.naam}</h2>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gedempt">Woningen in beeld</dt>
                    <dd className="font-medium text-inkt">{plaats.aantalWoningen.toLocaleString("nl-NL")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gedempt">Buurten</dt>
                    <dd className="font-medium text-inkt">{plaats.aantalBuurten.toLocaleString("nl-NL")}</dd>
                  </div>
                  {plaats.gemWoz != null ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gedempt">Gemiddelde WOZ</dt>
                      <dd className="font-medium text-inkt">{formatEuro(plaats.gemWoz)}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-4 text-sm font-semibold text-merk">Bekijk de woningmarkt &#8250;</p>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-gedempt">
            Gemiddelde WOZ per plaats is het gemiddelde van de buurtcijfers van het CBS.
          </p>
        </>
      ) : (
        <div className="mt-8">
          <LegeStaat
            titel="Nog geen plaatsen beschikbaar"
            tekst="We vullen de woningmarkt-pagina's plaats voor plaats, zodra de data van een gebied op orde is. Kom later terug of zoek een adres via de homepage."
          />
        </div>
      )}
      </div>
    </div>
  );
}
