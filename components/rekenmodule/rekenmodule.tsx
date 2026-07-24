"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { EnergieLabelBadge, SectieLabel } from "@/components/ui";
import { Icoon } from "@/components/iconen";
import { bewaarSessie, klemStap, laadSessie, parseStapParam, STAP_PARAM, stapZoekdeel } from "./logica";

/**
 * RekenModule: het gedeelde stap-frame voor alle rekenhulpen. Een module
 * levert alleen zijn stappen (vraag, velden, validatie) en een uitkomst-view;
 * dit frame regelt de rest: voortgangsbalk, 1 stap tegelijk, Volgende/Terug,
 * validatie-gate, stap-in-de-URL (?stap=2, deelbaar), focus naar de stapkop,
 * Enter = volgende, zachte stap-overgang en sessie-persistentie.
 *
 * Rekenregels horen hier nadrukkelijk NIET: die blijven in lib/ en de
 * berekening.ts van de tool. Dit is een UI-schil. Referentie-implementatie:
 * app/budget/stepper.tsx.
 *
 * Huisstijl v3 (docs/BRAND.md): de voortgangsbalk toont kleur-voortgang
 * (navy = gedaan, amber = actief), keuzeopties zijn rijke kaarten
 * (KeuzeKaart/EnergieLabelKeuze) en de uitkomst is een warm moment
 * (UitkomstMoment op amber-wash, met BandbreedteInvaart).
 */

export type StapDefinitie = {
  /** Stabiele sleutel, bv. "inkomen". */
  id: string;
  /** Kort woord voor de voortgangsbalk, bv. "Inkomen". */
  titel: string;
  /** De vraagzin die als stapkop (h2) verschijnt, bv. "Wat verdien je?". */
  vraag: string;
  /** De velden van de stap (zonder eigen kop; het frame zet de vraag erboven). */
  inhoud: ReactNode;
  /**
   * Validatie van deze stap: null als de invoer in orde is, anders de melding
   * die de bezoeker helpt ("Vul je bruto jaarinkomen in..."). Weglaten =
   * stap is altijd in orde (bv. een optionele stap).
   */
  valideer?: () => string | null;
};

export type RekenModuleApi = {
  /** Spring naar een stap (0-gebaseerd), bv. vanuit een "wijzig"-link. */
  gaNaarStap: (stapIndex: number) => void;
};

export type SessieKoppeling = {
  /** De volledige invoerstand als plat, JSON-serialiseerbaar object. */
  snapshot: () => Record<string, unknown>;
  /**
   * Zet een eerder bewaarde stand terug. Kom je uit sessionStorage, dus
   * behandel elk veld als onbetrouwbaar: controleer het type voor je iets
   * overneemt.
   */
  herstel: (data: Record<string, unknown>) => void;
};

// Zelfde stijl als KnopPrimair/KnopSecundair; ui.tsx heeft geen
// onClick/aria-variant, dus het frame draagt de klassen zelf (net als de
// eerdere budget-stepper deed).
const knopPrimairCls =
  "group inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht focus:outline-2 focus:outline-offset-2 focus:outline-merk aria-disabled:opacity-60";
const knopSecundairCls =
  "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk";

// Zachte stap-overgang: hergebruikt de reveal-in-keyframes en motion-tokens
// uit globals.css. prefers-reduced-motion wordt daar globaal geneutraliseerd.
const stapAnimatie: CSSProperties = { animation: "reveal-in var(--duur-kort) var(--ease-uit) both" };

/* -------------------------------------------------------------------------
 * Voortgangsbalk met kleur-voortgang (v3): navy-gevulde cirkels voor gedane
 * stappen (klikbaar, terug is altijd veilig; vooruit blijft via de
 * validatie-gate lopen), amber voor de actieve stap (accent-500-vlak met
 * merk-900-cijfer, het toegestane paar op donker/vlak), en een navy-vullende
 * verbindingslijn die de voortgang letterlijk laat zien.
 * (Heet StapVoortgang: VoortgangsBalk in components/ui.tsx is de gestapelde
 * categorie-balk uit de flux-kleurlaag, een ander component.)
 * ---------------------------------------------------------------------- */
