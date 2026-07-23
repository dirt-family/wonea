import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { BandbreedteBalk } from "../components/onderdelen";
import { adem } from "../helpers";
import { Formaat } from "../theme";

/**
 * Merk-hero. Beat 1: kop + logo faden in. Beat 2: bandbreedte-indicator
 * verschijnt, amberkleurige merkstip schuift naar het midden. Beat 3: subregel
 * en CTA faden in; de indicator ademt heel licht om de loop af te ronden.
 * Bewust zonder bedragen: de hero belooft geen cijfers, alleen de bandbreedte.
 */
const BALK_BREEDTE: Record<Formaat, number> = { breed: 620, vierkant: 740, story: 800 };

export const Hero: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();

  const visual = (
    <div style={{ scale: `${adem(frame, 116, 148, 0.018)}` }}>
      <BandbreedteBalk
        frame={frame}
        breedte={BALK_BREEDTE[formaat]}
        labelLinks="ondergrens"
        labelRechts="bovengrens"
        positie={0.5}
        start={50}
        duur={45}
        labelGrootte={formaat === "story" ? 26 : 21}
        schaal={formaat === "breed" ? 1.15 : 1.3}
      />
    </div>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Eerlijk inzicht in jouw woningwaarde"
      subregel="Transparante data en realistische bandbreedtes zonder verkooptrucjes."
      cta="Ontdek Wonea"
      visual={visual}
      subregelVroeg={false}
    />
  );
};
