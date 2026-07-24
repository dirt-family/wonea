import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@/components/analytics";
import { WoneaLogo } from "@/components/logo";
import { HeaderNav } from "@/app/header-nav";
import "@fontsource-variable/inter";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "./globals.css";
import { jsonLdScriptProps, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { getPlaatsen, type PlaatsLink } from "@/lib/homepage-data";
import { OSM_ATTRIBUTIE, OSM_COPYRIGHT_URL } from "@/lib/bronnen/makelaars";
import { baseUrl } from "@/lib/util";

export const metadata: Metadata = {
  // metadataBase maakt relatieve metadata-URL's (og:image, canonicals)
  // absoluut; baseUrl leest WONEA_BASE_URL en hoort in productie op
  // https://www.wonea.nl te staan.
  metadataBase: new URL(baseUrl()),
  title: {
    default: "Wonea | Eerlijk inzicht in je woningwaarde",
    template: "%s | Wonea",
  },
  description:
    "Wonea toont de geschatte waarde van elke woning met een eerlijke bandbreedte, de verkopen erachter en een uitgelegde methode. Jouw huis, jouw data.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  // Geen globale robots-regel meer: adres- en buurtpagina's beslissen via de
  // indexatie-gating (lib/seo/gating.ts); alle overige pagina's dragen hun
  // eigen expliciete robots-metadata.
};

function BetaBanner() {
  return (
    <div className="border-b border-accent-200 bg-accent-wash px-5 py-2 text-center text-sm text-accent-900">
      <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full bg-accent-500 align-middle" />
      Openbare testversie: alle woningen en waardes zijn voorbeelddata, en e-mailfuncties staan nog uit.
    </div>
  );
}

/**
 * Header v3: zwevend gevoel via translucent paneel + backdrop-blur + gelaagde
 * schaduw (shadow-zweef-md); het gradient-logo is het merkmoment. Actieve
 * navigatie-staten zitten in HeaderNav (client, app/header-nav.tsx).
 */
function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-lijn/70 bg-paneel/85 shadow-zweef-md backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-2xl font-bold text-merk-900 focus:outline-2 focus:outline-offset-2 focus:outline-merk"
        >
          <WoneaLogo className="h-9 w-9" />
          Wonea
        </Link>
        <HeaderNav />
      </div>
    </header>
  );
}

/**
 * Plaatsen voor de footer-regel "Woningmarkt". Faalt stil: zonder database
 * (bijvoorbeeld tijdens een build zonder DATABASE_URL) valt de regel terug op
 * alleen de link naar het overzicht.
 */
async function veiligePlaatsen(): Promise<PlaatsLink[]> {
  try {
    return await getPlaatsen();
  } catch {
    return [];
  }
}

/**
 * Mega-footer v3: navy-wash canvas (bewust een wash, geen donkere band; het
 * thema-slot laat max 1 merk-900-band per pagina en die is van de pagina's
 * zelf). Sectie-scheider met het mono-motief erboven, gradient-logo als
 * merkmoment in de merkkolom.
 */
async function Footer() {
  const plaatsen = await veiligePlaatsen();
  const kolomKop = "text-xs font-semibold uppercase tracking-[0.12em] text-merk";
  const voetLink = "text-inkt-zacht transition-colors hover:text-merk";
  return (
    <footer className="mt-16">
      <div aria-hidden="true" className="mx-auto flex max-w-5xl items-center gap-4 px-5 pb-5">
        <span className="h-px flex-1 bg-lijn" />
        <WoneaLogo variant="mono" className="h-5 w-5 text-merk-300" />
        <span className="h-px flex-1 bg-lijn" />
      </div>

      <div className="border-t border-merk-100 bg-wash-navy">
        <div className="mx-auto grid max-w-5xl gap-x-8 gap-y-10 px-5 py-12 text-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2.5 font-display text-xl font-bold text-merk-900">
              <WoneaLogo className="h-8 w-8" />
              Wonea
            </p>
            <p className="mt-3 max-w-xs leading-relaxed text-inkt-zacht">
              Eerlijk inzicht in woningwaarde: altijd met bandbreedte, bronnen en uitleg. Jouw huis, jouw data.
            </p>
          </div>
          <div className="space-y-2.5">
            <p className={kolomKop}>Rekenhulpen</p>
            <p><Link href="/tools" className={voetLink}>Alle rekenhulpen</Link></p>
            <p><Link href="/budget" className={voetLink}>Budgetberekenaar</Link></p>
            <p><Link href="/woz-check" className={voetLink}>Gratis WOZ-check</Link></p>
            <p><Link href="/hypotheek-rentes" className={voetLink}>Actuele hypotheekrentes</Link></p>
            <p><Link href="/kosten-koper" className={voetLink}>Kosten koper</Link></p>
            <p><Link href="/overbieden" className={voetLink}>Overbieden</Link></p>
            <p><Link href="/verduurzamen" className={voetLink}>Verduurzamingscheck</Link></p>
            <p><Link href="/makelaars" className={voetLink}>Vind een makelaar</Link></p>
          </div>
          <div className="space-y-2.5">
            <p className={kolomKop}>Wonea</p>
            <p><Link href="/zoeken" className={voetLink}>Woningen zoeken</Link></p>
            <p><Link href="/vergelijken" className={voetLink}>Woningen vergelijken</Link></p>
            <p><Link href="/gids" className={voetLink}>Woongids</Link></p>
            <p><Link href="/methode" className={voetLink}>Hoe we rekenen</Link></p>
            <p><Link href="/over-ons" className={voetLink}>Over ons</Link></p>
            <p><Link href="/claim" className={voetLink}>Mijn woning</Link></p>
            <p><Link href="/woningmarkt" className={voetLink}>Woningmarkt</Link></p>
          </div>
          <div className="space-y-2.5">
            <p className={kolomKop}>Jouw data</p>
            <p><Link href="/privacy" className={voetLink}>Privacy</Link></p>
            <p><Link href="/verwijderen" className={voetLink}>Je woning verwijderen</Link></p>
            <p className="text-xs leading-relaxed text-inkt-zacht">
              Verwijderen kan altijd, in twee stappen, zonder account.
            </p>
          </div>
        </div>

        <div className="border-t border-merk-100">
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-2 px-5 py-4 text-sm">
            <p className={kolomKop}>Woningmarkt</p>
            {plaatsen.map((p) => (
              <Link key={p.slug} href={`/woningmarkt/${p.slug}`} className={voetLink}>
                {p.naam}
              </Link>
            ))}
            <Link href="/woningmarkt" className="font-medium text-merk hover:underline">
              Bekijk alle plaatsen
            </Link>
          </div>
        </div>

        <div className="border-t border-merk-100">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-xs text-inkt-zacht">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <Link href="/privacy" className={voetLink}>Privacy</Link>
              <Link href="/methode" className={voetLink}>Methode</Link>
              <Link href="/verwijderen" className={voetLink}>Verwijderen</Link>
            </div>
            <p>
              Makelaarsdata:{" "}
              <a href={OSM_COPYRIGHT_URL} className="underline underline-offset-2 transition-colors hover:text-merk" rel="noreferrer">
                {OSM_ATTRIBUTIE}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen">
        <script {...jsonLdScriptProps(organizationJsonLd())} />
        <script {...jsonLdScriptProps(websiteJsonLd())} />
        <BetaBanner />
        <Header />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
