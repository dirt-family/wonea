import { Easing, interpolate } from "remotion";

/** Zelfde curves als de site-tokens (--ease-uit) plus een rustige in-uit. */
export const EASE_UIT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_INUIT = Easing.bezier(0.45, 0, 0.55, 1);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Fade-in vanaf een startframe (ease-out, geklemd). */
export const fade = (frame: number, start: number, duur = 18): number =>
  interpolate(frame, [start, start + duur], [0, 1], { easing: EASE_UIT, ...clamp });

/** Zachte opwaartse entree: afstand in px die naar 0 loopt. */
export const schuif = (frame: number, start: number, duur = 18, afstand = 26): number =>
  interpolate(frame, [start, start + duur], [afstand, 0], { easing: EASE_UIT, ...clamp });

/** Genormaliseerde voortgang 0-1 met rustige in-uit easing. */
export const verloop = (frame: number, start: number, duur: number): number =>
  interpolate(frame, [start, start + duur], [0, 1], { easing: EASE_INUIT, ...clamp });

/** Tellerwaarde: telt van `van` naar `tot`, afgerond op `stap` voor rust in beeld. */
export const telWaarde = (frame: number, start: number, duur: number, van: number, tot: number, stap = 1000): number => {
  const p = verloop(frame, start, duur);
  return Math.round((van + (tot - van) * p) / stap) * stap;
};

/** Eén rustige ademhaling: 1 -> 1+sterkte -> 1, eindigt exact op 1 (loopvriendelijk). */
export const adem = (frame: number, start: number, einde: number, sterkte = 0.02): number => {
  if (frame <= start || frame >= einde) return 1;
  const p = (frame - start) / (einde - start);
  return 1 + Math.sin(Math.PI * p) * sterkte;
};

/** Euro-notatie, hele euro's, nl-NL. */
export const euro = (n: number): string =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Percentage met 1 decimaal en komma (nl-NL). */
export const procent = (n: number): string => `${n.toFixed(1).replace(".", ",")}%`;

/** Lengte van een polyline (voor teken-animaties in SVG). */
export const polyLengte = (punten: ReadonlyArray<readonly [number, number]>): number => {
  let l = 0;
  for (let i = 1; i < punten.length; i++) {
    l += Math.hypot(punten[i][0] - punten[i - 1][0], punten[i][1] - punten[i - 1][1]);
  }
  return l;
};
