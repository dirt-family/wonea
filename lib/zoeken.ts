import { and, count, desc, eq, gte, ilike, inArray, isNotNull, notExists, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, municipalities, neighborhoods, optouts, valuations, wozValues, type Woningtype } from "@/db/schema";
import { isSuppressed, suppressedKeySet } from "@/lib/suppression";
import { getOrCreateValuation, type Adres } from "@/lib/valuation";
import { annuiteitMaandlast, TOETS_LOOPTIJD_MAANDEN } from "@/lib/hypotheek";
import { getActueleRentes, getRenteBucket, peilmaandLabel } from "@/lib/bronnen/rentes";
import { formatEuro, normalizePostcode } from "@/lib/util";

/**
 * Zoek- en vergelijklogica voor /zoeken en /vergelijken. Server-only (leest de
 * database). Twee harde regels gelden overal in dit bestand:
 * 1. suppressie: elk pad dat adressen teruggeeft checkt lib/suppression.ts;
 * 2. echte data: waardes komen uit valuations; bestaat er geen schatting, dan
 *    geven we null terug en toont de pagina dat eerlijk (nooit verzinnen).
 */

/* ------------------------------------------------------------------------- */
/* Filters: parsen van searchParams (pure functies, los testbaar)             */
/* ------------------------------------------------------------------------- */

export const WONINGTYPES = ["appartement", "tussenwoning", "hoekwoning", "twee-onder-een-kap", "vrijstaand"] as const;

export const ENERGIELABELS = ["A", "B", "C", "D", "E", "F", "G"] as const;

export type ZoekFilters = {
  /** Vrije zoekterm: straat, postcode of plaats. */
  q: string | null;
  woningtype: Woningtype | null;
  /** Exact energielabel A t/m G. */
  energielabel: string | null;
  /** Minimale woonoppervlakte in m2. */
  minOppervlak: number | null;
  /** Gemeente-slug uit de municipalities-tabel. */
  gemeente: string | null;
};

type RuweParams = Record<string, string | string[] | undefined>;

