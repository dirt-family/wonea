import { and, avg, count, desc, eq, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  addresses,
  marketStats,
  municipalities,
  neighborhoods,
  sales,
  valuations,
  type Confidence,
  type Woningtype,
} from "@/db/schema";
import { suppressedAdresIdSet, suppressedKeySet } from "@/lib/suppression";
import { slugify } from "@/lib/format";

/**
 * Datalaag voor de woningmarkt-linkstructuur: /woningmarkt (overzicht van
 * plaatsen) en /woningmarkt/[plaats] (plaatspagina). Alle queries voor die
 * twee pagina's wonen hier, zodat de pages zelf alleen renderen.
 *
 * Suppressie (CONTRACTS.md regel 3): elk pad dat adresdata teruggeeft checkt
 * lib/suppression.ts. Seed-verkopen hebben nooit een adres_id (regel 4) en
 * kunnen dus niets lekken; kadaster-verkopen en woningen-met-waarde worden
 * hier per rij gecheckt.
 */

/** Kebab-case slug van een gemeentenaam, zelfde conventie als de seed (slugify). */
export function plaatsSlug(naam: string): string {
  return slugify(naam);
}

export type PlaatsOverzicht = {
  code: string;
  naam: string;
  slug: string;
  aantalWoningen: number;
  aantalBuurten: number;
  /** Gemiddelde van de buurt-WOZ-cijfers (CBS); null zonder CBS-cijfers. */
  gemWoz: number | null;
};

/** Alle gemeenten met tellingen, gesorteerd op naam. Voor /woningmarkt. */
export async function allePlaatsen(): Promise<PlaatsOverzicht[]> {
  const gemeenten = await db.select().from(municipalities).orderBy(municipalities.naam);

  const buurtAgg = await db
    .select({
      gemeenteCode: neighborhoods.gemeenteCode,
      aantalBuurten: count(),
      gemWoz: avg(neighborhoods.gemWoz),
    })
    .from(neighborhoods)
    .groupBy(neighborhoods.gemeenteCode);

  const adresAgg = await db
    .select({ gemeenteCode: neighborhoods.gemeenteCode, aantalWoningen: count() })
    .from(addresses)
    .innerJoin(neighborhoods, eq(addresses.buurtCode, neighborhoods.buurtCode))
    .where(eq(addresses.status, "actief"))
    .groupBy(neighborhoods.gemeenteCode);

  const perGemeenteBuurten = new Map(buurtAgg.map((rij) => [rij.gemeenteCode, rij]));
  const perGemeenteAdressen = new Map(adresAgg.map((rij) => [rij.gemeenteCode, rij.aantalWoningen]));

  return gemeenten.map((gemeente) => {
    const buurten = perGemeenteBuurten.get(gemeente.code);
    return {
      code: gemeente.code,
      naam: gemeente.naam,
      slug: gemeente.slug,
      aantalWoningen: perGemeenteAdressen.get(gemeente.code) ?? 0,
      aantalBuurten: buurten?.aantalBuurten ?? 0,
      gemWoz: buurten?.gemWoz != null ? Math.round(Number(buurten.gemWoz)) : null,
    };
  });
}

/** Alle plaats-slugs, voor generateStaticParams. */
export async function allePlaatsSlugs(): Promise<string[]> {
  const rijen = await db.select({ slug: municipalities.slug }).from(municipalities);
  return rijen.map((rij) => rij.slug);
}

/** Gemeente op slug (case-insensitief); null als onbekend. */
export async function vindPlaats(slug: string) {
  const rijen = await db
    .select()
    .from(municipalities)
    .where(eq(municipalities.slug, slug.toLowerCase()))
    .limit(1);
  return rijen[0] ?? null;
}

export type PlaatsKerncijfers = {
  aantalWoningen: number;
  aantalBuurten: number;
  /** Gemiddelde van de buurt-WOZ-cijfers (CBS); null zonder CBS-cijfers. */
  gemWoz: number | null;
  /** Som van de buurt-inwonertallen (CBS); null zonder CBS-cijfers. */
  inwoners: number | null;
};

