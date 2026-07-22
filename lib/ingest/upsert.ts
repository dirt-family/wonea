import { eq, sql } from "drizzle-orm";
import { addresses, municipalities, neighborhoods } from "@/db/schema";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";
import { isSuppressed } from "@/lib/suppression";
import type { BagAdresRij } from "@/lib/ingest/bag";
import type { CbsBuurt } from "@/lib/ingest/cbs";

/**
 * Upsert-laag van de ingest. Twee harde regels uit het plan:
 * 1. De suppressielijst (bevestigde optouts) wint ALTIJD: voor elke
 *    adres-upsert wordt isSuppressed gecheckt; een opted-out adres wordt
 *    nooit (opnieuw) toegevoegd of teruggezet op actief.
 * 2. Idempotent: uniekheid op postcode+nummerslug met onConflictDoNothing;
 *    bestaande rijen (inclusief hun status) worden nooit aangeraakt.
 */

export function upsertGemeente(g: { code: string; naam: string }): void {
  db.insert(municipalities)
    .values({ code: g.code, naam: g.naam, slug: slugify(g.naam) })
    // Bestaat de gemeente al, dan alleen de naam verversen; de slug blijft
    // staan (URL-stabiliteit).
    .onConflictDoUpdate({ target: municipalities.code, set: { naam: g.naam } })
    .run();
}

/**
 * Kiest een slug voor een buurt binnen een gemeente. Bestaande buurten houden
 * hun slug (URL-stabiliteit). Botst de naam met een andere buurt (echte
 * CBS-buurten kunnen dezelfde naam hebben als seed-buurten, bv. Binnenstad),
 * dan krijgt de nieuwe een deterministisch suffix uit de buurtcode.
 */
export function kiesBuurtSlug(gemeenteCode: string, buurtCode: string, naam: string): string {
  const bestaande = db
    .select({ buurtCode: neighborhoods.buurtCode, slug: neighborhoods.slug })
    .from(neighborhoods)
    .where(eq(neighborhoods.gemeenteCode, gemeenteCode))
    .all();
  const eigen = bestaande.find((b) => b.buurtCode === buurtCode);
  if (eigen) return eigen.slug;

  const basis = slugify(naam) || buurtCode.toLowerCase();
  const bezet = new Set(bestaande.map((b) => b.slug));
  if (!bezet.has(basis)) return basis;
  const kandidaat = `${basis}-${buurtCode.replace(/^BU/i, "").slice(-4).toLowerCase()}`;
  if (!bezet.has(kandidaat)) return kandidaat;
  let i = 2;
  while (bezet.has(`${kandidaat}-${i}`)) i++;
  return `${kandidaat}-${i}`;
}

export type BuurtUpsertResultaat = "toegevoegd" | "bijgewerkt";

export function upsertBuurt(gemeenteCode: string, b: CbsBuurt): BuurtUpsertResultaat {
  const bestaand = db
    .select({ buurtCode: neighborhoods.buurtCode })
    .from(neighborhoods)
    .where(eq(neighborhoods.buurtCode, b.buurtCode))
    .get();

  if (bestaand) {
    // Naam en cijfers verversen; een null uit CBS overschrijft nooit een
    // eerder bekende waarde (geheime buurten hebben geen WOZ/inwoners).
    const set: Partial<typeof neighborhoods.$inferInsert> = { naam: b.naam };
    if (b.gemWoz != null) set.gemWoz = b.gemWoz;
    if (b.inwoners != null) set.inwoners = b.inwoners;
    db.update(neighborhoods).set(set).where(eq(neighborhoods.buurtCode, b.buurtCode)).run();
    return "bijgewerkt";
  }

  db.insert(neighborhoods)
    .values({
      buurtCode: b.buurtCode,
      naam: b.naam,
      slug: kiesBuurtSlug(gemeenteCode, b.buurtCode, b.naam),
      gemeenteCode,
      gemWoz: b.gemWoz,
      inwoners: b.inwoners,
    })
    .run();
  return "toegevoegd";
}

export type AdresUpsertResultaat = "toegevoegd" | "bestond_al" | "onderdrukt";

/**
 * Voegt een BAG-adresrij toe. Suppressie wint altijd; conflict op
 * postcode+nummerslug laat de bestaande rij (en dus de status) met rust.
 */
export function upsertAdres(rij: BagAdresRij, buurtCode: string): AdresUpsertResultaat {
  if (isSuppressed(rij.postcode, rij.nummerslug)) return "onderdrukt";
  const res = db
    .insert(addresses)
    .values({
      bagId: rij.bagId,
      straat: rij.straat,
      huisnummer: rij.huisnummer,
      toevoeging: rij.toevoeging,
      nummerslug: rij.nummerslug,
      postcode: rij.postcode,
      plaats: rij.plaats,
      buurtCode,
      lat: rij.lat,
      lon: rij.lon,
      bouwjaar: rij.bouwjaar,
      oppervlakteM2: rij.oppervlakteM2,
      woningtype: rij.woningtype,
      energielabel: rij.energielabel,
      energielabelBron: "indicatie",
      bron: "bag",
      // status bewust niet gezet: nieuwe rijen krijgen de default "actief",
      // bestaande rijen worden niet aangeraakt (nooit terug naar actief).
    })
    .onConflictDoNothing()
    .run();
  return res.changes > 0 ? "toegevoegd" : "bestond_al";
}

/**
 * Herberekent per buurt de gemiddelde oppervlakte (uit eigen adresrijen) en
 * het anker-m2-prijs-afgeleide (gem_woz / gem_oppervlakte), zoals
 * scripts/seed.ts dat ook doet. Buurten zonder adressen houden null.
 */
export function herberekenBuurtAnkers(buurtCodes: Iterable<string>): void {
  for (const code of new Set(buurtCodes)) {
    const rij = db
      .select({ avgOpp: sql<number | null>`avg(${addresses.oppervlakteM2})` })
      .from(addresses)
      .where(eq(addresses.buurtCode, code))
      .get();
    const gemOpp = rij?.avgOpp ?? null;
    const buurt = db.select({ gemWoz: neighborhoods.gemWoz }).from(neighborhoods).where(eq(neighborhoods.buurtCode, code)).get();
    if (!buurt) continue;
    const anker = gemOpp && buurt.gemWoz ? buurt.gemWoz / gemOpp : null;
    db.update(neighborhoods).set({ gemOppervlakte: gemOpp, ankerM2Prijs: anker }).where(eq(neighborhoods.buurtCode, code)).run();
  }
}

/** Alle bekende buurtcodes (voor FK-checks in de ingest). */
export function bekendeBuurtCodes(): Set<string> {
  return new Set(
    db
      .select({ buurtCode: neighborhoods.buurtCode })
      .from(neighborhoods)
      .all()
      .map((b) => b.buurtCode),
  );
}

/** Bestaande adresrijen (postcode + buurt) voor de postcode4-fallback. */
export function bestaandeAdresBuurten(): Array<{ postcode: string; buurtCode: string }> {
  return db.select({ postcode: addresses.postcode, buurtCode: addresses.buurtCode }).from(addresses).all();
}
