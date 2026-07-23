import { OG_ALT, OG_CONTENT_TYPE, OG_MAAT, woneaOgImage } from "@/lib/seo/og";

/**
 * Site-brede og-afbeelding (Next-bestandsconventie in het root-segment):
 * de default voor elke route zonder eigen og-afbeelding. De gedeelde
 * opbouw staat in lib/seo/og.tsx; het token-gebonden rapportbeeld blijft
 * in app/api/og/route.tsx.
 */

export const alt = OG_ALT;
export const size = OG_MAAT;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return woneaOgImage();
}
