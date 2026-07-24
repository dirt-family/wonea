/**
 * Voorbeeldadressen van Wonea: gedeelde engine + config-lijst.
 *
 * KEUZE (2026-07-24): een gedeelde aanpak i.p.v. een tweede kopie van
 * scripts/adres-drunen.ts. De hele flow (gemeente/buurt-upsert, suppressie,
 * adres-upsert, buurt-ankers, scoped seed-regeneratie, valuation-check) is
 * per adres identiek; alleen de geverifieerde brondata verschilt. Die flow
 * staat hier dus 1x (runVoorbeeldAdres), en elk voorbeeldadres is een
 * config-object in de lijst hieronder. De losse entrypoints
 * scripts/adres-drunen.ts en scripts/adres-wassenaar.ts zijn dunne wrappers,
 * zodat het eerder gedocumenteerde commando (en de verwijzing in
 * lib/homepage-data.ts) blijft werken.
 *
 * Draaien:  npx tsx --env-file=.env scripts/adres-drunen.ts
 *           npx tsx --env-file=.env scripts/adres-wassenaar.ts
 * Prod:     DATABASE_URL=<PROD_DATABASE_URL> npx tsx scripts/adres-<naam>.ts
 *
 * Idempotent: gemeente/buurt/adres upserten op natuurlijke sleutels; de
 * synthetische verkopen en market_stats van de eigen buurt worden per run
 * verwijderd en deterministisch opnieuw gegenereerd (zelfde patroon als
 * scripts/seed.ts, maar begrensd tot de buurt van het voorbeeldadres).
 * Suppressie wint altijd: staat het adres op de suppressielijst, dan wordt
 * het niet (opnieuw) toegevoegd of bijgewerkt.
 *
 * LET OP: scripts/seed.ts verwijdert ALLE verkopen met bron=seed, dus ook de
 * verkopen van deze buurten. Draai deze scripts na een her-seed opnieuw.
 *
 * VOORBEELD_ADRES (homepage-hero, lib/homepage-data.ts) blijft Jamaïcaring 9;
 * de overige voorbeeldadressen bestaan als woningpagina en draaien mee in
 * zoeken en buurt-rijen.
 */
import { and, eq } from "drizzle-orm";
import { db, sql as pool } from "../lib/db";
import { addresses, marketStats, sales, type Woningtype } from "../db/schema";
import { mulberry32 } from "../db/seed/generator";
import { nummerslug } from "../lib/format";
import { herberekenBuurtAnkers, upsertBuurt, upsertGemeente } from "../lib/ingest/upsert";
import { isSuppressed } from "../lib/suppression";
import { heeftGebiedsWhitelist } from "../lib/seo/gating";
import { getOrCreateValuation } from "../lib/valuation";

// --- Config-vorm ------------------------------------------------------------

export type VoorbeeldAdresConfig = {
  /** Korte naam voor logging ("drunen", "wassenaar"). */
  key: string;
  gemeente: { code: string; naam: string };
  buurt: { buurtCode: string; naam: string; gemWoz: number; inwoners: number };
  adres: {
    bagId: string;
    straat: string;
    huisnummer: number;
    toevoeging: string | null;
    postcode: string;
    plaats: string;
    lat: number;
    lon: number;
    bouwjaar: number;
    oppervlakteM2: number;
    woningtype: Woningtype;
    energielabel: string;
    energielabelBron: "echt" | "indicatie";
  };
  /**
   * Echte straatnamen binnen de buurt (PDOK Locatieserver, adressen gefilterd
   * op buurtcode). Alleen gebruikt voor synthetische verkopen op straatniveau;
   * die krijgen nooit een huisnummer of adres_id.
   */
  straten: string[];
  /**
   * Woningtype-mix voor de synthetische verkopen: gekozen verdeling passend
   * bij het karakter van de buurt. Dit is seed-data (gelabeld als voorbeeld),
   * geen CBS-cijfer; zelfde vorm als de typeMix per buurt in
   * db/seed/generator.ts. Kansen sommeren tot 1.
   */
  typeMix: Array<{ type: Woningtype; kans: number }>;
  /** mulberry32-seed, conventie: numeriek deel van de buurtcode. */
  seed: number;
  /**
   * Aanname gemiddelde woninggrootte (m2) waarmee de CBS-gemWoz naar een ruwe
   * m2-prijs vertaald wordt (ankerM2 = gemWoz / dit getal). Default 110,
   * identiek aan db/seed/generator.ts; zet 'm lager voor buurten met vooral
   * kleine woningen zodat de synthetische m2-prijs bij de buurt past.
   */
  ankerOppervlakteM2?: number;
  /**
   * Basisoppervlakte (m2) per woningtype voor de synthetische verkopen; de
   * generator varieert dit x0,75-x1,45. Default = dezelfde waarden als
   * db/seed/generator.ts en het oorspronkelijke Drunen-script. Overschrijf
   * per buurt zodat de verkopen (en dus de AVM-comparables) qua grootte bij
   * de echte woningvoorraad passen. Seed-data, geen CBS-cijfer.
   */
  basisOpp?: Partial<Record<Woningtype, number>>;
};

