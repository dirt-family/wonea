/**
 * Seed-script: vult de lokale database met het testgebied (Eindhoven).
 * Idempotent: draait op een deterministische generator en upsert op
 * natuurlijke sleutels; 2x draaien geeft 0 verschil.
 * HARDE REGEL (suppressie): een adres dat in optouts staat wordt NOOIT
 * teruggezet op actief, ook niet bij her-seed/her-ingest.
 */
import { eq, sql } from "drizzle-orm";
import { db, sql as pool } from "../lib/db";
import { addresses, marketStats, municipalities, neighborhoods, sales, wozValues } from "../db/schema";
import { BUURTEN, GEMEENTE, buurtSlug, genereerAdressen, genereerVerkopen, mulberry32 } from "../db/seed/generator";
import { isSuppressed } from "../lib/suppression";

async function main() {
  console.log("Seed: gemeente + buurten");
  await db
    .insert(municipalities)
    .values({ code: GEMEENTE.code, naam: GEMEENTE.naam, slug: GEMEENTE.slug })
    .onConflictDoNothing();

  for (const b of BUURTEN) {
    await db
      .insert(neighborhoods)
      .values({
        buurtCode: b.buurtCode,
        naam: b.naam,
        slug: buurtSlug(b.naam),
        gemeenteCode: GEMEENTE.code,
        gemWoz: b.gemWoz,
        inwoners: b.inwoners,
      })
      .onConflictDoUpdate({
        target: neighborhoods.buurtCode,
        set: { naam: b.naam, slug: buurtSlug(b.naam), gemWoz: b.gemWoz, inwoners: b.inwoners },
      });
  }

  console.log("Seed: adressen");
  const adressen = genereerAdressen();
  await db.transaction(async (tx) => {
    for (const a of adressen) {
      // Suppressielijst is leidend: opted-out adressen niet terugzetten.
      if (await isSuppressed(a.postcode, a.nummerslug)) continue;
      await tx
        .insert(addresses)
        .values({
          straat: a.straat,
          huisnummer: a.huisnummer,
          toevoeging: a.toevoeging,
          nummerslug: a.nummerslug,
          postcode: a.postcode,
          plaats: a.plaats,
          buurtCode: a.buurtCode,
          bouwjaar: a.bouwjaar,
          oppervlakteM2: a.oppervlakteM2,
          woningtype: a.woningtype,
          energielabel: a.energielabel,
          energielabelBron: "indicatie",
          bron: "seed",
        })
        .onConflictDoNothing();
    }
  });

  console.log("Seed: buurt-ankers (gem. oppervlakte + anker-m2-prijs, afgeleide)");
  for (const b of BUURTEN) {
    const row = (
      await db
        .select({ avgOpp: sql<number>`avg(${addresses.oppervlakteM2})` })
        .from(addresses)
        .where(eq(addresses.buurtCode, b.buurtCode))
        .limit(1)
    )[0];
    const gemOpp = row?.avgOpp ?? null;
    const anker = gemOpp ? b.gemWoz / gemOpp : null;
    await db
      .update(neighborhoods)
      .set({ gemOppervlakte: gemOpp, ankerM2Prijs: anker })
      .where(eq(neighborhoods.buurtCode, b.buurtCode));
  }

  console.log("Seed: verkopen + marktstatistieken (synthetisch, buurtniveau, NOOIT aan een echt adres)");
  const { verkopen, stats } = genereerVerkopen();
  // Verkopen hebben geen natuurlijke sleutel: bij her-seed eerst seed-rijen weg.
  await db.delete(sales).where(eq(sales.bron, "seed"));
  await db.transaction(async (tx) => {
    for (const v of verkopen) {
      await tx
        .insert(sales)
        .values({ buurtCode: v.buurtCode, straat: v.straat, adresId: null, datum: v.datum, prijs: v.prijs, oppervlakteM2: v.oppervlakteM2, woningtype: v.woningtype, bron: "seed" });
    }
    for (const s of stats) {
      await tx
        .insert(marketStats)
        .values({ buurtCode: s.buurtCode, maand: s.maand, mediaanPrijs: s.mediaanPrijs, doorlooptijdDagen: s.doorlooptijdDagen, overbiedingPct: s.overbiedingPct, volume: s.volume, bron: "seed" })
        .onConflictDoUpdate({
          target: [marketStats.buurtCode, marketStats.maand],
          set: { mediaanPrijs: s.mediaanPrijs, doorlooptijdDagen: s.doorlooptijdDagen, overbiedingPct: s.overbiedingPct, volume: s.volume },
        });
    }
  });

  console.log("Seed: WOZ-waarden (seed, gelabeld; echte WOZ = eigenaar-invoer)");
  const rand = mulberry32(555777);
  const alleAdressen = await db.select().from(addresses);
  await db.transaction(async (tx) => {
    for (const a of alleAdressen) {
      if (rand() > 0.35) continue; // deel van de adressen heeft een seed-WOZ
      const bestaand = (await tx.select({ id: wozValues.id }).from(wozValues).where(eq(wozValues.adresId, a.id)).limit(1))[0];
      if (bestaand) continue;
      const buurt = BUURTEN.find((b) => b.buurtCode === a.buurtCode);
      if (!buurt) continue;
      const waarde = Math.round((buurt.gemWoz * (a.oppervlakteM2 / 110) * (0.85 + rand() * 0.3)) / 1000) * 1000;
      await tx.insert(wozValues).values({ adresId: a.id, peiljaar: 2025, waarde, bron: "seed" });
    }
  });

  const counts = {
    adressen: (await db.select({ n: sql<number>`count(*)` }).from(addresses).limit(1))[0]?.n,
    verkopen: (await db.select({ n: sql<number>`count(*)` }).from(sales).limit(1))[0]?.n,
    stats: (await db.select({ n: sql<number>`count(*)` }).from(marketStats).limit(1))[0]?.n,
  };
  console.log(`Seed klaar: ${counts.adressen} adressen, ${counts.verkopen} verkopen, ${counts.stats} marktstat-rijen.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
