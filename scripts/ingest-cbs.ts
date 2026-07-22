/**
 * Ingest: CBS Kerncijfers wijken en buurten (KWB) voor een gemeente.
 * Bron: StatLine OData (keyless). Haalt per buurt code, naam, gemiddelde
 * WOZ-waarde en inwoners op en upsert die in neighborhoods (de gemeente
 * wordt zo nodig aangemaakt).
 *
 * Draaien:  npx tsx scripts/ingest-cbs.ts
 * Env:      WONEA_GEMEENTE     gemeentenaam (default "Eindhoven")
 *           WONEA_KWB_DATASET  StatLine-dataset-id (default 86165NED, KWB 2025)
 *
 * Offline-gedrag (bewust): netwerkfout = stil terugvallen op de laatste
 * snapshot in db/seed/snapshots/cbs-<gemeente>.json; is die er niet, dan een
 * nette melding en exit 0. De seed-buurten blijven de offline-basis.
 * Idempotent: 2x draaien geeft dezelfde eindstand.
 */
import { KWB_DATASET_DEFAULT, haalKwbVoorGemeente, type CbsSnapshot } from "../lib/ingest/cbs";
import { leesSnapshot, schrijfSnapshot } from "../lib/ingest/snapshot";
import { herberekenBuurtAnkers, upsertBuurt, upsertGemeente } from "../lib/ingest/upsert";
import { slugify } from "../lib/format";

async function main() {
  const gemeenteNaam = process.env.WONEA_GEMEENTE ?? "Eindhoven";
  const datasetId = process.env.WONEA_KWB_DATASET ?? KWB_DATASET_DEFAULT;
  const snapshotNaam = `cbs-${slugify(gemeenteNaam)}`;

  let snapshot: CbsSnapshot | null = null;
  try {
    console.log(`CBS KWB (${datasetId}): buurten ophalen voor gemeente "${gemeenteNaam}"...`);
    const resultaat = await haalKwbVoorGemeente(datasetId, gemeenteNaam);
    if (resultaat === "niet-gevonden") {
      console.log(`Gemeente "${gemeenteNaam}" niet gevonden in dataset ${datasetId}. Controleer de naam (bv. "Eindhoven", "'s-Gravenhage"). Niets gewijzigd.`);
      return;
    }
    snapshot = resultaat;
    const pad = schrijfSnapshot(snapshotNaam, snapshot);
    console.log(`Online: ${snapshot.buurten.length} buurten opgehaald; snapshot -> ${pad}`);
  } catch (e) {
    console.warn(`CBS niet bereikbaar (${(e as Error).message}); terugvallen op snapshot.`);
    snapshot = leesSnapshot<CbsSnapshot>(snapshotNaam);
    if (!snapshot) {
      console.log("Geen snapshot aanwezig; de seed-buurten blijven de offline-basis. Niets gewijzigd.");
      return;
    }
    console.log(`Snapshot van ${snapshot.opgehaaldAt}: ${snapshot.buurten.length} buurten.`);
  }

  upsertGemeente(snapshot.gemeente);
  let toegevoegd = 0;
  let bijgewerkt = 0;
  let metWoz = 0;
  for (const buurt of snapshot.buurten) {
    const resultaat = upsertBuurt(snapshot.gemeente.code, buurt);
    if (resultaat === "toegevoegd") toegevoegd++;
    else bijgewerkt++;
    if (buurt.gemWoz != null) metWoz++;
  }
  herberekenBuurtAnkers(snapshot.buurten.map((b) => b.buurtCode));

  console.log(
    `CBS-ingest klaar (${snapshot.gemeente.naam}, ${snapshot.gemeente.code}): ` +
      `${toegevoegd} buurten toegevoegd, ${bijgewerkt} bijgewerkt, ${metWoz}/${snapshot.buurten.length} met WOZ-waarde.`,
  );
}

main().catch((e) => {
  console.error("CBS-ingest onverwacht mislukt:", e);
  process.exitCode = 1;
});
