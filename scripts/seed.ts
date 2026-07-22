/**
 * Seed-script: vult de lokale database met het testgebied (Eindhoven).
 * Idempotent: draait op een deterministische generator en upsert op
 * natuurlijke sleutels; 2x draaien geeft 0 verschil.
 * HARDE REGEL (suppressie): een adres dat in optouts staat wordt NOOIT
 * teruggezet op actief, ook niet bij her-seed/her-ingest.
 */
import { eq, sql } from "drizzle-orm";
import { db, sqlite } from "../lib/db";
import { addresses, marketStats, municipalities, neighborhoods, sales, wozValues } from "../db/schema";
import { BUURTEN, GEMEENTE, buurtSlug, genereerAdressen, genereerVerkopen, mulberry32 } from "../db/seed/generator";
import { isSuppressed } from "../lib/suppression";

function main() {
  console.log("Seed: gemeente + buurten");
  db.insert(municipalities)
    .values({ code: GEMEENTE.code, naam: GEMEENTE.naam, slug: GEMEENTE.slug })
    .onConflictDoNothing()
    .run();

  for (const b of BUURTEN) {
    db.insert(neighborhoods)
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
      })
      .run();
  }

  console.log("Seed: adressen");
  const adressen = genereerAdressen();
  const seedAlles = sqlite.transaction(() => {
    for (const a of adressen) {
      // Suppressielijst is leidend: opted-out adressen niet terugzetten.
      if (isSuppressed(a.postcode, a.nummerslug)) continue;
      db.insert(addresses)
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
        .onConflictDoNothing()
        .run();
    }
  });
  seedAlles();

  console.log("Seed: buurt-ankers (gem. oppervlakte + anker-m2-prijs, afgeleide)");
  for (const b of BUURTEN) {
    const row = db
      .select({ avgOpp: sql<number>`avg(${addresses.oppervlakteM2})` })
      .from(addresses)
      .where(eq(addresses.buurtCode, b.buurtCode))
      .get();
    const gemOpp = row?.avgOpp ?? null;
    const anker = gemOpp ? b.gemWoz / gemOpp : null;
    db.update(neighborhoods)
      .set({ gemOppervlakte: gemOpp, ankerM2Prijs: anker })
      .where(eq(neighborhoods.buurtCode, b.buurtCode))
      .run();
  }

  console.log("Seed: verkopen + marktstatistieken (synthetisch, buurtniveau, NOOIT aan een echt adres)");
  const { verkopen, stats } = genereerVerkopen();
  // Verkopen hebben geen natuurlijke sleutel: bij her-seed eerst seed-rijen weg.
  db.delete(sales).where(eq(sales.bron, "seed")).run();
  const verkoopTx = sqlite.transaction(() => {
    for (const v of verkopen) {
      db.insert(sales)
        .values({ buurtCode: v.buurtCode, straat: v.straat, adresId: null, datum: v.datum, prijs: v.prijs, oppervlakteM2: v.oppervlakteM2, woningtype: v.woningtype, bron: "seed" })
        .run();
    }
    for (const s of stats) {
      db.insert(marketStats)
        .values({ buurtCode: s.buurtCode, maand: s.maand, mediaanPrijs: s.mediaanPrijs, doorlooptijdDagen: s.doorlooptijdDagen, overbiedingPct: s.overbiedingPct, volume: s.volume, bron: "seed" })
        .onConflictDoUpdate({
          target: [marketStats.buurtCode, marketStats.maand],
          set: { mediaanPrijs: s.mediaanPrijs, doorlooptijdDagen: s.doorlooptijdDagen, overbiedingPct: s.overbiedingPct, volume: s.volume },
        })
        .run();
    }
  });
  verkoopTx();

  console.log("Seed: WOZ-waarden (seed, gelabeld; echte WOZ = eigenaar-invoer)");
  const rand = mulberry32(555777);
  const alleAdressen = db.select().from(addresses).all();
  const wozTx = sqlite.transaction(() => {
    for (const a of alleAdressen) {
      if (rand() > 0.35) continue; // deel van de adressen heeft een seed-WOZ
      const bestaand = db.select({ id: wozValues.id }).from(wozValues).where(eq(wozValues.adresId, a.id)).get();
      if (bestaand) continue;
      const buurt = BUURTEN.find((b) => b.buurtCode === a.buurtCode);
      if (!buurt) continue;
      const waarde = Math.round((buurt.gemWoz * (a.oppervlakteM2 / 110) * (0.85 + rand() * 0.3)) / 1000) * 1000;
      db.insert(wozValues).values({ adresId: a.id, peiljaar: 2025, waarde, bron: "seed" }).run();
    }
  });
  wozTx();

  const counts = {
    adressen: db.select({ n: sql<number>`count(*)` }).from(addresses).get()?.n,
    verkopen: db.select({ n: sql<number>`count(*)` }).from(sales).get()?.n,
    stats: db.select({ n: sql<number>`count(*)` }).from(marketStats).get()?.n,
  };
  console.log(`Seed klaar: ${counts.adressen} adressen, ${counts.verkopen} verkopen, ${counts.stats} marktstat-rijen.`);
}

main();
