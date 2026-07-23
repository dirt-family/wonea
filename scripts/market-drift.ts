/**
 * Market-drift: simuleert de maandontwikkeling van de woningmarkt in het
 * testgebied, zodat de maandelijkse waarde-alerts echt iets te melden hebben.
 *
 * Per buurt (tabel neighborhoods):
 * - voegt voor de HUIDIGE maand extra synthetische verkopen toe aan sales
 *   (bron=seed, adres_id ALTIJD null, straat uit bestaande verkopen van die
 *   buurt), met prijzen rond het recente buurtniveau maal een drift van
 *   +0,2% tot +0,8% per run;
 * - upsert de market_stats-rij van deze maand (mediaan + volume uit de echte
 *   maandverkopen).
 *
 * Deterministisch per kalendermaand: de seed is afgeleid van jaar+maand (plus
 * de buurtcode), dus binnen dezelfde maand trekt elke run dezelfde drift en
 * dezelfde keuzes. Het prijsniveau schuift wel per run op, omdat de basis (het
 * recente buurtniveau) de verkopen van eerdere runs meetelt.
 *
 * Draaien: npx tsx scripts/market-drift.ts
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, sql } from "../lib/db";
import { marketStats, neighborhoods, sales } from "../db/schema";
import { mulberry32 } from "../db/seed/generator";

function mediaan(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** djb2-hash zodat elke buurt binnen de maand een eigen deterministische reeks krijgt. */
function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function isoMaandenTerug(maanden: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - maanden);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const nu = new Date();
  const jaar = nu.getFullYear();
  const maandNr = nu.getMonth() + 1;
  const maand = `${jaar}-${String(maandNr).padStart(2, "0")}`;
  const maandSeed = jaar * 100 + maandNr; // deterministisch per kalendermaand

  const buurten = await db.select().from(neighborhoods);
  console.log(`Market-drift voor ${maand}: ${buurten.length} buurten.`);

  let totaalNieuw = 0;
  for (const buurt of buurten) {
    const rand = mulberry32((maandSeed ^ stringHash(buurt.buurtCode)) >>> 0);

    // Recent buurtniveau per m2: laatste 3 maanden verkopen, anders 24
    // maanden, anders het buurt-anker (afgeleide uit CBS-WOZ).
    const recent = await db
      .select()
      .from(sales)
      .where(and(eq(sales.buurtCode, buurt.buurtCode), gte(sales.datum, isoMaandenTerug(3))));
    const basisVerkopen =
      recent.length >= 3
        ? recent
        : await db
            .select()
            .from(sales)
            .where(and(eq(sales.buurtCode, buurt.buurtCode), gte(sales.datum, isoMaandenTerug(24))));
    const m2Niveau = basisVerkopen.length > 0 ? mediaan(basisVerkopen.map((s) => s.prijs / s.oppervlakteM2)) : (buurt.ankerM2Prijs ?? null);

    // Straat, woningtype en oppervlakte komen uit bestaande verkopen van deze
    // buurt; nieuwe rijen hangen dus nooit aan een echt adres (adres_id null).
    const voorbeelden = await db.select().from(sales).where(eq(sales.buurtCode, buurt.buurtCode)).orderBy(desc(sales.datum)).limit(200);
    if (!m2Niveau || voorbeelden.length === 0) {
      console.log(`- ${buurt.naam}: overgeslagen (geen bestaande verkopen en geen buurt-anker).`);
      continue;
    }

    const drift = 1 + (0.002 + rand() * 0.006); // +0,2% tot +0,8% per run
    const volume = 2 + Math.floor(rand() * 4); // 2 tot 5 nieuwe verkopen

    const doorlooptijdDagen = 18 + Math.floor(rand() * 30);
    const overbiedingPct = Math.round((rand() * 8 - 1.5) * 10) / 10;

    const uitkomst = await db.transaction(async (tx) => {
      for (let i = 0; i < volume; i++) {
        const voorbeeld = voorbeelden[Math.floor(rand() * voorbeelden.length)];
        const oppervlakteM2 = Math.max(30, Math.round(voorbeeld.oppervlakteM2 * (0.9 + rand() * 0.2)));
        const prijs = Math.round((m2Niveau * drift * oppervlakteM2 * (0.93 + rand() * 0.14)) / 1000) * 1000;
        const dag = Math.min(1 + Math.floor(rand() * 27), nu.getDate());
        await tx
          .insert(sales)
          .values({
            buurtCode: buurt.buurtCode,
            straat: voorbeeld.straat,
            adresId: null, // HARDE REGEL: synthetische verkopen nooit aan een echt adres
            datum: `${maand}-${String(dag).padStart(2, "0")}`,
            prijs,
            oppervlakteM2,
            woningtype: voorbeeld.woningtype,
            bron: "seed",
          });
      }

      // market_stats voor deze maand: mediaan en volume uit ALLE verkopen van
      // de maand (bestaande plus zojuist toegevoegde).
      const maandVerkopen = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.buurtCode, buurt.buurtCode), gte(sales.datum, `${maand}-01`), lte(sales.datum, `${maand}-31`)));
      const mediaanPrijs = Math.round(mediaan(maandVerkopen.map((s) => s.prijs)));
      await tx
        .insert(marketStats)
        .values({
          buurtCode: buurt.buurtCode,
          maand,
          mediaanPrijs,
          doorlooptijdDagen,
          overbiedingPct,
          volume: maandVerkopen.length,
          bron: "seed",
        })
        .onConflictDoUpdate({
          target: [marketStats.buurtCode, marketStats.maand],
          set: { mediaanPrijs, doorlooptijdDagen, overbiedingPct, volume: maandVerkopen.length },
        });

      return { mediaanPrijs, volumeMaand: maandVerkopen.length };
    });

    totaalNieuw += volume;
    const driftPct = ((drift - 1) * 100).toFixed(2).replace(".", ",");
    console.log(
      `- ${buurt.naam}: drift +${driftPct}%, ${volume} nieuwe verkopen rond ${Math.round(m2Niveau * drift)} euro/m2; ` +
        `maand ${maand}: mediaan ${uitkomst.mediaanPrijs} euro, volume ${uitkomst.volumeMaand}.`,
    );
  }

  console.log(`Klaar: ${totaalNieuw} synthetische verkopen toegevoegd voor ${maand}. Maandrun alerts: POST /api/alerts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