/** Default-basisoppervlaktes, identiek aan het oorspronkelijke Drunen-script. */
const BASIS_OPP_DEFAULT: Record<Woningtype, number> = {
  appartement: 55,
  vrijstaand: 160,
  "twee-onder-een-kap": 135,
  hoekwoning: 105,
  tussenwoning: 105,
};

// --- Voorbeeld 1: Jamaïcaring 9, 5152ME Drunen (gemeente Heusden) -----------
//
// Dit is Mitch' eigen woonadres; op zijn eigen verzoek is dit HET vaste
// voorbeeldadres van Wonea (zie VOORBEELD_ADRES in lib/homepage-data.ts).
//
// BRON PER VELD — alle waarden live opgehaald en geverifieerd op 2026-07-23:
//
// BAG (PDOK BAG WFS 2.0, keyless; service.pdok.nl/lv/bag/wfs/v2_0, filter op
// identificatie = 0797010000008022; zelfde bron als scripts/ingest-bag.ts):
//   - straat "Jamaïcaring", huisnummer 9, geen huisletter/toevoeging
//   - postcode 5152ME, woonplaats Drunen
//   - oppervlakte 104 m2, bouwjaar 1991
//   - gebruiksdoel "woonfunctie", status "Verblijfsobject in gebruik" (check)
//   - punt (WGS84): lat 51.68229244919575, lon 5.127866902702288
//   - pand 0797100000015600 telt in de BAG 1 verblijfsobject
//
// EP-Online (RVO, public.ep-online.nl/api/v5/PandEnergielabel/Adres met
// EPONLINE_API_KEY; zelfde bron als lib/bronnen/energielabel.ts):
//   - energielabel "A++", GEREGISTREERD label (registratie 2026-04-03,
//     geldig tot 2036-03-30, Gebouwklasse "Woningbouw") -> bron "echt"
//   - BAGVerblijfsobjectID in de registratie = 0797010000008022 (match)
//   - Gebouwtype "Rijwoning tussen" -> woningtype "tussenwoning". De
//     BAG-heuristiek (lib/ingest/bag.ts: 1 vbo in pand, 104 m2 < 120) geeft
//     onafhankelijk hetzelfde type.
//
// CBS Kerncijfers wijken en buurten 2025 (StatLine 86165NED, keyless; zelfde
// bron en dataset als scripts/ingest-cbs.ts):
//   - buurt BU07970104 "Venne-West", wijk "Wijk 01 Drunen"
//   - gemeente GM0797 "Heusden"
//   - AantalInwoners_5 = 5445
//   - GemiddeldeWOZWaardeVanWoningen_39 = 431 (in duizenden) -> 431.000 euro
//
// PDOK Locatieserver (open data): koppeling adres -> buurtcode BU07970104,
// en de straatnamenlijst van de buurt (filter buurtcode:BU07970104).
//
// Afgeleiden volgens bestaande conventies:
//   - nummerslug "9" via nummerslug() (lib/format.ts)
//   - ankerM2Prijs = gemWoz / gem. oppervlakte van de eigen adresrijen in de
//     buurt, via herberekenBuurtAnkers (lib/ingest/upsert.ts, zelfde als
//     seed en BAG-ingest)
//   - verkopen: SYNTHETISCH (bron "seed", NOOIT een adres_id), zelfde
//     generator-stijl en spreiding als db/seed/generator.ts, geankerd op de
//     CBS-gemWoz van deze buurt; gelabeld als voorbeelddata in de UI

