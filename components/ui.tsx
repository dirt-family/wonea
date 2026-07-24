import Link from "next/link";
import type { ReactNode } from "react";
import { Illustratie, type IllustratieNaam } from "@/components/illustraties";
import { Icoon, type IcoonNaam } from "@/components/iconen";

/** Basis-UI: alle pagina's gebruiken deze bouwstenen zodat de stijl 1 geheel is. */

export function Kaart({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[14px] border border-lijn bg-paneel p-6 shadow-zweef ${className}`}>{children}</div>;
}

export function SectieLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">{children}</p>;
}

export function KnopPrimair({ href, children, type }: { href?: string; children: ReactNode; type?: "submit" | "button" }) {
  const cls =
    "inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht focus:outline-2 focus:outline-offset-2 focus:outline-merk";
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type ?? "submit"} className={cls}>{children}</button>;
}

export function KnopSecundair({ href, children, type }: { href?: string; children: ReactNode; type?: "submit" | "button" }) {
  const cls =
    "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk";
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type ?? "button"} className={cls}>{children}</button>;
}

export function Veld({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-inkt">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gedempt">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-lijn bg-paneel px-4 py-3 text-sm text-inkt placeholder:text-gedempt focus:border-merk focus:outline-none";

export function BronLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-wash px-2.5 py-0.5 text-[11px] font-medium text-accent-800">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* v3-componenten: huisstijl "navy naar amber" (docs/BRAND.md, Huisstijl v3)   */
/* ------------------------------------------------------------------------- */

/**
 * Pil-familie: klein label in een wash met rand. Varianten:
 * - merk (navy-wash): themalabels, filters, kenmerken
 * - amber (amber-wash): warme nadruk, "nieuw"/actie-labels (tekst accent-800)
 * - lime (lime-wash): energie/actie-labels in het dashboard en de site-echo
 *   (tekst lime-diep, 7,1:1 op de wash)
 * - lavendel (lavendel-wash): rustige datalabels (tekst lavendel-diep, 6,5:1)
 * - neutraal: stille metalabels
 * Voor richting-indicatoren bestaat DeltaPil; voor bronnen BronLabel.
 */
export function Pil({
  variant = "neutraal",
  children,
}: {
  variant?: "merk" | "amber" | "lime" | "lavendel" | "neutraal";
  children: ReactNode;
}) {
  const stijl =
    variant === "merk"
      ? "border-merk-200 bg-merk-wash text-merk"
      : variant === "amber"
        ? "border-accent-200 bg-accent-wash text-accent-800"
        : variant === "lime"
          ? "border-lime-300 bg-lime-wash text-lime-diep"
          : variant === "lavendel"
            ? "border-lavendel-200 bg-lavendel-wash text-lavendel-diep"
            : "border-lijn bg-achtergrond text-inkt-zacht";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stijl}`}>
      {children}
    </span>
  );
}

