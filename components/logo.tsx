import { useId } from "react";

/**
 * Wonea-logo: de oplopende huizenreeks (huis + groei). Twee varianten:
 * - "gradient" (default): de merkbehandeling navy -> amber, door Mitch gekozen
 *   uit zijn eigen logo-varianten (23 jul 2026). Voor header, footer, hero en
 *   andere merkmomenten.
 * - "mono": currentColor, voor motief-gebruik (washes, sectie-scheiders,
 *   achtergrond-elementen) waar de gradient te zwaar zou zijn.
 * De gradient-stops zijn bewust de letterlijke logokleuren; de site-tokens
 * (globals.css) dragen de vertaling naar het bredere palet.
 */
export function WoneaLogo({
  className = "",
  variant = "gradient",
}: {
  className?: string;
  variant?: "gradient" | "mono";
}) {
  const gradientId = useId();
  const fill = variant === "gradient" ? `url(#${gradientId})` : "currentColor";
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {variant === "gradient" ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      ) : null}
      <path fill={fill} d="M 40 160 V 90 L 95 35 H 115 L 60 90 V 160 Z" />
      <path fill={fill} d="M 72 160 V 102 L 120 47 H 140 L 92 102 V 160 Z" />
      <path fill={fill} d="M 104 160 V 114 L 145 62 L 165 82 L 124 125 V 160 Z" opacity="0.9" />
      <path fill={fill} d="M 136 160 V 130 L 165 101 V 160 Z" opacity="0.8" />
    </svg>
  );
}