export const DRUNEN: VoorbeeldAdresConfig = {
  key: "drunen",
  gemeente: { code: "GM0797", naam: "Heusden" }, // CBS 86165NED
  buurt: {
    buurtCode: "BU07970104", // CBS + PDOK Locatieserver
    naam: "Venne-West", // CBS
    gemWoz: 431_000, // CBS (431 x 1000, conform wozNaarEuro in lib/ingest/cbs.ts)
    inwoners: 5445, // CBS
  },
  adres: {
    bagId: "0797010000008022", // BAG
    straat: "Jamaïcaring", // BAG
    huisnummer: 9, // BAG
    toevoeging: null, // BAG (geen huisletter/toevoeging)
    postcode: "5152ME", // BAG
    plaats: "Drunen", // BAG
    lat: 51.68229244919575, // BAG (WGS84)
    lon: 5.127866902702288, // BAG (WGS84)
    bouwjaar: 1991, // BAG (EP-Online bevestigt)
    oppervlakteM2: 104, // BAG
    woningtype: "tussenwoning", // EP-Online Gebouwtype "Rijwoning tussen"
    energielabel: "A++", // EP-Online, geregistreerd 2026-04-03
    energielabelBron: "echt", // EP-Online = geregistreerd label
  },
  straten: [
    "Jamaïcaring",
    "Braziliëlaan",
    "Boliviaring",
    "Canadalaan",
    "Europalaan",
    "Finlandplantsoen",
    "Londenring",
    "Turkijelaan",
    "Nijlring",
  ],
  // Jaren-70/90-uitbreidingswijk met vooral rijwoningen.
  typeMix: [
    { type: "tussenwoning", kans: 0.52 },
    { type: "hoekwoning", kans: 0.18 },
    { type: "twee-onder-een-kap", kans: 0.14 },
    { type: "vrijstaand", kans: 0.08 },
    { type: "appartement", kans: 0.08 },
  ],
  seed: 7970104,
};

// --- Voorbeeld 2: Wittelaan 12, 2245VP Wassenaar ----------------------------
//
// Tweede voorbeeldadres (verzoek Mitch, 2026-07-23): bestaat als woningpagina
// (/woning/2245VP/12) en draait mee in zoeken en buurt-rijen; de homepage-hero
// blijft Jamaïcaring 9.
//
// BRON PER VELD — alle waarden live opgehaald en geverifieerd op 2026-07-24:
//
// BAG (PDOK BAG WFS 2.0, keyless; service.pdok.nl/lv/bag/wfs/v2_0, filter op
// identificatie = 0629010000001903; zelfde bron als scripts/ingest-bag.ts):
//   - straat "Wittelaan", huisnummer 12, geen huisletter/toevoeging
//   - postcode 2245VP, woonplaats Wassenaar
//   - oppervlakte 56 m2, bouwjaar 1914
//   - gebruiksdoel "woonfunctie", status "Verblijfsobject in gebruik" (check)
//   - punt (WGS84): lat 52.11050252796112, lon 4.368609650773267
//   - pand 0629100000001557 telt in de BAG 1 verblijfsobject
//
// EP-Online (RVO, public.ep-online.nl/api/v5/PandEnergielabel/Adres met
// EPONLINE_API_KEY; zelfde bron als lib/bronnen/energielabel.ts):
//   - energielabel "G", GEREGISTREERD label (registratie 2020-04-04, geldig
//     tot 2030-04-04, Gebouwklasse "Woningbouw") -> bron "echt"
//   - BAGVerblijfsobjectID in de registratie = 0629010000001903 (match)
//   - Gebouwtype "Twee-onder-een-kap / rijwoning hoek", Gebouwsubtype
//     "Rijwoning" -> woningtype "hoekwoning". De BAG-heuristiek (1 vbo,
//     56 m2 < 120) zou "tussenwoning" zeggen, maar kan "hoekwoning" per
//     definitie nooit toekennen (zie lib/ingest/bag.ts); EP-Online is hier
//     specifieker en wint — zelfde voorrangsregel als bij Drunen.
//   - EP-Online noemt in de registratie bouwjaar 1930; de BAG (1914) is de
//     authentieke bron voor bouwjaar en wint.
//
// CBS Kerncijfers wijken en buurten 2025 (StatLine 86165NED, keyless; zelfde
// bron en dataset als scripts/ingest-cbs.ts):
//   - buurt BU06290006 "Kerkehout", wijk "Wijk 00 Zuidwestelijk deel der
//     gemeente"
//   - gemeente GM0629 "Wassenaar"
//   - AantalInwoners_5 = 1085
//   - GemiddeldeWOZWaardeVanWoningen_39 = 439 (in duizenden) -> 439.000 euro
//
// PDOK Locatieserver (open data): koppeling adres -> buurtcode BU06290006,
// en de straatnamenlijst van de buurt (filter buurtcode:BU06290006;
// 572 adressen, 17 straten — alle 17 hieronder).

