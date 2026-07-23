import type { Woningtype } from "@/db/schema";
import type { Verticaal } from "@/app/verduurzamen/verticalen";
import { formatEuro } from "@/lib/format";
import {
  berekenIsolatieSubsidie,
  ISDE_BRONNEN,
  ISDE_GLAS,
  ISDE_ISOLATIE,
  ISDE_PEILDATUM,
  ISDE_VERDUBBELING_UITLEG,
  ISDE_WARMTEPOMP_MINIMUM_EUR,
  ISDE_WARMTEPOMPEN,
  ISDE_ZONNEBOILERS,
  type IsolatieMaatregelKey,
} from "@/lib/normen/isde-2026";
import {
  BESPARING_DAK,
  BESPARING_DISCLAIMER,
  BESPARING_GLAS,
  BESPARING_HYBRIDE_WARMTEPOMP,
  BESPARING_PEILDATUM,
  BESPARING_SPOUWMUUR,
  BESPARING_VLOER,
  BESPARING_VOLLEDIGE_WARMTEPOMP,
  BESPARING_ZONNEBOILER,
  BESPARING_ZONNEPANELEN,
  type BesparingKental,
} from "@/lib/normen/besparing";
import { VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING } from "@/lib/normen/leennormen-2026";

/**
 * Verduurzamingsadvies per maatregel, opgebouwd uit de geverifieerde open
 * databronnen (docs/DATABRONNEN.md):
 * - ISDE 2026 (RVO): lib/normen/isde-2026.ts, peildatum ISDE_PEILDATUM
 * - Besparingskentallen (Milieu Centraal): lib/normen/besparing.ts
 * - Extra leenruimte (art. 4 lid 4 Tijdelijke regeling hypothecair krediet):
 *   lib/normen/leennormen-2026.ts
 *
 * Pure module: geen database, geen Next. Alle bedragen zijn INDICATIES en
 * worden in de UI zo gelabeld; elk cijfer heeft hier zijn bron en peildatum
 * bij zich, zodat de pagina die kan tonen (CONTRACTS: elk getoond cijfer
 * heeft een bron + peildatum in de UI of methode-uitleg).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Bereik = { laag: number; hoog: number };

export type MaatregelKey =
  | "dakisolatie"
  | "spouwmuurisolatie"
  | "vloerisolatie"
  | "glasisolatie"
  | "warmtepomp"
  | "zonneboiler"
  | "zonnepanelen";

export type Bron = { label: string; url: string };

export type MaatregelAdvies = {
  key: MaatregelKey;
  titel: string;
  /** Naar welke bestaande funnel deze maatregel leidt (/verduurzamen/[verticaal]). */
  verticaal: Verticaal;
  /** Indicatieve kosten (ruwe ordegrootte); null = geen betrouwbare ordegrootte beschikbaar. */
  kosten: { bereik: Bereik; toelichting: string } | null;
  /** ISDE-bedrag 2026 (indicatie); null = geen ISDE voor deze maatregel. */
  subsidie: { bedrag: number; toelichting: string } | null;
  /** Reden waarom subsidie null is (alleen gezet als subsidie null is). */
  subsidieGeenReden?: string;
  /** Indicatieve jaarbesparing in euro; null = geen kental beschikbaar. */
  besparing: { bereik: Bereik; toelichting: string } | null;
  /** Reden waarom besparing null is (alleen gezet als besparing null is). */
  besparingGeenReden?: string;
  /** Terugverdientijd in hele jaren (afgerond); null als kosten of besparing ontbreekt. */
  terugverdientijd: Bereik | null;
  /** Alinea's voor de methode-uitleg (UitklapUitleg), met bronnen en peildata. */
  uitleg: string[];
  bronnen: Bron[];
};

// ---------------------------------------------------------------------------
// Terugverdientijd
// ---------------------------------------------------------------------------

