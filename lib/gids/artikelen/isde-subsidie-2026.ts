import {
  berekenIsolatieSubsidie,
  ISDE_BRONNEN,
  ISDE_GLAS,
  ISDE_ISOLATIE,
  ISDE_PEILDATUM,
  ISDE_WARMTEPOMP_MINIMUM_EUR,
  ISDE_WARMTEPOMPEN,
  ISDE_ZONNEBOILERS,
  type IsolatieMaatregelKey,
} from "@/lib/normen/isde-2026";
import { formatDatumNl } from "@/lib/format";
import { berekenLeestijdMinuten, type GidsArtikel, type GidsSectie } from "@/lib/gids/model";
import { euroKort, euroTekst } from "@/lib/gids/tekst";

/**
 * Artikel: ISDE 2026 per maatregel. Alle bedragen komen uit
 * lib/normen/isde-2026.ts (RVO-pagina's en meldcodelijsten) en worden hier
 * geinterpoleerd; het normbedragen-blok wordt bewaakt in tests/gids.test.ts.
 * Apparaat-bedragen zijn INDICATIES en worden zo benoemd (UI-regel uit het
 * normbestand zelf).
 */

function iso(key: IsolatieMaatregelKey) {
  const m = ISDE_ISOLATIE.find((x) => x.key === key);
  if (!m) throw new Error(`isde-artikel: onbekende isolatiemaatregel ${key}`);
  return m;
}

function wp(categorie: string) {
  const w = ISDE_WARMTEPOMPEN.find((x) => x.categorie === categorie);
  if (!w) throw new Error(`isde-artikel: onbekende warmtepompcategorie ${categorie}`);
  return w;
}

const dak = iso("dakisolatie");
const luchtWater = wp("Lucht-Water");
const grondWater = wp("Grond-Water");
const waterWater = wp("Water-Water");
const boiler = wp("Warmtepompboiler");
const zonKlein = ISDE_ZONNEBOILERS[0];
const zonGroot = ISDE_ZONNEBOILERS[1];

// Gelabeld rekenvoorbeeld, berekend met dezelfde functie als de rekenhulp.
const VOORBEELD_DAK_M2 = 100;
const VOORBEELD_DAK_LOS = berekenIsolatieSubsidie("dakisolatie", VOORBEELD_DAK_M2, false);
const VOORBEELD_DAK_MET_TWEEDE = berekenIsolatieSubsidie("dakisolatie", VOORBEELD_DAK_M2, true);

const isolatieRij = (key: IsolatieMaatregelKey) => {
  const m = iso(key);
  return {
    label: m.label,
    waarde: `${euroKort(m.eurPerM2)} per m2 (${m.minM2} tot ${m.maxM2} m2), biobased bonus ${euroKort(m.biobasedBonusEurPerM2)} per m2`,
  };
};