export const WASSENAAR: VoorbeeldAdresConfig = {
  key: "wassenaar",
  gemeente: { code: "GM0629", naam: "Wassenaar" }, // CBS 86165NED
  buurt: {
    buurtCode: "BU06290006", // CBS + PDOK Locatieserver
    naam: "Kerkehout", // CBS
    gemWoz: 439_000, // CBS (439 x 1000, conform wozNaarEuro in lib/ingest/cbs.ts)
    inwoners: 1085, // CBS
  },
  adres: {
    bagId: "0629010000001903", // BAG
    straat: "Wittelaan", // BAG
    huisnummer: 12, // BAG
    toevoeging: null, // BAG (geen huisletter/toevoeging)
    postcode: "2245VP", // BAG
    plaats: "Wassenaar", // BAG
    lat: 52.11050252796112, // BAG (WGS84)
    lon: 4.368609650773267, // BAG (WGS84)
    bouwjaar: 1914, // BAG (EP-Online-registratie zegt 1930; BAG wint)
    oppervlakteM2: 56, // BAG
    woningtype: "hoekwoning", // EP-Online Gebouwtype "Twee-onder-een-kap / rijwoning hoek"
    energielabel: "G", // EP-Online, geregistreerd 2020-04-04
    energielabelBron: "echt", // EP-Online = geregistreerd label
  },
  straten: [
    "Het Kerkehout",
    "Louisestraat",
    "Rijksstraatweg",
    "Woutersstraat",
    "Wittelaan",
    "Albertinestraat",
    "Adrianastraat",
    "Charlottestraat",
    "Van Bommellaan",
    "Mariastraat",
    "Daniel Ruysstraat",
    "Dokter van Praagstraat",
    "Van Sillevoldtstraat",
    "Jacobastraat",
    "Laan van Pluymestein",
    "Johannastraat",
    "Verlengde Wittelaan",
  ],
  // Vooroorlogse dorpsbuurt (ca. 1900-1930) met vooral kleine rijwoningen;
  // enkele grotere en vrijstaande huizen langs de Rijksstraatweg.
  typeMix: [
    { type: "tussenwoning", kans: 0.5 },
    { type: "hoekwoning", kans: 0.2 },
    { type: "twee-onder-een-kap", kans: 0.12 },
    { type: "vrijstaand", kans: 0.1 },
    { type: "appartement", kans: 0.08 },
  ],
  seed: 6290006,
  // Kleine vooroorlogse (arbeiders)woningen: basisoppervlaktes omlaag t.o.v.
  // de standaard zodat de synthetische verkopen bij de echte woningvoorraad
  // passen (het voorbeeldadres zelf is 56 m2) en het AVM comparables in de
  // juiste oppervlakteklasse vindt (0,7x-1,4x, lib/comparables.ts).
  basisOpp: { tussenwoning: 65, hoekwoning: 70, "twee-onder-een-kap": 110 },
  // gemWoz / 70 i.p.v. / 110: de gemiddelde woning in deze buurt is klein,
  // dus de ruwe m2-prijs ligt hoger dan de standaard-aanname.
  ankerOppervlakteM2: 70,
};

export const VOORBEELDEN: VoorbeeldAdresConfig[] = [DRUNEN, WASSENAAR];

const MAANDEN = 24;

// --- Synthetische verkopen + marktstatistieken (stijl db/seed/generator.ts) --

function kies<T>(rand: () => number, items: Array<{ type: T; kans: number }>): T {
  const r = rand();
  let acc = 0;
  for (const it of items) {
    acc += it.kans;
    if (r <= acc) return it.type;
  }
  return items[items.length - 1].type;
}

function driftFactor(rand: () => number, maandIndex: number): number {
  const jaarlijks = 0.045; // ~4,5% per jaar, zelfde aanname als de seed
  const ruis = (rand() - 0.5) * 0.01;
  return Math.pow(1 + jaarlijks, maandIndex / 12) * (1 + ruis);
}

type VoorbeeldVerkoop = { straat: string; datum: string; prijs: number; oppervlakteM2: number; woningtype: Woningtype };
type VoorbeeldStat = { maand: string; mediaanPrijs: number; doorlooptijdDagen: number; overbiedingPct: number; volume: number };

