import { and, count, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { addresses, marketStats, municipalities, neighborhoods, valuations } from "@/db/schema";
import { isSuppressed, suppressedKeySet } from "@/lib/suppression";
import { getOrCreateValuation, type Adres } from "@/lib/valuation";
import { berekenBiedadvies, type Biedadvies } from "@/lib/biedadvies";

/**
 * Queries voor de homepage. Alles hier is ECHT: adressen, waardes en tellingen
 * komen live uit de database; er wordt niets verzonnen (CONTRACTS "Statistieken
 * zijn echt"). Suppressie wordt op elk adres-tonend pad gecheckt.
 */

/**
 * De open databronnen waar Wonea op draait, zoals gedocumenteerd en geverifieerd
 * in docs/DATABRONNEN.md. Deze lijst voedt het cijfer "open databronnen" in de
 * statistieken-band; het aantal is dus de lengte van deze benoembare lijst,
 * geen los verzonnen getal.
 */
export const OPEN_BRONNEN: readonly string[] = [
  "BAG (Kadaster)", // adressen, bouwjaren, oppervlaktes
  "CBS Kerncijfers wijken en buurten", // buurtgrenzen, gemiddelde WOZ, inwoners
  "EP-Online (RVO)", // geregistreerde energielabels
  "DNB", // gemiddelde hypotheekrentes per rentevaste periode
  "OpenStreetMap", // makelaarskantoren (ODbL, met attributie)
  "Milieu Centraal", // besparingskentallen verduurzaming
  "Leennormen 2026 (Staatscourant)", // financieringslastpercentages budgetberekenaar
  "NHG", // kostengrens en borgtochtprovisie 2026
];

/** Aantal gratis rekenhulpen; hoort gelijk te lopen met de lijst op /tools. */
export const AANTAL_TOOLS = 9;

export type VoorbeeldValuation = {
  waarde: number;
  intervalLaag: number;
  intervalHoog: number;
  confidence: "hoog" | "middel" | "laag";
  nComparables: number;
};

export type VoorbeeldWoning = {
  adres: Adres;
  valuation: VoorbeeldValuation;
  /** Niveau waarop de comparables gevonden zijn: straat of buurt. */
  niveau: "straat" | "buurt";
  buurtNaam: string | null;
  /** Biedadvies op basis van echte market_stats van de buurt; null zonder cijfers. */
  biedadvies: Biedadvies | null;
};

export type WoningKaartData = {
  id: number;
  straat: string;
  huisnummer: number;
  toevoeging: string | null;
  nummerslug: string;
  postcode: string;
  plaats: string;
  energielabel: string | null;
  energielabelBron: "echt" | "indicatie";
  waarde: number;
  intervalLaag: number;
  intervalHoog: number;
};

export type HomepageStats = {
  adressen: number;
  buurten: number;
  tools: number;
  bronnen: number;
};

export type PlaatsLink = { naam: string; slug: string };

/**
 * Het vaste voorbeeldadres voor de hero-preview: Jamaïcaring 9, 5152ME Drunen.
 * Dit is Mitch' eigen woonadres, op zijn eigen verzoek het voorbeeldadres van
 * Wonea (aangemaakt en gevuld door scripts/adres-drunen.ts). Bestaat het adres
 * niet in de database (bv. testdatabase), is het inactief of gesupprimeerd, of
 * lukt er geen eerlijke schatting, dan valt getVoorbeeldWoning terug op het
 * eerste actieve adres met een schatting (laagste id).
 */
export const VOORBEELD_ADRES = { postcode: "5152ME", nummerslug: "9" } as const;

/**
 * Bouwt de hero-preview voor een kandidaat-adres, of geeft null als het adres
 * gesupprimeerd is of geen eerlijke schatting krijgt. getOrCreateValuation is
 * hetzelfde pad als de woningpagina en schrijft hooguit 1 valuation-rij per
 * adres per dag.
 */
async function bouwVoorbeeldWoning(adres: Adres): Promise<VoorbeeldWoning | null> {
  if (await isSuppressed(adres.postcode, adres.nummerslug)) return null;

  const { valuation, comparables, buurt } = await getOrCreateValuation(adres);
  if (!valuation) return null; // liever een adres met een echte schatting dan een lege preview

  const statRijen = await db
    .select()
    .from(marketStats)
    .where(eq(marketStats.buurtCode, adres.buurtCode))
    .orderBy(desc(marketStats.maand))
    .limit(6);

  const biedadvies = berekenBiedadvies({
    valuation: { intervalLaag: valuation.intervalLaag, intervalHoog: valuation.intervalHoog },
    marktMaanden: statRijen.map((r) => ({
      maand: r.maand,
      overbiedingPct: r.overbiedingPct,
      doorlooptijdDagen: r.doorlooptijdDagen,
    })),
  });

  return {
    adres,
    valuation: {
      waarde: valuation.waarde,
      intervalLaag: valuation.intervalLaag,
      intervalHoog: valuation.intervalHoog,
      confidence: valuation.confidence,
      nComparables: valuation.nComparables,
    },
    niveau: comparables.niveau,
    buurtNaam: buurt?.naam ?? null,
    biedadvies,
  };
}

/**
 * Voorbeeldadres voor de hero-preview: eerst het vaste VOORBEELD_ADRES
 * (indien actief, niet gesupprimeerd en met een schatting), anders het eerste
 * actieve, niet-gesupprimeerde adres (laagste id) waarvoor een eerlijke
 * schatting bestaat.
 */
async function getVoorbeeldWoningOngecachet(): Promise<VoorbeeldWoning | null> {
  const vastRows = await db
    .select()
    .from(addresses)
    .where(
      and(
        eq(addresses.postcode, VOORBEELD_ADRES.postcode),
        eq(addresses.nummerslug, VOORBEELD_ADRES.nummerslug),
        eq(addresses.status, "actief"),
      ),
    )
    .limit(1);
  if (vastRows[0]) {
    const vast = await bouwVoorbeeldWoning(vastRows[0]);
    if (vast) return vast;
  }

  const kandidaten = await db
    .select()
    .from(addresses)
    .where(eq(addresses.status, "actief"))
    .orderBy(addresses.id)
    .limit(10);

  for (const adres of kandidaten) {
    const voorbeeld = await bouwVoorbeeldWoning(adres);
    if (voorbeeld) return voorbeeld;
  }
  return null;
}

/**
 * Woningen voor de horizontale rij: actieve adressen met een bestaande
 * valuation (nieuwste per adres), zonder gesupprimeerde adressen. Leest alleen;
 * schrijft niets.
 */
async function getWoningenRijOngecachet(limiet = 8): Promise<WoningKaartData[]> {
  // Nieuwste valuation per adres in SQL (DISTINCT ON), zodat dit niet stil
  // degradeert als de historie per adres groeit (review-bevinding G4-F4).
  const rijen = await db
    .selectDistinctOn([valuations.adresId], {
      adres: addresses,
      waarde: valuations.waarde,
      intervalLaag: valuations.intervalLaag,
      intervalHoog: valuations.intervalHoog,
      datum: valuations.datum,
    })
    .from(valuations)
    .innerJoin(addresses, eq(valuations.adresId, addresses.id))
    .where(eq(addresses.status, "actief"))
    .orderBy(valuations.adresId, desc(valuations.datum))
    .limit(Math.max(limiet * 3, 24));

  // Suppressie als 1 batchquery; daarna nieuwste-datum eerst tonen.
  const onderdrukt = await suppressedKeySet(rijen.map((rij) => rij.adres));
  rijen.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : a.adres.id - b.adres.id));

  const uit: WoningKaartData[] = [];
  for (const rij of rijen) {
    if (uit.length >= limiet) break;
    if (onderdrukt.has(`${rij.adres.postcode}|${rij.adres.nummerslug}`)) continue;
    uit.push({
      id: rij.adres.id,
      straat: rij.adres.straat,
      huisnummer: rij.adres.huisnummer,
      toevoeging: rij.adres.toevoeging,
      nummerslug: rij.adres.nummerslug,
      postcode: rij.adres.postcode,
      plaats: rij.adres.plaats,
      energielabel: rij.adres.energielabel,
      energielabelBron: rij.adres.energielabelBron,
      waarde: rij.waarde,
      intervalLaag: rij.intervalLaag,
      intervalHoog: rij.intervalHoog,
    });
  }
  return uit;
}