/**
 * Simpele terugverdientijd: (kosten minus subsidie) gedeeld door de
 * jaarbesparing, afgerond op hele jaren. Bewust simpel en zo gelabeld:
 * geen rente, geen energieprijsscenario's. De uiteinden worden paarsgewijs
 * gerekend (lage kosten bij lage besparing, hoge bij hoge; zo horen bij de
 * warmtepomp de hybride-kosten bij de hybride-besparing) en daarna op
 * min/max gesorteerd. 0 betekent: minder dan 1 jaar.
 */
export function berekenTerugverdientijd(kosten: Bereik, subsidieEur: number, besparing: Bereik): Bereik | null {
  if (besparing.laag <= 0 || besparing.hoog <= 0) return null;
  const a = Math.round(Math.max(0, kosten.laag - subsidieEur) / besparing.laag);
  const b = Math.round(Math.max(0, kosten.hoog - subsidieEur) / besparing.hoog);
  return { laag: Math.min(a, b), hoog: Math.max(a, b) };
}

/** Nederlandse weergave van een terugverdientijd-bereik, altijd als indicatie bedoeld. */
export function formatTerugverdientijd(t: Bereik): string {
  if (t.laag === t.hoog) return t.laag < 1 ? "minder dan 1 jaar" : `ongeveer ${t.laag} jaar`;
  if (t.laag < 1) return `minder dan 1 tot ${t.hoog} jaar`;
  return `ongeveer ${t.laag} tot ${t.hoog} jaar`;
}

/** Weergave van een eurobereik: "€ 1.000 tot € 5.000", of één bedrag als laag = hoog. */
export function formatEuroBereik(b: Bereik): string {
  if (b.laag === b.hoog) return formatEuro(b.laag);
  return `${formatEuro(b.laag)} tot ${formatEuro(b.hoog)}`;
}

// ---------------------------------------------------------------------------
// Extra leenruimte bij het huidige label (art. 4 lid 4)
// ---------------------------------------------------------------------------

export const LEENNORMEN_BRON: Bron = {
  label: "Wijzigingsregeling hypothecair krediet 2026 (Staatscourant 2025, 36471), artikel 4, vierde lid",
  url: "https://zoek.officielebekendmakingen.nl/stcrt-2025-36471.html",
};

/** Datum waarop de leennormen-bedragen tegen de bron zijn geverifieerd (lib/normen/leennormen-2026.ts). */
export const LEENNORMEN_PEILDATUM = "2026-07-23";

export type LeenruimteAdvies = {
  /** Maximaal extra bedrag dat buiten beschouwing kan blijven, hele euro's. */
  bedrag: number;
  /** Labelgroep uit de regeling waar dit label in valt, bv. "E, F of G". */
  labelGroep: string;
};

/**
 * Artikel 4, vierde lid: het maximale extra kredietbedrag dat een aanbieder
 * buiten beschouwing kan laten voor energiebesparende voorzieningen, bij het
 * huidige energielabel. Geeft null bij een onbekend of niet-herkenbaar label:
 * liever geen bedrag dan een verzonnen bedrag.
 */
export function extraLeenruimteBijLabel(label: string | null | undefined): LeenruimteAdvies | null {
  if (!label) return null;
  const m = /^([A-G])(\+*)$/.exec(label.trim().toUpperCase());
  if (!m) return null;
  const letter = m[1] as string;
  const plussen = (m[2] as string).length;
  if (plussen > 0 && letter !== "A") return null; // B+ e.d. bestaat niet
  if (letter === "A" && plussen >= 3) return { bedrag: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.A3PlusEnBeter, labelGroep: "A+++ of beter" };
  if (letter === "A" && plussen >= 1) return { bedrag: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.APlus_APlusPlus, labelGroep: "A+ of A++" };
  if (letter === "A" || letter === "B") return { bedrag: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.AB, labelGroep: "A of B" };
  if (letter === "C" || letter === "D") return { bedrag: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.CD, labelGroep: "C of D" };
  return { bedrag: VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.EFG, labelGroep: "E, F of G" };
}

// ---------------------------------------------------------------------------
// Kosten-ordegroottes (dezelfde als de funnelteksten in verticalen.ts gebruiken)
// ---------------------------------------------------------------------------

