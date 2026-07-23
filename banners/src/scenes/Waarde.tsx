import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { BandbreedteBalk, BronChip, MicroRegel, Paneel, SectieLabel } from "../components/onderdelen";
import { euro, fade, telWaarde } from "../helpers";
import { BEAT3, Formaat, font, kleur } from "../theme";

/**
 * Woningwaarde-check. Beat 1: kop + subregel + leeg waardedomein. Beat 2: teller
 * telt rustig op naar de middenwaarde terwijl de amberkleurige marker inschuift
 * tussen de twee blauwe uitersten. Beat 3: uitleg + CTA faden in.
 * Cijfers zijn een gelabeld rekenvoorbeeld (geen echte adresdata in een banner).
 */
const LAAG = 385000;
const MIDDEN = 405000;
const HOOG = 425000;

const KAART_BREEDTE: Record<Formaat, number> = { breed: 640, vierkant: 780, story: 820 };

export const Waarde: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();
  const waarde = telWaarde(frame, 48, 50, LAAG, MIDDEN, 1000);
  const groot = formaat === "story";

  const visual = (
    <Paneel breedte={KAART_BREEDTE[formaat]} opacity={fade(frame, 12, 20)} padding={groot ? 48 : 40}>
      <SectieLabel grootte={groot ? 22 : 18}>Geschatte woningwaarde</SectieLabel>
      <p
        style={{
          fontFamily: font.display,
          fontWeight: 600,
          fontSize: groot ? 92 : 68,
          color: kleur.merk,
          margin: `${groot ? 18 : 12}px 0 ${groot ? 26 : 20}px`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {euro(waarde)}
      </p>
      <BandbreedteBalk
        frame={frame}
        breedte={KAART_BREEDTE[formaat] - (groot ? 96 : 80)}
        labelLinks={euro(LAAG)}
        labelRechts={euro(HOOG)}
        positie={(MIDDEN - LAAG) / (HOOG - LAAG)}
        start={48}
        duur={50}
        labelGrootte={groot ? 24 : 20}
        schaal={groot ? 1.2 : 1}
      />
      <div style={{ marginTop: groot ? 30 : 24, display: "flex", flexDirection: "column", gap: 10, opacity: fade(frame, BEAT3, 20) }}>
        <MicroRegel grootte={groot ? 22 : 18}>Altijd een bandbreedte, nooit een schijnexact bedrag.</MicroRegel>
        <div>
          <BronChip grootte={groot ? 20 : 17}>Rekenvoorbeeld, juli 2026</BronChip>
        </div>
      </div>
    </Paneel>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Geen schijnzekerheid, wel een eerlijke bandbreedte"
      subregel="Bekijk de reële waarde van je huis op basis van transparante marktdata."
      cta="Check je woning"
      visual={visual}
    />
  );
};
