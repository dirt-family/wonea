import Image from "next/image";

/**
 * Decoratieve illustraties uit public/illustraties (viewBox 240x180, alleen
 * merk-tinten + max 1 amber-accent per stuk). Standaard aria-hidden: ze dragen
 * geen informatie die niet ook in de tekst ernaast staat. Draagt een
 * illustratie bij uitzondering wel betekenis, geef dan een alt mee.
 */

export const ILLUSTRATIE_NAMEN = [
  "hero-motief",
  "lege-staat",
  "woningwaarde",
  "bieden",
  "verduurzamen",
  "jouw-data",
  "rapport",
] as const;

export type IllustratieNaam = (typeof ILLUSTRATIE_NAMEN)[number];

export function Illustratie({
  naam,
  alt,
  className = "",
}: {
  naam: IllustratieNaam;
  alt?: string;
  className?: string;
}) {
  return (
    <Image
      src={`/illustraties/${naam}.svg`}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      width={240}
      height={180}
      unoptimized
      className={className}
    />
  );
}