/** Icoon in een tint-rondje (dashboard-shell-element, ook elders functioneel). */
export function IcoonRondje({ naam, tint = "merk", maat = "m" }: { naam: IcoonNaam; tint?: "merk" | "amber"; maat?: "m" | "l" }) {
  const kleur = tint === "amber" ? "bg-accent-wash text-accent-800" : "bg-merk-wash text-merk";
  const grootte = maat === "l" ? "h-11 w-11" : "h-9 w-9";
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${grootte} ${kleur}`}>
      <Icoon naam={naam} maat={maat === "l" ? "m" : "s"} />
    </span>
  );
}

/**
 * Oversized cijfer met kleine eenheid-suffix en optionele delta-pill
 * (flux-patroon "grote vriendelijke cijfers"). waarde is een al geformatteerde
 * string (bijv. via formatEuro); we formatteren hier niets zelf.
 */
export function GrootCijfer({
  waarde,
  eenheid,
  delta,
  deltaRichting = "vlak",
  deltaTint = "wash",
}: {
  waarde: string;
  eenheid?: string;
  delta?: string;
  deltaRichting?: "op" | "neer" | "vlak";
  /** "lime" = de flux-delta (positief als vol lime-vlak, tekst shell) */
  deltaTint?: "wash" | "lime";
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-display text-5xl font-semibold tabular-nums text-merk">{waarde}</span>
      {eenheid ? <span className="text-base font-medium text-inkt-zacht">{eenheid}</span> : null}
      {delta ? <DeltaPil richting={deltaRichting} tint={deltaTint}>{delta}</DeltaPil> : null}
    </p>
  );
}

/**
 * Sectie-wrapper voor de wash-dramaturgie: secties wisselen af tussen
 * navy-wash, amber-wash en paneel-wit (nooit twee dezelfde washes direct na
 * elkaar; zie BRAND.md). Volle breedte; de aanroeper zet zijn eigen container.
 */
export function TintSectie({
  wash = "geen",
  children,
  className = "",
  ...rest
}: {
  wash?: "navy" | "amber" | "paneel" | "geen";
  children: ReactNode;
  className?: string;
} & React.ComponentPropsWithoutRef<"section">) {
  const bg =
    wash === "navy"
      ? "bg-wash-navy"
      : wash === "amber"
        ? "bg-wash-amber"
        : wash === "paneel"
          ? "border-y border-lijn bg-paneel"
          : "";
  return (
    <section className={`${bg} ${className}`} {...rest}>
      {children}
    </section>
  );
}

/**
 * Alert/lijst-rij met kleurdot (prototype-patroon): voor feeds, checklijsten
 * en keuzelijsten. Componeer meerdere rijen met divide-y divide-lijn.
 */
export function AlertRij({
  kleur = "merk",
  titel,
  meta,
  href,
}: {
  kleur?: "merk" | "amber" | "positief" | "negatief" | "lime" | "lavendel";
  titel: ReactNode;
  meta?: string;
  href?: string;
}) {
  const dot =
    kleur === "amber"
      ? "bg-accent-500"
      : kleur === "positief"
        ? "bg-positief"
        : kleur === "negatief"
          ? "bg-negatief"
          : kleur === "lime"
            ? "bg-lime-600"
            : kleur === "lavendel"
              ? "bg-lavendel-500"
              : "bg-merk-400";
  const inhoud = (
    <span className="flex items-start gap-3">
      <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0">
        <span className="block text-sm leading-relaxed text-inkt">{titel}</span>
        {meta ? <span className="mt-0.5 block text-xs text-gedempt">{meta}</span> : null}
      </span>
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="block px-1 py-3 transition-colors hover:bg-merk-50">
        {inhoud}
      </Link>
    );
  }
  return <div className="px-1 py-3">{inhoud}</div>;
}

/**
 * De rijke woningkaart-signatuur: illustratie-hoek op tint, labelbadge,
 * adres + micro-info, waarde met bandbreedte-regel. Voor zoekresultaten,
 * woningen-rijen en buurtpagina's. Alleen echte data doorgeven; ontbreekt een
 * veld, dan valt de regel gewoon weg (eerlijk leeg).
 */
export function WoningKaart({
  href,
  adres,
  plaats,
  micro,
  waarde,
  bandbreedte,
  energielabel,
  illustratie = "woningwaarde",
  tag,
  className = "",
}: {
  href: string;
  adres: string;
  plaats: string;
  /** bijv. "94 m² · rijwoning · 1978" — alleen echte velden, gescheiden met · */
  micro?: string;
  /** al geformatteerd, bijv. "€ 427.000" */
  waarde?: string;
  /** al geformatteerd, bijv. "€ 395.000 – € 459.000" */
  bandbreedte?: string;
  energielabel?: string | null;
  illustratie?: IllustratieNaam | null;
  tag?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`til-op group block overflow-hidden rounded-[14px] border border-lijn bg-paneel shadow-zweef focus:outline-2 focus:outline-offset-2 focus:outline-merk ${className}`}
    >
      {illustratie ? (
        <div className="relative flex h-24 items-end justify-end bg-wash-navy px-5">
          <Illustratie naam={illustratie} className="h-20 w-auto translate-y-1" />
          {tag ? <span className="absolute left-5 top-4"><ModuleTag>{tag}</ModuleTag></span> : null}
        </div>
      ) : null}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-inkt group-hover:text-merk">{adres}</p>
            <p className="mt-0.5 text-xs text-gedempt">{plaats}</p>
          </div>
          {energielabel ? <EnergieLabelBadge label={energielabel} klein /> : null}
        </div>
        {micro ? <p className="mt-3 text-xs text-inkt-zacht">{micro}</p> : null}
        {waarde ? (
          <p className="mt-3 border-t border-lijn pt-3">
            <span className="block font-display text-xl font-semibold tabular-nums text-merk">{waarde}</span>
            {bandbreedte ? <span className="mt-0.5 block text-xs tabular-nums text-gedempt">{bandbreedte}</span> : null}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Donkere navy CTA-band (radius-band 20, de gedocumenteerde uitzondering op de
 * radius-drieslag): witte serif-kop, optionele pills, amber knop met
 * merk-900-tekst (6,8:1). Maximaal 1 donkere band per pagina (thema-slot).
 */
export function CtaBand({
  titel,
  tekst,
  knopTekst,
  href,
  pills,
}: {
  titel: string;
  tekst?: string;
  knopTekst: string;
  href: string;
  pills?: string[];
}) {
  return (
    <div className="rounded-[20px] bg-merk-900 px-7 py-10 sm:px-10">
      {pills && pills.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p} className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-merk-100">
              {p}
            </span>
          ))}
        </div>
      ) : null}
      <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">{titel}</h2>
      {tekst ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-merk-200">{tekst}</p> : null}
      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-merk-900 transition-colors hover:bg-accent-400 focus:outline-2 focus:outline-offset-2 focus:outline-accent-300"
        >
          {knopTekst}
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Flux-kleurlaag (besluit Mitch 24 jul, BRAND.md "Flux-kleurlaag"):           */
/* shell-zwart + lime + lavendel voor de ingelogde omgeving, gedoseerd als     */
/* site-brede echo. Tekst op lime/lavendel is ALTIJD shell of inkt.            */
/* ------------------------------------------------------------------------- */

/**
 * Promo/CTA-blok (het flux-sidebar-promopatroon): lime kaart met optionele
 * illustratie en een zwarte pill-knop. Maximaal 1 per pagina en altijd
 * functioneel (bijv. "Claim je woning" of waarde-alerts aanzetten).
 * radius="blok" (24) alleen binnen het dashboard-frame; elders "kaart" (14).
 */
export function PromoBlok({
  titel,
  tekst,
  knopTekst,
  href,
  illustratie,
  radius = "kaart",
  className = "",
}: {
  titel: string;
  tekst?: string;
  knopTekst: string;
  href: string;
  illustratie?: IllustratieNaam;
  radius?: "kaart" | "blok";
  className?: string;
}) {
  const hoeken = radius === "blok" ? "rounded-[24px]" : "rounded-[14px]";
  return (
    <div className={`overflow-hidden bg-lime p-5 text-shell ${hoeken} ${className}`}>
      {illustratie ? (
        <div className="-mx-5 -mt-5 mb-4 flex justify-end bg-lime-200 px-5 pt-4">
          <Illustratie naam={illustratie} className="h-16 w-auto translate-y-1" />
        </div>
      ) : null}
      <p className="text-sm font-bold leading-snug">{titel}</p>
      {tekst ? <p className="mt-1.5 text-xs leading-relaxed text-shell">{tekst}</p> : null}
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-full bg-shell px-5 py-2.5 text-xs font-semibold text-op-shell transition-colors hover:bg-shell-hoog focus:outline-2 focus:outline-offset-2 focus:outline-shell"
      >
        {knopTekst}
      </Link>
    </div>
  );
}

/**
 * Donkere analysekaart (flux): shell-zwarte kaart op radius-band (20) voor de
 * waarde-ontwikkelingsgrafiek en andere donkere dataviz. Zet de klasse
 * `chart-op-shell` zodat elke Bklit-grafiek erbinnen automatisch de
 * shell-grafiektokens leest (historie gedempt, lavendel = vergelijking,
 * lime = actueel; zie globals.css). Telt als de ene donkere band per pagina;
 * actie is de plek voor bijv. een periode-switch.
 */
export function AnalyseKaart({
  titel,
  meta,
  actie,
  children,
  className = "",
}: {
  titel: string;
  meta?: string;
  actie?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`chart-op-shell rounded-[20px] bg-shell p-6 text-op-shell ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-op-shell">{titel}</p>
          {meta ? <p className="mt-0.5 text-xs text-op-shell-zacht">{meta}</p> : null}
        </div>
        {actie ? <div className="shrink-0">{actie}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/**
 * Dot-matrix (flux): intensiteitsweergave in lavendel-tinten, zoals de
 * chart-scale maar dan als stippenraster (bijv. verkopen per week, drukte per
 * maand). Sequentiële schaal: 0 = canvas-grijs, daarna lavendel-200 tot -500.
 * Bedoeld op licht (witte blokken); geef ALTIJD een omschrijving mee, dat is
 * de toegankelijke samenvatting van wat het raster laat zien.
 * Alleen echte reeksen doorgeven; lege reeks rendert niets.
 */
export function DotMatrix({
  waarden,
  omschrijving,
  kolommen = 7,
  max,
  className = "",
}: {
  waarden: number[];
  /** bijv. "Verkopen per week, afgelopen 12 weken: piek in week 3" */
  omschrijving: string;
  kolommen?: number;
  /** eigen schaal-maximum; default het hoogste punt in de reeks */
  max?: number;
  className?: string;
}) {
  if (waarden.length === 0) return null;
  const top = max ?? Math.max(...waarden);
  const tint = (w: number) => {
    if (top <= 0 || w <= 0) return "bg-canvas";
    const q = w / top;
    if (q <= 0.25) return "bg-lavendel-200";
    if (q <= 0.5) return "bg-lavendel-300";
    if (q <= 0.75) return "bg-lavendel-400";
    return "bg-lavendel-500";
  };
  return (
    <div
      role="img"
      aria-label={omschrijving}
      className={`inline-grid gap-1.5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${kolommen}, 0.625rem)` }}
    >
      {waarden.map((w, i) => (
        <span key={i} aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${tint(w)}`} />
      ))}
    </div>
  );
}

export type VoortgangSegment = {
  label: string;
  waarde: number;
  kleur?: "merk" | "lavendel" | "lime" | "amber" | "neutraal";
};

const VOORTGANG_KLEUREN: Record<NonNullable<VoortgangSegment["kleur"]>, string> = {
  merk: "bg-merk-500",
  lavendel: "bg-lavendel-500",
  lime: "bg-lime-600",
  amber: "bg-accent",
  neutraal: "bg-merk-200",
};
const VOORTGANG_VOLGORDE = ["merk", "lavendel", "lime", "amber", "neutraal"] as const;

/**
 * Voortgangsbalk met kleurpunt-legenda (flux): een gestapelde balk waarin elk
 * segment een categorie is, met eronder de legenda (kleurdot + label +
 * waarde). Kleuren op graphics-contrast (merk-500 / lavendel-500 / lime-600 /
 * accent-700 / merk-200); geen kleur meegegeven = automatische volgorde.
 * Alleen echte waarden; telt alles op tot 0, dan rendert er niets (de
 * aanroeper toont een eerlijke LegeStaat met de bron).
 */
export function VoortgangsBalk({
  segmenten,
  formatteer,
  omschrijving,
  className = "",
}: {
  segmenten: VoortgangSegment[];
  /** waarde-opmaak in de legenda, default nl-NL getal */
  formatteer?: (n: number) => string;
  /** aria-samenvatting; default opgebouwd uit de segmenten zelf */
  omschrijving?: string;
  className?: string;
}) {
  const totaal = segmenten.reduce((som, s) => som + s.waarde, 0);
  if (!(totaal > 0)) return null;
  const fmt = formatteer ?? ((n: number) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(n));
  const kleurVan = (s: VoortgangSegment, i: number) => VOORTGANG_KLEUREN[s.kleur ?? VOORTGANG_VOLGORDE[i % VOORTGANG_VOLGORDE.length]];
  const samenvatting = omschrijving ?? segmenten.map((s) => `${s.label} ${fmt(s.waarde)}`).join(", ");
  return (
    <div className={className}>
      <div role="img" aria-label={samenvatting} className="flex h-3 gap-0.5">
        {segmenten.map((s, i) =>
          s.waarde > 0 ? (
            <span
              key={s.label}
              aria-hidden="true"
              className={`h-3 min-w-1.5 rounded-full ${kleurVan(s, i)}`}
              style={{ width: `${(s.waarde / totaal) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segmenten.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${kleurVan(s, i)}`} />
            <dt className="text-inkt-zacht">{s.label}</dt>
            <dd className="font-semibold tabular-nums text-inkt">{fmt(s.waarde)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function VoorbeelddataLabel() {
  return (
    <BronLabel>
      Voorbeelddata: in deze testfase tonen we fictieve verkopen op buurtniveau, niet gekoppeld aan echte adressen
    </BronLabel>
  );
}

/* ------------------------------------------------------------------------- */
/* Uitkomst- en datavisualisatie (gedeeld door alle tools)                    */
/* ------------------------------------------------------------------------- */

/** Bandbreedte-visual: range-balk met marker. De kern van de Wonea-eerlijkheid. */
export function Bandbreedte({ laag, waarde, hoog, formatteer }: { laag: number; waarde: number; hoog: number; formatteer?: (n: number) => string }) {
  const fmt = formatteer ?? ((n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));
  const positie = hoog === laag ? 50 : ((waarde - laag) / (hoog - laag)) * 100;
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-merk-wash">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full border border-lijn" />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-merk shadow"
          style={{ left: `calc(${positie}% - 8px)` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm text-inkt-zacht">
        <span>{fmt(laag)}</span>
        <span>{fmt(hoog)}</span>
      </div>
    </div>
  );
}

/**
 * Kerncijfer-tegel: label, grote waarde, optionele deltaregel.
 * tint="merk"/"amber" geeft de stat-tile-op-tint uit het prototype
 * (achtergrond-tint, geen witte kaart); default blijft de witte paneel-tegel.
 * tint="lime"/"lavendel" is de flux-variant: het VOLLE anker-vlak met alle
 * tekst in shell-zwart (13,5:1 op lime, 7,9:1 op lavendel) — de richting van
 * een delta zit daar in de tekst zelf ("+4,2%"), niet in een kleur.
 * Max 1 lime- of lavendel-tegel per stat-rij (flux: precies een kleurtegel).
 */
export function StatTegel({
  label,
  waarde,
  delta,
  deltaRichting,
  tint = "paneel",
}: {
  label: string;
  waarde: string;
  delta?: string;
  deltaRichting?: "positief" | "negatief" | "neutraal";
  tint?: "paneel" | "merk" | "amber" | "lime" | "lavendel";
}) {
  const opAnker = tint === "lime" || tint === "lavendel";
  const deltaKleur = opAnker
    ? "text-shell"
    : deltaRichting === "positief"
      ? "text-positief"
      : deltaRichting === "negatief"
        ? "text-negatief"
        : "text-gedempt";
  const vlak =
    tint === "merk"
      ? "bg-merk-wash"
      : tint === "amber"
        ? "bg-accent-wash"
        : tint === "lime"
          ? "bg-lime"
          : tint === "lavendel"
            ? "bg-lavendel"
            : "border border-lijn bg-paneel shadow-zweef";
  const labelKleur = opAnker ? "text-shell" : tint === "amber" ? "text-accent-800" : "text-gedempt";
  return (
    <div className={`rounded-[14px] p-5 ${vlak}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${labelKleur}`}>{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${opAnker ? "text-shell" : "text-merk"}`}>{waarde}</p>
      {delta ? <p className={`mt-1 text-sm ${deltaKleur}`}>{delta}</p> : null}
    </div>
  );
}

/** Grote uitkomstkaart voor rekentools: een resultaat met context eronder. */
export function UitkomstKaart({ label, bedrag, children }: { label: string; bedrag: string; children?: ReactNode }) {
  return (
    <Kaart className="bg-merk-wash">
      <SectieLabel>{label}</SectieLabel>
      <p className="mt-3 font-display text-5xl font-semibold tabular-nums text-merk">{bedrag}</p>
      {children}
    </Kaart>
  );
}

/** Sparkline uit een reeks getallen (server-side SVG, currentColor). */
export function Sparkline({ waarden, breedte = 160, hoogte = 40, className = "text-merk" }: { waarden: number[]; breedte?: number; hoogte?: number; className?: string }) {
  if (waarden.length < 2) return null;
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const span = max - min || 1;
  const punten = waarden
    .map((w, i) => `${((i / (waarden.length - 1)) * (breedte - 4) + 2).toFixed(1)},${(hoogte - 4 - ((w - min) / span) * (hoogte - 8) + 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${breedte} ${hoogte}`} className={className} style={{ width: breedte, height: hoogte }} aria-hidden="true">
      <polyline points={punten} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------------- */
/* Structuur en flow                                                          */
/* ------------------------------------------------------------------------- */

/** Stappenindicator voor funnels en rekentools. */
export function StappenBalk({ stappen, actief }: { stappen: string[]; actief: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Voortgang">
      {stappen.map((stap, i) => (
        <li key={stap} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              i < actief ? "bg-merk text-white" : i === actief ? "border-2 border-merk text-merk" : "border border-lijn text-gedempt"
            }`}
            aria-current={i === actief ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={i === actief ? "font-semibold text-inkt" : "text-gedempt"}>{stap}</span>
          {i < stappen.length - 1 ? <span className="mx-1 h-px w-6 bg-lijn" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

/** Uitklapbare uitleg (native details, geen JS nodig). Voor methode-uitleg per tool. */
export function UitklapUitleg({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <details className="group rounded-[14px] border border-lijn bg-paneel">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-inkt transition-colors [&::-webkit-details-marker]:hidden hover:text-merk">
        <span className="mr-2 inline-block transition-transform duration-200 group-open:rotate-90">&#8250;</span>
        {titel}
      </summary>
      <div className="border-t border-lijn px-5 py-4 text-sm leading-relaxed text-inkt-zacht">{children}</div>
    </details>
  );
}

/** Lege staat: eerlijk vertellen wat er ontbreekt en wat de bron is. */
export function LegeStaat({ titel, tekst }: { titel: string; tekst: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-lijn bg-achtergrond p-8 text-center">
      <p className="font-semibold text-inkt">{titel}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gedempt">{tekst}</p>
    </div>
  );
}

/** Consistente funnel-CTA: benoemt ALTIJD wat er met de aanvraag gebeurt. */
export function LeadCta({ titel, tekst, knopTekst, href, ontvanger }: { titel: string; tekst: string; knopTekst: string; href: string; ontvanger: string }) {
  return (
    <Kaart className="bg-merk-wash">
      <h2 className="text-lg font-semibold">{titel}</h2>
      <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">{tekst}</p>
      <KnopPrimair href={href}>{knopTekst}</KnopPrimair>
      <p className="mt-3 text-xs text-gedempt">Je aanvraag gaat na jouw akkoord naar {ontvanger}. Niet naar anderen.</p>
    </Kaart>
  );
}

/* ------------------------------------------------------------------------- */
/* v2-componenten, geoogst uit Mitch' prototype (docs/PROTOTYPE-OOGST.md)      */
/* ------------------------------------------------------------------------- */

/**
 * Delta-pill: kleine richting-indicator bij een cijfer (+4,2% dit jaar).
 * tint="lime" is de flux-variant: de POSITIEVE richting wordt een vol
 * lime-vlak met shell-zwarte tekst (13,5:1); neer/vlak blijven de washes.
 * Gebruik lime in het dashboard en bij stat-tegels in de site-echo.
 */
export function DeltaPil({
  richting,
  tint = "wash",
  children,
}: {
  richting: "op" | "neer" | "vlak";
  tint?: "wash" | "lime";
  children: ReactNode;
}) {
  const kleur =
    richting === "op"
      ? tint === "lime"
        ? "bg-lime text-shell"
        : "bg-positief-wash text-positief"
      : richting === "neer"
        ? "bg-negatief-wash text-negatief"
        : "bg-merk-wash text-inkt-zacht";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${kleur}`}>{children}</span>;
}

/**
 * Energielabel-badge in de EU-labelkleuren (tokens --color-label-a..g in
 * globals.css; overal identiek). A+..A++++ tonen we als A. Tekstkleur per
 * label vastgelegd op contrast: wit op A/E/F/G, inkt op B/C/D (zie BRAND.md).
 */
const LABELS: Record<string, { kleur: string; donkereTekst: boolean }> = {
  A: { kleur: "var(--color-label-a)", donkereTekst: false },
  B: { kleur: "var(--color-label-b)", donkereTekst: true },
  C: { kleur: "var(--color-label-c)", donkereTekst: true },
  D: { kleur: "var(--color-label-d)", donkereTekst: true },
  E: { kleur: "var(--color-label-e)", donkereTekst: false },
  F: { kleur: "var(--color-label-f)", donkereTekst: false },
  G: { kleur: "var(--color-label-g)", donkereTekst: false },
};
export function EnergieLabelBadge({ label, klein = false }: { label: string; klein?: boolean }) {
  const basis = label.replace(/\+/g, "").toUpperCase().charAt(0);
  const info = LABELS[basis];
  if (!info) return null;
  const maat = klein ? "h-7 w-7 text-sm" : "h-10 w-10 text-lg";
  return (
    <span
      className={`inline-grid place-items-center rounded-lg font-bold ${maat} ${info.donkereTekst ? "text-inkt" : "text-white"}`}
      style={{ backgroundColor: info.kleur }}
      aria-label={`Energielabel ${label.toUpperCase()}`}
    >
      {label.toUpperCase()}
    </span>
  );
}

/** Klein module-tagje rechtsboven in een kaartkop ("gratis", "rekenhulp"). */
export function ModuleTag({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gedempt">{children}</span>;
}

/** Feitenlijst: label-waarde-rijen in 2 kolommen (kenmerken van een woning). */
export function FeitenLijst({ feiten }: { feiten: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-7 sm:grid-cols-2">
      {feiten.map(([label, waarde]) => (
        <div key={label} className="flex justify-between border-b border-lijn py-2.5 text-sm last:border-0 sm:[&:nth-last-child(2)]:border-0">
          <dt className="text-inkt-zacht">{label}</dt>
          <dd className="font-semibold tabular-nums">{waarde}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Vergelijkingstabel (hypotheekvergelijker e.d.): kop + rijen, bron onderaan. */
export function VergelijkTabel({ koppen, rijen, bron }: { koppen: string[]; rijen: ReactNode[][]; bron: string }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-[14px] border border-lijn bg-paneel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
              {koppen.map((k) => (
                <th key={k} className="px-4 py-3 font-medium">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.map((rij, i) => (
              <tr key={i} className="border-b border-lijn transition-colors last:border-0 hover:bg-merk-50">
                {rij.map((cel, j) => (
                  <td key={j} className="px-4 py-3">{cel}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gedempt">{bron}</p>
    </div>
  );
}