/** Echte tellingen voor de statistieken-band. */
async function getHomepageStatsOngecachet(): Promise<HomepageStats> {
  const adressenRij = await db.select({ n: count() }).from(addresses).where(eq(addresses.status, "actief"));
  const buurtenRij = await db.select({ n: count() }).from(neighborhoods);
  return {
    adressen: adressenRij[0]?.n ?? 0,
    buurten: buurtenRij[0]?.n ?? 0,
    tools: AANTAL_TOOLS,
    bronnen: OPEN_BRONNEN.length,
  };
}

/** Gemeenten voor de plaatsen-ticker en de footer, alfabetisch. */
async function getPlaatsenOngecachet(): Promise<PlaatsLink[]> {
  return db
    .select({ naam: municipalities.naam, slug: municipalities.slug })
    .from(municipalities)
    .orderBy(municipalities.naam);
}


/* ---------------------------------------------------------------------------
 * Caching: de homepage is force-dynamic maar deze leesdata hoeft niet per
 * request vers (review-bevinding G4-F2). 5 minuten cache met tag "homepage";
 * de opt-out-bevestiging revalidatet die tag zodat de verwijderbelofte ook
 * hier direct geldt. Buiten de Next-runtime (vitest) bestaat de incremental
 * cache niet; dan vallen we terug op de ongecachete functie zodat tests het
 * echte leespad blijven testen.
 * ------------------------------------------------------------------------- */

function metCache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  sleutel: string,
  revalidate: number,
): (...args: A) => Promise<R> {
  const cached = unstable_cache(fn, [sleutel], { revalidate, tags: ["homepage"] });
  return async (...args: A) => {
    try {
      return await cached(...args);
    } catch (fout) {
      if (fout instanceof Error && fout.message.includes("incrementalCache")) return fn(...args);
      throw fout;
    }
  };
}

export const getVoorbeeldWoning = metCache(getVoorbeeldWoningOngecachet, "homepage-voorbeeld", 300);
export const getWoningenRij = metCache(getWoningenRijOngecachet, "homepage-rij", 300);
export const getHomepageStats = metCache(getHomepageStatsOngecachet, "homepage-stats", 300);
export const getPlaatsen = metCache(getPlaatsenOngecachet, "homepage-plaatsen", 3600);
