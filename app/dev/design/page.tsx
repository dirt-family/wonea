import { notFound } from "next/navigation";
import {
  Bandbreedte,
  BronLabel,
  Kaart,
  KnopPrimair,
  KnopSecundair,
  LeadCta,
  LegeStaat,
  SectieLabel,
  Sparkline,
  StappenBalk,
  StatTegel,
  UitklapUitleg,
  UitkomstKaart,
  VergelijkTabel,
  VoorbeelddataLabel,
} from "@/components/ui";
import { WoneaLogo } from "@/components/logo";
import { Illustratie, ILLUSTRATIE_NAMEN } from "@/components/illustraties";

/** Design-showcase, alleen in development (zelfde guard als /dev/mail). */

const DIALS = [
  { naam: "Design-variantie", waarde: 5, uitleg: "Elke pagina een eigen sectieritme, geen kopie-stramien." },
  { naam: "Motion-intensiteit", waarde: 4, uitleg: "Beweging alleen met een reden; enters ease-uit, eenmalig." },
  { naam: "Visuele dichtheid", waarde: 4, uitleg: "Informatierijk maar rustig; witruimte doet het werk." },
] as const;

const TASTE_REGELS = [
  "Eyebrow-restraint: max 1 SectieLabel per 3 secties op marketingpagina's; de kop alleen is meestal genoeg.",
  "Layout-diversiteit: een sectie-familie max 1x per pagina, min 4 families per pagina, max 2 opeenvolgende splits.",
  "Echte previews: productweergaves zijn echte mini-versies van onze UI, nooit div-nep-screenshots.",
  "Hero-discipline: kop max 2 regels, subtekst max 20 woorden, CTA's boven de vouw, geen trust-strips in de hero.",
  "CTA-hygiene: 1 label per intentie op een pagina; knoptekst past op 1 regel.",
  "Statistieken zijn echt of expliciet voorbeeld; nooit verzonnen precisie.",
  "Copy-zelfaudit: elke zichtbare string hardop lezen; NL, eerlijk, geen emoji, geen em-dashes.",
  "Thema-slot: de site is licht; de donkere band is de ene bewuste uitzondering, max 1x per pagina.",
] as const;

const MOTION_TOKENS = [
  { label: "micro", duurToken: "--duur-micro", duurTekst: "120ms", gebruik: "hovers, kleine state-wissels" },
  { label: "kort", duurToken: "--duur-kort", duurTekst: "200ms", gebruik: "uitklappen, kaart-hovers" },
  { label: "normaal", duurToken: "--duur-normaal", duurTekst: "300ms", gebruik: "sectie-enters, reveals" },
] as const;