/** Isolatie: "vaak 1.000 tot 5.000 euro per maatregel" (bestaande ordegrootte). */
const ISOLATIE_KOSTEN: Bereik = { laag: 1000, hoog: 5000 };

/** Warmtepomp: "grofweg 4.000 (hybride) tot 15.000 euro (volledig elektrisch)" (bestaande ordegrootte). */
const WARMTEPOMP_KOSTEN: Bereik = { laag: 4000, hoog: 15000 };

const KOSTEN_ORDEGROOTTE_TOELICHTING = "ruwe ordegrootte inclusief installatie, geen offerte";

// ---------------------------------------------------------------------------
// Opbouw per maatregel
// ---------------------------------------------------------------------------

/** Nederlandse weergave van een woningtype in lopende tekst. */
function woningtypeTekst(w: Woningtype): string {
  switch (w) {
    case "appartement":
      return "appartement";
    case "tussenwoning":
      return "gemiddelde tussenwoning";
    case "hoekwoning":
      return "gemiddelde hoekwoning";
    case "twee-onder-een-kap":
      return "gemiddelde twee-onder-een-kapwoning";
    case "vrijstaand":
      return "gemiddelde vrijstaande woning";
  }
}

/** Getal met Nederlandse decimaalkomma, bv. 16.25 -> "16,25". */
function komma(n: number): string {
  return String(n).replace(".", ",");
}

const GEEN_KENTAL_APPARTEMENT =
  "Milieu Centraal geeft voor appartementen geen besparingskental; liever geen cijfer dan een verzonnen cijfer.";

const TERUGVERDIEN_UITLEG =
  "Terugverdientijd: (kosten minus subsidie) gedeeld door de jaarbesparing, afgerond op hele jaren. Een indicatie, bewust simpel: zonder rente en zonder energieprijsscenario's. De bandbreedte is breed omdat de kosten een ruwe ordegrootte zijn.";

function isolatieAdvies(
  isdeKey: IsolatieMaatregelKey,
  titel: string,
  kental: BesparingKental,
  woningtype: Woningtype,
): MaatregelAdvies {
  const isde = ISDE_ISOLATIE.find((m) => m.key === isdeKey);
  if (!isde) throw new Error(`isolatieAdvies: onbekende ISDE-maatregel ${isdeKey}`);

  const voorbeeldM2 = isde.minM2;
  const subsidieBedrag = berekenIsolatieSubsidie(isdeKey, voorbeeldM2, false);

  const perType = woningtype === "appartement" ? null : (kental.perWoningtype?.[woningtype] ?? null);
  const besparingEur = perType?.eurPerJaar ?? null;

  const besparing =
    besparingEur === null
      ? null
      : {
          bereik: { laag: besparingEur, hoog: besparingEur },
          toelichting: `kental Milieu Centraal, ${woningtypeTekst(woningtype)}`,
        };

  return {
    key: isdeKey as MaatregelKey,
    titel,
    verticaal: "isolatie",
    kosten: { bereik: ISOLATIE_KOSTEN, toelichting: KOSTEN_ORDEGROOTTE_TOELICHTING },
    subsidie: {
      bedrag: subsidieBedrag,
      toelichting: `rekenvoorbeeld bij het ISDE-minimum van ${voorbeeldM2} m2 (${komma(isde.eurPerM2)} euro per m2)`,
    },
    besparing,
    ...(besparing === null ? { besparingGeenReden: GEEN_KENTAL_APPARTEMENT } : {}),
    terugverdientijd:
      besparing === null ? null : berekenTerugverdientijd(ISOLATIE_KOSTEN, subsidieBedrag, besparing.bereik),
    uitleg: [
      `Kosten: ruwe ordegrootte van ${formatEuro(ISOLATIE_KOSTEN.laag)} tot ${formatEuro(ISOLATIE_KOSTEN.hoog)} per maatregel, dezelfde ordegrootte als elders op Wonea. Geen offerte: de echte prijs hangt af van je huis en de uitvoerder.`,
      `ISDE-subsidie 2026: ${komma(isde.eurPerM2)} euro per m2 (minimaal ${isde.minM2}, maximaal ${isde.maxM2} m2). Het bedrag hierboven is een rekenvoorbeeld bij het minimum van ${voorbeeldM2} m2; een groter oppervlak geeft meer subsidie. ${ISDE_VERDUBBELING_UITLEG} Bron: RVO, peildatum ${ISDE_PEILDATUM}.`,
      besparing === null
        ? GEEN_KENTAL_APPARTEMENT
        : `Besparing: kental van Milieu Centraal voor een ${woningtypeTekst(woningtype)} (basisgeval: ${kental.basisgeval}), bronpagina laatst gewijzigd ${kental.bronGewijzigd}, opgehaald ${BESPARING_PEILDATUM}. ${BESPARING_DISCLAIMER}`,
      TERUGVERDIEN_UITLEG,
    ],
    bronnen: [
      { label: "RVO: ISDE isolatiemaatregelen", url: ISDE_BRONNEN.isolatie },
      { label: `Milieu Centraal: ${kental.label.toLowerCase()}`, url: kental.bronUrl },
    ],
  };
}

