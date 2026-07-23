import { and, count, desc, eq, gte, ne } from "drizzle-orm";
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

/**
 * Datalaag voor de buurtpagina (app/buurt/[gemeente]/[buurt]). Alle queries
 * wonen hier zodat de page zelf alleen rendert, zelfde patroon als
 * lib/woningmarkt.ts.
 *
 * Suppressie (CONTRACTS.md regel 3): elk pad dat adresdata teruggeeft checkt
 * lib/suppression.ts. Seed-verkopen hebben nooit een adres_id (regel 4);
 * kadaster-verkopen en woningen-met-waarde worden hier per rij gecheckt.
 */

/** Gemeente + buurt op hun slugs (case-insensitief); null als een van beide onbekend is. */
export async function vindBuurtMetGemeente(gemeenteSlug: string, buurtSlug: string) {
  const gemeente = (
    await db.select().from(municipalities).where(eq(municipalities.slug, gemeenteSlug.toLowerCase())).limit(1)
  )[0];
  if (!gemeente) return null;
  const buurt = (
    await db
      .select()
      .from(neighborhoods)
      .where(and(eq(neighborhoods.gemeenteCode, gemeente.code), eq(neighborhoods.slug, buurtSlug.toLowerCase())))
      .limit(1)
  )[0];
  if (!buurt) return null;
  return { gemeente, buurt };
}

/** ISO-datum van 12 maanden geleden, voor het venster "recente verkopen". */
function cutoff12Maanden(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export type BuurtKerncijfers = {
  /** Actieve adressen in ons bestand in deze buurt. */
  aantalWoningen: number;
  /** Verkopen in de laatste 12 maanden, na suppressie-filtering. */
  aantalRecenteVerkopen: number;
};

/** Tellingen voor de stats-rij. Gesupprimeerde kadaster-verkopen tellen niet mee. */
export async function buurtKerncijfers(buurtCode: string): Promise<BuurtKerncijfers> {
  const adresRijen = await db
    .select({ aantal: count() })
    .from(addresses)
    .where(and(eq(addresses.buurtCode, buurtCode), eq(addresses.status, "actief")));

  const verkoopRijen = await db
    .select({ adresId: sales.adresId })
    .from(sales)
    .where(and(eq(sales.buurtCode, buurtCode), gte(sales.datum, cutoff12Maanden())));

  const onderdrukteVerkoopIds = await suppressedAdresIdSet(
    verkoopRijen.map((rij) => rij.adresId).filter((id): id is number => id != null),
  );
  let aantalRecenteVerkopen = 0;
  for (const rij of verkoopRijen) {
    if (rij.adresId != null && onderdrukteVerkoopIds.has(rij.adresId)) continue;
    aantalRecenteVerkopen += 1;
  }

  return { aantalWoningen: adresRijen[0]?.aantal ?? 0, aantalRecenteVerkopen };
}

export type BuurtVerkoop = {
  id: number;
  datum: string;
  prijs: number;
  oppervlakteM2: number;
  woningtype: Woningtype;
  straat: string | null;
  bron: "seed" | "kadaster";
  adresId: number | null;
};

/**
 * Recente verkopen in de buurt, nieuwste eerst, op straat- en buurtniveau
 * (nooit met huisnummer). Seed-verkopen hebben per definitie geen adres_id;
 * rijen met een adres_id (bron kadaster) vallen weg zodra het adres
 * gesupprimeerd is.
 */
export async function recenteVerkopenInBuurt(buurtCode: string, limiet = 12): Promise<BuurtVerkoop[]> {
  const ruw = await db
    .select()
    .from(sales)
    .where(eq(sales.buurtCode, buurtCode))
    .orderBy(desc(sales.datum), desc(sales.id))
    .limit(limiet * 3);

  const onderdrukteIds = await suppressedAdresIdSet(ruw.map((rij) => rij.adresId).filter((id): id is number => id != null));
  const gefilterd: BuurtVerkoop[] = [];
  for (const rij of ruw) {
    if (rij.adresId != null && onderdrukteIds.has(rij.adresId)) continue;
    gefilterd.push(rij);
    if (gefilterd.length >= limiet) break;
  }
  return gefilterd;
}

export type BuurtWoning = {
  adresId: number;
  straat: string;
  huisnummer: number;
  toevoeging: string | null;
  nummerslug: string;
  postcode: string;
  plaats: string;
  oppervlakteM2: number;
  woningtype: Woningtype;
  bouwjaar: number;
  energielabel: string | null;
  energielabelBron: "echt" | "indicatie";
  waarde: number;
  intervalLaag: number;
  intervalHoog: number;
  confidence: Confidence;
  datum: string;
};

/**
 * Adressen in de buurt met hun recentste waardeschatting, voor de
 * woningen-kaartenrij. Alleen actieve, niet-gesupprimeerde adressen;
 * 1 rij per adres.
 */
export async function woningenInBuurt(buurtCode: string, limiet = 8): Promise<BuurtWoning[]> {
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
      bouwjaar: addresses.bouwjaar,
      energielabel: addresses.energielabel,
      energielabelBron: addresses.energielabelBron,
      waarde: valuations.waarde,
      intervalLaag: valuations.intervalLaag,
      intervalHoog: valuations.intervalHoog,
      confidence: valuations.confidence,
      datum: valuations.datum,
    })
    .from(valuations)
    .innerJoin(addresses, eq(valuations.adresId, addresses.id))
    .where(and(eq(addresses.buurtCode, buurtCode), eq(addresses.status, "actief")))
    .orderBy(desc(valuations.datum), desc(valuations.id))
    .limit(limiet * 6);

  // Recentste valuation per adres (de query staat op datum aflopend).
  const perAdres = new Map<number, BuurtWoning>();
  for (const rij of ruw) {
    if (!perAdres.has(rij.adresId)) perAdres.set(rij.adresId, rij);
  }

  const onderdrukt = await suppressedKeySet([...perAdres.values()]);
  const resultaat: BuurtWoning[] = [];
  for (const woning of perAdres.values()) {
    if (onderdrukt.has(`${woning.postcode}|${woning.nummerslug}`)) continue;
    resultaat.push(woning);
    if (resultaat.length >= limiet) break;
  }
  return resultaat;
}

