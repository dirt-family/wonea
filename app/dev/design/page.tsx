import { notFound } from "next/navigation";
import {
  AlertRij,
  AnalyseKaart,
  Bandbreedte,
  BronLabel,
  CtaBand,
  DeltaPil,
  DotMatrix,
  EnergieLabelBadge,
  GrootCijfer,
  IcoonRondje,
  Kaart,
  KnopPrimair,
  KnopSecundair,
  LeadCta,
  LegeStaat,
  ModuleTag,
  Pil,
  PromoBlok,
  SectieLabel,
  Sparkline,
  StappenBalk,
  StatTegel,
  TintSectie,
  UitklapUitleg,
  UitkomstKaart,
  VergelijkTabel,
  VoortgangsBalk,
  WoningKaart,
} from "@/components/ui";
import { WoneaLogo } from "@/components/logo";
import { Icoon, type IcoonNaam } from "@/components/iconen";
import { Illustratie, ILLUSTRATIE_NAMEN } from "@/components/illustraties";
import { WaardeGrafiek } from "@/components/grafieken/waarde-grafiek";

/**
 * Designsysteem-showcase, alleen in development (zelfde guard als /dev/mail).
 * Dit is de definitieve referentie: alle tokens, contrast-paren, labelkleuren,
 * componenten en de flux-kleurlaag (BRAND.md v3 + Flux-kleurlaag, 24 jul).
 * Alle cijfers op deze pagina zijn voorbeelddata voor de showcase.
 */

const DIALS = [
  { naam: "Design-variantie", waarde: 7, uitleg: "Elke pagina een eigen sectieritme en wash-dramaturgie; geen kopie-stramien." },
  { naam: "Motion-intensiteit", waarde: 6, uitleg: "Beweging met een reden: enters ease-uit, hover-lift, eenmalige reveals." },
  { naam: "Visuele dichtheid", waarde: 6, uitleg: "Informatierijk met grote kleurvlakken; witruimte blijft het werk doen." },
] as const;

const TASTE_REGELS = [
  "Eyebrow-restraint: max 1 SectieLabel per 3 secties op marketingpagina's; de kop alleen is meestal genoeg.",
  "Layout-diversiteit: een sectie-familie max 1x per pagina, min 4 families per pagina, max 2 opeenvolgende splits.",
  "Echte previews: productweergaves zijn echte mini-versies van onze UI, nooit div-nep-screenshots.",
  "Hero-discipline: kop max 2 regels, subtekst max 20 woorden, CTA's boven de vouw, geen trust-strips in de hero.",
  "CTA-hygiene: 1 label per intentie op een pagina; knoptekst past op 1 regel.",
  "Statistieken zijn echt of expliciet voorbeeld; nooit verzonnen precisie.",
  "Copy-zelfaudit: elke zichtbare string hardop lezen; NL, eerlijk, geen emoji, geen em-dashes.",
  "Thema-slot: de site is licht; max 1 donkere band per pagina (CtaBand of AnalyseKaart, nooit allebei).",
  "Flux-discipline: naast navy max 2 accentfamilies per scherm; lime en lavendel zijn nooit tekst op licht (alleen lime-diep en lavendel-diep).",
  "Merk-discipline: logo, koppen, primaire knoppen en washes blijven navy-amber; in het dashboard voeren zwart, lime en lavendel de boventoon.",
] as const;

const MOTION_TOKENS = [
  { label: "micro", duurToken: "--duur-micro", duurTekst: "120ms", gebruik: "hovers, kleine state-wissels" },
  { label: "kort", duurToken: "--duur-kort", duurTekst: "200ms", gebruik: "uitklappen, kaart-hovers, til-op" },
  { label: "normaal", duurToken: "--duur-normaal", duurTekst: "300ms", gebruik: "sectie-enters, reveals" },
] as const;

/** Whitelist uit components/iconen.tsx (nieuwe iconen alleen via die lijst). */
const ICOON_NAMEN: IcoonNaam[] = [
  "zoek", "huis", "euro", "rekenhulp", "grafiek", "blad", "document", "schild",
  "weegschaal", "locatie", "info", "vraag", "waarschuwing", "vinkje", "kruis",
  "pijlRechts", "verwijderen",
];

