import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { BronChip, MicroRegel, Paneel, SectieLabel } from "../components/onderdelen";
import { euro, fade, telWaarde, verloop } from "../helpers";
import { BEAT3, Formaat, font, kleur } from "../theme";

/**
 * Budgetberekenaar (maximale hypotheek). Beat 1: kop + schuifbalk in diep
 * blauw. Beat 2: slider schuift naar rechts, budgetteller stopt op de
 * leencapaciteit. Beat 3: amber accent onder het eindbedrag + CTA.
 * Bedrag is een gelabeld rekenvoorbeeld; de echte tool rekent op de
 * officiële leennormen 2026.
 */
const KAART_BREEDTE: Record<Formaat, number> = { breed: 640, vierkant: 780, story: 820 };

export const Budget: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();
  const groot = formaat === "story";
  const p = verloop(frame, 48, 50);
  const sliderPositie = 0.06 + 0.72 * p;
  const bedrag = telWaarde(frame, 48, 50, 240000, 340000, 1000);
  const accentBreedte = verloop(frame, BEAT3, 22);
  const stip = groot ? 34 : 28;

  const visual = (
    <Paneel breedte={KAART_BREEDTE[formaat]} opacity={fade(frame, 12, 20)} padding={groot ? 48 : 40}>
      <SectieLabel grootte={groot ? 22 : 18}>Maximale hypotheek</SectieLabel>
      <div style={{ position: "relative", display: "inline-block", margin: `${groot ? 18 : 12}px 0 ${groot ? 30 : 24}px` }}>
        <p
          style={{
            fontFamily: font.display,
            fontWeight: 600,
            fontSize: groot ? 92 : 68,
            color: kleur.merk,
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {euro(bedrag)}
        </p>
        <div
          aria-hidden="true"
          style={{
            marginTop: groot ? 12 : 8,
            height: groot ? 8 : 6,
            width: `${accentBreedte * 68}%`,
            backgroundColor: kleur.accent,
            borderRadius: 999,
          }}
        />
      </div>
      <div
        style={{
          position: "relative",
          height: groot ? 14 : 12,
          borderRadius: 999,
          backgroundColor: kleur.merkWash,
          opacity: fade(frame, 26, 18),
        }}
      >
        <div
          style={{
            position: "absolute",
            insetBlock: 0,
            left: 0,
            width: `${sliderPositie * 100}%`,
            backgroundColor: kleur.merk,
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${sliderPositie * 100}%`,
            width: stip,
            height: stip,
            translate: `${-stip / 2}px ${-stip / 2}px`,
            borderRadius: 999,
            backgroundColor: kleur.paneel,
            border: `3px solid ${kleur.merk}`,
            boxShadow: "0 4px 12px rgba(22, 50, 79, 0.18)",
          }}
        />
      </div>
      <div style={{ marginTop: groot ? 30 : 24, display: "flex", flexDirection: "column", gap: 10, opacity: fade(frame, BEAT3, 20) }}>
        <MicroRegel grootte={groot ? 22 : 18}>Berekend volgens de officiële leennormen 2026.</MicroRegel>
        <div>
          <BronChip grootte={groot ? 20 : 17}>Rekenvoorbeeld, juli 2026</BronChip>
        </div>
      </div>
    </Paneel>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Weet wat je echt kunt bieden"
      subregel="Bereken je maximale hypotheek helder en zonder verborgen aannames."
      cta="Bereken je budget"
      visual={visual}
    />
  );
};