export type VergelijkbareBuurt = {
  buurtCode: string;
  naam: string;
  slug: string;
  ankerM2Prijs: number;
  gemWoz: number | null;
  /** Verschil in m2-prijs ten opzichte van de eigen buurt, in procenten (afgerond op 1 decimaal). */
  verschilPct: number;
};

/**
 * Vergelijkbare buurten: zelfde gemeente, dichtstbijzijnde m2-prijs. Zonder
 * eigen m2-prijs is "dichtstbij" niet te bepalen; dan geven we bewust een
 * lege lijst terug (de sectie wordt weggelaten, niet gegokt).
 */
export async function vergelijkbareBuurten(buurtCode: string, limiet = 3): Promise<VergelijkbareBuurt[]> {
  const eigen = (
    await db.select().from(neighborhoods).where(eq(neighborhoods.buurtCode, buurtCode)).limit(1)
  )[0];
  if (!eigen || eigen.ankerM2Prijs == null) return [];
  const eigenPrijs = eigen.ankerM2Prijs;

  const anderen = await db
    .select({
      buurtCode: neighborhoods.buurtCode,
      naam: neighborhoods.naam,
      slug: neighborhoods.slug,
      ankerM2Prijs: neighborhoods.ankerM2Prijs,
      gemWoz: neighborhoods.gemWoz,
    })
    .from(neighborhoods)
    .where(and(eq(neighborhoods.gemeenteCode, eigen.gemeenteCode), ne(neighborhoods.buurtCode, buurtCode)));

  return anderen
    .filter((b): b is typeof b & { ankerM2Prijs: number } => b.ankerM2Prijs != null)
    .sort((a, b) => Math.abs(a.ankerM2Prijs - eigenPrijs) - Math.abs(b.ankerM2Prijs - eigenPrijs))
    .slice(0, limiet)
    .map((b) => ({
      ...b,
      verschilPct: Math.round(((b.ankerM2Prijs - eigenPrijs) / eigenPrijs) * 1000) / 10,
    }));
}