/** Kleurswatch: naam + volledige (statische) Tailwind-klasse, zodat de scanner ze ziet. */
function SwatchRij({ titel, swatches }: { titel: string; swatches: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-inkt">{titel}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {swatches.map(([naam, klas]) => (
          <div key={naam} className="text-center">
            <div className={`h-12 w-16 rounded-lg border border-lijn ${klas}`} />
            <p className="mt-1 max-w-16 text-[10px] leading-tight text-gedempt">{naam}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Contrast-paar: voorbeeldtekst op het echte vlak, met de nagerekende ratio erbij. */
function ContrastChip({ vlak, tekst, label, ratio, klein = false }: { vlak: string; tekst: string; label: string; ratio: string; klein?: boolean }) {
  return (
    <div className="text-center">
      <div className={`grid h-14 w-32 place-items-center rounded-lg border border-lijn px-2 ${vlak}`}>
        <span className={`${tekst} ${klein ? "text-xs" : "text-sm font-semibold"}`}>Woningwaarde</span>
      </div>
      <p className="mt-1 text-[10px] leading-tight text-gedempt">{label} ({ratio})</p>
    </div>
  );
}

export default function DesignShowcase() {
  if (process.env.NODE_ENV !== "development" || process.env.WONEA_DEV_MAIL !== "1") notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-5 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Designsysteem-showcase</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Huisstijl v3 (navy naar amber) plus de flux-kleurlaag (shell, lime, lavendel). Alle cijfers hieronder zijn
          voorbeelddata voor de showcase; regels en ratio&apos;s staan in docs/BRAND.md.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dials en taste-regels                                              */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectieLabel>Merk-dials (BRAND.md v3)</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          {DIALS.map((d) => (
            <Kaart key={d.naam}>
              <p className="text-sm font-medium text-inkt">{d.naam}</p>
              <div className="mt-2 flex gap-1" role="img" aria-label={`${d.naam}: ${d.waarde} van 10`}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <span key={i} className={`h-2 w-3.5 rounded-full ${i <= d.waarde ? "bg-merk" : "bg-merk-100"}`} />
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gedempt">{d.uitleg}</p>
            </Kaart>
          ))}
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

      {/* ------------------------------------------------------------------ */}
      {/* Tokens: kleuren, contrast, labels                                  */}
      {/* ------------------------------------------------------------------ */}

      <section className="space-y-5">
        <SectieLabel>Kleurtokens (globals.css, de enige bron)</SectieLabel>
        <SwatchRij
          titel="Basis en washes"
          swatches={[
            ["achtergrond", "bg-achtergrond"],
            ["paneel", "bg-paneel"],
            ["lijn", "bg-lijn"],
            ["wash-navy", "bg-wash-navy"],
            ["wash-amber", "bg-wash-amber"],
            ["positief-wash", "bg-positief-wash"],
            ["negatief-wash", "bg-negatief-wash"],
            ["positief", "bg-positief"],
            ["negatief", "bg-negatief"],
          ]}
        />
        <SwatchRij
          titel="Navy-familie (merk; 900 = exact de logo-navy)"
          swatches={[
            ["merk-50", "bg-merk-50"],
            ["merk-100", "bg-merk-100"],
            ["merk-200", "bg-merk-200"],
            ["merk-300", "bg-merk-300"],
            ["merk-400", "bg-merk-400"],
            ["merk-500", "bg-merk-500"],
            ["merk-600", "bg-merk-600"],
            ["merk-700", "bg-merk-700"],
            ["merk (800)", "bg-merk"],
            ["merk-900", "bg-merk-900"],
            ["merk-950", "bg-merk-950"],
          ]}
        />
        <SwatchRij
          titel="Amber-familie (accent; 500 = exact de logo-amber)"
          swatches={[
            ["accent-50", "bg-accent-50"],
            ["accent-100", "bg-accent-100"],
            ["accent-200", "bg-accent-200"],
            ["accent-300", "bg-accent-300"],
            ["accent-400", "bg-accent-400"],
            ["accent-500", "bg-accent-500"],
            ["accent-600", "bg-accent-600"],
            ["accent (700)", "bg-accent"],
            ["accent-800", "bg-accent-800"],
            ["accent-900", "bg-accent-900"],
          ]}
        />
        <SwatchRij
          titel="Shell-familie en canvas (flux: dashboard-zwart, bewust geen navy)"
          swatches={[
            ["shell", "bg-shell"],
            ["shell-hoog", "bg-shell-hoog"],
            ["shell-lijn", "bg-shell-lijn"],
            ["canvas", "bg-canvas"],
          ]}
        />
        <SwatchRij
          titel="Lime-familie (flux: energie en actie; anker = 400)"
          swatches={[
            ["lime-50 (wash)", "bg-lime-wash"],
            ["lime-100", "bg-lime-100"],
            ["lime-200", "bg-lime-200"],
            ["lime-300", "bg-lime-300"],
            ["lime (400)", "bg-lime"],
            ["lime-500", "bg-lime-500"],
            ["lime-600", "bg-lime-600"],
            ["lime-700", "bg-lime-700"],
            ["lime-diep (800)", "bg-lime-diep"],
            ["lime-900", "bg-lime-900"],
            ["lime-950", "bg-lime-950"],
          ]}
        />
        <SwatchRij
          titel="Lavendel-familie (flux: de rustige datakant; anker = 300)"
          swatches={[
            ["lavendel-50 (wash)", "bg-lavendel-wash"],
            ["lavendel-100", "bg-lavendel-100"],
            ["lavendel-200", "bg-lavendel-200"],
            ["lavendel (300)", "bg-lavendel"],
            ["lavendel-400", "bg-lavendel-400"],
            ["lavendel-500", "bg-lavendel-500"],
            ["lavendel-600", "bg-lavendel-600"],
            ["lavendel-diep (700)", "bg-lavendel-diep"],
            ["lavendel-800", "bg-lavendel-800"],
            ["lavendel-900", "bg-lavendel-900"],
          ]}
        />
      </section>

      <section>
        <SectieLabel>Contrast-paren (hard; alles daarbuiten is een bug)</SectieLabel>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gedempt">
          Lopende tekst minimaal 4,5:1; groot, bold of UI minimaal 3:1. De ratio&apos;s zijn nagerekend en staan in
          BRAND.md. Verboden: amber 300 tot 600 als tekst op licht, merk-300/400 als tekst, lime 50 tot 500 en lavendel
          50 tot 400 als tekst op licht, gedempt op washes voor lopende tekst.
        </p>
        <Kaart className="mt-3 space-y-5">
          <div>
            <p className="text-xs font-semibold text-inkt">Lopende tekst op licht</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <ContrastChip vlak="bg-paneel" tekst="text-inkt" label="inkt op wit" ratio="15,9" />
              <ContrastChip vlak="bg-paneel" tekst="text-inkt-zacht" label="inkt-zacht op wit" ratio="7,5" />
              <ContrastChip vlak="bg-paneel" tekst="text-merk" label="merk op wit" ratio="11,9" />
              <ContrastChip vlak="bg-paneel" tekst="text-merk-600" label="merk-600 op wit" ratio="6,9" />
              <ContrastChip vlak="bg-paneel" tekst="text-accent-800" label="accent-800 op wit" ratio="5,8" />
              <ContrastChip vlak="bg-paneel" tekst="text-accent-900" label="accent-900 op wit" ratio="7,9" />
              <ContrastChip vlak="bg-paneel" tekst="text-gedempt" label="gedempt: alleen meta" ratio="4,8" klein />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-inkt">Op donker (merk-900 en shell)</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <ContrastChip vlak="bg-merk-900" tekst="text-white" label="wit op merk-900" ratio="14,6" />
              <ContrastChip vlak="bg-merk-900" tekst="text-merk-200" label="merk-200 op merk-900" ratio="10+" />
              <ContrastChip vlak="bg-merk-900" tekst="text-accent-300" label="accent-300 op merk-900, groot" ratio="9,1" />
              <ContrastChip vlak="bg-shell" tekst="text-op-shell" label="op-shell op shell" ratio="15,5" />
              <ContrastChip vlak="bg-shell" tekst="text-op-shell-zacht" label="op-shell-zacht op shell" ratio="7,3" klein />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-inkt">Flux-vlakken en flux-tekst op licht</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <ContrastChip vlak="bg-lime" tekst="text-shell" label="shell op lime-anker" ratio="13,5" />
              <ContrastChip vlak="bg-lavendel" tekst="text-shell" label="shell op lavendel-anker" ratio="7,9" />
              <ContrastChip vlak="bg-lime-wash" tekst="text-lime-diep" label="lime-diep op de wash" ratio="7,1" />
              <ContrastChip vlak="bg-lavendel-wash" tekst="text-lavendel-diep" label="lavendel-diep op de wash" ratio="6,5" />
              <ContrastChip vlak="bg-paneel" tekst="text-lime-diep" label="lime-diep op wit" ratio="7,5" />
              <ContrastChip vlak="bg-paneel" tekst="text-lavendel-diep" label="lavendel-diep op wit" ratio="7,1" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-inkt">Groot, bold of UI (minimaal 3:1)</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <ContrastChip vlak="bg-paneel" tekst="text-accent-700" label="accent-700: de amber-grens" ratio="3,9" />
              <ContrastChip vlak="bg-paneel" tekst="text-merk-500" label="merk-500: korte display" ratio="4,8" />
              <div className="text-center">
                <div className="flex h-14 w-32 items-center justify-center gap-2 rounded-lg border border-lijn bg-paneel">
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-lime-600" />
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-lavendel-500" />
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent-500" />
                </div>
                <p className="mt-1 text-[10px] leading-tight text-gedempt">graphics-dots: lime-600, lavendel-500, accent-500</p>
              </div>
            </div>
          </div>
        </Kaart>
      </section>

      <section>
        <SectieLabel>Energielabelkleuren (tokens label-a tot label-g, overal identiek)</SectieLabel>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {["A", "B", "C", "D", "E", "F", "G"].map((label) => (
            <EnergieLabelBadge key={label} label={label} />
          ))}
          <span className="text-xs text-gedempt">Alleen via EnergieLabelBadge; tekst wit op A/E/F/G, inkt op B/C/D.</span>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Typografie, vormtaal, diepte, motion                               */}
      {/* ------------------------------------------------------------------ */}

      <section className="space-y-3">
        <SectieLabel>Typografie</SectieLabel>
        <h1 className="text-4xl font-semibold">Kop 1: Source Serif 4, merk</h1>
        <h2 className="text-2xl font-semibold">Kop 2: hetzelfde notariele vertrouwen</h2>
        <p className="text-inkt">Lopende tekst in Inter, inkt. Cijfers altijd tabular-nums: <span className="tabular-nums">427.000</span>.</p>
        <p className="text-sm text-inkt-zacht">Secundair, inkt-zacht.</p>
        <p className="text-xs text-gedempt">Bijschrift, gedempt (alleen meta).</p>
      </section>

      <section>
        <SectieLabel>Vormtaal, diepte en gradients</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <Kaart>
            <p className="text-sm font-medium text-inkt">Radius: drieslag plus twee uitzonderingen</p>
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
              <div className="flex items-center gap-3">
                <span className="h-9 w-16 rounded-[20px] bg-merk-900" />
                <span>Band 20: volle-breedte banden en de donkere analysekaart</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-9 w-16 rounded-[24px] bg-shell" />
                <span>Blok 24: grote flux-blokken binnen het dashboard-frame</span>
              </div>
            </div>
          </Kaart>
          <Kaart>
            <p className="text-sm font-medium text-inkt">Schaduwen (navy-getint, nooit zwart) en hover-lift</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="grid h-16 w-24 place-items-center rounded-[14px] bg-paneel text-[10px] text-gedempt shadow-zweef">zweef</div>
              <div className="grid h-16 w-24 place-items-center rounded-[14px] bg-paneel text-[10px] text-gedempt shadow-zweef-md">zweef-md</div>
              <div className="grid h-16 w-24 place-items-center rounded-[14px] bg-paneel text-[10px] text-gedempt shadow-zweef-lg">zweef-lg</div>
              <div className="til-op grid h-16 w-24 place-items-center rounded-[14px] border border-lijn bg-paneel text-[10px] text-gedempt shadow-zweef">til-op (hover)</div>
            </div>
            <p className="mt-4 text-sm font-medium text-inkt">Merkgradient: alleen merkmomenten</p>
            <div className="mt-2 flex items-center gap-3">
              <span aria-hidden="true" className="h-9 w-16 rounded-lg" style={{ backgroundImage: "var(--gradient-merk)" }} />
              <WoneaLogo className="h-9 w-9" />
              <span className="text-xs text-gedempt">Nooit als vlakvulling van secties, kaarten of knoppen.</span>
            </div>
          </Kaart>
        </div>
      </section>

      <section>
        <SectieLabel>Wash-dramaturgie (TintSectie)</SectieLabel>
        <p className="mt-2 text-xs text-gedempt">
          Secties wisselen tussen navy-wash (koel: data en uitleg), amber-wash (warm: mens en actie) en paneel-wit als
          rustmaat. Nooit twee dezelfde washes direct na elkaar. Hero&apos;s gebruiken de vervloeiende variant
          (gradient-hero-wash).
        </p>
        <div className="mt-3 overflow-hidden rounded-[14px] border border-lijn">
          <TintSectie wash="amber" className="px-5 py-4 text-sm text-inkt">amber-wash: warme adem</TintSectie>
          <TintSectie wash="paneel" className="px-5 py-4 text-sm text-inkt">paneel-wit: rustmaat</TintSectie>
          <TintSectie wash="navy" className="px-5 py-4 text-sm text-inkt">navy-wash: koele adem</TintSectie>
          <div className="px-5 py-4 text-sm text-inkt [background-image:var(--gradient-hero-wash)]">gradient-hero-wash: vervloeit naar de achtergrond</div>
        </div>
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
        <SectieLabel>Grafisch motief, iconen en illustraties</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-[14px] border border-lijn bg-paneel p-6">
            <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 text-merk-100">
              <WoneaLogo variant="mono" className="h-36 w-36" />
            </div>
            <p className="relative max-w-[60%] text-sm leading-relaxed text-inkt-zacht">
              De oplopende huisvorm uit het logo: als groot zacht achtergrond-element (merk-50/merk-100, max 1 per
              pagina) en als sectie-scheider.
            </p>
            <div aria-hidden="true" className="relative mt-4 flex items-center gap-4">
              <span className="h-px flex-1 bg-lijn" />
              <WoneaLogo variant="mono" className="h-5 w-5 text-merk-200" />
              <span className="h-px flex-1 bg-lijn" />
            </div>
          </div>
          <Kaart>
            <p className="text-sm font-medium text-inkt">Iconen: Lucide via de whitelist (components/iconen.tsx)</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {ICOON_NAMEN.map((naam) => (
                <span key={naam} className="grid h-9 w-9 place-items-center rounded-lg border border-lijn text-merk" title={naam}>
                  <Icoon naam={naam} maat="s" />
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-gedempt">Vaste maten s/m/l, strokeWidth 1,75, aria-hidden default.</p>
          </Kaart>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ILLUSTRATIE_NAMEN.map((naam) => (
            <div key={naam} className="rounded-[14px] border border-lijn bg-paneel p-4">
              <p className="text-xs font-semibold text-inkt">{naam}</p>
              <div className="mt-3 rounded-lg bg-achtergrond p-2">
                <Illustratie naam={naam} className="h-auto w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Componenten                                                        */}
      {/* ------------------------------------------------------------------ */}

      <section className="space-y-4">
        <SectieLabel>Knoppen, pillen en labels</SectieLabel>
        <div className="flex flex-wrap items-center gap-3">
          <KnopPrimair href="#">Primaire knop</KnopPrimair>
          <KnopSecundair href="#">Secundaire knop</KnopSecundair>
          <BronLabel>bronlabel</BronLabel>
          <ModuleTag>module-tag</ModuleTag>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Pil variant="merk">merk-pil</Pil>
          <Pil variant="amber">amber-pil</Pil>
          <Pil variant="lime">lime-pil</Pil>
          <Pil variant="lavendel">lavendel-pil</Pil>
          <Pil variant="neutraal">neutrale pil</Pil>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DeltaPil richting="op">+4,2%</DeltaPil>
          <DeltaPil richting="neer">-1,1%</DeltaPil>
          <DeltaPil richting="vlak">vlak</DeltaPil>
          <DeltaPil richting="op" tint="lime">+4,2%</DeltaPil>
          <span className="text-xs text-gedempt">DeltaPil: washes; tint=lime maakt alleen de positieve richting vol lime</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IcoonRondje naam="huis" tint="merk" />
          <IcoonRondje naam="euro" tint="amber" />
          <IcoonRondje naam="grafiek" tint="merk" maat="l" />
          <IcoonRondje naam="blad" tint="amber" maat="l" />
          <span className="text-xs text-gedempt">IcoonRondje: merk- en amber-tint, maten m en l</span>
        </div>
      </section>

      <section>
        <SectieLabel>Stat-tegels (max 1 kleurtegel per rij)</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-4">
          <StatTegel label="Gemiddelde WOZ" waarde="€ 465.000" delta="+4,2% dit jaar" deltaRichting="positief" />
          <StatTegel label="Doorlooptijd" waarde="23 dagen" delta="6 dagen sneller" deltaRichting="positief" tint="merk" />
          <StatTegel label="Overbieden" waarde="+3,1%" delta="vlak t.o.v. vorige maand" deltaRichting="neutraal" tint="amber" />
          <StatTegel label="Waarde-alerts" waarde="12" delta="+3 deze maand" tint="lime" />
        </div>
      </section>

      <section>
        <SectieLabel>Grote cijfers en uitkomsten</SectieLabel>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <Kaart>
            <GrootCijfer waarde="427.000" eenheid="euro" delta="+5%" deltaRichting="op" deltaTint="lime" />
            <p className="mt-2 text-xs text-gedempt">GrootCijfer met eenheid-suffix en lime-delta (flux-patroon).</p>
            <div className="mt-4 flex items-end gap-6">
              <Sparkline waarden={[420, 435, 431, 448, 460, 458, 472]} />
              <span className="text-xs text-gedempt">Sparkline (currentColor)</span>
            </div>
          </Kaart>
          <UitkomstKaart label="Maximale hypotheek (voorbeeld)" bedrag="€ 385.000">
            <Bandbreedte laag={355000} waarde={385000} hoog={402000} />
          </UitkomstKaart>
        </div>
      </section>

      <section>
        <SectieLabel>Woningkaart-signatuur en alert-rijen</SectieLabel>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <WoningKaart
            href="#"
            adres="Voorbeeldstraat 12"
            plaats="1234 AB Testdorp"
            micro="94 m2 · rijwoning · 1978"
            waarde="€ 427.000"
            bandbreedte="€ 395.000 tot € 459.000"
            energielabel="C"
            tag="voorbeeld"
          />
          <Kaart>
            <p className="text-sm font-semibold text-inkt">AlertRij (alle kleurdots)</p>
            <div className="mt-2 divide-y divide-lijn">
              <AlertRij kleur="merk" titel="WOZ 2026 staat online" meta="merk" />
              <AlertRij kleur="amber" titel="Nieuw in je buurt" meta="amber" />
              <AlertRij kleur="positief" titel="Waarde gestegen" meta="positief" />
              <AlertRij kleur="negatief" titel="Rente omhoog" meta="negatief" />
              <AlertRij kleur="lime" titel="Je waarde-indicatie is bijgewerkt" meta="lime (site-echo)" />
              <AlertRij kleur="lavendel" titel="3 nieuwe verkopen in je buurt" meta="lavendel (site-echo)" />
            </div>
          </Kaart>
        </div>
      </section>

      <section className="space-y-4">
        <SectieLabel>Structuur en flow</SectieLabel>
        <StappenBalk stappen={["Inkomen", "Woonsituatie", "Uitkomst"]} actief={1} />
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
      </section>

      <section>
        <SectieLabel>Donkere banden (max 1 per pagina; hier naast elkaar als referentie)</SectieLabel>
        <div className="mt-3 space-y-5">
          <CtaBand
            titel="Claim je woning"
            tekst="Volg de waarde vanuit je eigen dashboard. Gratis, en opzeggen kan altijd."
            knopTekst="Naar mijn woning"
            href="#"
            pills={["Gratis", "Zonder account verwijderen kan ook"]}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Flux-kleurlaag: dashboard-compositie                               */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectieLabel>Flux-blokken op canvas (dashboard-compositie)</SectieLabel>
        <p className="mt-2 text-xs text-gedempt">
          Zwarte shell, grijs canvas, witte blokken op radius 24, precies een donkere tegel (AnalyseKaart) en een lime
          promo-moment. Voorbeelddata; in het echte dashboard komt alles uit de eigen woninggegevens.
        </p>
        <div className="mt-3 rounded-[24px] bg-canvas p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] bg-paneel p-6">
                <div className="flex items-center gap-3">
                  <IcoonRondje naam="huis" />
                  <p className="text-sm font-semibold text-inkt">Geschatte waarde</p>
                </div>
                <div className="mt-4">
                  <GrootCijfer waarde="427.000" eenheid="euro" delta="+5%" deltaRichting="op" deltaTint="lime" />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <StatTegel label="WOZ 2026" waarde="€ 398.000" tint="lime" delta="+4,2% t.o.v. 2025" />
                  <StatTegel label="Prijs per m2" waarde="€ 4.540" tint="lavendel" />
                  <StatTegel label="Bandbreedte" waarde="± € 32.000" />
                </div>
              </div>
              <AnalyseKaart
                titel="Waarde-ontwikkeling"
                meta="Per kwartaal, laatste 2 jaar"
                actie={<span className="inline-flex items-center rounded-full bg-shell-hoog px-3 py-1 text-xs font-semibold text-op-shell">2 jaar</span>}
              >
                <WaardeGrafiek
                  data={[
                    { label: "K1 '25", waarde: 392 },
                    { label: "K2 '25", waarde: 398 },
                    { label: "K3 '25", waarde: 396 },
                    { label: "K4 '25", waarde: 405 },
                    { label: "K1 '26", waarde: 411 },
                    { label: "K2 '26", waarde: 415 },
                    { label: "K3 '26", waarde: 421 },
                    { label: "K4 '26", waarde: 427 },
                  ]}
                />
              </AnalyseKaart>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] bg-paneel p-6">
                  <p className="text-sm font-semibold text-inkt">Verkoopdrukte per week</p>
                  <div className="mt-4">
                    <DotMatrix
                      waarden={[1, 2, 0, 3, 5, 4, 2, 1, 3, 6, 4, 2, 0, 1, 2, 4, 7, 5, 3, 2, 1]}
                      omschrijving="Verkopen per week in de buurt, afgelopen 21 weken: piek rond week 17"
                    />
                  </div>
                  <p className="mt-3 text-xs text-gedempt">DotMatrix: intensiteit in lavendel-tinten</p>
                </div>
                <div className="rounded-[24px] bg-paneel p-6">
                  <p className="text-sm font-semibold text-inkt">Woningtypen in de buurt</p>
                  <div className="mt-4">
                    <VoortgangsBalk
                      segmenten={[
                        { label: "Rijwoning", waarde: 214, kleur: "merk" },
                        { label: "Appartement", waarde: 96, kleur: "lavendel" },
                        { label: "Hoekwoning", waarde: 58, kleur: "lime" },
                        { label: "Vrijstaand", waarde: 22, kleur: "neutraal" },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-[24px] bg-paneel p-6">
                <p className="text-sm font-semibold text-inkt">Alerts</p>
                <div className="mt-2 divide-y divide-lijn">
                  <AlertRij kleur="lime" titel="Je waarde-indicatie is bijgewerkt" meta="vandaag" />
                  <AlertRij kleur="lavendel" titel="3 nieuwe verkopen in je buurt" meta="deze week" />
                  <AlertRij kleur="merk" titel="WOZ 2026 staat online" meta="vorige week" />
                </div>
              </div>
              <PromoBlok
                titel="Volg je woningwaarde"
                tekst="Zet alerts aan en zie het direct als er iets verandert in je buurt."
                knopTekst="Alerts aanzetten"
                href="#"
                illustratie="woningwaarde"
                radius="blok"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