/**
 * Deterministisch (vaste seed per buurt): 2x draaien geeft exact dezelfde
 * rijen. Prijzen ankeren op de CBS-gemWoz van de buurt (gemWoz / 110 als
 * ruwe m2-prijs, +-15% ruis en lichte maanddrift), identiek aan
 * genereerVerkopen in db/seed/generator.ts.
 */
function genereerBuurtVoorbeelden(config: VoorbeeldAdresConfig): { verkopen: VoorbeeldVerkoop[]; stats: VoorbeeldStat[] } {
  const rand = mulberry32(config.seed);
  const verkopen: VoorbeeldVerkoop[] = [];
  const stats: VoorbeeldStat[] = [];
  const nu = new Date();
  const ankerM2 = config.buurt.gemWoz / (config.ankerOppervlakteM2 ?? 110);
  const basisOppPerType = { ...BASIS_OPP_DEFAULT, ...config.basisOpp };

  for (let m = MAANDEN - 1; m >= 0; m--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - m, 1);
    const maand = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const drift = driftFactor(rand, MAANDEN - m);
    const volume = 2 + Math.floor(rand() * 4);
    const prijzen: number[] = [];
    for (let v = 0; v < volume; v++) {
      const straat = config.straten[Math.floor(rand() * config.straten.length)];
      const type = kies(rand, config.typeMix);
      const opp = Math.round(basisOppPerType[type] * (0.75 + rand() * 0.7));
      const m2 = ankerM2 * drift * (0.85 + rand() * 0.3);
      const prijs = Math.round((m2 * opp) / 1000) * 1000;
      const dag = 1 + Math.floor(rand() * 27);
      verkopen.push({ straat, datum: `${maand}-${String(dag).padStart(2, "0")}`, prijs, oppervlakteM2: opp, woningtype: type });
      prijzen.push(prijs);
    }
    const sorted = [...prijzen].sort((a, b) => a - b);
    stats.push({
      maand,
      mediaanPrijs: sorted[Math.floor(sorted.length / 2)],
      doorlooptijdDagen: 18 + Math.floor(rand() * 30),
      overbiedingPct: Math.round((rand() * 8 - 1.5) * 10) / 10,
      volume,
    });
  }
  return { verkopen, stats };
}

// --- Flow per voorbeeldadres ------------------------------------------------