// ---------------------------------------------------------------------------
// Karakteristiek-zin: alleen wat echt uit onze data volgt
// ---------------------------------------------------------------------------

/** Minimaal aantal actieve adressen voordat we iets over de buurt durven zeggen. */
export const MIN_ADRESSEN_VOOR_KARAKTERISTIEK = 5;
/** Minimaal aandeel van 1 woningtype om "vooral X" te mogen zeggen. */
export const DOMINANT_AANDEEL = 0.6;

const TYPE_MEERVOUD: Record<Woningtype, string> = {
  appartement: "appartementen",
  tussenwoning: "tussenwoningen",
  hoekwoning: "hoekwoningen",
  "twee-onder-een-kap": "twee-onder-een-kapwoningen",
  vrijstaand: "vrijstaande woningen",
};

/**
 * Een zin karakteristiek, PUUR afgeleid uit onze eigen adresrijen (dominant
 * woningtype, mediaan bouwjaar, gemiddelde oppervlakte). Geen dominant type of
 * te weinig adressen: null, en de pagina laat de zin weg. Nooit een verzonnen
 * "rustige jaren-30 buurt" (docs/PROTOTYPE-OOGST.md).
 */
export async function buurtKarakteristiek(buurtCode: string): Promise<string | null> {
  const rijen = await db
    .select({ woningtype: addresses.woningtype, bouwjaar: addresses.bouwjaar, oppervlakteM2: addresses.oppervlakteM2 })
    .from(addresses)
    .where(and(eq(addresses.buurtCode, buurtCode), eq(addresses.status, "actief")));
  if (rijen.length < MIN_ADRESSEN_VOOR_KARAKTERISTIEK) return null;

  const perType = new Map<Woningtype, number>();
  for (const rij of rijen) perType.set(rij.woningtype, (perType.get(rij.woningtype) ?? 0) + 1);
  const [dominantType, dominantAantal] = [...perType.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominantAantal / rijen.length < DOMINANT_AANDEEL) return null;

  const bouwjaren = rijen.map((rij) => rij.bouwjaar).sort((a, b) => a - b);
  const mediaanBouwjaar = bouwjaren[Math.floor(bouwjaren.length / 2)];
  const decennium = Math.round(mediaanBouwjaar / 10) * 10;
  const gemOppervlakte = Math.round(rijen.reduce((som, rij) => som + rij.oppervlakteM2, 0) / rijen.length);

  return `In ons bestand staan hier vooral ${TYPE_MEERVOUD[dominantType]} van rond ${decennium}, gemiddeld ${gemOppervlakte} m2.`;
}

// ---------------------------------------------------------------------------
// Prijsontwikkeling: alleen een echte reeks
// ---------------------------------------------------------------------------

export type PrijsPunt = { maand: string; mediaan: number };

export type BuurtPrijsontwikkeling = {
  punten: PrijsPunt[];
  heeftSeed: boolean;
};

/**
 * Mediaanprijs per maand uit market_stats, laatste 12 maanden met een cijfer.
 * Minder dan 2 punten is geen reeks: dan null, en de pagina laat de grafiek
 * weg in plaats van een verzonnen lijn te tekenen.
 */
export async function buurtPrijsontwikkeling(buurtCode: string): Promise<BuurtPrijsontwikkeling | null> {
  const rijen = (
    await db.select().from(marketStats).where(eq(marketStats.buurtCode, buurtCode)).orderBy(marketStats.maand)
  ).slice(-12);
  const punten = rijen
    .filter((rij): rij is typeof rij & { mediaanPrijs: number } => rij.mediaanPrijs != null)
    .map((rij) => ({ maand: rij.maand, mediaan: rij.mediaanPrijs }));
  if (punten.length < 2) return null;
  return { punten, heeftSeed: rijen.some((rij) => rij.bron === "seed") };
}
