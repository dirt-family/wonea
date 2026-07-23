import type { Metadata } from "next";
import Link from "next/link";
import { Bandbreedte, BronLabel, Kaart } from "@/components/ui";
import { WoneaLogo } from "@/components/logo";
import { Zoekbalk } from "@/components/zoekbalk";
import { MODEL_VERSIE } from "@/lib/avm";
import { getActueleRentes, peilmaandLabel } from "@/lib/bronnen/rentes";
import { ISDE_PEILDATUM, ISDE_WARMTEPOMPEN } from "@/lib/normen/isde-2026";
import { NHG_GRENS_2026 } from "@/lib/normen/leennormen-2026";
import { OVB_TARIEF_HOOFDVERBLIJF_PCT, STARTERS_WONINGWAARDEGRENS } from "@/lib/normen/overdrachtsbelasting-2026";
import { formatDatumNl, formatEuro } from "@/lib/util";

export const metadata: Metadata = {
  title: "Gratis rekenhulpen voor waarde en hypotheek",
  description:
    "Alle gratis rekenhulpen van Wonea op een rij: woningwaarde, WOZ-check, budget, hypotheekrentes en verduurzamen. Zonder account, met bron per rekenhulp.",
  alternates: { canonical: "/tools" },
  // Bewust indexeerbaar: dit is een statische landingspagina zonder adresdata.
  // Hij staat daarom ook in /sitemaps/statisch.xml (lib/seo/sitemap.ts);
  // indexeren en opnemen in de sitemap horen bij elkaar.
  robots: { index: true, follow: true },
};

/**
 * Tools-hub: de "gratis inzicht"-etalage. Eén uitgelichte tool (woningwaarde,
 * met een echte mini-preview van onze UI), daarna de overige tools als kaarten
 * met per kaart de bron als label en een echt datapunt waar dat kan. Cijfers
 * komen uit de echte bronbestanden (DNB-snapshot, leennormen, ISDE); het
 * rekenvoorbeeld in de preview is expliciet zo gelabeld.
 */

