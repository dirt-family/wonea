/**
 * Wonea-merktokens voor de banners. Kleuren exact gelijk aan app/globals.css.
 * Wit (#ffffff) is het paneel-token uit datzelfde bestand (kaarten, knoptekst).
 */
export const kleur = {
  achtergrond: "#faf9f7",
  merk: "#16324f",
  merkLicht: "#235684",
  merkWash: "#eef3f8",
  accent: "#b4740f",
  accentWash: "#faf3e6",
  paneel: "#ffffff",
} as const;

export const font = {
  display: "'Source Serif 4', Georgia, serif",
  sans: "'Inter', -apple-system, sans-serif",
} as const;

export type Formaat = "breed" | "vierkant" | "story";

export const FORMATEN: Record<Formaat, { breedte: number; hoogte: number }> = {
  breed: { breedte: 1920, hoogte: 600 },
  vierkant: { breedte: 1080, hoogte: 1080 },
  story: { breedte: 1080, hoogte: 1920 },
};

/** Typografie- en ruimte-schaal per formaat (video-leesbaarheid eerst). */
export const MAAT: Record<
  Formaat,
  {
    kop: number;
    sub: number;
    cta: number;
    micro: number;
    merkregel: number;
    logo: number;
    paddingH: number;
    paddingV: number;
    kolomGap: number;
  }
> = {
  breed: { kop: 64, sub: 27, cta: 25, micro: 19, merkregel: 30, logo: 40, paddingH: 100, paddingV: 56, kolomGap: 90 },
  vierkant: { kop: 62, sub: 30, cta: 27, micro: 20, merkregel: 32, logo: 44, paddingH: 84, paddingV: 76, kolomGap: 0 },
  story: { kop: 80, sub: 37, cta: 31, micro: 23, merkregel: 38, logo: 52, paddingH: 96, paddingV: 150, kolomGap: 0 },
};

/** Vaste beat-grens (frames bij 30 fps, totaal 150 = 5 s, binnen de 4-6 s loop). */
export const FPS = 30;
export const DUUR = 150;
export const BEAT2 = 45;
export const BEAT3 = 105;
