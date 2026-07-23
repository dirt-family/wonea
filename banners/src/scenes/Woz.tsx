import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { BronChip, MicroRegel, Paneel, SectieLabel } from "../components/onderdelen";
import { euro, fade, verloop } from "../helpers";
import { BEAT3, Formaat, font, kleur } from "../theme";

/**
 * WOZ-check. Beat 1: kop + gestileerde WOZ-kaart in diep blauw. Beat 2: amber
 * markeerlijn schuift over het WOZ-bedrag, de marktvergelijking verschijnt.
 * Beat 3: "Onderbouwd inzicht" + CTA. Bedragen zijn een gelabeld rekenvoorbeeld.
 */
const KAART_BREEDTE: Record<Formaat, number> = { breed: 620, vierkant: 760, story: 800 };

export const Woz: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();
  const groot = formaat === "story";
  const markeer = verloop(frame, 42, 40);

  const visual = (
    <Paneel breedte={KAART_BREEDTE[formaat]} opacity={fade(frame, 10, 20)} padding={groot ? 48 : 40}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <SectieLabel grootte={groot ? 22 : 18}>WOZ-beschikking 2026</SectieLabel>
        <span
          style={{
            fontFamily: font.sans,
            fontWeight: 600,
            fontSize: groot ? 20 : 16,
            color: kleur.merkLicht,
            backgroundColor: kleur.merkWash,
            borderRadius: 999,
            padding: `${groot ? 7 : 5}px ${groot ? 16 : 12}px`,
          }}
        >
          gemeente
        </span>
      </div>
      <div style={{ position: "relative", display: "inline-block", margin: `${groot ? 20 : 14}px 0 0` }}>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -8,
            top: "12%",
            height: "80%",
            width: `calc(${markeer * 100}% + ${markeer * 16}px)`,
            backgroundColor: kleur.accentWash,
            borderRadius: 10,
          }}
        />
        <span
          style={{
            position: "relative",
            fontFamily: font.display,
            fontWeight: 600,
            fontSize: groot ? 88 : 64,
            color: kleur.merk,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {euro(398000)}
        </span>
      </div>
      <div
        style={{
          marginTop: groot ? 30 : 22,
          paddingTop: groot ? 26 : 20,
          borderTop: `1.5px solid ${kleur.merkWash}`,
          display: "flex",
          flexDirection: "column",
          gap: groot ? 14 : 10,
          opacity: fade(frame, 68, 22),
        }}
      >
        <MicroRegel grootte={groot ? 24 : 20}>
          Marktwaarde: {euro(385000)} tot {euro(425000)}
        </MicroRegel>
        <MicroRegel grootte={groot ? 22 : 18}>Zo zie je direct of je aanslag redelijk is.</MicroRegel>
      </div>
      <div style={{ marginTop: groot ? 26 : 20, display: "flex", gap: 12, flexWrap: "wrap", opacity: fade(frame, BEAT3, 20) }}>
        <BronChip grootte={groot ? 20 : 17}>Onderbouwd inzicht</BronChip>
        <BronChip grootte={groot ? 20 : 17}>Rekenvoorbeeld, juli 2026</BronChip>
      </div>
    </Paneel>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Klopt jouw WOZ-beschikking wel precies?"
      subregel="Controleer eenvoudig of je gemeentelijke aanslag overeenkomt met de markt."
      cta="Check je WOZ"
      visual={visual}
    />
  );
};
