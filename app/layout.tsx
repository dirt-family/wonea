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

export const metadata: Metadata = {
  title: {
    default: "Wonea | Eerlijk inzicht in je woningwaarde",
    template: "%s | Wonea",
  },
  description:
    "Wonea toont de geschatte waarde van elke woning met een eerlijke bandbreedte, de verkopen waarop die is gebaseerd en een uitgelegde methode. Jouw huis, jouw data.",
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
          <Link href="/woz-check" className="transition-colors hover:text-merk">
            WOZ-check
          </Link>
          <Link href="/methode" className="transition-colors hover:text-merk">
            Onze methode
          </Link>
          <Link href="/over-ons" className="transition-colors hover:text-merk">
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

function Footer() {
  return (
    <footer className="mt-16 border-t border-lijn bg-paneel">
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 text-sm text-inkt-zacht sm:grid-cols-3">
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
          <p className="font-semibold text-inkt">Wonea</p>
          <p><Link href="/methode" className="hover:text-merk">Hoe we rekenen</Link></p>
          <p><Link href="/over-ons" className="hover:text-merk">Over ons</Link></p>
          <p><Link href="/woz-check" className="hover:text-merk">Gratis WOZ-check</Link></p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-inkt">Jouw data</p>
          <p><Link href="/privacy" className="hover:text-merk">Privacy</Link></p>
          <p><Link href="/privacy#verwijderen" className="hover:text-merk">Je woning verwijderen</Link></p>
          <p className="text-xs leading-relaxed text-gedempt">
            Verwijderen kan altijd, in twee stappen, zonder account.
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