const SECTIES: GidsSectie[] = [
  {
    kop: "Hoe de ISDE werkt",
    paragrafen: [
      `De ISDE is de landelijke subsidie voor woningeigenaren die hun huis verduurzamen. Je krijgt een vast bedrag per maatregel: voor isolatie een bedrag per vierkante meter, voor warmtepompen en zonneboilers een bedrag per apparaat. De regeling wordt uitgevoerd door RVO. Alle bedragen in dit artikel komen van de RVO-pagina's en de openbare meldcodelijsten, peildatum ${formatDatumNl(ISDE_PEILDATUM)}.`,
    ],
  },
  {
    kop: "Isolatie: een bedrag per vierkante meter",
    paragrafen: [
      "Voor isolatie geldt een basisbedrag per vierkante meter, met per maatregel een minimum- en maximumoppervlak. Gebruik je biobased isolatiemateriaal, dan komt er een bonus per vierkante meter bij. Dit zijn de bedragen bij een losse maatregel:",
    ],
    cijfers: [
      isolatieRij("dakisolatie"),
      isolatieRij("zoldervloerisolatie"),
      isolatieRij("gevelisolatie"),
      isolatieRij("spouwmuurisolatie"),
      isolatieRij("vloerisolatie"),
      isolatieRij("bodemisolatie"),
    ],
  },
  {
    kop: "Twee of meer maatregelen: het bedrag verdubbelt",
    paragrafen: [
      "Voer je binnen 24 maanden twee of meer maatregelen uit, dan verdubbelt het basisbedrag per vierkante meter voor isolatie. Dat geldt ook als je isolatie combineert met een warmtepomp, zonneboiler of een aansluiting op een warmtenet. De biobased bonus verdubbelt niet mee.",
      `Een gelabeld voorbeeld: voor ${VOORBEELD_DAK_M2} vierkante meter dakisolatie (${euroKort(dak.eurPerM2)} per m2) is de subsidie ${euroTekst(VOORBEELD_DAK_LOS)} als losse maatregel, en ${euroTekst(VOORBEELD_DAK_MET_TWEEDE)} zodra je binnen twee jaar een tweede maatregel uitvoert. Het hogere bedrag geldt alleen als de tweede maatregel binnen die termijn valt.`,
    ],
  },
  {
    kop: "Glas, panelen en deuren",
    paragrafen: [
      `Voor glas, isolerende panelen en deuren gelden aparte bedragen per vierkante meter. Voor alle glasmaatregelen samen geldt een minimum van ${ISDE_GLAS.minM2Totaal} en een maximum van ${ISDE_GLAS.maxM2Totaal} vierkante meter.`,
    ],
    cijfers: ISDE_GLAS.tarieven.map((t) => ({ label: t.label, waarde: `${euroKort(t.eurPerM2)} per m2` })),
  },
  {
    kop: "Warmtepompen en zonneboilers: indicaties per categorie",
    paragrafen: [
      "Voor een warmtepomp of zonneboiler hangt het precieze bedrag af van het apparaat dat je kiest: het staat per apparaat op de meldcodelijst van RVO. De bedragen hieronder zijn daarom indicaties, de mediaan van alle apparaten in die lijst, geen toezegging voor jouw apparaat.",
      `Voor een (hybride) warmtepomp geldt wel een harde ondergrens: je ontvangt altijd minimaal ${euroTekst(ISDE_WARMTEPOMP_MINIMUM_EUR)}. Let op: lucht-luchtwarmtepompen (airco's) vallen niet meer onder de ISDE.`,
    ],
    cijfers: [
      {
        label: luchtWater.label,
        waarde: `rond ${euroKort(luchtWater.mediaanEur)} (van ${euroKort(luchtWater.minEur)} tot ${euroKort(luchtWater.maxEur)}, ${luchtWater.nApparaten} apparaten)`,
      },
      { label: grondWater.label, waarde: `rond ${euroKort(grondWater.mediaanEur)}` },
      { label: waterWater.label, waarde: `rond ${euroKort(waterWater.mediaanEur)}` },
      { label: boiler.label, waarde: `rond ${euroKort(boiler.mediaanEur)}` },
      { label: zonKlein.label, waarde: `rond ${euroKort(zonKlein.mediaanEur)}` },
      { label: zonGroot.label, waarde: `rond ${euroKort(zonGroot.mediaanEur)}` },
    ],
  },
  {
    kop: "Zo gebruik je deze bedragen",
    paragrafen: [
      "Reken uit welke maatregelen bij jouw huis passen en wat ze samen aan subsidie opleveren; het basisbedrag verdubbelt bij twee of meer maatregelen binnen twee jaar. Kies je een warmtepomp of zonneboiler, controleer dan het exacte bedrag voor dat apparaat op de meldcodelijst.",
    ],
    faq: [
      {
        vraag: "Verdubbelt de biobased bonus ook bij twee of meer maatregelen?",
        antwoord: "Nee. Alleen het basisbedrag per vierkante meter verdubbelt; de bonus voor biobased materiaal blijft gelijk.",
      },
      {
        vraag: "Valt een lucht-luchtwarmtepomp onder de ISDE?",
        antwoord:
          "Nee, die valt niet meer onder de regeling. Lucht-water-, grond-water- en water-waterwarmtepompen en warmtepompboilers vallen er wel onder.",
      },
    ],
  },
];