function pct(n: number): string {
  return `${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

type GridTool = {
  titel: string;
  zin: string;
  bron: string;
  href: string;
  linkTekst: string;
  breed?: boolean;
  datapunt?: { waarde: string; uitleg: string };
};

export default function ToolsPagina() {
  const rentes = getActueleRentes();
  const warmtepomp = ISDE_WARMTEPOMPEN.find((w) => w.categorie === "Lucht-Water");

  const gridTools: GridTool[] = [
    {
      titel: "WOZ-check",
      zin: "Vergelijk de WOZ-waarde van je beschikking met onze marktschatting. Scheelt het veel, dan leggen we uit hoe bezwaar werkt, gratis via je gemeente.",
      bron: "Jouw eigen WOZ-beschikking",
      href: "/woz-check",
      linkTekst: "Start de WOZ-check",
    },
    {
      titel: "Budgetberekenaar",
      zin: "Een indicatie van hoeveel hypotheek je ongeveer kunt krijgen, volgens de officiële leennormen. Geen hypotheekadvies.",
      bron: "Leennormen 2026 en NHG",
      href: "/budget",
      linkTekst: "Bereken je budget",
      datapunt: { waarde: formatEuro(NHG_GRENS_2026), uitleg: "NHG-kostengrens 2026" },
    },
    {
      titel: "Actuele hypotheekrentes",
      zin: "De gemiddelde rente op nieuwe hypotheken per rentevaste periode. Geen tarieven per geldverstrekker: die cijfers zijn niet openbaar.",
      bron: `DNB, ${peilmaandLabel()}`,
      href: "/hypotheek-rentes",
      linkTekst: "Bekijk de rentes",
      datapunt:
        rentes.totaalRentePct !== null
          ? {
              waarde: pct(rentes.totaalRentePct),
              uitleg: `gemiddelde rente op nieuwe hypotheken, alle rentevaste perioden samen (${peilmaandLabel()})`,
            }
          : undefined,
    },
    {
      titel: "Verduurzamingscheck",
      zin: "Zie per adres wat isolatie, zonnepanelen of een warmtepomp je opleveren aan energierekening en comfort, inclusief de subsidie die erbij hoort.",
      bron: "RVO (ISDE en EP-Online)",
      href: "/verduurzamen",
      linkTekst: "Start de verduurzamingscheck",
      breed: true,
      datapunt: warmtepomp
        ? {
            waarde: formatEuro(warmtepomp.mediaanEur),
            uitleg: `mediaan ISDE-subsidie voor een lucht-waterwarmtepomp (RVO-meldcodelijst, ${formatDatumNl(ISDE_PEILDATUM)})`,
          }
        : undefined,
    },
    {
      titel: "Kosten koper",
      zin: "Hoeveel eigen geld heb je nodig bovenop je hypotheek? Overdrachtsbelasting plus een eerlijke indicatie van de bijkomende kosten, met de startersvrijstelling erbij.",
      bron: "Wet op belastingen van rechtsverkeer",
      href: "/kosten-koper",
      linkTekst: "Bereken je kosten koper",
      datapunt: {
        waarde: `${OVB_TARIEF_HOOFDVERBLIJF_PCT}%`,
        uitleg: `overdrachtsbelasting eigen woning; starters tot ${formatEuro(STARTERS_WONINGWAARDEGRENS)} eenmalig 0%`,
      },
    },
    {
      titel: "Overbieden",
      zin: "Wat betekent een bod boven de vraagprijs voor je eigen geld? Vul je taxatie-inschatting in en zie welk deel de bank niet financiert.",
      bron: "Eigen invoer en rekenregels",
      href: "/overbieden",
      linkTekst: "Reken je bod door",
    },
    {
      titel: "Vind een makelaar",
      zin: "Makelaars bij jou in de buurt op een rij, zonder ranking en zonder betaalde posities. De dekking wisselt per gebied, dus dit overzicht is niet compleet.",
      bron: "OpenStreetMap",
      href: "/makelaars",
      linkTekst: "Vind een makelaar",
    },
  ];

  return (
    <div>
      <style>{`@keyframes wonea-enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      {/* Compacte intro: geen hero-herhaling van home, wel het huisvorm-motief. */}
      <section className="relative overflow-hidden border-b border-lijn bg-paneel">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-14 text-merk-50">
          <WoneaLogo className="h-72 w-72" />
        </div>
        <div
          className="relative mx-auto max-w-5xl px-5 py-12"
          style={{ animation: "wonea-enter var(--duur-normaal) var(--ease-uit) both" }}
        >
          <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
            <Link href="/" className="hover:text-merk">Wonea</Link> / Rekenhulpen
          </nav>
          <h1 className="mt-3 max-w-xl text-3xl font-semibold sm:text-4xl">Gratis inzicht, zonder account</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
            Negen rekenhulpen rond wonen, kopen en verduurzamen. Bij elke rekenhulp staat op welke bron hij draait en
            wat hij niet weet; cijfers komen altijd met bron en peildatum.
          </p>
        </div>
      </section>

      {/* Uitgelicht: de woningwaarde-check, met een echte mini-preview van onze UI. */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid items-center gap-8 rounded-[14px] border border-lijn bg-paneel p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold">Woningwaarde-check</h2>
            <p className="mt-3 leading-relaxed text-inkt-zacht">
              De geschatte waarde van een adres in ons testgebied, altijd als bandbreedte met de verkopen erachter en de
              rekenstappen erbij.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <BronLabel>Eigen rekenmodel ({MODEL_VERSIE})</BronLabel>
              <BronLabel>BAG en CBS</BronLabel>
            </div>
            <div className="mt-6">
              <Zoekbalk />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gedempt">
              In deze testfase zijn de verkopen achter de schatting voorbeelddata, altijd zo gelabeld.
            </p>
          </div>
          <div className="rounded-[14px] bg-merk-wash p-5">
            <p className="text-sm font-medium text-inkt">Geschatte waarde</p>
            <p className="mt-1 font-display text-3xl font-semibold text-merk">{formatEuro(340000)}</p>
            <Bandbreedte laag={312000} waarde={340000} hoog={368000} />
            <p className="mt-3 text-xs leading-relaxed text-gedempt">
              Rekenvoorbeeld, geen echt adres. Zo ziet elke schatting eruit: met marge, niet als één strak getal.
            </p>
          </div>
        </div>
      </section>

      {/* De overige tools: gevarieerd grid, per kaart bronlabel + echt datapunt waar dat kan. */}
      <section className="mx-auto max-w-5xl px-5 pb-12">
        <h2 className="text-2xl font-semibold">De andere rekenhulpen</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {gridTools.map((tool) => (
            <Kaart key={tool.titel} className={`flex flex-col ${tool.breed ? "lg:col-span-2" : ""}`}>
              <h3 className="text-lg font-semibold">{tool.titel}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-inkt-zacht">{tool.zin}</p>
              {tool.datapunt ? (
                <p className="mt-4 border-t border-lijn pt-3">
                  <span className="font-display text-xl font-semibold text-merk">{tool.datapunt.waarde}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-gedempt">{tool.datapunt.uitleg}</span>
                </p>
              ) : null}
              <div className="mt-4">
                <BronLabel>{tool.bron}</BronLabel>
              </div>
              <Link
                href={tool.href}
                className="mt-3 self-start text-sm font-semibold text-merk underline underline-offset-4 transition-colors hover:text-merk-licht"
              >
                {tool.linkTekst}
              </Link>
            </Kaart>
          ))}
        </div>
      </section>

      {/* Biedadvies: hoort bij een adres, dus een eigen kaart met uitleg
          (bewust geen volle-breedte band: die familie is voor de donkere slotband). */}
      <section id="biedadvies" className="mx-auto max-w-5xl px-5 pb-12">
        <div className="rounded-[14px] bg-merk-wash p-6 sm:p-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold">Biedadvies: wat is een realistisch bod?</h2>
            <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
              Het biedadvies hoort bij een specifieke woning: een realistische biedrange op basis van de
              waardebandbreedte, plus de overbieding en doorlooptijd in de buurt. Context, geen aankoopadvies. Zoek de
              woning; de link naar het biedadvies staat op de woningpagina.
            </p>
            <div className="mt-4">
              <BronLabel>Waardebandbreedte en buurtcijfers</BronLabel>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gedempt">In deze testfase zijn de buurtcijfers voorbeelddata.</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-semibold text-merk underline underline-offset-4 transition-colors hover:text-merk-licht"
            >
              Zoek een adres
            </Link>
          </div>
        </div>
      </section>

      {/* Donkere band: de ene bewuste thema-uitzondering, voor het eerlijke gratis-verhaal. */}
      <section className="bg-merk-900">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="text-2xl font-semibold text-white">Hoe zit het met gratis?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-merk-100">
            Alle rekenhulpen zijn gratis en werken zonder account. Sommige eindigen in een vrijblijvende vervolgstap, zoals een
            voorstel voor verduurzaming. Verstuur je zo&apos;n aanvraag, dan staat er altijd vooraf bij naar welk type partij
            hij gaat, en zonder jouw akkoord gaat er niets de deur uit.
          </p>
          <p className="mt-5 space-x-5 text-sm">
            <Link href="/methode" className="font-semibold text-white underline underline-offset-4">Zo rekenen we</Link>
            <Link href="/privacy" className="font-semibold text-white underline underline-offset-4">Privacy en verwijderen</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
