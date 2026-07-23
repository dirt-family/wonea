import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { BronChip, MicroRegel } from "../components/onderdelen";
import { adem, fade, schuif, verloop } from "../helpers";
import { BEAT3, Formaat, font, kleur } from "../theme";

/**
 * Vind-een-makelaar. Beat 1: profielkaarten verschijnen rustig. Beat 2:
 * prestatie-indicatoren vullen zich met een amberkleurige accentbalk.
 * Beat 3: subregel + CTA, zachte puls op de match-score.
 * Voorbeeldprofielen, expliciet zo gelabeld: geen echte makelaars.
 */
type Profiel = {
  naam: string;
  score: number;
  stats: Array<{ label: string; waarde: string; vulling: number }>;
};

const PROFIELEN: Profiel[] = [
  {
    naam: "Makelaar A",
    score: 92,
    stats: [
      { label: "Doorlooptijd", waarde: "23 dagen", vulling: 0.86 },
      { label: "Opbrengst", waarde: "102% van vraagprijs", vulling: 0.92 },
    ],
  },
  {
    naam: "Makelaar B",
    score: 87,
    stats: [
      { label: "Doorlooptijd", waarde: "31 dagen", vulling: 0.72 },
      { label: "Opbrengst", waarde: "100% van vraagprijs", vulling: 0.84 },
    ],
  },
];

export const Makelaar: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();
  const groot = formaat === "story";
  // Breed toont twee kaarten naast elkaar; vierkant en story tonen er één prominent.
  const profielen = formaat === "breed" ? PROFIELEN : PROFIELEN.slice(0, 1);
  const kaartBreedte = formaat === "breed" ? 330 : formaat === "vierkant" ? 620 : 700;

  const visual = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: groot ? 26 : 18 }}>
      <div style={{ display: "flex", flexDirection: "row", gap: 26, justifyContent: "center" }}>
        {profielen.map((profiel, i) => {
          const start = 12 + i * 10;
          const puls = adem(frame, 112, 144, 0.05);
          return (
            <div
              key={profiel.naam}
              style={{
                width: kaartBreedte,
                backgroundColor: kleur.paneel,
                border: `1.5px solid ${kleur.merkWash}`,
                borderRadius: 14,
                padding: groot ? 40 : 30,
                boxShadow: "0 18px 44px rgba(22, 50, 79, 0.07)",
                textAlign: "left",
                opacity: fade(frame, start, 18),
                translate: `0px ${schuif(frame, start, 18, 22)}px`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: groot ? 20 : 14 }}>
                <div
                  style={{
                    width: groot ? 76 : 58,
                    height: groot ? 76 : 58,
                    borderRadius: 999,
                    backgroundColor: kleur.merkWash,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: font.display,
                    fontWeight: 600,
                    fontSize: groot ? 34 : 26,
                    color: kleur.merk,
                  }}
                >
                  {profiel.naam.slice(-1)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: font.display, fontWeight: 600, fontSize: groot ? 34 : 25, color: kleur.merk }}>
                    {profiel.naam}
                  </span>
                  <span style={{ fontFamily: font.sans, fontSize: groot ? 20 : 15, color: kleur.merkLicht }}>
                    Voorbeeldprofiel
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: groot ? 22 : 16, marginTop: groot ? 30 : 22 }}>
                {profiel.stats.map((stat, j) => {
                  const vul = verloop(frame, 50 + j * 10, 40) * stat.vulling;
                  return (
                    <div key={stat.label}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontFamily: font.sans,
                          fontSize: groot ? 21 : 16,
                          color: kleur.merkLicht,
                          marginBottom: 8,
                        }}
                      >
                        <span>{stat.label}</span>
                        <span style={{ fontWeight: 600, color: kleur.merk }}>{stat.waarde}</span>
                      </div>
                      <div style={{ height: groot ? 10 : 8, borderRadius: 999, backgroundColor: kleur.merkWash }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${vul * 100}%`,
                            borderRadius: 999,
                            backgroundColor: kleur.accent,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: groot ? 28 : 20, scale: `${puls}`, transformOrigin: "left center" }}>
                <BronChip grootte={groot ? 21 : 16}>Match {profiel.score}%</BronChip>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: fade(frame, BEAT3 + 4, 20) }}>
        <MicroRegel grootte={groot ? 21 : 17}>Voorbeeldprofielen ter illustratie, geen echte makelaars.</MicroRegel>
      </div>
    </div>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Kies een makelaar op harde resultaten"
      subregel="Vergelijk lokale makelaars op verkoopsnelheid, opbrengst en ervaring."
      cta="Vind jouw makelaar"
      visual={visual}
      subregelVroeg={false}
    />
  );
};
