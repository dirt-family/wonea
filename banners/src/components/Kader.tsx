import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fade, schuif } from "../helpers";
import { BEAT3, Formaat, font, kleur, MAAT } from "../theme";
import { Merkregel } from "./Logo";

/**
 * Gedeeld banner-kader: achtergrond, subtiel raster (niet in story), merkregel,
 * kop/subregel/CTA in vaste slots en een visual-slot. Elke scene levert alleen
 * copy + visual; het kader regelt layout per formaat en de tekst-beats.
 */
type KaderProps = {
  formaat: Formaat;
  kop: string;
  subregel: string;
  cta: string;
  visual: React.ReactNode;
  /** true = subregel fadet in beat 1 mee; false = pas in beat 3 (met de CTA). */
  subregelVroeg?: boolean;
};

const Raster: React.FC = () => (
  <AbsoluteFill aria-hidden="true">
    {[0.22, 0.44, 0.66, 0.88].map((p) => (
      <div
        key={p}
        style={{
          position: "absolute",
          left: `${p * 100}%`,
          top: 0,
          bottom: 0,
          width: 1.5,
          backgroundColor: kleur.merkWash,
        }}
      />
    ))}
  </AbsoluteFill>
);

export const CtaKnop: React.FC<{ tekst: string; grootte: number }> = ({ tekst, grootte }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: kleur.merk,
      color: kleur.paneel,
      fontFamily: font.sans,
      fontWeight: 600,
      fontSize: grootte,
      padding: `${Math.round(grootte * 0.72)}px ${Math.round(grootte * 1.7)}px`,
      borderRadius: 999,
    }}
  >
    {tekst}
  </div>
);

export const Kader: React.FC<KaderProps> = ({ formaat, kop, subregel, cta, visual, subregelVroeg = true }) => {
  const frame = useCurrentFrame();
  const m = MAAT[formaat];

  const subStart = subregelVroeg ? 14 : BEAT3;
  const ctaStart = BEAT3 + 6;

  const kopBlok = (
    <h1
      style={{
        fontFamily: font.display,
        fontWeight: 600,
        fontSize: m.kop,
        lineHeight: 1.12,
        color: kleur.merk,
        margin: 0,
        opacity: fade(frame, 6, 22),
        translate: `0px ${schuif(frame, 6, 22, 26)}px`,
      }}
    >
      {kop}
    </h1>
  );

  const subBlok = (
    <p
      style={{
        fontFamily: font.sans,
        fontWeight: 400,
        fontSize: m.sub,
        lineHeight: 1.5,
        color: kleur.merkLicht,
        margin: 0,
        maxWidth: formaat === "breed" ? 700 : 820,
        opacity: fade(frame, subStart, 20),
        translate: `0px ${schuif(frame, subStart, 20, 18)}px`,
      }}
    >
      {subregel}
    </p>
  );

  const ctaBlok = (
    <div
      style={{
        opacity: fade(frame, ctaStart, 20),
        translate: `0px ${schuif(frame, ctaStart, 20, 16)}px`,
      }}
    >
      <CtaKnop tekst={cta} grootte={m.cta} />
    </div>
  );

  const merk = (
    <div style={{ opacity: fade(frame, 0, 16) }}>
      <Merkregel logoGrootte={m.logo} tekstGrootte={m.merkregel} />
    </div>
  );

  if (formaat === "breed") {
    return (
      <AbsoluteFill style={{ backgroundColor: kleur.achtergrond, fontFamily: font.sans }}>
        <Raster />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            height: "100%",
            padding: `${m.paddingV}px ${m.paddingH}px`,
            gap: m.kolomGap,
          }}
        >
          <div style={{ flex: 1.05, display: "flex", flexDirection: "column", justifyContent: "center", gap: 26 }}>
            {merk}
            {kopBlok}
            {subBlok}
            {ctaBlok}
          </div>
          <div style={{ flex: 0.95, display: "flex", alignItems: "center", justifyContent: "center" }}>{visual}</div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: kleur.achtergrond, fontFamily: font.sans }}>
      {formaat === "vierkant" ? <Raster /> : null}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          height: "100%",
          padding: `${m.paddingV}px ${m.paddingH}px`,
          gap: formaat === "story" ? 44 : 30,
        }}
      >
        {merk}
        {kopBlok}
        <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{visual}</div>
        {subBlok}
        {ctaBlok}
      </div>
    </AbsoluteFill>
  );
};