function eersteWaarde(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/**
 * Maakt van rauwe searchParams veilige, gevalideerde filters. Ongeldige
 * waarden worden stil genegeerd (het is een filterformulier, geen API), zodat
 * een gemanipuleerde URL nooit tot rare queries leidt.
 */
export function parseZoekFilters(params: RuweParams): ZoekFilters {
  const qRuw = eersteWaarde(params.q);
  const q = qRuw && qRuw.length >= 2 ? qRuw.slice(0, 80) : null;

  const typeRuw = eersteWaarde(params.woningtype);
  const woningtype = typeRuw && (WONINGTYPES as readonly string[]).includes(typeRuw) ? (typeRuw as Woningtype) : null;

  const labelRuw = eersteWaarde(params.energielabel)?.toUpperCase() ?? null;
  const energielabel = labelRuw && (ENERGIELABELS as readonly string[]).includes(labelRuw) ? labelRuw : null;

  const oppRuw = eersteWaarde(params.minOppervlak);
  const oppGetal = oppRuw && /^\d{1,4}$/.test(oppRuw) ? Number.parseInt(oppRuw, 10) : null;
  const minOppervlak = oppGetal && oppGetal > 0 && oppGetal <= 1000 ? oppGetal : null;

  const gemeenteRuw = eersteWaarde(params.gemeente)?.toLowerCase() ?? null;
  const gemeente = gemeenteRuw && /^[a-z0-9-]{1,80}$/.test(gemeenteRuw) ? gemeenteRuw : null;

  return { q, woningtype, energielabel, minOppervlak, gemeente };
}

export function heeftFilters(filters: ZoekFilters): boolean {
  return Boolean(filters.q || filters.woningtype || filters.energielabel || filters.minOppervlak || filters.gemeente);
}

/* ------------------------------------------------------------------------- */
/* Zoeken                                                                     */
/* ------------------------------------------------------------------------- */

export const MAX_RESULTATEN = 30;

export type ZoekResultaat = {
  id: number;
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
  /** Nieuwste schatting uit valuations; null als er nog geen bestaat. */
  waarde: number | null;
  intervalLaag: number | null;
  intervalHoog: number | null;
  /** Sleutel voor /vergelijken?w=, bv. "5611ab-12". */
  slug: string;
};

/** Vergelijk-sleutel voor een woning: postcode plus nummerslug, kleine letters. */
export function woningSlug(postcode: string, nummerslug: string): string {
  return `${postcode}-${nummerslug}`.toLowerCase();
}

/**
 * Escapet de LIKE-wildcards (%, _) en de backslash in gebruikersinvoer, zodat
 * een zoekterm nooit zelf een patroon kan zijn (stuurbare full scans).
 */
function veiligLike(s: string): string {
  return s.replace(/[\\%_]/g, (teken) => `\\${teken}`);
}

/**
 * Zelfde drie zoekvormen als /api/search: postcode-prefix, "straat nummer",
 * en substring op straat of plaats (ilike, dus hoofdletterongevoelig).
 */
function qConditie(q: string): SQL | undefined {
  const zonderSpaties = q.replace(/\s/g, "");
  const alsPostcode = normalizePostcode(q) ?? (/^[1-9][0-9]{3}/.test(zonderSpaties) ? zonderSpaties.toUpperCase() : null);
  if (alsPostcode) return ilike(addresses.postcode, `${alsPostcode}%`);
  const straatNummer = q.match(/^(.+?)\s+(\d+[a-z0-9-]*)$/i);
  if (straatNummer) {
    return and(ilike(addresses.straat, `%${veiligLike(straatNummer[1])}%`), ilike(addresses.nummerslug, `${veiligLike(straatNummer[2].toLowerCase())}%`));
  }
  return or(ilike(addresses.straat, `%${veiligLike(q)}%`), ilike(addresses.plaats, `%${veiligLike(q)}%`));
}

/**
 * Suppressie op queryniveau: sluit adressen met een bevestigde opt-out al in
 * SQL uit, zodat ook de teller klopt. Dit VERVANGT de per-adres-check via
 * lib/suppression.ts niet; die blijft hieronder de leidende poort per rij
 * (CONTRACTS: lib/suppression is de enige toegangslaag).
 */
function nietGesupprimeerdConditie(): SQL {
  return notExists(
    db
      .select({ id: optouts.id })
      .from(optouts)
      .where(and(eq(optouts.postcode, addresses.postcode), eq(optouts.nummerslug, addresses.nummerslug), isNotNull(optouts.bevestigdAt))),
  );
}

/**
 * Zoekt actieve, niet-gesupprimeerde adressen op de filters, met per adres de
 * nieuwste schatting (als die bestaat; we rekenen hier bewust niets uit, dat
 * zou tot 30 database-writes per zoekopdracht betekenen). `totaal` is het
 * aantal treffers voor de teller; `resultaten` is afgekapt op `limiet`.
 */
export async function zoekWoningen(
  filters: ZoekFilters,
  limiet: number = MAX_RESULTATEN,
): Promise<{ resultaten: ZoekResultaat[]; totaal: number }> {
  const condities: (SQL | undefined)[] = [eq(addresses.status, "actief"), nietGesupprimeerdConditie()];
  if (filters.q) condities.push(qConditie(filters.q));
  if (filters.woningtype) condities.push(eq(addresses.woningtype, filters.woningtype));
  if (filters.energielabel) condities.push(eq(addresses.energielabel, filters.energielabel));
  if (filters.minOppervlak) condities.push(gte(addresses.oppervlakteM2, filters.minOppervlak));
  if (filters.gemeente) condities.push(eq(municipalities.slug, filters.gemeente));
  const where = and(...condities);

  // Iets ruimer ophalen dan de limiet; de per-adres suppressiecheck hieronder
  // blijft de leidende poort en mag de lijst nooit onnodig kort maken.
  const ophaalLimiet = limiet * 2;
  const rijen = await db
    .select({ adres: addresses })
    .from(addresses)
    .innerJoin(neighborhoods, eq(addresses.buurtCode, neighborhoods.buurtCode))
    .innerJoin(municipalities, eq(neighborhoods.gemeenteCode, municipalities.code))
    .where(where)
    .orderBy(addresses.plaats, addresses.straat, addresses.huisnummer, addresses.nummerslug)
    .limit(ophaalLimiet);

  // Suppressie als batch (1 query) in plaats van 1 roundtrip per rij;
  // lib/suppression blijft de toegangslaag (suppressedKeySet woont daar).
  const onderdrukt = await suppressedKeySet(rijen.map((rij) => rij.adres));
  const toonbaar: Adres[] = rijen
    .map((rij) => rij.adres)
    .filter((adres) => !onderdrukt.has(`${adres.postcode}|${adres.nummerslug}`));

  // Teller: hebben we alle treffers al gezien, dan is het gefilterde aantal
  // exact; anders tellen we in de database met dezelfde condities (inclusief
  // de suppressie-conditie, zodat de teller niemand meetelt die weg wil zijn).
  let totaal = toonbaar.length;
  if (rijen.length === ophaalLimiet) {
    const telRijen = await db
      .select({ n: count() })
      .from(addresses)
      .innerJoin(neighborhoods, eq(addresses.buurtCode, neighborhoods.buurtCode))
      .innerJoin(municipalities, eq(neighborhoods.gemeenteCode, municipalities.code))
      .where(where);
    totaal = telRijen[0]?.n ?? toonbaar.length;
  }

  const geselecteerd = toonbaar.slice(0, limiet);

  // Nieuwste valuation per adres in 1 query (rijen staan op datum aflopend).
  const waardePerAdres = new Map<number, { waarde: number; intervalLaag: number; intervalHoog: number }>();
  const ids = geselecteerd.map((a) => a.id);
  if (ids.length > 0) {
    const vals = await db
      .select({
        adresId: valuations.adresId,
        waarde: valuations.waarde,
        intervalLaag: valuations.intervalLaag,
        intervalHoog: valuations.intervalHoog,
      })
      .from(valuations)
      .where(inArray(valuations.adresId, ids))
      .orderBy(desc(valuations.datum));
    for (const v of vals) {
      if (!waardePerAdres.has(v.adresId)) waardePerAdres.set(v.adresId, v);
    }
  }

  const resultaten: ZoekResultaat[] = geselecteerd.map((a) => {
    const val = waardePerAdres.get(a.id) ?? null;
    return {
      id: a.id,
      straat: a.straat,
      huisnummer: a.huisnummer,
      toevoeging: a.toevoeging,
      nummerslug: a.nummerslug,
      postcode: a.postcode,
      plaats: a.plaats,
      oppervlakteM2: a.oppervlakteM2,
      woningtype: a.woningtype,
      bouwjaar: a.bouwjaar,
      energielabel: a.energielabel,
      energielabelBron: a.energielabelBron,
      waarde: val?.waarde ?? null,
      intervalLaag: val?.intervalLaag ?? null,
      intervalHoog: val?.intervalHoog ?? null,
      slug: woningSlug(a.postcode, a.nummerslug),
    };
  });

  return { resultaten, totaal };
}

/** Gemeenten voor het filter-dropdown, alfabetisch. */
export async function getGemeenten(): Promise<{ naam: string; slug: string }[]> {
  return db.select({ naam: municipalities.naam, slug: municipalities.slug }).from(municipalities).orderBy(municipalities.naam);
}

/* ------------------------------------------------------------------------- */
/* Vergelijken                                                                */
/* ------------------------------------------------------------------------- */

export type VergelijkSleutel = { postcode: string; nummerslug: string };

/**
 * Parset ?w=slug1,slug2,slug3 naar adres-sleutels. Ongeldige delen worden stil
 * overgeslagen, dubbelen ontdubbeld, en meer dan 3 wordt afgekapt.
 */
export function parseVergelijkParam(w: string | string[] | undefined): VergelijkSleutel[] {
  const ruw = eersteWaarde(w) ?? "";
  const uit: VergelijkSleutel[] = [];
  for (const deel of ruw.split(",")) {
    const s = deel.trim().toLowerCase();
    const m = s.match(/^([0-9]{4}[a-z]{2})-([a-z0-9][a-z0-9-]{0,19})$/);
    if (!m) continue;
    const postcode = normalizePostcode(m[1]);
    if (!postcode) continue;
    const nummerslug = m[2];
    if (uit.some((u) => u.postcode === postcode && u.nummerslug === nummerslug)) continue;
    uit.push({ postcode, nummerslug });
    if (uit.length === 3) break;
  }
  return uit;
}

export type VergelijkWoning = {
  adres: Adres;
  /** "Dorpstraat 12" of "Dorpstraat 12 a". */
  naam: string;
  slug: string;
  valuation: { waarde: number; intervalLaag: number; intervalHoog: number } | null;
  woz: { waarde: number; peiljaar: number; bron: "eigenaar" | "seed" } | null;
  /** Geschatte waarde gedeeld door oppervlakte, hele euro's; null zonder schatting. */
  prijsPerM2: number | null;
  /** Indicatieve bruto maandlast over de geschatte waarde; null zonder schatting. */
  maandlast: number | null;
};

/**
 * Haalt de woningen voor /vergelijken op. Ongeldige sleutels, onbekende
 * adressen en gesupprimeerde of opted-out adressen worden stil overgeslagen.
 * De schatting loopt via hetzelfde pad als de woningpagina
 * (getOrCreateValuation: hooguit 1 nieuwe rij per adres per dag).
 */
export async function getVergelijkWoningen(w: string | string[] | undefined): Promise<VergelijkWoning[]> {
  const sleutels = parseVergelijkParam(w);
  const uit: VergelijkWoning[] = [];

  for (const sleutel of sleutels) {
    const adres = (
      await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.postcode, sleutel.postcode), eq(addresses.nummerslug, sleutel.nummerslug)))
        .limit(1)
    )[0];
    if (!adres) continue;
    if (adres.status === "opted_out" || (await isSuppressed(adres.postcode, adres.nummerslug))) continue;

    const { valuation } = await getOrCreateValuation(adres);
    const wozRij = (
      await db.select().from(wozValues).where(eq(wozValues.adresId, adres.id)).orderBy(desc(wozValues.peiljaar)).limit(1)
    )[0];

    uit.push({
      adres,
      naam: `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`,
      slug: woningSlug(adres.postcode, adres.nummerslug),
      valuation: valuation
        ? { waarde: valuation.waarde, intervalLaag: valuation.intervalLaag, intervalHoog: valuation.intervalHoog }
        : null,
      woz: wozRij ? { waarde: wozRij.waarde, peiljaar: wozRij.peiljaar, bron: wozRij.bron } : null,
      prijsPerM2: valuation ? Math.round(valuation.waarde / adres.oppervlakteM2) : null,
      maandlast: valuation ? indicatieveMaandlast(valuation.waarde) : null,
    });
  }

  return uit;
}

