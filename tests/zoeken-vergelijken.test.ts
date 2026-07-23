import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";
import { annuiteitMaandlast, TOETS_LOOPTIJD_MAANDEN } from "@/lib/hypotheek";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let zoeken: typeof import("@/lib/zoeken");

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  zoeken = await import("@/lib/zoeken");

  await db.insert(schema.municipalities).values([
    { code: "GM0001", naam: "Veldhoven", slug: "veldhoven" },
    { code: "GM0002", naam: "Best", slug: "best" },
  ]);
  await db.insert(schema.neighborhoods).values([
    // BU1 met buurt-anker: schattingen mogelijk. BU2 bewust zonder anker.
    { buurtCode: "BU1", naam: "Dorp", slug: "dorp", gemeenteCode: "GM0001", ankerM2Prijs: 3400 },
    { buurtCode: "BU2", naam: "Kerkbuurt", slug: "kerkbuurt", gemeenteCode: "GM0002" },
  ]);

  const adressen = await db
    .insert(schema.addresses)
    .values([
      {
        straat: "Dorpstraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Veldhoven",
        buurtCode: "BU1", bouwjaar: 1975, oppervlakteM2: 110, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      },
      {
        straat: "Dorpstraat", huisnummer: 14, toevoeging: null, nummerslug: "14", postcode: "5611AB", plaats: "Veldhoven",
        buurtCode: "BU1", bouwjaar: 2018, oppervlakteM2: 65, woningtype: "appartement", energielabel: "A",
        energielabelBron: "echt", bron: "seed", status: "actief",
      },
      {
        straat: "Kerkweg", huisnummer: 3, toevoeging: null, nummerslug: "3", postcode: "5612CD", plaats: "Best",
        buurtCode: "BU2", bouwjaar: 1955, oppervlakteM2: 180, woningtype: "vrijstaand", energielabel: "F",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      },
      // Gesupprimeerd adres: status nog actief, maar bevestigde opt-out.
      // Test bewust het isSuppressed-pad, niet de status-kolom.
      {
        straat: "Dorpstraat", huisnummer: 16, toevoeging: null, nummerslug: "16", postcode: "5611AB", plaats: "Veldhoven",
        buurtCode: "BU1", bouwjaar: 1980, oppervlakteM2: 120, woningtype: "hoekwoning", energielabel: "B",
        energielabelBron: "echt", bron: "seed", status: "actief",
      },
    ])
    .returning({ id: schema.addresses.id, nummerslug: schema.addresses.nummerslug });

  const onderdrukt = adressen.find((a) => a.nummerslug === "16")!;
  await db.insert(schema.optouts).values({
    adresId: onderdrukt.id, postcode: "5611AB", nummerslug: "16", token: "test-optout",
    aangevraagdAt: "2026-07-01", bevestigdAt: "2026-07-02T10:00:00Z",
  });

  const adres12 = adressen.find((a) => a.nummerslug === "12")!;
  await db.insert(schema.wozValues).values({ adresId: adres12.id, peiljaar: 2025, waarde: 340000, bron: "seed" });
});

/* ------------------------------------------------------------------------- */
/* parseZoekFilters                                                           */
/* ------------------------------------------------------------------------- */

describe("parseZoekFilters", () => {
  it("parset geldige waarden", () => {
    const f = zoeken.parseZoekFilters({ q: "Dorpstraat", woningtype: "appartement", energielabel: "a", minOppervlak: "100", gemeente: "Veldhoven" });
    expect(f).toEqual({ q: "Dorpstraat", woningtype: "appartement", energielabel: "A", minOppervlak: 100, gemeente: "veldhoven" });
  });

  it("negeert ongeldige waarden stil", () => {
    const f = zoeken.parseZoekFilters({
      q: "x", // te kort
      woningtype: "kasteel",
      energielabel: "Z",
      minOppervlak: "-5",
      gemeente: "geen geldige slug!",
    });
    expect(f).toEqual({ q: null, woningtype: null, energielabel: null, minOppervlak: null, gemeente: null });
  });

  it("pakt bij herhaalde parameters de eerste en kapt lange zoektermen af", () => {
    const f = zoeken.parseZoekFilters({ q: ["Kerkweg", "iets anders"], minOppervlak: ["150", "999"] });
    expect(f.q).toBe("Kerkweg");
    expect(f.minOppervlak).toBe(150);
    expect(zoeken.parseZoekFilters({ q: "a".repeat(200) }).q).toHaveLength(80);
  });
});

