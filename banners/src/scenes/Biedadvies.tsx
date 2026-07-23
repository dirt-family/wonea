import React from "react";
import { useCurrentFrame } from "remotion";
import { Kader } from "../components/Kader";
import { BronChip, MicroRegel } from "../components/onderdelen";
import { euro, fade, verloop } from "../helpers";
import { BEAT3, Formaat, kleur } from "../theme";

/**
 * Biedadvies. Beat 1: kop + subregel + strak assenstelsel. Beat 2: lijngrafiek
 * van recente transacties tekent zich van links naar rechts, amber doelgebied
 * verschijnt. Beat 3: geadviseerde biedrange stabiliseert + CTA.
 * Story: vereenvoudigd tot stippellijn met doelzone, assen vallen weg.
 * De reeks is illustratief en zo gelabeld.
 */
const PUNTEN: ReadonlyArray<readonly [number, number]> = [
  [0, 78],
  [11, 74],
  [22, 76],
  [33, 68],
  [44, 70],
  [55, 61],
  [66, 63],
  [77, 54],
  [88, 50],
  [100, 44],
];

const VB: Record<Formaat, { b: number; h: number }> = {
  breed: { b: 660, h: 340 },
  vierkant: { b: 800, h: 400 },
  story: { b: 820, h: 480 },
};

export const Biedadvies: React.FC<{ formaat: Formaat }> = ({ formaat }) => {
  const frame = useCurrentFrame();
  const groot = formaat === "story";
  const { b, h } = VB[formaat];
  const marge = 22;

  // Doelzone (biedrange) over het rechterdeel, rond het lijn-einde.
  const zoneX = b * 0.58;
  const zoneY = h * 0.32;
  const zoneH = h * 0.26;

  const naarX = (x: number) => marge + (x / 100) * (b - 2 * marge);
  const naarY = (y: number) => marge + (y / 100) * (h - 2 * marge);
  const punten = PUNTEN.map(([x, y]) => `${naarX(x).toFixed(1)},${naarY(y).toFixed(1)}`).join(" ");

  const teken = verloop(frame, 40, 55);
  const zoneOp = fade(frame, 78, 20);
  const laatste = PUNTEN[PUNTEN.length - 1];

  const visual = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: groot ? 24 : 16 }}>
      <svg width={b} height={h} viewBox={`0 0 ${b} ${h}`} style={{ opacity: fade(frame, 12, 20) }}>
        {formaat === "story" ? null : (
          <g stroke={kleur.merkLicht} strokeWidth={2} opacity={0.45}>
            <line x1={marge} y1={marge / 2} x2={marge} y2={h - marge} />
            <line x1={marge} y1={h - marge} x2={b - marge / 2} y2={h - marge} />
          </g>
        )}
        <rect
          x={zoneX}
          y={zoneY}
          width={b - zoneX - marge}
          height={zoneH}
          rx={12}
          fill={kleur.accentWash}
          stroke={kleur.accent}
          strokeWidth={2}
          strokeDasharray="8 8"
          opacity={zoneOp}
        />
        <defs>
          <clipPath id={`teken-${formaat}`}>
            <rect x={0} y={0} width={teken * b} height={h} />
          </clipPath>
        </defs>
        <g clipPath={`url(#teken-${formaat})`}>
          <polyline
            points={punten}
            fill="none"
            stroke={kleur.merk}
            strokeWidth={groot ? 6 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={formaat === "story" ? "1 18" : undefined}
          />
        </g>
        <circle
          cx={naarX(laatste[0])}
          cy={naarY(laatste[1])}
          r={groot ? 12 : 10}
          fill={kleur.accent}
          stroke={kleur.paneel}
          strokeWidth={4}
          opacity={fade(frame, 92, 14)}
        />
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          opacity: fade(frame, BEAT3, 20),
        }}
      >
        <MicroRegel grootte={groot ? 24 : 20}>
          Adviesrange: {euro(402000)} tot {euro(418000)}
        </MicroRegel>
        <BronChip grootte={groot ? 20 : 17}>Illustratieve reeks, rekenvoorbeeld juli 2026</BronChip>
      </div>
    </div>
  );

  return (
    <Kader
      formaat={formaat}
      kop="Bied met kennis, niet op gevoel"
      subregel="Ontvang een realistisch biedadvies op basis van recente verkoopprijzen."
      cta="Ontvang biedadvies"
      visual={visual}
    />
  );
};
