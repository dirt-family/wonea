/**
 * Productie-check (Fase-5-gate, naast `npm run build`).
 *
 * Draait tegen een LOPENDE productie-build en start zelf NIETS. Gebruik:
 *
 *   1. npm run build
 *   2. npm run start           (serveert op poort 4123)
 *   3. npx tsx scripts/prodcheck.ts
 *
 * Andere host/poort: WONEA_BASE_URL=http://host:poort npx tsx scripts/prodcheck.ts
 *
 * Checks (hard = exit 1 bij falen):
 *   - HARD  /                 geeft 200
 *   - HARD  adrespagina       geeft 200 (eerste actieve, niet-gesupprimeerde
 *                             rij uit de eigen database)
 *   - INFO  tweede request naar dezelfde adrespagina: duur + x-nextjs-cache,
 *           alleen gelogd (cache-indicatie, geen harde eis: timing is ruis)
 *   - HARD  /api/og           geeft 200 met image/* content-type EN een
 *                             Cache-Control-header
 *   - HARD  /dev/mail         geeft 404: de dev-mailbox (magic links, outbox)
 *                             mag in een productiebuild NIET bestaan. Dit is
 *                             DE guard-check uit het plan (par. 1 en Fase 6).
 *
 * Zie docs/PERFORMANCE.md voor het waarom achter elk beleid.
 */
import { eq } from "drizzle-orm";
import { db, sql } from "../lib/db";
import { addresses } from "../db/schema";
import { isSuppressed } from "../lib/suppression";

const base = process.env.WONEA_BASE_URL ?? "http://localhost:4123";

let fouten = 0;

function ok(label: string, detail = "") {
  console.log(`OK   ${label}${detail ? `: ${detail}` : ""}`);
}

function fout(label: string, detail: string) {
  fouten++;
  console.error(`FOUT ${label}: ${detail}`);
}

function info(label: string, detail: string) {
  console.log(`INFO ${label}: ${detail}`);
}

/** Fetch met timing; volgt bewust geen redirects (we willen de route zelf zien). */
async function meet(pad: string): Promise<{ res: Response; ms: number } | null> {
  const t0 = performance.now();
  try {
    const res = await fetch(base + pad, { redirect: "manual" });
    // Body altijd consumeren, anders blijft de verbinding hangen.
    await res.arrayBuffer();
    return { res, ms: performance.now() - t0 };
  } catch (e) {
    fout(pad, `server niet bereikbaar op ${base} (${(e as Error).message}). Draai eerst: npm run build && npm run start`);
    return null;
  }
}

/** Eerste actieve, niet-gesupprimeerde rij: een adres dat zeker moet renderen. */
async function vindTestAdres(): Promise<{ pad: string; label: string } | null> {
  try {
    const rows = await db.select().from(addresses).where(eq(addresses.status, "actief")).orderBy(addresses.id).limit(25);
    let adres: (typeof rows)[number] | undefined;
    for (const rij of rows) {
      if (!(await isSuppressed(rij.postcode, rij.nummerslug))) {
        adres = rij;
        break;
      }
    }
    if (!adres) return null;
    return {
      pad: `/woning/${adres.postcode}/${adres.nummerslug}`,
      label: `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.postcode}`,
    };
  } catch (e) {
    fout("database", `kan geen testadres lezen (${(e as Error).message}). Draai eerst: npm run setup`);
    return null;
  }
}

async function main() {
  console.log(`Prodcheck tegen ${base} (start zelf geen server)`);

  // 1. Home
  const home = await meet("/");
  if (home) {
    if (home.res.status === 200) ok("/", `200 in ${home.ms.toFixed(0)}ms`);
    else fout("/", `status ${home.res.status} (verwacht 200)`);
  }

  // 2 + 3. Adrespagina, twee keer: eerste render vult de ISR-cache, de tweede
  // hoort daaruit te komen. Alleen de 200 is hard; timing/cache-status is info.
  const adres = await vindTestAdres();
  if (!adres) {
    if (fouten === 0) fout("adrespagina", "geen actief, niet-gesupprimeerd adres in de database. Draai eerst: npm run setup");
  } else {
    const eerste = await meet(adres.pad);
    if (eerste) {
      if (eerste.res.status === 200) ok(adres.pad, `200 in ${eerste.ms.toFixed(0)}ms (${adres.label})`);
      else fout(adres.pad, `status ${eerste.res.status} (verwacht 200)`);

      if (eerste.res.status === 200) {
        const tweede = await meet(adres.pad);
        if (tweede && tweede.res.status === 200) {
          const cache1 = eerste.res.headers.get("x-nextjs-cache") ?? "-";
          const cache2 = tweede.res.headers.get("x-nextjs-cache") ?? "-";
          const sneller = tweede.ms <= eerste.ms;
          info(
            "cache-indicatie",
            `request 1: ${eerste.ms.toFixed(0)}ms (x-nextjs-cache: ${cache1}), request 2: ${tweede.ms.toFixed(0)}ms (x-nextjs-cache: ${cache2}); ` +
              (sneller ? "tweede request sneller of gelijk, dat wijst op een gevulde cache." : "tweede request trager; timing is ruis, check x-nextjs-cache (HIT verwacht)."),
          );
        } else if (tweede) {
          fout(adres.pad, `tweede request gaf status ${tweede.res.status} (verwacht 200)`);
        }
      }
    }
  }

  // 4. /api/og: image + cache-header (zonder token = de generieke afbeelding).
  const og = await meet("/api/og");
  if (og) {
    const contentType = og.res.headers.get("content-type") ?? "";
    const cacheControl = og.res.headers.get("cache-control") ?? "";
    if (og.res.status !== 200) fout("/api/og", `status ${og.res.status} (verwacht 200)`);
    else if (!contentType.startsWith("image/")) fout("/api/og", `content-type "${contentType}" is geen image/*`);
    else if (!cacheControl) fout("/api/og", "geen Cache-Control-header op de og-afbeelding");
    else ok("/api/og", `${contentType}, Cache-Control: ${cacheControl}`);
  }

  // 5. DE guard-check: /dev/mail bestaat niet in een productiebuild.
  const devMail = await meet("/dev/mail");
  if (devMail) {
    if (devMail.res.status === 404) ok("/dev/mail", "404, dev-mailbox bestaat niet in deze build");
    else fout("/dev/mail", `status ${devMail.res.status} (verwacht 404). De dev-mailbox lekt in productie: check NODE_ENV en WONEA_DEV_MAIL, dit mag nooit live.`);
  }

  if (fouten > 0) {
    console.error(`Prodcheck: ${fouten} harde fouten.`);
    process.exit(1);
  }
  console.log("Prodcheck: alles groen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