function glasAdvies(woningtype: Woningtype): MaatregelAdvies {
  const tarief = ISDE_GLAS.tarieven[0]; // hr++-glas in bestaande kozijnen
  const voorbeeldM2 = ISDE_GLAS.minM2Totaal;
  const subsidieBedrag = Math.round(voorbeeldM2 * tarief.eurPerM2);
  const kental = BESPARING_GLAS;

  const perType = woningtype === "appartement" ? null : (kental.perWoningtype?.[woningtype] ?? null);
  const besparingEur = perType?.eurPerJaar ?? null;
  const besparing =
    besparingEur === null
      ? null
      : {
          bereik: { laag: besparingEur, hoog: besparingEur },
          toelichting: `kental Milieu Centraal, ${woningtypeTekst(woningtype)}, enkelglas naar hr++`,
        };

  return {
    key: "glasisolatie",
    titel: "Glasisolatie (hr++)",
    verticaal: "isolatie",
    kosten: { bereik: ISOLATIE_KOSTEN, toelichting: KOSTEN_ORDEGROOTTE_TOELICHTING },
    subsidie: {
      bedrag: subsidieBedrag,
      toelichting: `rekenvoorbeeld bij het ISDE-minimum van ${voorbeeldM2} m2 (${komma(tarief.eurPerM2)} euro per m2, hr++ in bestaande kozijnen)`,
    },
    besparing,
    ...(besparing === null ? { besparingGeenReden: GEEN_KENTAL_APPARTEMENT } : {}),
    terugverdientijd:
      besparing === null ? null : berekenTerugverdientijd(ISOLATIE_KOSTEN, subsidieBedrag, besparing.bereik),
    uitleg: [
      `Kosten: ruwe ordegrootte van ${formatEuro(ISOLATIE_KOSTEN.laag)} tot ${formatEuro(ISOLATIE_KOSTEN.hoog)}, dezelfde ordegrootte als elders op Wonea. Geen offerte: de echte prijs hangt vooral af van het aantal m2 glas.`,
      `ISDE-subsidie 2026: ${komma(tarief.eurPerM2)} euro per m2 voor hr++-glas, tripleglas of vacuümglas in bestaande kozijnen; voor tripleglas of vacuümglas in nieuwe kozijnen geldt ${komma(ISDE_GLAS.tarieven[1].eurPerM2)} euro per m2. Voor alle glasmaatregelen samen minimaal ${ISDE_GLAS.minM2Totaal} en maximaal ${ISDE_GLAS.maxM2Totaal} m2; het bedrag hierboven is een rekenvoorbeeld bij het minimum van ${voorbeeldM2} m2. ${ISDE_VERDUBBELING_UITLEG} Bron: RVO, peildatum ${ISDE_PEILDATUM}.`,
      besparing === null
        ? GEEN_KENTAL_APPARTEMENT
        : `Besparing: kental van Milieu Centraal voor een ${woningtypeTekst(woningtype)} (basisgeval: ${kental.basisgeval}), bronpagina laatst gewijzigd ${kental.bronGewijzigd}, opgehaald ${BESPARING_PEILDATUM}. Vervang je dubbelglas in plaats van enkelglas, dan is de besparing kleiner. ${BESPARING_DISCLAIMER}`,
      TERUGVERDIEN_UITLEG,
    ],
    bronnen: [
      { label: "RVO: ISDE isolatiemaatregelen (glas)", url: ISDE_BRONNEN.isolatie },
      { label: "Milieu Centraal: glasisolatie", url: kental.bronUrl },
    ],
  };
}

