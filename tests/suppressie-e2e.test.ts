import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

/**
 * Suppressie end-to-end: de merkbelofte "verwijderen kan altijd" over ALLE
 * leespaden die nu bestaan. Drie adressen in een straat:
 * - A (huisnummer 1): doorloopt in de tests de volledige opt-out-flow
 *   (aanvraag, bevestiging, cascade);
 * - B (huisnummer 3): controle-adres, moet overal zichtbaar blijven;
 * - C (huisnummer 5): bevestigde opt-out ZONDER cascade (status nog "actief").
 *   Dat is het defensie-in-de-diepte-geval: ook als de cascade nog niet of
 *   half gedraaid heeft, moet isSuppressed elk leespad al dichtzetten.
 *
 * Gedekte leespaden: zoek-API (app/api/search), zoekpagina en vergelijken
 * (lib/zoeken), homepage (lib/homepage-data), plaatspagina's (lib/woningmarkt),
 * buurtpagina's (lib/buurt-data), her-ingest (lib/ingest/upsert) en de
 * cascade zelf (lib/suppression). De rapport-, alerts-, widget-, og- en
 * dossierpaden hebben hun eigen testbestanden en worden hier niet herhaald.
 */

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let suppression: typeof import("@/lib/suppression");
let zoeken: typeof import("@/lib/zoeken");
let homepage: typeof import("@/lib/homepage-data");
let woningmarkt: typeof import("@/lib/woningmarkt");
let buurtData: typeof import("@/lib/buurt-data");
let upsert: typeof import("@/lib/ingest/upsert");
let searchRoute: typeof import("@/app/api/search/route");

let adresA: number;
let adresB: number;
let adresC: number;

const LEGE_FILTERS = { q: "Suppressiestraat", woningtype: null, energielabel: null, minOppervlak: null, gemeente: null } as const;

async function zoekApiLabels(q: string): Promise<string[]> {
  const res = await searchRoute.GET(new Request(`http://test.local/api/search?q=${encodeURIComponent(q)}`));
  const body = (await res.json()) as { resultaten: Array<{ label: string }> };
  return body.resultaten.map((r) => r.label);
}

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  suppression = await import("@/lib/suppression");
  zoeken = await import("@/lib/zoeken");
  homepage = await import("@/lib/homepage-data");
  woningmarkt = await import("@/lib/woningmarkt");
  buurtData = await import("@/lib/buurt-data");
  upsert = await import("@/lib/ingest/upsert");
  searchRoute = await import("@/app/api/search/route");

  await db.insert(schema.municipalities).values({ code: "GM0900", naam: "Grondel", slug: "grondel" });
  // Met anker, zodat getOrCreateValuation (homepage-preview, vergelijken) een
  // eerlijke schatting kan maken.
  await db
    .insert(schema.neighborhoods)
    .values({ buurtCode: "BU9", naam: "Zuidhoek", slug: "zuidhoek", gemeenteCode: "GM0900", gemWoz: 320000, inwoners: 1200, ankerM2Prijs: 3200 });

  // Insertvolgorde bepaalt de id's: C krijgt de laagste id, zodat paden die
  // "eerste actieve adres" kiezen (homepage-preview) aantoonbaar over C heen
  // moeten stappen op grond van isSuppressed, niet op grond van status.
  const adressen = await db
    .insert(schema.addresses)
    .values([
      {
        straat: "Suppressiestraat", huisnummer: 5, toevoeging: null, nummerslug: "5", postcode: "5699ZZ", plaats: "Grondel",
        buurtCode: "BU9", bouwjaar: 1990, oppervlakteM2: 105, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      },
      {
        straat: "Suppressiestraat", huisnummer: 1, toevoeging: null, nummerslug: "1", postcode: "5699ZZ", plaats: "Grondel",
        buurtCode: "BU9", bouwjaar: 1985, oppervlakteM2: 110, woningtype: "tussenwoning", energielabel: "B",
        energielabelBron: "echt", bron: "seed", status: "actief",
      },
      {
        straat: "Suppressiestraat", huisnummer: 3, toevoeging: null, nummerslug: "3", postcode: "5699ZZ", plaats: "Grondel",
        buurtCode: "BU9", bouwjaar: 1992, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      },
    ])
    .returning({ id: schema.addresses.id, nummerslug: schema.addresses.nummerslug });
  adresC = adressen.find((a) => a.nummerslug === "5")!.id;
  adresA = adressen.find((a) => a.nummerslug === "1")!.id;
  adresB = adressen.find((a) => a.nummerslug === "3")!.id;

  // A heeft een claim met alert en deel-rapport: de cascade moet die dichtzetten.
  const userId = (
    await db.insert(schema.users).values({ email: "eigenaar@voorbeeld.nl", verifiedAt: "2026-01-01", createdAt: "2026-01-01" }).returning({ id: schema.users.id })
  )[0].id;
  const claimId = (
    await db.insert(schema.claims).values({ userId, adresId: adresA, rol: "eigenaar", createdAt: "2026-02-01" }).returning({ id: schema.claims.id })
  )[0].id;
  await db.insert(schema.alertSubscriptions).values({ claimId, actief: true });
  await db.insert(schema.sharedReports).values({ token: "rapport-a", claimId, adresId: adresA, createdAt: "2026-03-01" });

  // Bestaande schattingen voor alle drie (voedt homepage-rij, plaats- en buurtlijsten).
  await db.insert(schema.valuations).values(
    [
      { adresId: adresC, waarde: 336000 },
      { adresId: adresA, waarde: 352000 },
      { adresId: adresB, waarde: 320000 },
    ].map((v) => ({
      adresId: v.adresId,
      datum: "2026-07-20",
      waarde: v.waarde,
      intervalLaag: v.waarde - 20000,
      intervalHoog: v.waarde + 20000,
      confidence: "middel" as const,
      nComparables: 4,
      modelVersie: "wonea-avm-1.0",
      inputsJson: "{}",
    })),
  );

  // Verkopen: een seed-verkoop zonder adres_id en per adres een
  // kadaster-verkoop met adres_id (die moet meeverdwijnen bij suppressie).
  await db.insert(schema.sales).values([
    { buurtCode: "BU9", straat: "Suppressiestraat", adresId: null, datum: "2026-06-15", prijs: 350000, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "seed" },
    { buurtCode: "BU9", straat: "Suppressiestraat", adresId: adresA, datum: "2026-06-20", prijs: 400000, oppervlakteM2: 110, woningtype: "tussenwoning", bron: "kadaster" },
    { buurtCode: "BU9", straat: "Suppressiestraat", adresId: adresC, datum: "2026-06-22", prijs: 420000, oppervlakteM2: 105, woningtype: "tussenwoning", bron: "kadaster" },
    { buurtCode: "BU9", straat: "Suppressiestraat", adresId: adresB, datum: "2026-06-25", prijs: 410000, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "kadaster" },
  ]);

  // Opt-outs: C bevestigd maar zonder cascade (status blijft "actief");
  // A alleen aangevraagd, bevestiging en cascade volgen in de tests.
  await db.insert(schema.optouts).values([
    { adresId: adresC, postcode: "5699ZZ", nummerslug: "5", email: null, token: "optout-c", aangevraagdAt: "2026-07-10", bevestigdAt: "2026-07-11T09:00:00Z" },
    { adresId: adresA, postcode: "5699ZZ", nummerslug: "1", email: "eigenaar@voorbeeld.nl", token: "optout-a", aangevraagdAt: "2026-07-20" },
  ]);
});

