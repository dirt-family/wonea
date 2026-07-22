/**
 * CLI voor de indexatie-whitelist (index_gating). Default is ALLES noindex;
 * met deze CLI geef je bewust gebieden vrij (anti scaled-content-abuse, zie
 * lib/seo/gating.ts).
 *
 * Gebruik:
 *   npx tsx scripts/gating.ts allow buurt BU07720001 "reden"
 *   npx tsx scripts/gating.ts allow postcode4 5611 "reden"
 *   npx tsx scripts/gating.ts disallow buurt BU07720001 ["reden"]
 *   npx tsx scripts/gating.ts list
 *   npx tsx scripts/gating.ts import pad.csv --drempel 10
 *
 * Zoekvraag-CSV-formaat (import): kolommen scope,code,zoekvolume met optionele
 * kopregel. scope = buurt | postcode4. Een rij wordt indexeerbaar bij
 * zoekvolume >= drempel (default 10; drempel is inclusief), anders wordt de
 * rij expliciet op niet-indexeerbaar gezet (de afweging blijft zo zichtbaar
 * in de tabel). Voorbeeld:
 *
 *   scope,code,zoekvolume
 *   buurt,BU07720001,140
 *   postcode4,5611,8
 *
 * LIVEGANG-TODO: de echte input is een Ahrefs-keywordexport (zoekvolume per
 * buurt-/plaatsquery), handmatig terug te brengen tot dit CSV-formaat.
 */
import { readFileSync } from "node:fs";
import { isGatingScope, listGating, parseZoekvraagCsv, setGating } from "../lib/seo/gating";

const STANDAARD_DREMPEL = 10;

function stop(melding: string): never {
  console.error(melding);
  process.exit(1);
}

function hulp(): never {
  console.log(
    [
      "Gebruik:",
      '  npx tsx scripts/gating.ts allow <buurt|postcode4> <code> "<reden>"',
      '  npx tsx scripts/gating.ts disallow <buurt|postcode4> <code> ["<reden>"]',
      "  npx tsx scripts/gating.ts list",
      `  npx tsx scripts/gating.ts import <pad.csv> [--drempel ${STANDAARD_DREMPEL}]`,
    ].join("\n"),
  );
  process.exit(0);
}

function valideerCode(scope: "buurt" | "postcode4", code: string): void {
  if (scope === "buurt" && !/^BU\d{8}$/.test(code)) {
    stop(`Ongeldige buurtcode "${code}": verwacht CBS-formaat BU + 8 cijfers, bv. BU07720001.`);
  }
  if (scope === "postcode4" && !/^[1-9][0-9]{3}$/.test(code)) {
    stop(`Ongeldige postcode4 "${code}": verwacht 4 cijfers, bv. 5611.`);
  }
}

function doeAllowDisallow(indexeerbaar: boolean, args: string[]): void {
  const [scope, code, reden] = args;
  if (!scope || !code) hulp();
  if (!isGatingScope(scope)) stop(`Onbekende scope "${scope}": gebruik buurt of postcode4.`);
  if (indexeerbaar && !reden) stop('Reden verplicht bij allow: npx tsx scripts/gating.ts allow buurt BU07720001 "reden".');
  valideerCode(scope, code);
  setGating(scope, code, indexeerbaar, reden ?? null);
  console.log(`${indexeerbaar ? "Vrijgegeven" : "Geblokkeerd"}: ${scope} ${code}${reden ? ` (${reden})` : ""}`);
}

function doeList(): void {
  const rijen = listGating();
  if (rijen.length === 0) {
    console.log("Whitelist is leeg: alle adres- en buurtpagina's staan op noindex (de default).");
    return;
  }
  console.log("scope      code         indexeerbaar  reden");
  for (const rij of rijen) {
    console.log(`${rij.scope.padEnd(10)} ${rij.code.padEnd(12)} ${(rij.indexeerbaar ? "ja" : "nee").padEnd(13)} ${rij.reden ?? ""}`);
  }
}

function doeImport(args: string[]): void {
  const pad = args[0];
  if (!pad) hulp();
  let drempel = STANDAARD_DREMPEL;
  const drempelIndex = args.indexOf("--drempel");
  if (drempelIndex !== -1) {
    drempel = Number(args[drempelIndex + 1]);
    if (!Number.isFinite(drempel) || drempel < 0) stop(`Ongeldige drempel "${args[drempelIndex + 1]}".`);
  }

  let inhoud: string;
  try {
    inhoud = readFileSync(pad, "utf8");
  } catch {
    stop(`Kan CSV niet lezen: ${pad}`);
  }

  const { rijen, overgeslagen } = parseZoekvraagCsv(inhoud, drempel);
  for (const rij of rijen) {
    setGating(rij.scope, rij.code, rij.indexeerbaar, `zoekvraag-import: volume ${rij.zoekvolume} (drempel ${drempel})`);
  }
  const vrijgegeven = rijen.filter((r) => r.indexeerbaar).length;
  console.log(`Import klaar: ${rijen.length} rijen verwerkt, ${vrijgegeven} vrijgegeven, ${rijen.length - vrijgegeven} geblokkeerd.`);
  if (overgeslagen.length > 0) {
    console.warn(`Overgeslagen (${overgeslagen.length} ongeldige regels):`);
    for (const regel of overgeslagen) console.warn(`  ${regel}`);
  }
}

function main(): void {
  const [commando, ...rest] = process.argv.slice(2);
  switch (commando) {
    case "allow":
      return doeAllowDisallow(true, rest);
    case "disallow":
      return doeAllowDisallow(false, rest);
    case "list":
      return doeList();
    case "import":
      return doeImport(rest);
    default:
      hulp();
  }
}

main();
