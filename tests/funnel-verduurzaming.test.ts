import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let logic: typeof import("@/app/verduurzamen/logic");
let verticalen: typeof import("@/app/verduurzamen/verticalen");
let leadwaarde: typeof import("@/lib/config/leadwaarde").leadwaarde;
let eq: typeof import("drizzle-orm").eq;

let adresId: number;

const ANTWOORDEN: Record<string, Record<string, unknown>> = {
  zonnepanelen: { dakOrientatie: "zuid", schaduw: "geen", koophuis: "ja" },
  warmtepomp: { huidigeVerwarming: "cv-ketel", isolatiegraad: "matig", bouwjaar: "1962" },
  isolatie: { delen: ["dak", "vloer"], bouwjaar: "1962", koophuis: "ja" },
};

// Verwachte leadwaarde per verticaal bij status "nieuw" (lib/config/leadwaarde.ts).
const VERWACHTE_WAARDE: Record<string, number> = { zonnepanelen: 35, warmtepomp: 50, isolatie: 30 };

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  logic = await import("@/app/verduurzamen/logic");
  verticalen = await import("@/app/verduurzamen/verticalen");
  ({ leadwaarde } = await import("@/lib/config/leadwaarde"));
  ({ eq } = await import("drizzle-orm"));

  db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" }).run();
  db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" }).run();
  adresId = db
    .insert(schema.addresses)
    .values({
      straat: "Labelstraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
      buurtCode: "BU1", bouwjaar: 1962, oppervlakteM2: 120, woningtype: "tussenwoning", energielabel: "F",
      energielabelBron: "indicatie", bron: "seed", status: "actief",
    })
    .returning({ id: schema.addresses.id })
    .get().id;
});