describe("suppressie end-to-end", () => {
  it("onderdrukt een onbevestigde aanvraag niet; een bevestigde zonder cascade wel", async () => {
    // A: alleen aangevraagd, dus overal nog zichtbaar.
    expect(await suppression.isSuppressed("5699ZZ", "1")).toBe(false);
    // C: bevestigd, status in de database nog "actief", maar toch overal weg.
    expect(await suppression.isSuppressed("5699ZZ", "5")).toBe(true);
    const c = (await db.select().from(schema.addresses).where(eq(schema.addresses.id, adresC)).limit(1))[0];
    expect(c!.status).toBe("actief");

    const labels = await zoekApiLabels("Suppressiestraat");
    expect(labels.some((l) => l.startsWith("Suppressiestraat 1,"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Suppressiestraat 3,"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Suppressiestraat 5,"))).toBe(false);
  });

  it("maakt het adres na bevestiging en cascade onvindbaar via alle leespaden", async () => {
    await db.update(schema.optouts).set({ bevestigdAt: "2026-07-22T08:00:00Z" }).where(eq(schema.optouts.token, "optout-a"));
    await suppression.applyOptoutCascade(adresA);

    expect(await suppression.isSuppressed("5699ZZ", "1")).toBe(true);
    expect(await suppression.isAddressIdSuppressed(adresA)).toBe(true);

    // 1. Zoek-API: op straatnaam en op postcode alleen nog B.
    for (const q of ["Suppressiestraat", "5699ZZ"]) {
      const labels = await zoekApiLabels(q);
      expect(labels).toHaveLength(1);
      expect(labels[0]!.startsWith("Suppressiestraat 3,")).toBe(true);
    }

    // 2. Zoekpagina (lib/zoeken): resultaten en teller tellen A en C niet mee.
    const { resultaten, totaal } = await zoeken.zoekWoningen({ ...LEGE_FILTERS });
    expect(resultaten.map((r) => r.id)).toEqual([adresB]);
    expect(totaal).toBe(1);

    // 3. Vergelijken: gesupprimeerde sleutels worden stil overgeslagen.
    const vergelijk = await zoeken.getVergelijkWoningen("5699zz-1,5699zz-3,5699zz-5");
    expect(vergelijk.map((w) => w.adres.id)).toEqual([adresB]);

    // 4. Homepage: woningen-rij en voorbeeldwoning slaan A en C over. C heeft
    // de laagste id en status "actief", dus de preview bewijst hier het
    // isSuppressed-pad, niet de status-kolom.
    const rij = await homepage.getWoningenRij();
    expect(rij.map((w) => w.id)).toEqual([adresB]);
    const voorbeeld = await homepage.getVoorbeeldWoning();
    expect(voorbeeld).not.toBeNull();
    expect(voorbeeld!.adres.id).toBe(adresB);

    // 5. Woningmarkt (plaatspagina): woningen met waarde en recente verkopen.
    const metWaarde = await woningmarkt.woningenMetWaarde("GM0900");
    expect(metWaarde.map((w) => w.adresId)).toEqual([adresB]);
    const verkopenPlaats = await woningmarkt.recenteVerkopenVanPlaats("GM0900");
    expect(verkopenPlaats.map((v) => v.prijs).sort()).toEqual([350000, 410000]);
    expect(verkopenPlaats.every((v) => v.adresId === null || v.adresId === adresB)).toBe(true);

    // 6. Buurtpagina: zelfde regels op buurtniveau.
    const verkopenBuurt = await buurtData.recenteVerkopenInBuurt("BU9");
    expect(verkopenBuurt.map((v) => v.prijs).sort()).toEqual([350000, 410000]);
    const woningenBuurt = await buurtData.woningenInBuurt("BU9");
    expect(woningenBuurt.map((w) => w.adresId)).toEqual([adresB]);
  });

  it("laat her-ingest een gesupprimeerd adres niet opnieuw activeren", async () => {
    const bagRij = (huisnummer: number, nummerslug: string, opp: number) => ({
      bagId: `0900${nummerslug}`,
      straat: "Suppressiestraat",
      huisnummer,
      toevoeging: null,
      nummerslug,
      postcode: "5699ZZ",
      plaats: "Grondel",
      lat: null,
      lon: null,
      bouwjaar: 1990,
      oppervlakteM2: opp,
      woningtype: "tussenwoning" as const,
      energielabel: "C",
    });

    // A (cascade gedraaid) en C (alleen bevestigd): allebei onderdrukt.
    expect(await upsert.upsertAdres(bagRij(1, "1", 110), "BU9")).toBe("onderdrukt");
    expect(await upsert.upsertAdres(bagRij(5, "5", 105), "BU9")).toBe("onderdrukt");
    // B bestaat al: de bestaande rij blijft onaangeraakt.
    expect(await upsert.upsertAdres(bagRij(3, "3", 100), "BU9")).toBe("bestond_al");
    // Een nieuw, niet-onderdrukt adres komt gewoon binnen.
    expect(await upsert.upsertAdres(bagRij(7, "7", 95), "BU9")).toBe("toegevoegd");

    // A is niet teruggezet op actief en niet opnieuw aangemaakt; B hield de
    // oorspronkelijke bron (seed, niet de bag-rij van de her-ingest).
    const a = (await db.select().from(schema.addresses).where(eq(schema.addresses.id, adresA)).limit(1))[0];
    expect(a!.status).toBe("opted_out");
    const b = (await db.select().from(schema.addresses).where(eq(schema.addresses.id, adresB)).limit(1))[0];
    expect(b!.bron).toBe("seed");

    // Na de her-ingest tonen de leespaden B en het nieuwe adres, nooit A of C.
    const labels = await zoekApiLabels("Suppressiestraat");
    expect(labels.some((l) => l.startsWith("Suppressiestraat 3,"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Suppressiestraat 7,"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Suppressiestraat 1,"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Suppressiestraat 5,"))).toBe(false);
  });

  it("zet met de cascade claims, alerts en deel-rapporten dicht en mailt de claimer", async () => {
    const claim = (await db.select().from(schema.claims).where(eq(schema.claims.adresId, adresA)).limit(1))[0];
    expect(claim!.endedAt).not.toBeNull();

    const alert = (await db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, claim!.id)).limit(1))[0];
    expect(alert!.actief).toBe(false);

    const rapport = (await db.select().from(schema.sharedReports).where(eq(schema.sharedReports.adresId, adresA)).limit(1))[0];
    expect(rapport!.revokedAt).not.toBeNull();

    const mail = (await db.select().from(schema.emailsOutbox)).find((m) => m.type === "claim_beeindigd");
    expect(mail).toBeDefined();
    expect(mail!.to).toBe("eigenaar@voorbeeld.nl");
    expect(mail!.status).toBe("queued");
  });

  // Bevinding voor de integrator, hier gedocumenteerd omdat dit bestand de
  // suppressie-dekking bewaakt: lib/comparables (findComparables) selecteert
  // verkopen alleen op buurt, venster, type en oppervlakte, en filtert
  // kadaster-verkopen van gesupprimeerde adressen NIET. De toonpaden
  // (buurt/woningmarkt) filteren wel, maar de verkoopprijs van een opted-out
  // adres blijft zo meewegen in schattingen van buren en de sale-id belandt in
  // valuations.inputs_json. Beleidsvraag: valt "meewegen in een aggregaat"
  // onder de verwijderbelofte? Zo ja, dan hoort in findComparables dezelfde
  // isAddressIdSuppressed-check als in recenteVerkopenInBuurt.
  it.todo("findComparables laat kadaster-verkopen van gesupprimeerde adressen meewegen (beleidsvraag, zie comment)");
});
