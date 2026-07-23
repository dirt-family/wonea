/**
 * Wonea-logo: een oplopende huisvorm (huis + groei). Solide, in currentColor,
 * zodat het meekleurt met text-merk en past bij het vlakke designsysteem
 * (geen gradients). De opaciteitstrapjes geven diepte.
 * Andere kleurvarianten: pas de text-kleur aan waar het logo gebruikt wordt.
 */
export function WoneaLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M 40 160 V 90 L 95 35 H 115 L 60 90 V 160 Z" />
      <path d="M 72 160 V 102 L 120 47 H 140 L 92 102 V 160 Z" />
      <path d="M 104 160 V 114 L 145 62 L 165 82 L 124 125 V 160 Z" opacity="0.9" />
      <path d="M 136 160 V 130 L 165 101 V 160 Z" opacity="0.8" />
    </svg>
  );
}