/* ------------------------------------------------------------------------- */
/* Indicatieve maandlast (DNB-gemiddelde, 30 jaar annuitair)                  */
/* ------------------------------------------------------------------------- */

export type IndicatieRente = {
  /** Gemiddelde rente in procenten uit de DNB-snapshot. */
  pct: number;
  /** "mei 2026", voor de verplichte peildatum-vermelding. */
  peilmaand: string;
  bron: string;
};

/**
 * De rente waarmee de indicatieve maandlast rekent: het DNB-totaalgemiddelde
 * over alle rentevaste perioden, of anders het gemiddelde voor langer dan
 * 10 jaar rentevast. Ontbreken beide in de snapshot, dan null: liever geen
 * maandlast dan een maandlast op een verzonnen rente.
 */
export function dnbIndicatieRente(): IndicatieRente | null {
  const rentes = getActueleRentes();
  const pct = rentes.totaalRentePct ?? getRenteBucket("vanaf_10")?.rentePct ?? null;
  if (pct === null) return null;
  return { pct, peilmaand: peilmaandLabel(rentes.peildatum), bron: rentes.bron };
}

/**
 * Indicatieve bruto maandlast: annuiteitenhypotheek over het hele bedrag,
 * 30 jaar (lib/hypotheek), tegen de DNB-indicatierente. Hele euro's.
 */