function warmtepompAdvies(): MaatregelAdvies {
  const indicatie = ISDE_WARMTEPOMPEN.find((w) => w.categorie === "Lucht-Water");
  if (!indicatie) throw new Error("warmtepompAdvies: lucht-water-indicatie ontbreekt in ISDE_WARMTEPOMPEN");
  const besparingBereik: Bereik = {
    laag: BESPARING_HYBRIDE_WARMTEPOMP.eurPerJaar,
    hoog: BESPARING_VOLLEDIGE_WARMTEPOMP.eurPerJaar,
  };

  return {
    key: "warmtepomp",
    titel: "Warmtepomp",
    verticaal: "warmtepomp",
    kosten: {
      bereik: WARMTEPOMP_KOSTEN,
      toelichting: "ruwe ordegrootte: hybride (laag) tot volledig elektrisch (hoog), inclusief installatie",
    },
    subsidie: {
      bedrag: indicatie.mediaanEur,
      toelichting: `mediaan van ${indicatie.nApparaten} lucht-waterwarmtepompen (ook hybride) op de RVO-meldcodelijst; het echte bedrag hangt af van het apparaat`,
    },
    besparing: {
      bereik: besparingBereik,
      toelichting: "kental Milieu Centraal: hybride (laag) tot volledig elektrisch (hoog), gemiddelde woning",
    },
    terugverdientijd: berekenTerugverdientijd(WARMTEPOMP_KOSTEN, indicatie.mediaanEur, besparingBereik),
    uitleg: [
      `Kosten: ruwe ordegrootte van ${formatEuro(WARMTEPOMP_KOSTEN.laag)} (hybride) tot ${formatEuro(WARMTEPOMP_KOSTEN.hoog)} (volledig elektrisch) inclusief installatie, dezelfde ordegrootte als elders op Wonea. Geen offerte.`,
      `ISDE-subsidie 2026: het exacte bedrag staat per apparaat op de openbare RVO-meldcodelijst. Als indicatie tonen we de mediaan van alle ${indicatie.nApparaten} lucht-waterwarmtepompen (hybride valt in deze categorie): ${formatEuro(indicatie.mediaanEur)}, met een spreiding van ${formatEuro(indicatie.minEur)} tot ${formatEuro(indicatie.maxEur)}. RVO garandeert minimaal ${formatEuro(ISDE_WARMTEPOMP_MINIMUM_EUR)} voor een (hybride) warmtepomp. Bron: RVO-meldcodelijst, peildatum ${ISDE_PEILDATUM}.`,
      `Besparing: kentallen van Milieu Centraal voor een gemiddelde woning met hr-ketel: hybride warmtepomp ongeveer ${formatEuro(BESPARING_HYBRIDE_WARMTEPOMP.eurPerJaar)} per jaar (bronpagina ${BESPARING_HYBRIDE_WARMTEPOMP.bronGewijzigd}), volledig elektrisch ongeveer ${formatEuro(BESPARING_VOLLEDIGE_WARMTEPOMP.eurPerJaar)} per jaar inclusief het vervallen vastrecht van de gasaansluiting (bronpagina ${BESPARING_VOLLEDIGE_WARMTEPOMP.bronGewijzigd}); opgehaald ${BESPARING_PEILDATUM}. ${BESPARING_DISCLAIMER}`,
      `${TERUGVERDIEN_UITLEG} De lage kant hoort bij een hybride warmtepomp, de hoge kant bij volledig elektrisch. Let op: een warmtepomp werkt pas comfortabel in een redelijk geïsoleerd huis.`,
    ],
    bronnen: [
      { label: "RVO: meldcodelijst warmtepompen", url: ISDE_BRONNEN.warmtepompen },
      { label: "Milieu Centraal: hybride warmtepomp", url: BESPARING_HYBRIDE_WARMTEPOMP.bronUrl },
      { label: "Milieu Centraal: volledig elektrische warmtepomp", url: BESPARING_VOLLEDIGE_WARMTEPOMP.bronUrl },
    ],
  };
}

