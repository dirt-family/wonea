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