export function indicatieveMaandlast(bedrag: number): number | null {
  const rente = dnbIndicatieRente();
  if (!rente) return null;
  return Math.round(annuiteitMaandlast(bedrag, rente.pct, TOETS_LOOPTIJD_MAANDEN));
}

/* ------------------------------------------------------------------------- */
/* "Wat valt op?": feitelijke verschillen, puur uit data                      */
/* ------------------------------------------------------------------------- */

export type WatValtOpItem = {
  naam: string;
  oppervlakteM2: number;
  bouwjaar: number;
  energielabel: string | null;
  prijsPerM2: number | null;
};

function labelBasis(label: string): string {
  return label.replace(/\+/g, "").toUpperCase().charAt(0);
}

/**
 * Benoemt feitelijke verschillen tussen de woningen in gewone taal: grootste
 * en kleinste, zuinigste energielabel, hoogste en laagste prijs per vierkante
 * meter, nieuwste en oudste. Geen oordeel, geen winnaar; alleen wat de cijfers
 * laten zien. Een vergelijking wordt alleen genoemd als elk item de benodigde
 * data heeft en er echt verschil is.
 */
export function watValtOp(items: WatValtOpItem[]): string[] {
  if (items.length < 2) return [];
  const zinnen: string[] = [];

  const grootste = items.reduce((a, b) => (b.oppervlakteM2 > a.oppervlakteM2 ? b : a));
  const kleinste = items.reduce((a, b) => (b.oppervlakteM2 < a.oppervlakteM2 ? b : a));
  if (grootste.oppervlakteM2 > kleinste.oppervlakteM2) {
    zinnen.push(
      `${grootste.naam} is met ${grootste.oppervlakteM2} m2 de grootste, ${kleinste.naam} met ${kleinste.oppervlakteM2} m2 de kleinste.`,
    );
  }

  const labels = items.map((i) => (i.energielabel ? labelBasis(i.energielabel) : null));
  if (labels.every((l): l is string => l !== null) && new Set(labels).size > 1) {
    const beste = items.reduce((a, b) => (labelBasis(b.energielabel!) < labelBasis(a.energielabel!) ? b : a));
    zinnen.push(`${beste.naam} heeft het zuinigste energielabel (${beste.energielabel!.toUpperCase()}).`);
  }

  if (items.every((i) => i.prijsPerM2 !== null)) {
    const duurste = items.reduce((a, b) => (b.prijsPerM2! > a.prijsPerM2! ? b : a));
    const goedkoopste = items.reduce((a, b) => (b.prijsPerM2! < a.prijsPerM2! ? b : a));
    if (duurste.prijsPerM2! > goedkoopste.prijsPerM2!) {
      zinnen.push(
        `${duurste.naam} heeft de hoogste prijs per vierkante meter (${formatEuro(duurste.prijsPerM2!)}), ${goedkoopste.naam} de laagste (${formatEuro(goedkoopste.prijsPerM2!)}).`,
      );
    }
  }

  const nieuwste = items.reduce((a, b) => (b.bouwjaar > a.bouwjaar ? b : a));
  const oudste = items.reduce((a, b) => (b.bouwjaar < a.bouwjaar ? b : a));
  if (nieuwste.bouwjaar > oudste.bouwjaar) {
    zinnen.push(`${nieuwste.naam} is het nieuwst (bouwjaar ${nieuwste.bouwjaar}), ${oudste.naam} het oudst (bouwjaar ${oudste.bouwjaar}).`);
  }

  return zinnen;
}