describe("verstuurVerduurzamingsLead", () => {
  for (const verticaal of ["zonnepanelen", "warmtepomp", "isolatie"] as const) {
    it(`maakt een ${verticaal}-lead met juist subtype, juiste leadwaarde en gelogde consent`, () => {
      const resultaat = logic.verstuurVerduurzamingsLead({
        verticaal,
        postcode: "5611 ab", // ruwe invoer: logic normaliseert zelf
        nummer: "12",
        email: `${verticaal}@voorbeeld.nl`,
        antwoorden: ANTWOORDEN[verticaal],
      });
      expect("leadId" in resultaat).toBe(true);
      if (!("leadId" in resultaat)) return;

      const lead = db.select().from(schema.leads).where(eq(schema.leads.id, resultaat.leadId)).get();
      expect(lead).toBeDefined();
      expect(lead!.type).toBe("verduurzaming");
      expect(lead!.subtype).toBe(verticaal);
      expect(lead!.adresId).toBe(adresId);
      expect(lead!.status).toBe("nieuw");
      expect(lead!.email).toBe(`${verticaal}@voorbeeld.nl`);
      // Leadwaarde per verticaal, uit de ene bron van waarheid en als hard bedrag.
      expect(lead!.estValueEur).toBe(leadwaarde("verduurzaming", verticaal, "nieuw"));
      expect(lead!.estValueEur).toBe(VERWACHTE_WAARDE[verticaal]);
      expect(JSON.parse(lead!.antwoordenJson)).toMatchObject(
        verticaal === "zonnepanelen" ? ANTWOORDEN[verticaal] : { bouwjaar: 1962 },
      );

      // AVG art. 7: consent-rij met letterlijke tekstversie, doel en bron.
      expect(lead!.consentId).not.toBeNull();
      const consent = db.select().from(schema.consents).where(eq(schema.consents.id, lead!.consentId!)).get();
      expect(consent).toBeDefined();
      expect(consent!.doel).toBe("lead_doorgifte");
      expect(consent!.bron).toBe("funnel:verduurzamen");
      expect(consent!.email).toBe(`${verticaal}@voorbeeld.nl`);
      expect(consent!.tekstversie).toBe(verticalen.consentTekstversie());
      expect(consent!.tekstversie).toContain("verduurzamen-v1");
      expect(consent!.tekstversie).toContain(verticalen.CONSENT_TEKST);
      expect(consent!.tekstversie).toContain("maximaal twee gecertificeerde installatiebedrijven uit de regio");
      expect(consent!.revokedAt).toBeNull();
    });
  }

  it("weigert ongeldige antwoorden zonder een lead of consent aan te maken", () => {
    const leadsVoor = db.select().from(schema.leads).all().length;
    const consentsVoor = db.select().from(schema.consents).all().length;

    const resultaat = logic.verstuurVerduurzamingsLead({
      verticaal: "zonnepanelen",
      postcode: "5611AB",
      nummer: "12",
      email: "fout@voorbeeld.nl",
      antwoorden: { dakOrientatie: "zuid", schaduw: "vol-in-de-zon", koophuis: "ja" },
    });
    expect(resultaat).toEqual({ fout: "antwoorden" });

    // Isolatie zonder gekozen delen is ook ongeldig (min 1).
    const leeg = logic.verstuurVerduurzamingsLead({
      verticaal: "isolatie",
      postcode: "5611AB",
      nummer: "12",
      email: "fout@voorbeeld.nl",
      antwoorden: { delen: [], bouwjaar: "1962", koophuis: "ja" },
    });
    expect(leeg).toEqual({ fout: "antwoorden" });

    expect(db.select().from(schema.leads).all().length).toBe(leadsVoor);
    expect(db.select().from(schema.consents).all().length).toBe(consentsVoor);
  });

  it("weigert een onbekend adres", () => {
    const resultaat = logic.verstuurVerduurzamingsLead({
      verticaal: "warmtepomp",
      postcode: "9999ZZ",
      nummer: "1",
      email: "niemand@voorbeeld.nl",
      antwoorden: ANTWOORDEN.warmtepomp,
    });
    expect(resultaat).toEqual({ fout: "adres" });
  });

  it("weigert een gesuppresseerd adres (opt-out is leidend)", () => {
    const suppressedId = db
      .insert(schema.addresses)
      .values({
        straat: "Wegstraat", huisnummer: 3, toevoeging: null, nummerslug: "3", postcode: "5611EF", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1970, oppervlakteM2: 95, woningtype: "hoekwoning", energielabel: "E",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
      .get().id;
    db.insert(schema.optouts)
      .values({
        adresId: suppressedId, postcode: "5611EF", nummerslug: "3", token: "optout-funnel-test",
        aangevraagdAt: "2026-07-22", bevestigdAt: "2026-07-22T10:00:00Z",
      })
      .run();

    const resultaat = logic.verstuurVerduurzamingsLead({
      verticaal: "isolatie",
      postcode: "5611EF",
      nummer: "3",
      email: "optout@voorbeeld.nl",
      antwoorden: ANTWOORDEN.isolatie,
    });
    expect(resultaat).toEqual({ fout: "adres" });

    const leadsVoorAdres = db.select().from(schema.leads).all().filter((l) => l.adresId === suppressedId);
    expect(leadsVoorAdres).toHaveLength(0);
  });

  it("zet een bevestigingsmail in de outbox die het partijtype en de testfase noemt", () => {
    const mail = db
      .select()
      .from(schema.emailsOutbox)
      .all()
      .find((m) => m.type === "lead_bevestiging" && m.to === "zonnepanelen@voorbeeld.nl");
    expect(mail).toBeDefined();
    expect(mail!.subject).toBe("Je verduurzamings-aanvraag bij Wonea");
    expect(mail!.html).toContain("maximaal twee gecertificeerde installatiebedrijven uit de regio");
    expect(mail!.html).toContain("Labelstraat 12, Test");
    expect(mail!.html.toLowerCase()).toContain("testfase");
  });
});
