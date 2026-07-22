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
  merk: "#16324f",
  merkWash: "#eef3f8",
};

const MAAT = { width: 1200, height: 630 };

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
    MAAT,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token || token.length < 16 || token.length > 128) return generiekeAfbeelding();

  const rapport = db.select().from(sharedReports).where(eq(sharedReports.token, token)).get();
  if (!rapport || rapport.revokedAt) return generiekeAfbeelding();

  const adres = db.select().from(addresses).where(eq(addresses.id, rapport.adresId)).get();
  if (!adres || adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) return generiekeAfbeelding();

  const { valuation } = getOrCreateValuation(adres);
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
    MAAT,
  );
}