/* ------------------------------------------------------------------------- */
/* zoekWoningen                                                               */
/* ------------------------------------------------------------------------- */

describe("zoekWoningen", () => {
  it("vindt op straatnaam, hoofdletterongevoelig (ilike), zonder gesupprimeerde adressen", async () => {
    const { resultaten, totaal } = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ q: "dorpstraat" }));
    expect(totaal).toBe(2);
    expect(resultaten.map((r) => r.nummerslug).sort()).toEqual(["12", "14"]);
    expect(resultaten.every((r) => r.nummerslug !== "16")).toBe(true);
  });

  it("vindt op postcode met spatie en op plaatsnaam", async () => {
    const opPostcode = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ q: "5612 cd" }));
    expect(opPostcode.resultaten.map((r) => r.straat)).toEqual(["Kerkweg"]);

    const opPlaats = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ q: "veldhoven" }));
    expect(opPlaats.totaal).toBe(2);
  });

  it("vindt op straat plus huisnummer", async () => {
    const { resultaten } = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ q: "Dorpstraat 14" }));
    expect(resultaten).toHaveLength(1);
    expect(resultaten[0].nummerslug).toBe("14");
  });

  it("filtert op woningtype, energielabel, minimale oppervlakte en gemeente", async () => {
    const opType = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ woningtype: "appartement" }));
    expect(opType.resultaten.map((r) => r.nummerslug)).toEqual(["14"]);

    const opLabel = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ energielabel: "A" }));
    expect(opLabel.resultaten.map((r) => r.nummerslug)).toEqual(["14"]);

    const opOppervlak = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ minOppervlak: "150" }));
    expect(opOppervlak.resultaten.map((r) => r.straat)).toEqual(["Kerkweg"]);

    const opGemeente = await zoeken.zoekWoningen(zoeken.parseZoekFilters({ gemeente: "best" }));
    expect(opGemeente.resultaten.map((r) => r.straat)).toEqual(["Kerkweg"]);
  });

  it("geeft zonder filters alle actieve, niet-gesupprimeerde adressen met teller en slug", async () => {
    const { resultaten, totaal } = await zoeken.zoekWoningen(zoeken.parseZoekFilters({}));
    expect(totaal).toBe(3);
    expect(resultaten).toHaveLength(3);
    const dorp12 = resultaten.find((r) => r.nummerslug === "12")!;
    expect(dorp12.slug).toBe("5611ab-12");
    // Nog geen valuation-rijen aangemaakt: waarde eerlijk null, niet verzonnen.
    expect(dorp12.waarde).toBeNull();
  });

  it("respecteert de resultaat-limiet", async () => {
    const { resultaten, totaal } = await zoeken.zoekWoningen(zoeken.parseZoekFilters({}), 2);
    expect(resultaten).toHaveLength(2);
    expect(totaal).toBe(3);
  });
});

/* ------------------------------------------------------------------------- */
/* parseVergelijkParam                                                        */
/* ------------------------------------------------------------------------- */

