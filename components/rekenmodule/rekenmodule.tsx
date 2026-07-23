"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { SectieLabel, StappenBalk } from "@/components/ui";
import { bewaarSessie, klemStap, laadSessie, parseStapParam, STAP_PARAM, stapZoekdeel } from "./logica";

/**
 * RekenModule: het gedeelde stap-frame voor alle rekenhulpen. Een module
 * levert alleen zijn stappen (vraag, velden, validatie) en een uitkomst-view;
 * dit frame regelt de rest: StappenBalk, 1 stap tegelijk, Volgende/Terug,
 * validatie-gate, stap-in-de-URL (?stap=2, deelbaar), focus naar de stapkop,
 * Enter = volgende, zachte stap-overgang en sessie-persistentie.
 *
 * Rekenregels horen hier nadrukkelijk NIET: die blijven in lib/ en de
 * berekening.ts van de tool. Dit is een UI-schil. Referentie-implementatie:
 * app/budget/stepper.tsx.
 */

export type StapDefinitie = {
  /** Stabiele sleutel, bv. "inkomen". */
  id: string;
  /** Kort woord voor de StappenBalk, bv. "Inkomen". */
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
  "inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht focus:outline-2 focus:outline-offset-2 focus:outline-merk aria-disabled:opacity-60";
const knopSecundairCls =
  "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk";

// Zachte stap-overgang: hergebruikt de reveal-in-keyframes en motion-tokens
// uit globals.css. prefers-reduced-motion wordt daar globaal geneutraliseerd.
const stapAnimatie: CSSProperties = { animation: "reveal-in var(--duur-kort) var(--ease-uit) both" };

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
  /** Label van de laatste stap in de StappenBalk. */
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
      <StappenBalk stappen={[...stappen.map((s) => s.titel), uitkomstTitel]} actief={stap} />

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
            <p id={meldingId} role="alert" className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
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
 * Uitkomst-view-conventie: bouwstenen die elke rekenhulp op de uitkomststap
 * gebruikt. Volgorde: UitkomstKaart (hoofdgetal + bandbreedte), samenvatting
 * van de invoer met wijzig-links, UitklapUitleg "Zo rekenen we" met bron en
 * peildatum, en tot slot het vervolgblok (GerelateerdeRekenhulpen + LeadCta).
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
    <div className="rounded-[14px] border border-lijn bg-paneel p-5">
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
          <Link key={item.href} href={item.href} className="group rounded-[14px] border border-lijn bg-paneel p-4 transition-colors hover:border-merk">
            <p className="text-sm font-semibold text-inkt transition-colors group-hover:text-merk">{item.titel}</p>
            <p className="mt-1 text-xs leading-relaxed text-gedempt">{item.zin}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
