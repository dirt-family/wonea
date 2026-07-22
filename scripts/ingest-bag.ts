/**
 * Ingest: BAG-verblijfsobjecten (woningen) voor een begrensd gebied.
 * Bron: keyless PDOK BAG WFS 2.0 (service.pdok.nl/lv/bag/wfs/v2_0). Het plan
 * noemde de OGC API op api.pdok.nl/lv/bag/ogc/v1, maar die serveert alleen
 * vector-tiles (geverifieerd); de WFS levert dezelfde BAG-features als
 * GeoJSON, inclusief bouwjaar en pand-join op het verblijfsobject zelf.
 *
 * Draaien:  npx tsx scripts/ingest-bag.ts        (na scripts/ingest-cbs.ts)
 * Env:      WONEA_BBOX          RD-bbox "minx,miny,maxx,maxy"
 *                               (default Eindhoven-centrum)
 *           WONEA_POSTCODE4     kommalijst, filtert de opgehaalde features
 *                               (bv. "5611,5612"); leeg = geen filter
 *           WONEA_MAX_OBJECTEN  cap op opgehaalde verblijfsobjecten (3000)
 *           WONEA_BAG_URL       WFS-override (tests/fallback)
 *           WONEA_SKIP_KOPPELTABEL=1  sla de CBS-koppeltabel over
 *
 * HARDE REGELS (zie lib/ingest/upsert.ts):
 * - suppressielijst wint altijd (isSuppressed voor elke upsert);
 * - idempotent: uniek op postcode+nummerslug, onConflictDoNothing, status
 *   wordt nooit teruggezet; 2x draaien = 0 nieuwe rijen;
 * - hervatbaar: state-bestand met laatste offset in data/, en een herstart
 *   is sowieso veilig door de idempotentie;
 * - batch-transacties per pagina-groep.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sqlite } from "../lib/db";
import {
  BAG_WFS_DEFAULT,
  haalVerblijfsobjecten,
  mapVerblijfsobject,
  telTotaalInBbox,
  telVbosPerPand,
  type BagFeature,
} from "../lib/ingest/bag";
import { laadKoppeltabel, koppeltabelKey, modaleBuurtPerPostcode4 } from "../lib/ingest/koppeltabel";
import { capFeatures, leesSnapshot, schrijfSnapshot } from "../lib/ingest/snapshot";
import { bekendeBuurtCodes, bestaandeAdresBuurten, herberekenBuurtAnkers, upsertAdres } from "../lib/ingest/upsert";

// Default: Eindhoven-centrum in RD (EPSG:28992), dekt grofweg de
// seed-postcodegebieden 5611-5616. Voor een andere gemeente: WONEA_BBOX.
const BBOX_DEFAULT = "160000,382000,162600,384600";
const BATCH = 500;

type IngestState = { gebied: string; volgendeStartIndex: number; bijgewerktAt: string };
type BagSnapshot = { opgehaaldAt: string; gebied: string; bbox: string; totaalInBbox: number | null; features: BagFeature[] };

const statePad = path.join(process.cwd(), "data", "ingest-bag-state.json");

function leesState(gebied: string): IngestState | null {
  if (!existsSync(statePad)) return null;
  try {
    const state = JSON.parse(readFileSync(statePad, "utf8")) as IngestState;
    return state.gebied === gebied ? state : null;
  } catch {
    return null;
  }
}

async function main() {
  const bbox = process.env.WONEA_BBOX ?? BBOX_DEFAULT;
  const postcode4 = (process.env.WONEA_POSTCODE4 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[1-9][0-9]{3}$/.test(s));
  const max = Number(process.env.WONEA_MAX_OBJECTEN ?? 3000);
  const basisUrl = process.env.WONEA_BAG_URL ?? BAG_WFS_DEFAULT;
  const gebied = postcode4.length > 0 ? `pc4-${postcode4.join("-")}` : `bbox-${bbox.replace(/,/g, "-")}`;
  const snapshotNaam = `bag-${gebied}`;

  // 1. Features ophalen (gepagineerd, met delay), hervatbaar via state.
  const state = leesState(gebied);
  const startIndex = state?.volgendeStartIndex ?? 0;
  if (startIndex > 0) console.log(`Hervatten vanaf offset ${startIndex} (state van ${state?.bijgewerktAt}).`);

  const features: BagFeature[] = [];
  let fetchCompleet = false;
  let totaalInBbox: number | null = null;
  try {
    totaalInBbox = await telTotaalInBbox(basisUrl, bbox);
    console.log(`BAG WFS: verblijfsobjecten ophalen (bbox ${bbox}, max ${max}${totaalInBbox != null ? `, beschikbaar ${totaalInBbox}` : ""})...`);
    for await (const pagina of haalVerblijfsobjecten({ basisUrl, bbox, max, startIndex })) {
      features.push(...pagina.features);
      console.log(`  pagina vanaf ${pagina.startIndex}: ${pagina.features.length} features (totaal deze run: ${features.length})`);
    }
    fetchCompleet = true;
  } catch (e) {
    console.warn(`BAG WFS-fout: ${(e as Error).message}`);
  }

  let bronLabel = "live";
  if (features.length === 0 && startIndex === 0) {
    // Netwerk stuk voordat er iets binnen was: stil terugvallen op snapshot.
    const snapshot = leesSnapshot<BagSnapshot>(snapshotNaam);
    if (!snapshot) {
      console.log("Geen features en geen snapshot; de seed blijft de offline-basis. Niets gewijzigd.");
      return;
    }
    console.log(`Terugvallen op snapshot van ${snapshot.opgehaaldAt} (${snapshot.features.length} features).`);
    features.push(...snapshot.features);
    bronLabel = "snapshot";
    fetchCompleet = false; // snapshot-run raakt de state niet
  } else if (features.length === 0) {
    console.log("Niets nieuws opgehaald (hervat-run zonder resultaat). Niets gewijzigd.");
    return;
  }

  // 2. Snapshot van de ruwe features (alleen bij een volledige verse run).
  if (bronLabel === "live" && startIndex === 0 && fetchCompleet) {
    const pad = schrijfSnapshot(snapshotNaam, {
      opgehaaldAt: new Date().toISOString(),
      gebied,
      bbox,
      totaalInBbox,
      features: capFeatures(features),
    } satisfies BagSnapshot);
    console.log(`Snapshot -> ${pad}`);
  }

  // 3. Buurt-koppeling voorbereiden.
  const vbosPerPand = telVbosPerPand(features);
  const pc4InSet = new Set(
    features
      .map((f) => (f.properties.postcode ?? "").replace(/\s+/g, "").slice(0, 4))
      .filter((s) => /^[1-9][0-9]{3}$/.test(s))
      .filter((s) => postcode4.length === 0 || postcode4.includes(s)),
  );
  const koppeltabel =
    process.env.WONEA_SKIP_KOPPELTABEL === "1" || pc4InSet.size === 0
      ? null
      : await laadKoppeltabel({ postcode4: pc4InSet, gebied, url: process.env.WONEA_KOPPELTABEL_URL, zipPad: process.env.WONEA_KOPPELTABEL_ZIP });
  if (koppeltabel) console.log(`Koppeltabel geladen: ${koppeltabel.size} postcode+huisnummer-regels voor dit gebied.`);

  const buurten = bekendeBuurtCodes();
  const fallbackPerPc4 = modaleBuurtPerPostcode4(bestaandeAdresBuurten());

  // 4. Mappen + upserten in batch-transacties.
  const telling = {
    opgehaald: features.length,
    buitenPostcode4: 0,
    geenWoning: 0,
    geenBuurt: 0,
    viaKoppeltabel: 0,
    viaFallback: 0,
    toegevoegd: 0,
    bestondAl: 0,
    onderdrukt: 0,
  };
  const geraakteBuurten = new Set<string>();

  for (let i = 0; i < features.length; i += BATCH) {
    const chunk = features.slice(i, i + BATCH);
    const verwerkChunk = sqlite.transaction(() => {
      for (const feature of chunk) {
        const rij = mapVerblijfsobject(feature, vbosPerPand.get(feature.properties.pandidentificatie) ?? 1);
        if (!rij) {
          telling.geenWoning++;
          continue;
        }
        if (postcode4.length > 0 && !postcode4.includes(rij.postcode.slice(0, 4))) {
          telling.buitenPostcode4++;
          continue;
        }
        const uitKoppeltabel = koppeltabel?.get(koppeltabelKey(rij.postcode, rij.huisnummer));
        let buurtCode: string | undefined;
        if (uitKoppeltabel && buurten.has(uitKoppeltabel)) {
          buurtCode = uitKoppeltabel;
          telling.viaKoppeltabel++;
        } else {
          buurtCode = fallbackPerPc4.get(rij.postcode.slice(0, 4));
          if (buurtCode) telling.viaFallback++;
        }
        if (!buurtCode) {
          telling.geenBuurt++;
          continue;
        }
        const resultaat = upsertAdres(rij, buurtCode);
        if (resultaat === "toegevoegd") telling.toegevoegd++;
        else if (resultaat === "bestond_al") telling.bestondAl++;
        else telling.onderdrukt++;
        geraakteBuurten.add(buurtCode);
      }
    });
    verwerkChunk();
  }

  // 5. Buurt-afgeleiden bijwerken en state afronden.
  herberekenBuurtAnkers(geraakteBuurten);

  if (bronLabel === "live") {
    if (fetchCompleet) {
      if (existsSync(statePad)) unlinkSync(statePad);
    } else {
      mkdirSync(path.dirname(statePad), { recursive: true });
      const nieuweState: IngestState = { gebied, volgendeStartIndex: startIndex + features.length, bijgewerktAt: new Date().toISOString() };
      writeFileSync(statePad, JSON.stringify(nieuweState));
      console.log(`Run onvolledig; state bewaard (volgende run hervat vanaf ${nieuweState.volgendeStartIndex}).`);
    }
  }

  console.log(
    `BAG-ingest klaar (${bronLabel}): ${telling.opgehaald} features, ` +
      `${telling.toegevoegd} adressen toegevoegd, ${telling.bestondAl} bestonden al, ${telling.onderdrukt} onderdrukt (suppressielijst), ` +
      `${telling.geenWoning} geen woning/bruikbaar, ${telling.buitenPostcode4} buiten postcode4-filter, ${telling.geenBuurt} zonder buurt-koppeling ` +
      `(koppeling: ${telling.viaKoppeltabel} via koppeltabel, ${telling.viaFallback} via postcode4-fallback).`,
  );
}

main().catch((e) => {
  console.error("BAG-ingest onverwacht mislukt:", e);
  process.exitCode = 1;
});