function zonneboilerAdvies(): MaatregelAdvies {
  const indicatie = ISDE_ZONNEBOILERS.find((z) => z.categorie === "Tot en met 5m2");
  if (!indicatie) throw new Error("zonneboilerAdvies: categorie tot en met 5 m2 ontbreekt in ISDE_ZONNEBOILERS");
  const kental = BESPARING_ZONNEBOILER;

  return {
    key: "zonneboiler",
    titel: "Zonneboiler",
    verticaal: "warmtepomp",
    kosten: null,
    subsidie: {
      bedrag: indicatie.mediaanEur,
      toelichting: `mediaan van ${indicatie.nApparaten} zonneboilers met collector tot en met 5 m2 op de RVO-meldcodelijst`,
    },
    besparing: {
      bereik: { laag: kental.eurPerJaar, hoog: kental.eurPerJaar },
      toelichting: "kental Milieu Centraal, huishouden van 3 personen",
    },
    terugverdientijd: null,
    uitleg: [
      "Kosten: voor zonneboilers hebben onze bronnen geen betrouwbare kosten-ordegrootte. We tonen daarom eerlijk geen kosten en geen terugverdientijd; een installateur kan dit wel concreet maken.",
      `ISDE-subsidie 2026: het exacte bedrag staat per apparaat op de openbare RVO-meldcodelijst en hangt af van collectoroppervlak en voorraadvat. Als indicatie tonen we de mediaan van de ${indicatie.nApparaten} zonneboilers met collector tot en met 5 m2: ${formatEuro(indicatie.mediaanEur)}, met een spreiding van ${formatEuro(indicatie.minEur)} tot ${formatEuro(indicatie.maxEur)}. Bron: RVO-meldcodelijst, peildatum ${ISDE_PEILDATUM}.`,
      `Besparing: kental van Milieu Centraal: ongeveer ${formatEuro(kental.eurPerJaar)} per jaar voor een huishouden van 3 personen; bij 5 personen ongeveer ${formatEuro(310)} per jaar. Bronpagina laatst gewijzigd ${kental.bronGewijzigd}, opgehaald ${BESPARING_PEILDATUM}. ${BESPARING_DISCLAIMER}`,
    ],
    bronnen: [
      { label: "RVO: meldcodelijst zonneboilers", url: ISDE_BRONNEN.zonneboilers },
      { label: "Milieu Centraal: zonneboiler", url: kental.bronUrl },
    ],
  };
}

