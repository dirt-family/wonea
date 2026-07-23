import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { MicroRegel, SectieLabel } from "../components/onderdelen";
import { fade, procent, schuif, verloop } from "../helpers";
import { BEAT3, Formaat, font, kleur } from "../theme";

/**
 * Hypotheekvergelijker. Beat 1: vergelijkingskaarten verschijnen. Beat 2:
 * rentepercentages tellen rustig af, één kaart krijgt een amber accentrand.
 * Beat 3: subregel + CTA, kaarten maken een hele lichte stijging.
 * Bewust rentevaste perioden (geen verzonnen aanbieders): per-verstrekker kan
 * niet op open data. Rentes zijn een gelabeld rekenvoorbeeld.
 */
type KaartData = { periode: string; rente: number; detail: string; accent?: boolean };

const KAARTEN: KaartData[] = [
  { periode: "5 jaar vast", rente: 3.4, detail: "annuïteit, met NHG" },
  { periode: "10 jaar vast", rente: 3.7, detail: "annuïteit, met NHG", accent: true },
  { periode: "20 jaar vast", rente: 4.1, detail: "annuïteit, met NHG" },
];

export const Hypotheek: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();
  const groot = formaat === "story";
  // Breed toont 3 kaarten; vierkant en story tonen er 2 voor een opgeruimd beeld.
  const kaarten = formaat === "breed" ? KAARTEN : KAARTEN.slice(0, 2);
  const richting = formaat === "story" ? "column" : "row";
  const kaartBreedte = formaat === "breed" ? 226 : formaat === "vierkant" ? 330 : 560;

  const visual = (
    <div style={{ display: "flex", flexDirection: "column", gap: groot ? 24 : 18, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: richting, gap: groot ? 26 : 22, justifyContent: "center" }}>
        {kaarten.map((kaart, i) => {
          const start = 12 + i * 8;
          const accentOp = kaart.accent ? verloop(frame, 84, 18) : 0;
          // Rente telt rustig af van +0,8 punt naar de eindwaarde.
          const rente = kaart.rente + 0.8 * (1 - verloop(frame, 48, 44));
          const stijging = verloop(frame, BEAT3, 24) * (groot ? 8 : 6);
          return (
            <div
              key={kaart.periode}
              style={{
                opacity: fade(frame, start, 18),
                translate: `0px ${schuif(frame, start, 18, 22) - stijging}px`,
              }}
            >
              <div
                style={{
                  width: kaartBreedte,
                  backgroundColor: kleur.paneel,
                  border: `2px solid ${accentOp > 0.01 ? kleur.accent : kleur.merkWash}`,
                  borderRadius: 14,
                  padding: groot ? 34 : 26,
                  boxShadow: "0 18px 44px rgba(22, 50, 79, 0.07)",
                  textAlign: "left",
                }}
              >
                <SectieLabel grootte={groot ? 21 : 16}>{kaart.periode}</SectieLabel>
                <p
                  style={{
                    fontFamily: font.display,
                    fontWeight: 600,
                    fontSize: groot ? 66 : 48,
                    color: kleur.merk,
                    margin: `${groot ? 14 : 10}px 0 0`,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {procent(rente)}
                </p>
                {formaat === "story" ? null : (
                  <p
                    style={{
                      fontFamily: font.sans,
                      fontSize: groot ? 20 : 17,
                      color: kleur.merkLicht,
                      margin: "10px 0 0",
                    }}
                  >
                    {kaart.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: fade(frame, BEAT3 + 4, 20) }}>
        <MicroRegel grootte={groot ? 21 : 17}>Indicatieve rentes per rentevaste periode, rekenvoorbeeld juli 2026.</MicroRegel>
      </div>
    </div>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Vergelijk hypotheken op feiten en voorwaarden"
      subregel="Zie direct welke rente en voorwaarden passen bij jouw situatie."
      cta="Vergelijk opties"
      visual={visual}
      subregelVroeg={false}
    />
  );
};