/** Kerncijfers voor de StatTegel-rij op de plaatspagina. */
export async function plaatsKerncijfers(gemeenteCode: string): Promise<PlaatsKerncijfers> {
  const buurtRijen = await db
    .select({
      aantalBuurten: count(),
      gemWoz: avg(neighborhoods.gemWoz),
      inwoners: sum(neighborhoods.inwoners),
    })
    .from(neighborhoods)
    .where(eq(neighborhoods.gemeenteCode, gemeenteCode));

  const adresRijen = await db
    .select({ aantal: count() })
    .from(addresses)
    .innerJoin(neighborhoods, eq(addresses.buurtCode, neighborhoods.buurtCode))
    .where(and(eq(neighborhoods.gemeenteCode, gemeenteCode), eq(addresses.status, "actief")));

  const buurten = buurtRijen[0];
  return {
    aantalWoningen: adresRijen[0]?.aantal ?? 0,
    aantalBuurten: buurten?.aantalBuurten ?? 0,
    gemWoz: buurten?.gemWoz != null ? Math.round(Number(buurten.gemWoz)) : null,
    inwoners: buurten?.inwoners != null ? Number(buurten.inwoners) : null,
  };
}

export type BuurtRij = {
  buurtCode: string;
  naam: string;
  slug: string;
  gemWoz: number | null;
  ankerM2Prijs: number | null;
  inwoners: number | null;
};

/** Buurten van een gemeente, gesorteerd op naam. Voor het buurten-grid. */
export async function buurtenVanPlaats(gemeenteCode: string): Promise<BuurtRij[]> {
  return db
    .select({
      buurtCode: neighborhoods.buurtCode,
      naam: neighborhoods.naam,
      slug: neighborhoods.slug,
      gemWoz: neighborhoods.gemWoz,
      ankerM2Prijs: neighborhoods.ankerM2Prijs,
      inwoners: neighborhoods.inwoners,
    })
    .from(neighborhoods)
    .where(eq(neighborhoods.gemeenteCode, gemeenteCode))
    .orderBy(neighborhoods.naam);
}

export type VerkoopRij = {
  id: number;
  datum: string;
  prijs: number;
  oppervlakteM2: number;
  woningtype: Woningtype;
  straat: string | null;
  bron: "seed" | "kadaster";
  adresId: number | null;
  buurtNaam: string;
  buurtSlug: string;
};

/**
 * Recente verkopen in een gemeente, op buurt- en straatniveau (nooit met
 * huisnummer). Seed-verkopen hebben per definitie geen adres_id; rijen met
 * een adres_id (bron kadaster) vallen weg zodra het adres gesupprimeerd is.
 */
export async function recenteVerkopenVanPlaats(gemeenteCode: string, limiet = 12): Promise<VerkoopRij[]> {
  const ruw = await db
    .select({
      id: sales.id,
      datum: sales.datum,
      prijs: sales.prijs,
      oppervlakteM2: sales.oppervlakteM2,
      woningtype: sales.woningtype,
      straat: sales.straat,
      bron: sales.bron,
      adresId: sales.adresId,
      buurtNaam: neighborhoods.naam,
      buurtSlug: neighborhoods.slug,
    })
    .from(sales)
    .innerJoin(neighborhoods, eq(sales.buurtCode, neighborhoods.buurtCode))
    .where(eq(neighborhoods.gemeenteCode, gemeenteCode))
    .orderBy(desc(sales.datum), desc(sales.id))
    .limit(limiet * 3);

  const onderdrukteIds = await suppressedAdresIdSet(ruw.map((rij) => rij.adresId).filter((id): id is number => id != null));
  const gefilterd: VerkoopRij[] = [];
  for (const rij of ruw) {
    if (rij.adresId != null && onderdrukteIds.has(rij.adresId)) continue;
    gefilterd.push(rij);
    if (gefilterd.length >= limiet) break;
  }
  return gefilterd;
}

export type WoningMetWaarde = {
  adresId: number;
  straat: string;
  huisnummer: number;
  toevoeging: string | null;
  nummerslug: string;
  postcode: string;
  plaats: string;
  oppervlakteM2: number;
  woningtype: Woningtype;
  waarde: number;
  intervalLaag: number;
  intervalHoog: number;
  confidence: Confidence;
  datum: string;
};

/**
 * Adressen met hun recentste waardeschatting, voor de woningen-rij.
 * Alleen actieve, niet-gesupprimeerde adressen; 1 rij per adres.
 */