export default function DesignShowcase() {
  if (process.env.NODE_ENV !== "development" || process.env.WONEA_DEV_MAIL !== "1") notFound();

  const kleuren = ["achtergrond", "paneel", "lijn", "merk-wash", "merk-100", "merk-300", "merk-500", "merk", "accent", "accent-wash", "positief", "negatief"];

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-5 py-10">
      <h1 className="text-3xl font-semibold">Designsysteem-showcase</h1>

      {/* ------------------------------------------------------------------ */}
      {/* Merkregels v2 (docs/BRAND.md)                                      */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectieLabel>Merk-dials (BRAND.md)</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          {DIALS.map((d) => (
            <Kaart key={d.naam}>
              <p className="text-sm font-medium text-inkt">{d.naam}</p>
              <div className="mt-2 flex gap-1.5" role="img" aria-label={`${d.naam}: ${d.waarde} van 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`h-2 w-6 rounded-full ${i <= d.waarde ? "bg-merk" : "bg-merk-100"}`} />
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gedempt">{d.uitleg}</p>
            </Kaart>
          ))}
        </div>
      </section>

      <section>
        <SectieLabel>Sectie-families (max 1x per pagina, min 4 per pagina)</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="grid h-16 grid-cols-[1.2fr_1fr] gap-1.5 rounded-lg border border-lijn bg-paneel p-1.5">
              <div className="rounded bg-merk-100" />
              <div className="rounded bg-merk-wash" />
            </div>
            <p className="mt-1.5 text-xs text-gedempt">Split (tekst + preview)</p>
          </div>
          <div>
            <div className="grid h-16 grid-cols-3 gap-1.5 rounded-lg border border-lijn bg-paneel p-1.5">
              <div className="rounded bg-merk-100" />
              <div className="rounded bg-merk-100" />
              <div className="rounded bg-merk-100" />
            </div>
            <p className="mt-1.5 text-xs text-gedempt">Kaarten-grid</p>
          </div>
          <div>
            <div className="flex h-16 rounded-lg border border-lijn bg-paneel p-1.5">
              <div className="flex-1 rounded bg-merk-wash" />
            </div>
            <p className="mt-1.5 text-xs text-gedempt">Volle-breedte band (wash)</p>
          </div>
          <div>
            <div className="flex h-16 rounded-lg border border-lijn bg-paneel p-1.5">
              <div className="flex-1 rounded bg-merk-900" />
            </div>
            <p className="mt-1.5 text-xs text-gedempt">Donkere band (1x per pagina)</p>
          </div>
          <div>
            <div className="flex h-16 items-center gap-1.5 overflow-hidden rounded-lg border border-lijn bg-paneel p-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-14 shrink-0 rounded bg-merk-100" />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gedempt">Ticker (max 1 op de hele site)</p>
          </div>
        </div>
      </section>

      <section>
        <SectieLabel>Taste-regels (checklist voor elke pagina)</SectieLabel>
        <Kaart className="mt-3">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-inkt-zacht">
            {TASTE_REGELS.map((regel) => (
              <li key={regel}>{regel}</li>
            ))}
          </ol>
        </Kaart>
      </section>

      <section>
        <SectieLabel>Motion-tokens</SectieLabel>
        <p className="mt-2 text-xs text-gedempt">
          Hover of focus verschuift het blok met de bijbehorende duur en ease-uit. prefers-reduced-motion zet alles stil
          (globaal geregeld in globals.css).
        </p>
        <div className="mt-3 flex flex-wrap gap-5">
          {MOTION_TOKENS.map((t) => (
            <button
              key={t.label}
              type="button"
              className="rounded-[14px] border border-lijn bg-paneel px-5 py-4 text-left transition-transform hover:-translate-y-1 focus:outline-2 focus:outline-offset-2 focus:outline-merk"
              style={{ transitionDuration: `var(${t.duurToken})`, transitionTimingFunction: "var(--ease-uit)" }}
            >
              <p className="text-sm font-semibold text-inkt">{t.label} ({t.duurTekst})</p>
              <p className="mt-1 text-xs text-gedempt">{t.gebruik}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-gedempt">Enters: var(--ease-uit). Exits: var(--ease-in). Scroll-reveals subtiel en eenmalig.</p>
      </section>

      <section>
        <SectieLabel>Grafisch motief en vormtaal</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-[14px] border border-lijn bg-paneel p-6">
            <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 text-merk-100">
              <WoneaLogo className="h-36 w-36" />
            </div>
            <p className="relative max-w-[60%] text-sm leading-relaxed text-inkt-zacht">
              De oplopende huisvorm uit het logo: als groot zacht achtergrond-element (merk-50/merk-100, max 1 per
              pagina) en als sectie-scheider.
            </p>
            <div aria-hidden="true" className="relative mt-4 flex items-center gap-4">
              <span className="h-px flex-1 bg-lijn" />
              <WoneaLogo className="h-5 w-5 text-merk-200" />
              <span className="h-px flex-1 bg-lijn" />
            </div>
          </div>
          <div className="rounded-[14px] border border-lijn bg-paneel p-6">
            <p className="text-sm font-medium text-inkt">Vaste drieslag, nergens andere radii</p>
            <div className="mt-3 space-y-3 text-xs text-gedempt">
              <div className="flex items-center gap-3">
                <span className="h-9 w-16 rounded-[14px] border border-lijn bg-merk-wash" />
                <span>Kaarten: 14px</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-9 w-16 rounded-full bg-merk" />
                <span>Knoppen: pill</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-9 w-16 rounded-lg border border-lijn bg-paneel" />
                <span>Inputs: 8px</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectieLabel>Illustraties (public/illustraties)</SectieLabel>
        <p className="mt-2 text-xs text-gedempt">
          Zeven decoratieve illustraties: merk-tinten, max 1 amber-accent per stuk, standaard aria-hidden. Elke
          illustratie hieronder op achtergrond en op paneel-wit.
        </p>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ILLUSTRATIE_NAMEN.map((naam) => (
            <div key={naam} className="rounded-[14px] border border-lijn bg-paneel p-4">
              <p className="text-xs font-semibold text-inkt">{naam}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-achtergrond p-2">
                  <Illustratie naam={naam} className="h-auto w-full" />
                </div>
                <div className="rounded-lg border border-lijn bg-paneel p-2">
                  <Illustratie naam={naam} className="h-auto w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tokens en componenten                                              */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectieLabel>Kleuren</SectieLabel>
        <div className="mt-3 flex flex-wrap gap-3">
          {kleuren.map((k) => (
            <div key={k} className="text-center">
              <div className={`h-14 w-20 rounded-lg border border-lijn bg-${k}`} />
              <p className="mt-1 text-xs text-gedempt">{k}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectieLabel>Typografie</SectieLabel>
        <h1 className="text-4xl font-semibold">Kop 1: serif, merk</h1>
        <h2 className="text-2xl font-semibold">Kop 2</h2>
        <p className="text-inkt">Lopende tekst in Inter, inkt.</p>
        <p className="text-sm text-inkt-zacht">Secundair, inkt-zacht.</p>
        <p className="text-xs text-gedempt">Bijschrift, gedempt.</p>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <KnopPrimair href="#">Primaire knop</KnopPrimair>
        <KnopSecundair href="#">Secundaire knop</KnopSecundair>
        <BronLabel>bronlabel</BronLabel>
        <VoorbeelddataLabel />
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTegel label="Gemiddelde WOZ" waarde="€ 465.000" delta="+4,2% dit jaar" deltaRichting="positief" />
        <StatTegel label="Doorlooptijd" waarde="23 dagen" delta="6 dagen sneller" deltaRichting="positief" />
        <StatTegel label="Overbieden" waarde="+3,1%" delta="vlak t.o.v. vorige maand" deltaRichting="neutraal" />
      </section>

      <UitkomstKaart label="Maximale hypotheek (voorbeeld)" bedrag="€ 385.000">
        <Bandbreedte laag={355000} waarde={385000} hoog={402000} />
      </UitkomstKaart>

      <section className="space-y-4">
        <StappenBalk stappen={["Inkomen", "Woonsituatie", "Uitkomst"]} actief={1} />
        <div className="flex items-end gap-6">
          <Sparkline waarden={[420, 435, 431, 448, 460, 458, 472]} />
          <span className="text-xs text-gedempt">Sparkline</span>
        </div>
      </section>

      <VergelijkTabel
        koppen={["Geldverstrekker", "10 jaar vast", "20 jaar vast", "NHG"]}
        rijen={[
          ["Voorbeeldbank", "3,4%", "3,8%", "ja"],
          ["Demo Hypotheken", "3,5%", "3,9%", "ja"],
        ]}
        bron="Voorbeelddata voor de showcase."
      />

      <UitklapUitleg titel="Zo rekenen we (uitklap-uitleg)">
        Elke tool krijgt een eigen zo-rekenen-we-blok met de echte formules en bronnen.
      </UitklapUitleg>

      <LegeStaat titel="Geen gegevens voor dit adres" tekst="Eerlijk leeg: we benoemen welke bron ontbreekt in plaats van iets te verzinnen." />

      <LeadCta
        titel="Weten wat dit voor jou betekent?"
        tekst="Een onafhankelijke adviseur rekent het door met je echte situatie."
        knopTekst="Vraag het na"
        href="#"
        ontvanger="een onafhankelijke hypotheekadviseur"
      />
    </div>
  );
}