export const ARTIKEL_ISDE: GidsArtikel = {
  slug: "isde-subsidie-2026",
  titel: "ISDE-subsidie in 2026 per maatregel",
  beschrijving:
    "Wat de ISDE-subsidie in 2026 per maatregel oplevert: isolatie per vierkante meter, de verdubbelaar bij twee of meer maatregelen, en indicaties voor warmtepompen en zonneboilers.",
  categorie: "verduurzamen",
  leestijdMinuten: berekenLeestijdMinuten(SECTIES),
  gepubliceerd: "2026-07-23",
  bijgewerkt: "2026-07-23",
  bronnen: [
    { naam: "RVO, ISDE isolatiemaatregelen", url: ISDE_BRONNEN.isolatie, peildatum: ISDE_PEILDATUM },
    { naam: "RVO, meldcodelijst warmtepompen", url: ISDE_BRONNEN.warmtepompen, peildatum: ISDE_PEILDATUM },
    { naam: "RVO, meldcodelijst zonneboilers", url: ISDE_BRONNEN.zonneboilers, peildatum: ISDE_PEILDATUM },
    { naam: "RVO, ISDE voor woningeigenaren", url: ISDE_BRONNEN.woningeigenaren, peildatum: ISDE_PEILDATUM },
  ],
  rekenhulp: {
    href: "/verduurzamen",
    label: "Start de verduurzamingscheck",
    zin: "De verduurzamingscheck rekent deze subsidiebedragen door voor jouw woning en laat zien wat maatregelen opleveren.",
  },
  secties: SECTIES,
  // Letterlijke waarden; tests/gids.test.ts vergelijkt ze met lib/normen.
  normbedragen: {
    dakisolatieEurPerM2: 16.25,
    dakisolatieMinM2: 20,
    dakisolatieMaxM2: 200,
    dakisolatieBiobasedBonus: 5,
    zoldervloerisolatieEurPerM2: 4,
    zoldervloerisolatieMinM2: 20,
    zoldervloerisolatieMaxM2: 200,
    zoldervloerisolatieBiobasedBonus: 1.5,
    gevelisolatieEurPerM2: 20.25,
    gevelisolatieMinM2: 10,
    gevelisolatieMaxM2: 170,
    gevelisolatieBiobasedBonus: 6,
    spouwmuurisolatieEurPerM2: 5.25,
    spouwmuurisolatieMinM2: 10,
    spouwmuurisolatieMaxM2: 170,
    spouwmuurisolatieBiobasedBonus: 1.5,
    vloerisolatieEurPerM2: 5.5,
    vloerisolatieMinM2: 20,
    vloerisolatieMaxM2: 130,
    vloerisolatieBiobasedBonus: 2,
    bodemisolatieEurPerM2: 3,
    bodemisolatieMinM2: 20,
    bodemisolatieMaxM2: 130,
    bodemisolatieBiobasedBonus: 1,
    glasMinM2Totaal: 3,
    glasMaxM2Totaal: 45,
    hrppGlasEurPerM2: 25,
    tripleNieuwKozijnEurPerM2: 111,
    paneelEurPerM2: 10,
    paneelNieuwKozijnEurPerM2: 45,
    deurEurPerM2: 25,
    deurNieuwKozijnEurPerM2: 111,
    warmtepompMinimumEur: 500,
    luchtWaterMediaanEur: 3250,
    luchtWaterMinEur: 1250,
    luchtWaterMaxEur: 16325,
    grondWaterMediaanEur: 4650,
    waterWaterMediaanEur: 4425,
    warmtepompboilerMediaanEur: 725,
    zonneboilerKleinMediaanEur: 1789,
    zonneboilerGrootMediaanEur: 1846,
    voorbeeldDak100M2Los: 1625,
    voorbeeldDak100M2MetTweedeMaatregel: 3250,
  },
};
