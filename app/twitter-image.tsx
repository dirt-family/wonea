import { OG_ALT, OG_CONTENT_TYPE, OG_MAAT, woneaOgImage } from "@/lib/seo/og";

/**
 * Twitter-kaartafbeelding (Next-bestandsconventie), zelfde beeld als de
 * og-afbeelding zodat de kaart overal identiek is. Gedeelde opbouw in
 * lib/seo/og.tsx.
 */

export const alt = OG_ALT;
export const size = OG_MAAT;
export const contentType = OG_CONTENT_TYPE;

export default function TwitterImage() {
  return woneaOgImage();
}