export async function woningenMetWaarde(gemeenteCode: string, limiet = 8): Promise<WoningMetWaarde[]> {
  const ruw = await db
    .select({
      adresId: addresses.id,
      straat: addresses.straat,
      huisnummer: addresses.huisnummer,
      toevoeging: addresses.toevoeging,
      nummerslug: addresses.nummerslug,
      postcode: addresses.postcode,
      plaats: addresses.plaats,
      oppervlakteM2: addresses.oppervlakteM2,
      woningtype: addresses.woningtype,
      waarde: valuations.waarde,
      intervalLaag: valuations.intervalLaag,
      intervalHoog: valuations.intervalHoog,
      confidence: valuations.confidence,
      datum: valuations.datum,
    })
    .from(valuations)
    .innerJoin(addresses, eq(valuations.adresId, addresses.id))
    .innerJoin(neighborhoods, eq(addresses.buurtCode, neighborhoods.buurtCode))
    .where(and(eq(neighborhoods.gemeenteCode, gemeenteCode), eq(addresses.status, "actief")))
    .orderBy(desc(valuations.datum), desc(valuations.id))
    .limit(limiet * 6);

  // Recentste valuation per adres (de query staat op datum aflopend).
  const perAdres = new Map<number, WoningMetWaarde>();
  for (const rij of ruw) {
    if (!perAdres.has(rij.adresId)) perAdres.set(rij.adresId, rij);
  }

  const onderdrukt = await suppressedKeySet([...perAdres.values()]);
  const resultaat: WoningMetWaarde[] = [];
  for (const woning of perAdres.values()) {
    if (onderdrukt.has(`${woning.postcode}|${woning.nummerslug}`)) continue;
    resultaat.push(woning);
    if (resultaat.length >= limiet) break;
  }
  return resultaat;
}

export type PlaatsMarktcijfers = {
  /** Recentste maand met marktcijfers, "2026-07". */
  maand: string;
  /** Som van de gemeten verkoopvolumes in die maand; null als nergens gemeten. */
  volumeTotaal: number | null;
  /** Aantal buurten met cijfers in die maand. */
  buurtenMetCijfers: number;
  /** True zolang er seed-cijfers tussen zitten (dan hoort er een voorbeelddata-label bij). */
  heeftSeed: boolean;
};

/**
 * Marktcijfers op plaatsniveau: alleen de som van gemeten volumes in de
 * recentste maand. Bewust geen "mediaan van medianen" of ander doorgerekend
 * gemiddelde: dat zou precisie suggereren die er niet is.
 */
export async function marktcijfersVanPlaats(gemeenteCode: string): Promise<PlaatsMarktcijfers | null> {
  const rijen = await db
    .select({ maand: marketStats.maand, volume: marketStats.volume, bron: marketStats.bron })
    .from(marketStats)
    .innerJoin(neighborhoods, eq(marketStats.buurtCode, neighborhoods.buurtCode))
    .where(eq(neighborhoods.gemeenteCode, gemeenteCode));
  if (rijen.length === 0) return null;

  const maand = rijen.map((rij) => rij.maand).sort().at(-1)!;
  const vanMaand = rijen.filter((rij) => rij.maand === maand);
  const volumes = vanMaand.map((rij) => rij.volume).filter((v): v is number => v != null);

  return {
    maand,
    volumeTotaal: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) : null,
    buurtenMetCijfers: vanMaand.length,
    heeftSeed: vanMaand.some((rij) => rij.bron === "seed"),
  };
}

export type VerkopenPerMaand = {
  /** "2026-07" */
  maand: string;
  /** Som van de gemeten buurt-volumes in die maand. */
  verkopen: number;
  heeftSeed: boolean;
};

/**
 * Verkoopvolume per maand voor een plaats: de som van de gemeten buurt-volumes
 * uit market_stats (statistisch veilig; we sommeren volumes en middelen geen
 * medianen). Laatste 12 maanden met data, oplopend gesorteerd voor de grafiek.
 */
export async function verkopenPerMaandVanPlaats(gemeenteCode: string): Promise<VerkopenPerMaand[]> {
  const rijen = await db
    .select({ maand: marketStats.maand, volume: marketStats.volume, bron: marketStats.bron })
    .from(marketStats)
    .innerJoin(neighborhoods, eq(marketStats.buurtCode, neighborhoods.buurtCode))
    .where(eq(neighborhoods.gemeenteCode, gemeenteCode));

  const perMaand = new Map<string, { verkopen: number; heeftSeed: boolean }>();
  for (const rij of rijen) {
    if (rij.volume == null) continue;
    const huidig = perMaand.get(rij.maand) ?? { verkopen: 0, heeftSeed: false };
    huidig.verkopen += rij.volume;
    huidig.heeftSeed ||= rij.bron === "seed";
    perMaand.set(rij.maand, huidig);
  }
  return [...perMaand.entries()]
    .map(([maand, w]) => ({ maand, ...w }))
    .sort((a, b) => a.maand.localeCompare(b.maand))
    .slice(-12);
}
