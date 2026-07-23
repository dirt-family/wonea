import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@/components/analytics";
import { WoneaLogo } from "@/components/logo";
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
    <div className="bg-accent-wash px-5 py-2 text-center text-sm text-inkt">
      Openbare testversie: alle woningen en waardes zijn voorbeelddata, en e-mailfuncties staan nog uit.
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-lijn bg-paneel">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-merk">
          <WoneaLogo className="h-7 w-7" />
          Wonea
        </Link>
        <nav className="flex items-center gap-5 text-sm text-inkt-zacht">
          <Link href="/tools" className="transition-colors hover:text-merk">
            Rekenhulpen
          </Link>
          <Link href="/woningmarkt" className="transition-colors hover:text-merk">
            Woningmarkt
          </Link>
          <Link href="/woz-check" className="hidden transition-colors hover:text-merk sm:inline">
            WOZ-check
          </Link>
          <Link href="/methode" className="hidden transition-colors hover:text-merk sm:inline">
            Onze methode
          </Link>
          <Link href="/over-ons" className="hidden transition-colors hover:text-merk md:inline">
            Over Wonea
          </Link>
          <Link
            href="/claim"
            className="rounded-full border border-merk px-4 py-1.5 font-semibold text-merk transition-colors hover:bg-merk hover:text-white"
          >
            Mijn woning
          </Link>
        </nav>
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

async function Footer() {
  const plaatsen = await veiligePlaatsen();
  return (
    <footer className="mt-16 border-t border-lijn bg-paneel">
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 text-sm text-inkt-zacht sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-bold text-merk">
            <WoneaLogo className="h-6 w-6" />
            Wonea
          </p>
          <p className="mt-2 max-w-xs leading-relaxed">
            Eerlijk inzicht in woningwaarde: altijd met bandbreedte, bronnen en uitleg. Jouw huis, jouw data.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-inkt">Rekenhulpen</p>
          <p><Link href="/tools" className="hover:text-merk">Alle rekenhulpen</Link></p>
          <p><Link href="/budget" className="hover:text-merk">Budgetberekenaar</Link></p>
          <p><Link href="/woz-check" className="hover:text-merk">Gratis WOZ-check</Link></p>
          <p><Link href="/hypotheek-rentes" className="hover:text-merk">Actuele hypotheekrentes</Link></p>
          <p><Link href="/kosten-koper" className="hover:text-merk">Kosten koper</Link></p>
          <p><Link href="/overbieden" className="hover:text-merk">Overbieden</Link></p>
          <p><Link href="/verduurzamen" className="hover:text-merk">Verduurzamingscheck</Link></p>
          <p><Link href="/makelaars" className="hover:text-merk">Vind een makelaar</Link></p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-inkt">Wonea</p>
          <p><Link href="/zoeken" className="hover:text-merk">Woningen zoeken</Link></p>
          <p><Link href="/vergelijken" className="hover:text-merk">Woningen vergelijken</Link></p>
          <p><Link href="/gids" className="hover:text-merk">Woongids</Link></p>
          <p><Link href="/methode" className="hover:text-merk">Hoe we rekenen</Link></p>
          <p><Link href="/over-ons" className="hover:text-merk">Over ons</Link></p>
          <p><Link href="/claim" className="hover:text-merk">Mijn woning</Link></p>
          <p><Link href="/woningmarkt" className="hover:text-merk">Woningmarkt</Link></p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-inkt">Jouw data</p>
          <p><Link href="/privacy" className="hover:text-merk">Privacy</Link></p>
          <p><Link href="/verwijderen" className="hover:text-merk">Je woning verwijderen</Link></p>
          <p className="text-xs leading-relaxed text-gedempt">
            Verwijderen kan altijd, in twee stappen, zonder account.
          </p>
        </div>
      </div>

      <div className="border-t border-lijn">
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-2 px-5 py-4 text-sm text-inkt-zacht">
          <p className="font-semibold text-inkt">Woningmarkt</p>
          {plaatsen.map((p) => (
            <Link key={p.slug} href={`/woningmarkt/${p.slug}`} className="hover:text-merk">
              {p.naam}
            </Link>
          ))}
          <Link href="/woningmarkt" className="font-medium text-merk hover:underline">
            Bekijk alle plaatsen
          </Link>
        </div>
      </div>

      <div className="border-t border-lijn">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-xs text-gedempt">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/privacy" className="hover:text-merk">Privacy</Link>
            <Link href="/methode" className="hover:text-merk">Methode</Link>
            <Link href="/verwijderen" className="hover:text-merk">Verwijderen</Link>
          </div>
          <p>
            Makelaarsdata:{" "}
            <a href={OSM_COPYRIGHT_URL} className="underline underline-offset-2 hover:text-merk" rel="noreferrer">
              {OSM_ATTRIBUTIE}
            </a>
          </p>
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
