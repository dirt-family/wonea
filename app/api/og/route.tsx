import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, sharedReports } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro } from "@/lib/util";

/**
 * Og-afbeelding voor gedeelde rapporten. Toont alleen adres en waarde bij een
 * GELDIG, niet-ingetrokken token van een niet-gesupprimeerd adres; in alle
 * andere gevallen een generieke Wonea-afbeelding (geen informatielek via og).
 * Default font van ImageResponse; bewust geen externe fetches.
 */

// Kleurwaarden zijn 1-op-1 de design tokens uit app/globals.css (ImageResponse
// kan geen CSS-variabelen of Tailwind-tokens lezen). Geen nieuwe hexcodes.
const KLEUR = {
  achtergrond: "#faf9f7",
  paneel: "#ffffff",
  inkt: "#1f2733",
  inktZacht: "#4b5563",
  gedempt: "#6b7280",
  lijn: "#e5e1da",
  merk: "#253853",
  merkWash: "#eef2f7",
};

const MAAT = { width: 1200, height: 630 };

// Cache-beleid (Fase 5.3, docs/PERFORMANCE.md): og-rendering is relatief duur
// (satori) en crawlers halen dezelfde afbeelding vaak herhaald op.
// - Generiek (geen/ongeldig token): statische inhoud, 24u cachen.
// - Token-afbeelding: bevat adres + waarde, dus KORT cachen (1u, geen
//   stale-while-revalidate): na intrekken van het token of opt-out van het
//   adres is de afbeelding binnen een uur ook uit shared caches verdwenen.
//   Er is geen on-demand purge voor deze route; de korte TTL is de grens.
const CACHE_GENERIEK = "public, max-age=86400";
const CACHE_TOKEN = "public, max-age=3600";

function generiekeAfbeelding() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: KLEUR.achtergrond,
          color: KLEUR.inkt,
        }}
      >
        <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: KLEUR.merk }}>Wonea</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: KLEUR.inktZacht }}>
          Eerlijk inzicht in woningwaarde
        </div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 26, color: KLEUR.gedempt }}>wonea.nl</div>
      </div>
    ),
    { ...MAAT, headers: { "Cache-Control": CACHE_GENERIEK } },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token || token.length < 16 || token.length > 128) return generiekeAfbeelding();

  const rapport = (await db.select().from(sharedReports).where(eq(sharedReports.token, token)).limit(1))[0];
  if (!rapport || rapport.revokedAt) return generiekeAfbeelding();

  const adres = (await db.select().from(addresses).where(eq(addresses.id, rapport.adresId)).limit(1))[0];
  if (!adres || adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug))) return generiekeAfbeelding();

  const { valuation } = await getOrCreateValuation(adres);
  if (!valuation) return generiekeAfbeelding();

  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: KLEUR.achtergrond,
          color: KLEUR.inkt,
          padding: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: KLEUR.merk }}>Wonea</div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: KLEUR.gedempt,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            Woningwaarde-rapport
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
            backgroundColor: KLEUR.paneel,
            border: `2px solid ${KLEUR.lijn}`,
            borderRadius: 20,
            marginTop: 36,
            padding: "48px 56px",
          }}
        >
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600 }}>{naam}</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 28, color: KLEUR.inktZacht }}>
            {adres.postcode} {adres.plaats}
          </div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 84, fontWeight: 700, color: KLEUR.merk }}>
            {formatEuro(valuation.waarde)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 28,
              color: KLEUR.inktZacht,
              backgroundColor: KLEUR.merkWash,
              borderRadius: 999,
              padding: "10px 24px",
            }}
          >
            Bandbreedte {formatEuro(valuation.intervalLaag)} tot {formatEuro(valuation.intervalHoog)}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, fontSize: 24, color: KLEUR.gedempt }}>
          <div style={{ display: "flex" }}>Modelmatige schatting met bandbreedte, geen taxatie</div>
          <div style={{ display: "flex" }}>wonea.nl</div>
        </div>
      </div>
    ),
    { ...MAAT, headers: { "Cache-Control": CACHE_TOKEN } },
  );
}
