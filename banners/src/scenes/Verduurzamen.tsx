import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { BronChip, SectieLabel } from "../components/onderdelen";
import { euro, fade, telWaarde, verloop } from "../helpers";
import { BEAT3, Formaat, font, kleur } from "../theme";

/**
 * Verduurzamingscheck. Beat 1: kop + energielabel-icoon in diep blauw.
 * Beat 2: het label schuift rustig omhoog naar een gunstigere klasse (D naar B)
 * terwijl een euro-besparingsteller meeloopt. Beat 3: het geschatte bedrag
 * licht op met warm amber + CTA. Bedrag is een gelabeld rekenvoorbeeld.
 * Geen groen: labelklassen in merkblauw, nadruk in amber.
 */
const KLASSEN = ["D", "C", "B"];

export const Verduurzamen: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();
  const groot = formaat === "story";
  const cel = groot ? 150 : 118;
  const p = verloop(frame, 48, 50);
  const bedrag = telWaarde(frame, 48, 50, 0, 1150, 50);
  const amber = fade(frame, BEAT3, 18);

  const labelVenster = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: groot ? 16 : 12 }}>
      <SectieLabel grootte={groot ? 21 : 16}>Energielabel</SectieLabel>
      <div
        style={{
          width: cel,
          height: cel,
          borderRadius: 22,
          backgroundColor: kleur.merk,
          overflow: "hidden",
          boxShadow: "0 18px 44px rgba(22, 50, 79, 0.16)",
        }}
      >
        <div style={{ translate: `0px ${-p * cel * (KLASSEN.length - 1)}px` }}>
          {KLASSEN.map((klasse) => (
            <div
              key={klasse}
              style={{
                width: cel,
                height: cel,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: font.display,
                fontWeight: 600,
                fontSize: cel * 0.54,
                color: kleur.paneel,
              }}
            >
              {klasse}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const teller = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: groot ? "center" : "flex-start", gap: groot ? 14 : 10 }}>
      <SectieLabel grootte={groot ? 21 : 16}>Geschatte besparing</SectieLabel>
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 12,
          backgroundColor: amber > 0.01 ? kleur.accentWash : "transparent",
          borderRadius: 14,
          padding: `${groot ? 10 : 6}px ${groot ? 18 : 12}px`,
        }}
      >
        <span
          style={{
            fontFamily: font.display,
            fontWeight: 600,
            fontSize: groot ? 88 : 64,
            color: amber > 0.5 ? kleur.accent : kleur.merk,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {euro(bedrag)}
        </span>
        <span style={{ fontFamily: font.sans, fontSize: groot ? 26 : 21, color: kleur.merkLicht }}>per jaar</span>
      </div>
      <div style={{ opacity: fade(frame, BEAT3, 20) }}>
        <BronChip grootte={groot ? 20 : 17}>Rekenvoorbeeld, gemiddelde rijwoning, juli 2026</BronChip>
      </div>
    </div>
  );

  const visual = (
    <div
      style={{
        display: "flex",
        flexDirection: groot ? "column" : "row",
        alignItems: "center",
        gap: groot ? 44 : 56,
        opacity: fade(frame, 12, 20),
      }}
    >
      {labelVenster}
      {teller}
    </div>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Maak je huis energiezuinig en waardevast"
      subregel="Ontdek welke verduurzamingen renderen voor jouw specifieke woning."
      cta="Check je besparing"
      visual={visual}
    />
  );
};
