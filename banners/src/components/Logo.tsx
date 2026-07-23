import React from "react";
import { font, kleur } from "../theme";

/**
 * Wonea-logo: oplopende huisvorm (huis + groei), 1-op-1 de SVG-paths uit
 * components/logo.tsx van de site. currentColor zodat hij meekleurt.
 */
export const WoneaLogo: React.FC<{ grootte: number; klr?: string }> = ({ grootte, klr = kleur.merk }) => (
  <svg
    viewBox="0 0 200 200"
    width={grootte}
    height={grootte}
    fill={klr}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M 40 160 V 90 L 95 35 H 115 L 60 90 V 160 Z" />
    <path d="M 72 160 V 102 L 120 47 H 140 L 92 102 V 160 Z" />
    <path d="M 104 160 V 114 L 145 62 L 165 82 L 124 125 V 160 Z" opacity="0.9" />
    <path d="M 136 160 V 130 L 165 101 V 160 Z" opacity="0.8" />
  </svg>
);

/** Merkregel: logo-icoon + woordmerk in Source Serif (notarieel vertrouwen). */
export const Merkregel: React.FC<{ logoGrootte: number; tekstGrootte: number }> = ({ logoGrootte, tekstGrootte }) => (
  <div style={{ display: "flex", alignItems: "center", gap: Math.round(logoGrootte * 0.22) }}>
    <WoneaLogo grootte={logoGrootte} />
    <span
      style={{
        fontFamily: font.display,
        fontWeight: 600,
        fontSize: tekstGrootte,
        color: kleur.merk,
        letterSpacing: "0.01em",
      }}
    >
      Wonea
    </span>
  </div>
);
