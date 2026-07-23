import React from "react";
import { fade, verloop } from "../helpers";
import { font, kleur } from "../theme";

/** Witte kaart, zelfde vorm als Kaart in components/ui.tsx (radius 14, rustige rand). */
export const Paneel: React.FC<{ children: React.ReactNode; breedte?: number; opacity?: number; padding?: number }> = ({
  children,
  breedte,
  opacity = 1,
  padding = 40,
}) => (
  <div
    style={{
      width: breedte,
      backgroundColor: kleur.paneel,
      border: `1.5px solid ${kleur.merkWash}`,
      borderRadius: 14,
      padding,
      boxShadow: "0 18px 44px rgba(22, 50, 79, 0.07)",
      opacity,
      textAlign: "left",
    }}
  >
    {children}
  </div>
);

/** Sectielabel zoals op de site: klein, kapitaal, gedempt blauw. */
export const SectieLabel: React.FC<{ children: React.ReactNode; grootte?: number }> = ({ children, grootte = 18 }) => (
  <p
    style={{
      fontFamily: font.sans,
      fontWeight: 600,
      fontSize: grootte,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: kleur.merkLicht,
      margin: 0,
    }}
  >
    {children}
  </p>
);

/** Bron-/voorbeeldchip, zelfde vorm als BronLabel (accent-wash pill). */
export const BronChip: React.FC<{ children: React.ReactNode; grootte?: number; opacity?: number }> = ({
  children,
  grootte = 17,
  opacity = 1,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      backgroundColor: kleur.accentWash,
      color: kleur.accent,
      fontFamily: font.sans,
      fontWeight: 500,
      fontSize: grootte,
      padding: `${Math.round(grootte * 0.35)}px ${Math.round(grootte * 0.85)}px`,
      borderRadius: 999,
      opacity,
    }}
  >
    {children}
  </span>
);

/** Microregel voor bron + peildatum onder een visual. */
export const MicroRegel: React.FC<{ children: React.ReactNode; grootte?: number; opacity?: number }> = ({
  children,
  grootte = 18,
  opacity = 1,
}) => (
  <p
    style={{
      fontFamily: font.sans,
      fontWeight: 400,
      fontSize: grootte,
      color: kleur.merkLicht,
      margin: 0,
      opacity,
    }}
  >
    {children}
  </p>
);

/**
 * Bandbreedte-visual: de kern van de Wonea-eerlijkheid (range-balk + merkstip),
 * zelfde beeldtaal als Bandbreedte in components/ui.tsx. De marker schuift van
 * links naar `positie` (0-1) tijdens beat 2.
 */
export const BandbreedteBalk: React.FC<{
  frame: number;
  breedte: number;
  labelLinks: string;
  labelRechts: string;
  positie?: number;
  start?: number;
  duur?: number;
  labelGrootte?: number;
  schaal?: number;
}> = ({ frame, breedte, labelLinks, labelRechts, positie = 0.5, start = 48, duur = 48, labelGrootte = 20, schaal = 1 }) => {
  const p = verloop(frame, start, duur);
  const markerPositie = 0.04 + (positie - 0.04) * p;
  const balkOpacity = fade(frame, start - 6, 16);
  const stip = Math.round(26 * schaal);
  return (
    <div style={{ width: breedte, opacity: balkOpacity }}>
      <div
        style={{
          position: "relative",
          height: Math.round(12 * schaal),
          borderRadius: 999,
          backgroundColor: kleur.merkWash,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${markerPositie * 100}%`,
            width: stip,
            height: stip,
            translate: `${-stip / 2}px ${-stip / 2}px`,
            borderRadius: 999,
            backgroundColor: kleur.accent,
            border: `${Math.max(3, Math.round(4 * schaal))}px solid ${kleur.paneel}`,
            boxShadow: "0 4px 12px rgba(22, 50, 79, 0.18)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: Math.round(14 * schaal),
          fontFamily: font.sans,
          fontSize: labelGrootte,
          color: kleur.merkLicht,
        }}
      >
        <span>{labelLinks}</span>
        <span>{labelRechts}</span>
      </div>
    </div>
  );
};