describe("parseVergelijkParam", () => {
  it("parset slugs naar postcode plus nummerslug, ook met streepje in de nummerslug", () => {
    expect(zoeken.parseVergelijkParam("5611ab-12,5612cd-12-2")).toEqual([
      { postcode: "5611AB", nummerslug: "12" },
      { postcode: "5612CD", nummerslug: "12-2" },
    ]);
  });

  it("slaat ongeldige delen stil over en ontdubbelt", () => {
    expect(zoeken.parseVergelijkParam("onzin,5611ab-12,0611ab-9,5611ab-12,,../etc")).toEqual([
      { postcode: "5611AB", nummerslug: "12" },
    ]);
  });

  it("kapt af op 3 woningen en geeft lege lijst zonder parameter", () => {
    expect(zoeken.parseVergelijkParam("5611ab-1,5611ab-2,5611ab-3,5611ab-4")).toHaveLength(3);
    expect(zoeken.parseVergelijkParam(undefined)).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- */
/* getVergelijkWoningen en maandlast                                          */
/* ------------------------------------------------------------------------- */

describe("getVergelijkWoningen", () => {
  it("slaat onbekende en gesupprimeerde slugs stil over", async () => {
    const woningen = await zoeken.getVergelijkWoningen("9999zz-1,5611ab-16,5611ab-12");
    expect(woningen).toHaveLength(1);
    expect(woningen[0].naam).toBe("Dorpstraat 12");
  });

  it("levert per woning echte waarde, woz, prijs per m2 en maandlast; zonder anker eerlijk null", async () => {
    const woningen = await zoeken.getVergelijkWoningen("5611ab-12,5612cd-3");
    expect(woningen.map((won) => won.naam)).toEqual(["Dorpstraat 12", "Kerkweg 3"]);

    const [dorp, kerk] = woningen;
    // BU1 heeft een buurt-anker: er ontstaat een schatting via hetzelfde pad
    // als de woningpagina (getOrCreateValuation).
    expect(dorp.valuation).not.toBeNull();
    expect(dorp.valuation!.waarde).toBeGreaterThan(0);
    expect(dorp.valuation!.intervalLaag).toBeLessThan(dorp.valuation!.intervalHoog);
    expect(dorp.woz).toEqual({ waarde: 340000, peiljaar: 2025, bron: "seed" });
    expect(dorp.prijsPerM2).toBe(Math.round(dorp.valuation!.waarde / 110));

    const rente = zoeken.dnbIndicatieRente();
    expect(rente).not.toBeNull();
    expect(dorp.maandlast).toBe(Math.round(annuiteitMaandlast(dorp.valuation!.waarde, rente!.pct, TOETS_LOOPTIJD_MAANDEN)));

    // BU2 heeft geen anker en geen verkopen: geen schatting, dus overal null.
    expect(kerk.valuation).toBeNull();
    expect(kerk.prijsPerM2).toBeNull();
    expect(kerk.maandlast).toBeNull();
    expect(kerk.woz).toBeNull();
  });
});

describe("indicatieveMaandlast", () => {
  it("rekent met de DNB-rente, 30 jaar annuitair, afgerond op hele euro's", () => {
    const rente = zoeken.dnbIndicatieRente();
    expect(rente).not.toBeNull();
    expect(rente!.pct).toBeGreaterThan(0);
    expect(rente!.peilmaand).toMatch(/\d{4}/);
    expect(zoeken.indicatieveMaandlast(300_000)).toBe(Math.round(annuiteitMaandlast(300_000, rente!.pct, TOETS_LOOPTIJD_MAANDEN)));
  });

  it("stijgt met het bedrag", () => {
    expect(zoeken.indicatieveMaandlast(400_000)!).toBeGreaterThan(zoeken.indicatieveMaandlast(300_000)!);
  });
});

/* ------------------------------------------------------------------------- */
/* watValtOp                                                                  */
/* ------------------------------------------------------------------------- */

describe("watValtOp", () => {
  const groot = { naam: "Kerkweg 3", oppervlakteM2: 180, bouwjaar: 1955, energielabel: "F", prijsPerM2: 2800 };
  const klein = { naam: "Dorpstraat 14", oppervlakteM2: 65, bouwjaar: 2018, energielabel: "A", prijsPerM2: 5200 };

  it("benoemt feitelijke verschillen in gewone taal", () => {
    const zinnen = zoeken.watValtOp([groot, klein]);
    expect(zinnen).toContain("Kerkweg 3 is met 180 m2 de grootste, Dorpstraat 14 met 65 m2 de kleinste.");
    expect(zinnen).toContain("Dorpstraat 14 heeft het zuinigste energielabel (A).");
    expect(zinnen.some((z) => z.startsWith("Dorpstraat 14 heeft de hoogste prijs per vierkante meter"))).toBe(true);
    expect(zinnen).toContain("Dorpstraat 14 is het nieuwst (bouwjaar 2018), Kerkweg 3 het oudst (bouwjaar 1955).");
  });

  it("zwijgt waar data ontbreekt of gelijk is", () => {
    // Identieke woningen: niets te melden.
    expect(zoeken.watValtOp([groot, { ...groot, naam: "Kopie" }])).toEqual([]);
    // Ontbrekend label of m2-prijs bij 1 woning: die vergelijking vervalt.
    const zonderLabel = zoeken.watValtOp([groot, { ...klein, energielabel: null, prijsPerM2: null }]);
    expect(zonderLabel.some((z) => z.includes("energielabel"))).toBe(false);
    expect(zonderLabel.some((z) => z.includes("vierkante meter"))).toBe(false);
    // Minder dan 2 woningen: lege lijst.
    expect(zoeken.watValtOp([groot])).toEqual([]);
  });
});
