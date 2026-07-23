import { ImageResponse } from "next/og";

/**
 * Gedeelde bouwsteen voor site-brede og-afbeeldingen (app/opengraph-image.tsx
 * en app/twitter-image.tsx). Paginatypes kunnen later een eigen variant krijgen
 * door woneaOgImage({ titel }) aan te roepen vanuit een eigen
 * opengraph-image.tsx in hun segment; nu is alleen de site-brede default
 * aangesloten.
 *
 * Bewust geen externe font-fetches: ImageResponse rendert met zijn ingebouwde
 * standaardfont. De serif-merkkeuze (Source Serif 4) geldt hier dus niet;
 * dat is een geaccepteerde beperking van og-rendering, zie het g2-rapport.
 *
 * De token-gebonden rapport-afbeelding (adres + waarde) blijft apart in
 * app/api/og/route.tsx: die heeft database- en suppressielogica nodig.
 */

// Kleurwaarden zijn 1-op-1 de design tokens uit app/globals.css (ImageResponse
// kan geen CSS-variabelen of Tailwind-tokens lezen). Geen nieuwe hexcodes.
const KLEUR = {
  achtergrond: "#faf9f7",
  inktZacht: "#4b5563",
  gedempt: "#6b7280",
  lijn: "#e5e1da",
  merk: "#16324f",
  merkWash: "#eef3f8",
  merk100: "#e4ebf2",
  accent: "#b4740f",
  wit: "#ffffff",
};

export const OG_MAAT = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "Wonea, eerlijk inzicht in je woningwaarde";

/** Standaardzin onder de merknaam; paginavarianten geven een eigen titel mee. */
const STANDAARD_TITEL = "Eerlijk inzicht in je woningwaarde";

/**
 * Het oplopende-huizen-merkteken, dezelfde vier paden als components/logo.tsx
 * (dat component rendert via Tailwind-classes en currentColor en is daarom
 * niet direct bruikbaar in satori; de vorm is hier 1-op-1 overgenomen).
 */
function WoneaMerkteken({ maat, kleur }: { maat: number; kleur: string }) {
  return (
    <svg width={maat} height={maat} viewBox="0 0 200 200" fill={kleur} xmlns="http://www.w3.org/2000/svg">
      <path d="M 40 160 V 90 L 95 35 H 115 L 60 90 V 160 Z" />
      <path d="M 72 160 V 102 L 120 47 H 140 L 92 102 V 160 Z" />
      <path d="M 104 160 V 114 L 145 62 L 165 82 L 124 125 V 160 Z" opacity="0.9" />
      <path d="M 136 160 V 130 L 165 101 V 160 Z" opacity="0.8" />
    </svg>
  );
}

/**
 * Site-brede og-afbeelding in de Wonea-huid: licht, rustig, merk-diepblauw,
 * met de bandbreedte-balk als grafisch element (de kern van de merkbelofte)
 * en 1 amber accent-moment (de marker). Zonder cijfers: een og-afbeelding
 * met verzonnen bedragen zou de eerlijkheidsregel schenden.
 */
export function woneaOgImage(opties: { titel?: string } = {}): ImageResponse {
  const titel = opties.titel ?? STANDAARD_TITEL;
  // Langere paginatitels iets kleiner zetten zodat ze binnen 2 regels blijven.
  const titelGrootte = titel.length > 46 ? 54 : 68;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: KLEUR.achtergrond,
          color: KLEUR.merk,
          padding: 72,
          position: "relative",
        }}
      >
        {/* Groot, zacht achtergrond-motief: de oplopende huisvorm in merk-100 (BRAND.md). */}
        <div style={{ display: "flex", position: "absolute", right: -70, bottom: -90 }}>
          <WoneaMerkteken maat={560} kleur={KLEUR.merk100} />
        </div>

        {/* Merkregel */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <WoneaMerkteken maat={64} kleur={KLEUR.merk} />
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700 }}>Wonea</div>
        </div>

        {/* Titel + bandbreedte-balk */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 860,
              fontSize: titelGrootte,
              fontWeight: 700,
              lineHeight: 1.15,
              color: KLEUR.merk,
            }}
          >
            {titel}
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 52, width: 640 }}>
            <div
              style={{
                display: "flex",
                position: "relative",
                height: 14,
                borderRadius: 999,
                backgroundColor: KLEUR.merkWash,
                border: `2px solid ${KLEUR.lijn}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: 356,
                  top: -10,
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  backgroundColor: KLEUR.accent,
                  border: `5px solid ${KLEUR.wit}`,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 14,
                fontSize: 22,
                color: KLEUR.gedempt,
              }}
            >
              <div style={{ display: "flex" }}>laag</div>
              <div style={{ display: "flex" }}>hoog</div>
            </div>
          </div>
        </div>

        {/* Voetregel */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: KLEUR.inktZacht }}>
          <div style={{ display: "flex" }}>Altijd met bandbreedte, bronnen en uitleg</div>
          <div style={{ display: "flex", color: KLEUR.gedempt }}>wonea.nl</div>
        </div>
      </div>
    ),
    { ...OG_MAAT },
  );
}