export async function runVoorbeeldAdres(config: VoorbeeldAdresConfig): Promise<void> {
  const { gemeente, buurt, adres } = config;
  const slug = nummerslug(adres.huisnummer, adres.toevoeging);
  console.log(`Voorbeeldadres: ${adres.straat} ${adres.huisnummer}, ${adres.postcode} ${adres.plaats} (${buurt.naam}, ${gemeente.naam})`);

  // 1. Gemeente + buurt (zelfde upsert-laag als de CBS-ingest; bestaande
  //    slugs blijven staan, null overschrijft nooit een bekende waarde).
  await upsertGemeente(gemeente);
  const buurtResultaat = await upsertBuurt(gemeente.code, {
    buurtCode: buurt.buurtCode,
    naam: buurt.naam,
    gemWoz: buurt.gemWoz,
    inwoners: buurt.inwoners,
  });
  console.log(`Buurt ${buurt.buurtCode} (${buurt.naam}): ${buurtResultaat} (gemWoz ${buurt.gemWoz}, inwoners ${buurt.inwoners}).`);

  // 2. Adres. Suppressie wint altijd (zelfde check als de ingest-scripts):
  //    een bevestigde opt-out betekent niet toevoegen en niet bijwerken.
  let adresOnderdrukt = false;
  if (await isSuppressed(adres.postcode, slug)) {
    adresOnderdrukt = true;
    console.log(`Adres ${adres.postcode} ${slug} staat op de suppressielijst: niet toegevoegd of bijgewerkt.`);
  } else {
    // Anders dan de bulk-ingest (onConflictDoNothing) vernieuwt dit script bij
    // een bestaande rij de woningkenmerken: het is 1 gecureerd adres waarvan
    // de bronwaarden hierboven gedocumenteerd staan. status wordt bewust NOOIT
    // aangeraakt (een opted-out adres komt nooit terug op actief).
    const kenmerken = {
      bagId: adres.bagId,
      straat: adres.straat,
      plaats: adres.plaats,
      buurtCode: buurt.buurtCode,
      lat: adres.lat,
      lon: adres.lon,
      bouwjaar: adres.bouwjaar,
      oppervlakteM2: adres.oppervlakteM2,
      woningtype: adres.woningtype,
      energielabel: adres.energielabel,
      energielabelBron: adres.energielabelBron,
      bron: "bag" as const,
    };
    const res = await db
      .insert(addresses)
      .values({
        ...kenmerken,
        huisnummer: adres.huisnummer,
        toevoeging: adres.toevoeging,
        nummerslug: slug,
        postcode: adres.postcode,
        // status niet gezet: nieuwe rij krijgt default "actief".
      })
      .onConflictDoUpdate({ target: [addresses.postcode, addresses.nummerslug], set: kenmerken })
      .returning({ id: addresses.id });
    console.log(`Adres ge-upsert (id ${res[0]?.id}): ${adres.oppervlakteM2} m2, bouwjaar ${adres.bouwjaar}, ${adres.woningtype}, label ${adres.energielabel} (bron ${adres.energielabelBron}).`);
  }

  // 3. Buurt-afgeleiden (gemOppervlakte + ankerM2Prijs) uit de eigen adresrijen.
  await herberekenBuurtAnkers([buurt.buurtCode]);

  // 4. Synthetische verkopen + market_stats voor de buurt: scoped delete +
  //    deterministische insert (idempotent, zelfde patroon als seed.ts).
  //    HARDE REGEL: bron "seed" en NOOIT een adres_id.
  const { verkopen, stats } = genereerBuurtVoorbeelden(config);
  await db.delete(sales).where(and(eq(sales.buurtCode, buurt.buurtCode), eq(sales.bron, "seed")));
  await db.delete(marketStats).where(and(eq(marketStats.buurtCode, buurt.buurtCode), eq(marketStats.bron, "seed")));
  await db.insert(sales).values(
    verkopen.map((v) => ({
      buurtCode: buurt.buurtCode,
      straat: v.straat,
      adresId: null,
      datum: v.datum,
      prijs: v.prijs,
      oppervlakteM2: v.oppervlakteM2,
      woningtype: v.woningtype,
      bron: "seed" as const,
    })),
  );
  await db.insert(marketStats).values(
    stats.map((s) => ({
      buurtCode: buurt.buurtCode,
      maand: s.maand,
      mediaanPrijs: s.mediaanPrijs,
      doorlooptijdDagen: s.doorlooptijdDagen,
      overbiedingPct: s.overbiedingPct,
      volume: s.volume,
      bron: "seed" as const,
    })),
  );
  console.log(`Voorbeeldverkopen: ${verkopen.length} rijen (bron seed, buurt/straatniveau), market_stats: ${stats.length} maanden.`);

  // 5. Verificatie: kan het AVM een waarde rekenen? Zelfde pad als de
  //    woningpagina (getOrCreateValuation; schrijft hooguit 1 rij per dag).
  if (!adresOnderdrukt) {
    const adresRows = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.postcode, adres.postcode), eq(addresses.nummerslug, slug)))
      .limit(1);
    const adresRij = adresRows[0];
    if (!adresRij) throw new Error("Verificatie mislukt: adres niet terug te lezen na upsert.");
    const { valuation, comparables } = await getOrCreateValuation(adresRij);
    if (!valuation) throw new Error("Verificatie mislukt: AVM kon geen waarde rekenen (geen comparables en geen buurt-anker).");
    console.log(
      `Valuation OK: ${valuation.waarde} (${valuation.intervalLaag}-${valuation.intervalHoog}), ` +
        `confidence ${valuation.confidence}, ${valuation.nComparables} comparables (niveau ${comparables.niveau}).`,
    );
    const indexeerbaar = await heeftGebiedsWhitelist(buurt.buurtCode, adres.postcode);
    console.log(
      `Gate-status: gebiedswhitelist ${indexeerbaar ? "VRIJGEGEVEN" : "niet vrijgegeven -> pagina blijft noindex (default)"}; ` +
        `pagina live op /woning/${adres.postcode}/${slug}.`,
    );
  }
}

/** Entrypoint-helper voor de dunne wrappers: draait configs na elkaar en sluit de pool. */
export function runVoorbeelden(configs: VoorbeeldAdresConfig[]): void {
  (async () => {
    for (const config of configs) {
      await runVoorbeeldAdres(config);
    }
  })()
    .catch((e) => {
      console.error("adres-voorbeelden onverwacht mislukt:", e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
