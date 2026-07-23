import Link from "next/link";
import type { ReactNode } from "react";

/** Basis-UI: alle pagina's gebruiken deze bouwstenen zodat de stijl 1 geheel is. */

export function Kaart({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[14px] border border-lijn bg-paneel p-6 ${className}`}>{children}</div>;
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
    <span className="inline-flex items-center rounded-full bg-accent-wash px-2.5 py-0.5 text-[11px] font-medium text-accent">
      {children}
    </span>
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

/** Kerncijfer-tegel: label, grote waarde, optionele deltaregel. */
export function StatTegel({ label, waarde, delta, deltaRichting }: { label: string; waarde: string; delta?: string; deltaRichting?: "positief" | "negatief" | "neutraal" }) {
  const deltaKleur = deltaRichting === "positief" ? "text-positief" : deltaRichting === "negatief" ? "text-negatief" : "text-gedempt";
  return (
    <div className="rounded-[14px] border border-lijn bg-paneel p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-merk">{waarde}</p>
      {delta ? <p className={`mt-1 text-sm ${deltaKleur}`}>{delta}</p> : null}
    </div>
  );
}

/** Grote uitkomstkaart voor rekentools: een resultaat met context eronder. */
export function UitkomstKaart({ label, bedrag, kinderen }: { label: string; bedrag: string; kinderen?: ReactNode }) {
  return (
    <Kaart className="bg-merk-wash">
      <SectieLabel>{label}</SectieLabel>
      <p className="mt-3 font-display text-5xl font-semibold text-merk">{bedrag}</p>
      {kinderen}
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
