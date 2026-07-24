"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Hoofdnavigatie met actieve staat (huisstijl v3). Client-component omdat de
 * actieve link uit het pad komt; de rest van de header blijft server-side in
 * app/layout.tsx. Actief = merk-tekst + een klein amber onderstreepje
 * (accent-500, decoratief). De "Mijn woning"-knop is de ene gevulde CTA.
 */

const LINKS = [
  { href: "/tools", label: "Rekenhulpen", verborgen: "" },
  { href: "/woningmarkt", label: "Woningmarkt", verborgen: "" },
  { href: "/woz-check", label: "WOZ-check", verborgen: "hidden sm:inline-flex" },
  { href: "/methode", label: "Onze methode", verborgen: "hidden sm:inline-flex" },
  { href: "/over-ons", label: "Over Wonea", verborgen: "hidden md:inline-flex" },
] as const;

function isActief(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav() {
  const pathname = usePathname() ?? "";
  const mijnWoningActief = isActief(pathname, "/claim") || isActief(pathname, "/dashboard") || isActief(pathname, "/account");

  return (
    <nav className="flex items-center gap-5 text-sm" aria-label="Hoofdnavigatie">
      {LINKS.map((link) => {
        const actief = isActief(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={actief ? "page" : undefined}
            className={`relative py-1 transition-colors ${link.verborgen} ${
              actief
                ? "font-semibold text-merk after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent-500"
                : "text-inkt-zacht hover:text-merk"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/claim"
        aria-current={mijnWoningActief ? "page" : undefined}
        className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 font-semibold transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-merk ${
          mijnWoningActief ? "bg-merk-900 text-white" : "bg-merk text-white hover:bg-merk-licht"
        }`}
      >
        Mijn woning
      </Link>
    </nav>
  );
}