function StapVoortgang({ titels, actief, opStap }: { titels: string[]; actief: number; opStap: (stapIndex: number) => void }) {
  return (
    <ol className="flex items-start" aria-label="Voortgang">
      {titels.map((titel, i) => {
        const gedaan = i < actief;
        const dezeActief = i === actief;
        const cirkel = gedaan
          ? "bg-merk text-white"
          : dezeActief
            ? "bg-accent-500 font-bold text-merk-900"
            : "border border-lijn bg-paneel text-gedempt";
        const label = (
          <span
            className={`text-xs ${dezeActief ? "font-semibold text-inkt" : "hidden text-gedempt sm:block"}`}
          >
            {titel}
          </span>
        );
        return (
          <li key={i} className={`flex items-start ${i < titels.length - 1 ? "min-w-0 flex-1" : ""}`} aria-current={dezeActief ? "step" : undefined}>
            {gedaan ? (
              <button
                type="button"
                onClick={() => opStap(i)}
                className="group flex shrink-0 flex-col items-center gap-1.5 rounded-lg px-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-merk"
                aria-label={`Terug naar stap ${i + 1}: ${titel}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition-colors group-hover:bg-merk-licht ${cirkel}`}
                >
                  {i + 1}
                </span>
                {label}
              </button>
            ) : (
              <span className="flex shrink-0 flex-col items-center gap-1.5 px-0.5">
                <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition-colors ${cirkel}`}>
                  {i + 1}
                </span>
                {label}
              </span>
            )}
            {i < titels.length - 1 ? (
              <span
                aria-hidden="true"
                className={`mx-1.5 mt-3 h-1 min-w-4 flex-1 rounded-full transition-colors sm:mx-2 ${gedaan ? "bg-merk" : "bg-lijn"}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function RekenModule({
  moduleId,
  stappen,
  uitkomst,
  uitkomstTitel = "Uitkomst",
  uitkomstKnopTekst = "Bekijk je uitkomst",
  sessie,
}: {
  /** Stabiele naam van de rekenhulp, bv. "budget"; sleutel voor de sessie-opslag. */
  moduleId: string;
  /** De invoerstappen, in volgorde. De uitkomst is altijd de laatste stap. */
  stappen: StapDefinitie[];
  /** De uitkomst-view; krijgt de api (gaNaarStap) voor "wijzig"-links. */
  uitkomst: (api: RekenModuleApi) => ReactNode;
  /** Label van de laatste stap in de voortgangsbalk. */
  uitkomstTitel?: string;
  /** Tekst op de Volgende-knop van de laatste invoerstap. */
  uitkomstKnopTekst?: string;
  /** Sessie-persistentie (sessionStorage); weglaten = geen persistentie. */
  sessie?: SessieKoppeling;
}) {
  const totaal = stappen.length + 1;
  // De server rendert altijd stap 1; de URL en de sessie worden pas na mount
  // gelezen (effecten hieronder), zodat er geen hydration-verschil ontstaat.
  const [stap, setStap] = useState(0);
  const [pogingGedaan, setPogingGedaan] = useState(false);
  const [hersteld, setHersteld] = useState(false);
  const kopRef = useRef<HTMLHeadingElement>(null);
  const focusNaWissel = useRef(false);
  const laatstBewaard = useRef<string | null>(null);
  const stappenRef = useRef(stappen);
  stappenRef.current = stappen;

  const huidige = stap < stappen.length ? stappen[stap] : null;
  const actueleMelding = huidige?.valideer?.() ?? null;
  const meldingId = `rekenmodule-${moduleId}-melding`;

  function schrijfUrl(index: number) {
    // replaceState (geen pushState): de stap vervuilt de browsergeschiedenis
    // niet, maar de URL is wel altijd deelbaar. Next' eigen history.state
    // blijft behouden.
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, "", pathname + stapZoekdeel(search, index) + hash);
  }

  function naarStap(index: number, focus: boolean) {
    const doel = Math.max(0, Math.min(index, totaal - 1));
    setPogingGedaan(false);
    if (focus) focusNaWissel.current = true;
    setStap(doel);
    schrijfUrl(doel);
  }

  function bijVersturen(e: FormEvent) {
    // Enter in een veld en de Volgende-knop komen allebei hier binnen.
    e.preventDefault();
    if (actueleMelding) {
      setPogingGedaan(true);
      return;
    }
    naarStap(stap + 1, true);
  }

  // 1) Sessie-herstel, voor alles: de validaties moeten over de herstelde
  //    invoer gaan voordat we de stap uit de URL beoordelen.
  useEffect(() => {
    if (sessie) {
      const data = laadSessie(moduleId);
      if (data) sessie.herstel(data);
    }
    setHersteld(true);
    // Bewust alleen bij mount; moduleId en sessie wisselen niet tijdens de sessie.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Stap uit de URL lezen (?stap=2), geklemd op de validatiestand: dieper
  //    delen dan de invoer toestaat valt terug op de eerste onaffe stap;
  //    ongeldige waarden vallen stil terug op stap 1.
  useEffect(() => {
    if (!hersteld) return;
    const defs = stappenRef.current;
    const gewenst = parseStapParam(new URLSearchParams(window.location.search).get(STAP_PARAM), defs.length + 1);
    const doel = klemStap(gewenst, defs.map((s) => s.valideer?.() ?? null));
    if (doel !== 0) setStap(doel);
    if (doel !== gewenst) schrijfUrl(doel);
  }, [hersteld]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3) Sessie-persistentie: na elke render de stand bewaren als die wijzigde.
  //    Pas na het herstel, anders overschrijft de lege beginstand de sessie.
  useEffect(() => {
    if (!hersteld || !sessie) return;
    const json = JSON.stringify(sessie.snapshot());
    if (json !== laatstBewaard.current) {
      laatstBewaard.current = json;
      bewaarSessie(moduleId, json);
    }
  });

  // 4) Focus naar de stapkop na een bewuste stapwissel (niet bij laden).
  useEffect(() => {
    if (focusNaWissel.current) {
      focusNaWissel.current = false;
      kopRef.current?.focus();
    }
  }, [stap]);

  return (
    <div>
      <StapVoortgang titels={[...stappen.map((s) => s.titel), uitkomstTitel]} actief={stap} opStap={(i) => naarStap(i, true)} />

      {huidige ? (
        <form onSubmit={bijVersturen} noValidate>
          <div key={huidige.id} style={stapAnimatie}>
            <fieldset className="mt-6 min-w-0">
              <legend className="p-0">
                <h2 ref={kopRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
                  {huidige.vraag}
                </h2>
              </legend>
              <div className="mt-4 space-y-5">{huidige.inhoud}</div>
            </fieldset>
          </div>

          {pogingGedaan && actueleMelding ? (
            <p id={meldingId} role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg border border-negatief/30 bg-negatief-wash px-4 py-3 text-sm text-negatief">
              <Icoon naam="waarschuwing" maat="s" className="mt-0.5 shrink-0" />
              {actueleMelding}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {stap > 0 ? (
              <button type="button" onClick={() => naarStap(stap - 1, true)} className={knopSecundairCls}>
                Terug
              </button>
            ) : null}
            {/* aria-disabled in plaats van disabled: de knop blijft klikbaar
                en legt bij een klik uit wat er nog mist (inline melding). */}
            <button
              type="submit"
              aria-disabled={actueleMelding != null}
              aria-describedby={pogingGedaan && actueleMelding ? meldingId : undefined}
              className={knopPrimairCls}
            >
              {stap === stappen.length - 1 ? uitkomstKnopTekst : "Volgende"}
              <Icoon naam="pijlRechts" maat="s" className="ml-2 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </form>
      ) : (
        <div key="uitkomst" style={stapAnimatie} className="mt-6">
          <h2 ref={kopRef} tabIndex={-1} className="sr-only focus:outline-none">
            {uitkomstTitel}
          </h2>
          {uitkomst({ gaNaarStap: (i) => naarStap(i, true) })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Keuzekaarten (v3): keuzeopties als rijke selecteerbare kaarten met
 * hover-lift. De input blijft een echt (native) radio/checkbox-element:
 * toetsenbord, screenreader en focus werken zoals de bezoeker verwacht.
 * Gekozen = navy rand + navy-wash; de kaart als geheel is het klikvlak.
 * ---------------------------------------------------------------------- */

export function KeuzeKaart({
  soort = "radio",
  naam,
  waarde,
  checked,
  onKies,
  titel,
  detail,
  meta,
  voor,
  children,
}: {
  soort?: "radio" | "checkbox";
  /** input-naam; verplicht voor radiogroepen. */
  naam?: string;
  waarde?: string;
  checked: boolean;
  onKies: () => void;
  /** De hoofdregel van de optie. */
  titel: ReactNode;
  /** Kleine toelichting onder de titel. */
  detail?: ReactNode;
  /** Rechts uitgelijnde meta ("+ € 10.000", "gemiddeld 3,74%"). */
  meta?: ReactNode;
  /** Visueel element voor de titel (bv. EnergieLabelBadge-rij). */
  voor?: ReactNode;
  /** Extra inhoud onder de optie-regel (waarschuwingen, voorwaarden). */
  children?: ReactNode;
}) {
  return (
    <label
      className={`til-op flex cursor-pointer items-start gap-3 rounded-[14px] border bg-paneel p-4 shadow-zweef transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-merk ${
        checked ? "border-merk bg-merk-wash" : "border-lijn hover:border-merk-300"
      }`}
    >
      <input
        type={soort}
        name={naam}
        value={waarde}
        checked={checked}
        onChange={onKies}
        className="mt-[3px] shrink-0 accent-merk"
      />
      {voor ? <span className="flex shrink-0 items-center gap-1">{voor}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <span className="text-sm font-medium text-inkt">{titel}</span>
          {meta ? <span className="text-xs tabular-nums text-inkt-zacht">{meta}</span> : null}
        </span>
        {detail ? <span className="text-xs leading-relaxed text-gedempt">{detail}</span> : null}
        {children}
      </span>
    </label>
  );
}

/**
 * Energielabel-keuzechip in de echte EU-labelkleur (via EnergieLabelBadge):
 * voor de A t/m G-keuze. `tekst` in plaats van `letter` geeft een gewone
 * tekstchip in dezelfde vorm ("Weet ik niet"). Gekozen = navy rand + wash +
 * een klein navy hoekpunt, zodat de keuze ook naast zeven kleurbadges
 * onmiskenbaar is.
 */
export function EnergieLabelKeuze({
  naam,
  letter,
  tekst,
  checked,
  onKies,
}: {
  naam: string;
  letter?: string;
  tekst?: string;
  checked: boolean;
  onKies: () => void;
}) {
  return (
    <label
      className={`til-op relative flex cursor-pointer items-center rounded-lg border p-1.5 shadow-zweef transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-merk ${
        checked ? "border-merk bg-merk-wash" : "border-lijn bg-paneel hover:border-merk-300"
      }`}
    >
      <input type="radio" name={naam} value={letter ?? tekst} checked={checked} onChange={onKies} className="sr-only" />
      {letter ? (
        <EnergieLabelBadge label={letter} klein />
      ) : (
        <span className="grid h-7 place-items-center px-2 text-sm font-medium text-inkt">{tekst}</span>
      )}
      {checked ? <span aria-hidden="true" className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-paneel bg-merk" /> : null}
    </label>
  );
}

/* -------------------------------------------------------------------------
 * Uitkomst-moment (v3): de warme afsluiter van elke rekenhulp. Amber-wash
 * kaart (mens/actie-wash uit BRAND.md) met het oversized serif-cijfer;
 * de navy info-blokken eronder wisselen er vanzelf mee af.
 * ---------------------------------------------------------------------- */

export function UitkomstMoment({
  label,
  waarde,
  eenheid,
  children,
}: {
  /** Kaartlabel, bv. "Maximale hypotheek (indicatie)". */
  label: string;
  /** Het al geformatteerde hoofdgetal (of een eerlijke tekst als er geen is). */
  waarde: string;
  /** Kleine eenheid-suffix, bv. "per maand". */
  eenheid?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-accent-200 bg-accent-wash p-6 shadow-zweef sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-800">{label}</p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="min-w-0 font-display text-4xl font-semibold tabular-nums text-merk sm:text-5xl lg:text-6xl">{waarde}</span>
        {eenheid ? <span className="text-base font-medium text-inkt-zacht">{eenheid}</span> : null}
      </p>
      {children}
    </div>
  );
}

/**
 * Bandbreedte met invaart: dezelfde eerlijke range-visual als Bandbreedte
 * (ui.tsx), maar de marker en de vulling schuiven na het tonen van de
 * uitkomst naar hun plek (motion-tokens; reduced motion landt direct via de
 * globale regel in globals.css). Voor de uitkomststap van de rekenhulpen.
 */
export function BandbreedteInvaart({
  laag,
  waarde,
  hoog,
  formatteer,
}: {
  laag: number;
  waarde: number;
  hoog: number;
  formatteer?: (n: number) => string;
}) {
  const fmt = formatteer ?? ((n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));
  const positie = hoog === laag ? 50 : ((waarde - laag) / (hoog - laag)) * 100;
  const [gestart, setGestart] = useState(false);

  // Eerst een frame op 0% renderen, dan naar de echte positie laten schuiven.
  // Dubbele requestAnimationFrame zodat de beginstand zeker geschilderd is.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGestart(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const doel = gestart ? positie : 0;
  const invaart: CSSProperties = { transitionTimingFunction: "var(--ease-uit)", transitionDuration: "var(--duur-normaal)" };

  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-merk-100">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-full bg-merk-300 transition-[width]"
          style={{ ...invaart, width: `${doel}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-merk shadow transition-[left]"
          style={{ ...invaart, left: `calc(${doel}% - 8px)` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm tabular-nums text-inkt-zacht">
        <span>{fmt(laag)}</span>
        <span>{fmt(hoog)}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Uitkomst-view-conventie: bouwstenen die elke rekenhulp op de uitkomststap
 * gebruikt. Volgorde: UitkomstMoment (hoofdgetal + bandbreedte-invaart),
 * samenvatting van de invoer met wijzig-links, UitklapUitleg "Zo rekenen we"
 * met bron en peildatum, en tot slot het vervolgblok
 * (GerelateerdeRekenhulpen + LeadCta).
 *
 * Flux-echo (besluit Mitch 24 jul, BRAND.md "Flux-kleurlaag"): positieve
 * uitkomst-delta's en besparingen krijgen LIME (DeltaPil tint="lime" of
 * StatTegel tint="lime", tekst altijd shell); een samenstellings-grafiekje
 * bij de uitkomst is een VoortgangsBalk, met lavendel als tweede reeks.
 * Discipline: naast navy maximaal twee accentfamilies per scherm (amber van
 * het UitkomstMoment telt mee), dus per uitkomst OF lime OF lavendel erbij,
 * en maximaal een lime-moment per scherm.
 * ---------------------------------------------------------------------- */

export type SamenvattingRij = {
  label: string;
  waarde: ReactNode;
  /** Naar welke stap (0-gebaseerd) de wijzig-link springt. */
  stapIndex: number;
};

/** Samenvatting van de invoer op de uitkomststap, met wijzig-links per rij. */
export function RekenmoduleSamenvatting({ rijen, gaNaarStap }: { rijen: SamenvattingRij[]; gaNaarStap: (stapIndex: number) => void }) {
  return (
    <div className="rounded-[14px] border border-lijn bg-paneel p-5 shadow-zweef">
      <SectieLabel>Je invoer</SectieLabel>
      <dl className="mt-3 divide-y divide-lijn">
        {rijen.map((rij) => (
          <div key={rij.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="text-inkt-zacht">{rij.label}</dt>
            <dd className="flex items-center gap-3 text-right font-semibold tabular-nums">
              {rij.waarde}
              <button
                type="button"
                onClick={() => gaNaarStap(rij.stapIndex)}
                className="text-xs font-semibold text-merk underline underline-offset-2 transition-colors hover:text-merk-licht"
                aria-label={`Wijzig ${rij.label.toLowerCase()}`}
              >
                wijzig
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export type GerelateerdeRekenhulp = {
  titel: string;
  /** Een zin die zegt wat je er berekent; gewone taal, geen verkooppraat. */
  zin: string;
  href: string;
};

/** Vervolgblok: verder rekenen met verwante rekenhulpen. */
export function GerelateerdeRekenhulpen({ items }: { items: GerelateerdeRekenhulp[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Verder rekenen</h2>
      <div className={`mt-3 grid gap-3 ${items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="til-op group rounded-[14px] border border-lijn bg-paneel p-4 shadow-zweef transition-colors hover:border-merk-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-merk"
          >
            <p className="flex items-baseline justify-between gap-2 text-sm font-semibold text-inkt transition-colors group-hover:text-merk">
              {item.titel}
              <Icoon naam="pijlRechts" maat="s" className="shrink-0 self-center text-merk-500 transition-transform group-hover:translate-x-0.5 group-hover:text-merk" />
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gedempt">{item.zin}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