function zonnepanelenAdvies(): MaatregelAdvies {
  const zp = BESPARING_ZONNEPANELEN;
  const kosten: Bereik = { laag: zp.aanschafEur, hoog: zp.aanschafEur };
  const besparingBereik: Bereik = { laag: zp.eurPerJaarVanaf2027, hoog: zp.eurPerJaar2026 };

  return {
    key: "zonnepanelen",
    titel: "Zonnepanelen",
    verticaal: "zonnepanelen",
    kosten: {
      bereik: kosten,
      toelichting: `aanschaf van 8 panelen (circa ${zp.opgewekteStroomKwhPerJaar} kWh per jaar), Milieu Centraal`,
    },
    subsidie: null,
    subsidieGeenReden: "voor zonnepanelen bestaat geen ISDE-subsidie",
    besparing: {
      bereik: besparingBereik,
      toelichting: `${formatEuro(zp.eurPerJaar2026)} in 2026; salderen stopt per 2027, daarna ongeveer ${formatEuro(zp.eurPerJaarVanaf2027)} per jaar`,
    },
    terugverdientijd: berekenTerugverdientijd(kosten, 0, besparingBereik),
    uitleg: [
      `Kosten: circa ${formatEuro(zp.aanschafEur)} voor 8 panelen op een gemiddeld dak (circa ${zp.opgewekteStroomKwhPerJaar} kWh opwek per jaar). Bron: Milieu Centraal, bronpagina laatst gewijzigd ${zp.bronGewijzigd}, opgehaald ${BESPARING_PEILDATUM}.`,
      "ISDE-subsidie: voor zonnepanelen bestaat geen ISDE-subsidie; de regeling dekt isolatie, (hybride) warmtepompen, zonneboilers en warmtenet-aansluitingen.",
      `Besparing: ongeveer ${formatEuro(zp.eurPerJaar2026)} per jaar in 2026. De salderingsregeling stopt per 2027; daarna daalt de besparing naar ongeveer ${formatEuro(zp.eurPerJaarVanaf2027)} per jaar. We tonen bewust beide bedragen, nooit alleen het hoge. ${BESPARING_DISCLAIMER}`,
      `Terugverdientijd: ${formatEuro(zp.aanschafEur)} gedeeld door de jaarbesparing, afgerond op hele jaren: ongeveer 6 jaar bij het 2026-tarief tot ongeveer 19 jaar zonder saldering. De werkelijkheid ligt daartussen, afhankelijk van je eigen verbruik achter de meter. Indicatie.`,
    ],
    bronnen: [{ label: "Milieu Centraal: kosten en opbrengst zonnepanelen", url: zp.bronUrl }],
  };
}

/**
 * Alle zeven maatregel-adviezen voor een woningtype, in vaste volgorde:
 * eerst isolatie (dak, spouw, vloer, glas), dan warmtepomp en zonneboiler,
 * dan zonnepanelen.
 */
export function maakMaatregelAdviezen(woningtype: Woningtype): MaatregelAdvies[] {
  return [
    isolatieAdvies("dakisolatie", "Dakisolatie", BESPARING_DAK, woningtype),
    isolatieAdvies("spouwmuurisolatie", "Spouwmuurisolatie", BESPARING_SPOUWMUUR, woningtype),
    isolatieAdvies("vloerisolatie", "Vloerisolatie", BESPARING_VLOER, woningtype),
    glasAdvies(woningtype),
    warmtepompAdvies(),
    zonneboilerAdvies(),
    zonnepanelenAdvies(),
  ];
}

// ---------------------------------------------------------------------------
// Groepen voor de pagina: elke groep eindigt in een bestaande verticaal-funnel
// ---------------------------------------------------------------------------

export type AdviesGroep = {
  titel: string;
  intro: string;
  verticaal: Verticaal;
  keys: MaatregelKey[];
};

export const ADVIES_GROEPEN: readonly AdviesGroep[] = [
  {
    titel: "Isolatie",
    intro:
      "Meestal de logische eerste stap: direct minder warmteverlies, meer comfort en een lagere rekening. Het ISDE-bedrag per m2 verdubbelt als je twee of meer maatregelen combineert.",
    verticaal: "isolatie",
    keys: ["dakisolatie", "spouwmuurisolatie", "vloerisolatie", "glasisolatie"],
  },
  {
    titel: "Warmtepomp en zonneboiler",
    intro:
      "Duurzaam verwarmen en warm water. Een warmtepomp werkt pas comfortabel in een redelijk geïsoleerd huis; begin dus bij isolatie als dat nog niet op orde is.",
    verticaal: "warmtepomp",
    keys: ["warmtepomp", "zonneboiler"],
  },
  {
    titel: "Zonnepanelen",
    intro:
      "Zelf stroom opwekken. Let op: de salderingsregeling stopt per 2027, dus reken jezelf niet rijk met alleen het huidige tarief.",
    verticaal: "zonnepanelen",
    keys: ["zonnepanelen"],
  },
] as const;
