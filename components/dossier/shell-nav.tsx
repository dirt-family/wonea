"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icoon, type IcoonNaam } from "@/components/iconen";

/**
 * Navigatie van de ingelogde shell (flux-patroon, BRAND.md): items met icoon
 * en label op de zwarte sidebar, het actieve item als witte/lichte pill
 * (op-shell-vlak, shell-tekst), teller-badge in lime. Op kleine schermen wordt
 * dezelfde lijst een horizontale, scrollbare rij in de zwarte bovenbalk.
 * Volledig toetsenbord-navigeerbaar: gewone links, zichtbare focus-ring in
 * lime (13,5:1 op shell).
 */

export type ShellNavItem = {
  label: string;
  href: string;
  icoon: IcoonNaam;
  /** Pad-prefix waarop dit item actief is; zonder prefix telt alleen een exacte match. */
  actiefPrefix?: string;
  /** Kleine lime teller-badge (bijv. aantal woningen), alleen als het iets zegt. */
  badge?: number;
};

function isActief(pathname: string, item: ShellNavItem): boolean {
  // Anker-links (bijv. #alerts) zijn snelkoppelingen binnen een pagina en
  // nooit zelf "de huidige pagina": precies een actieve pill (flux).
  if (item.href.includes("#")) return false;
  const doel = item.href.split("#")[0];
  if (item.actiefPrefix) return pathname === doel || pathname.startsWith(item.actiefPrefix);
  return pathname === doel;
}

export function ShellNav({ items }: { items: ShellNavItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Mijn Wonea">
      <ul className="flex gap-1.5 overflow-x-auto p-1 lg:flex-col lg:overflow-visible lg:p-0">
        {items.map((item) => {
          const actief = isActief(pathname, item);
          return (
            <li key={item.label} className="shrink-0">
              <Link
                href={item.href}
                aria-current={actief ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime ${
                  actief ? "bg-op-shell text-shell" : "text-op-shell-zacht hover:bg-shell-hoog hover:text-op-shell"
                }`}
              >
                <Icoon naam={item.icoon} maat="s" />
                {item.label}
                {item.badge != null && item.badge > 1 ? (
                  <span className="ml-auto rounded-full bg-lime px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none text-shell">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
