import type { Metadata } from "next";
import { Zoekbalk } from "@/components/zoekbalk";
import { LegeStaat, Pil, PromoBlok } from "@/components/ui";
import { MiniWaardePreview } from "@/components/marketing/mini-waarde-preview";
import { CtaKaarten } from "@/components/marketing/cta-kaarten";
import { Bronnenstrip } from "@/components/marketing/bronnenstrip";
import { WoningenRij } from "@/components/marketing/woningen-rij";
import { FeatureKaarten } from "@/components/marketing/feature-kaarten";
import { Vertrouwen } from "@/components/marketing/vertrouwen";
import { StatistiekenBand } from "@/components/marketing/statistieken-band";
import { PlaatsenTicker } from "@/components/marketing/plaatsen-ticker";
import { getHomepageStats, getPlaatsen, getVoorbeeldWoning, getWoningenRij } from "@/lib/homepage-data";

/**
 * Homepage volgens de structuur-blauwdruk in docs/BRAND.md: hero met echte
 * mini-preview, CTA-kaarten, bronnenstrip, woningen-rij, feature-kaarten,
 * vertrouwenssectie, statistieken-band (de ene donkere band), plaatsen-ticker.
 *
 * force-dynamic: de pagina toont live databasedata (tellingen, waardes) en we
 * willen geen databasewerk tijdens `next build` (zelfde principe als de
 * woningpagina's, die met lege generateStaticParams niets prerenderen).
 */
export const dynamic = "force-dynamic";

// Titel en description erven bewust van de root (geen duplicaat); hier alleen
// expliciete robots en de canonical voor de homepage.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const [voorbeeld, stats, plaatsen] = await Promise.all([getVoorbeeldWoning(), getHomepageStats(), getPlaatsen()]);
  // Na getVoorbeeldWoning, zodat een vers aangemaakte valuation meetelt in de rij.
  const woningen = await getWoningenRij(8);

  return (
    <div>
      {/* 1. Hero: split, met de amber gradient-wash bovenin (huisstijl v3) en
          de zoekbalk als zwevend element. Rechts de echte mini-preview,
          opgetild met de grote gelaagde schaduw. */}
      <section className="relative" style={{ backgroundImage: "var(--gradient-hero-wash)" }}>
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 lg:grid-cols-[1fr_400px] lg:py-24">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold sm:text-6xl">Wat je huis waard is, en waarom</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-inkt-zacht">
              Geen zwevend getal, maar een eerlijke bandbreedte met de verkopen eronder en een methode die we gewoon
              uitleggen.
            </p>
            <div className="mt-8">
              <Zoekbalk />
            </div>
            <p className="mt-4"><Pil variant="amber">Gratis en zonder account</Pil></p>
          </div>
          <div className="hidden lg:block">
            {voorbeeld ? (
              <MiniWaardePreview voorbeeld={voorbeeld} />
            ) : (
              <LegeStaat
                titel="Nog geen voorbeeldadres"
                tekst="Zodra het testgebied gevuld is, staat hier een echte woningwaarde-preview met bandbreedte."
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. Twee CTA-kaarten (budget en WOZ-check) met ernaast het ene lime
          promo-moment van deze pagina (flux-echo, BRAND.md "Flux-kleurlaag"):
          functioneel, de claim-flow. De arbitrary variant [&>a]:mt-auto duwt
          de zwarte pill-knop naar de onderrand van het gestrekte blok. */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid items-stretch gap-5 lg:grid-cols-[1.7fr_1fr]">
          <CtaKaarten />
          <PromoBlok
            titel="Volg je eigen woning"
            tekst="Claim je adres en volg de waarde vanuit je eigen dashboard. Gratis, en opzeggen kan altijd."
            knopTekst="Claim je woning"
            href="/claim"
            illustratie="rapport"
            className="flex h-full flex-col [&>a]:mt-auto"
          />
        </div>
      </section>

      {/* 3. Bronnenstrip: echte open bronnen, geen verzonnen social proof. */}
      <Bronnenstrip />

      {/* 4. Woningen-rij: horizontaal scrollende kaarten met echte adressen. */}
      <div className="reveal">
        <WoningenRij woningen={woningen} />
      </div>

      {/* 5. Drie feature-kaarten met echte mini-previews. */}
      <div className="reveal">
        <FeatureKaarten voorbeeld={voorbeeld} />
      </div>

      {/* 6. Volle-breedte vertrouwenssectie. */}
      <Vertrouwen />

      {/* 7. Statistieken-band: de ene donkere band, echte cijfers. */}
      <StatistiekenBand stats={stats} />

      {/* 8. Plaatsen-ticker: de enige marquee op de site. */}
      <PlaatsenTicker plaatsen={plaatsen} />
    </div>
  );
}
