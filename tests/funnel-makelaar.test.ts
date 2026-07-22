import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let leadsLib: typeof import("@/lib/leads");
let leadwaardeLib: typeof import("@/lib/config/leadwaarde");
let verkopenTeksten: typeof import("@/app/verkopen/consent-teksten");
let taxatieTeksten: typeof import("@/app/taxatierapport/consent-teksten");
let eq: typeof import("drizzle-orm").eq;

let adresId: number;

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  leadsLib = await import("@/lib/leads");
  leadwaardeLib = await import("@/lib/config/leadwaarde");
  verkopenTeksten = await import("@/app/verkopen/consent-teksten");
  taxatieTeksten = await import("@/app/taxatierapport/consent-teksten");
  ({ eq } = await import("drizzle-orm"));

  db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" }).run();
  db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" }).run();
  adresId = db
    .insert(schema.addresses)
    .values({
      straat: "Funnelstraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
      buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 120, woningtype: "tussenwoning", energielabel: "C",
      energielabelBron: "indicatie", bron: "seed", status: "actief",
    })
    .returning({ id: schema.addresses.id })
    .get().id;
});

describe("createLead via funnel:verkopen (makelaar)", () => {
  it("maakt lead + consent + event + bevestigingsmail met de juiste leadwaarde", () => {
    const { leadId } = leadsLib.createLead({
      type: "makelaar",
      adresId,
      email: "verkoper@voorbeeld.nl",
      antwoorden: { termijn: "Binnen 3 maanden", reden: "Ik wil groter wonen", alMakelaarGesproken: false },
      consentTekst: verkopenTeksten.consentTekstversie(),
      bron: "funnel:verkopen",
      partijType: "een lokale verkoopmakelaar",
      adresNaam: "Funnelstraat 12, Test",
    });

    const lead = db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).get();
    expect(lead).toBeDefined();
    expect(lead!.type).toBe("makelaar");
    expect(lead!.subtype).toBeNull();
    expect(lead!.status).toBe("nieuw");
    expect(lead!.adresId).toBe(adresId);
    // Leadwaarde uit lib/config/leadwaarde: makelaarslead, status nieuw.
    expect(lead!.estValueEur).toBe(leadwaardeLib.leadwaarde("makelaar", null, "nieuw"));
    expect(lead!.estValueEur).toBe(75);
    expect(JSON.parse(lead!.antwoordenJson)).toEqual({
      termijn: "Binnen 3 maanden",
      reden: "Ik wil groter wonen",
      alMakelaarGesproken: false,
    });
    expect(lead!.retentieTot > lead!.createdAt).toBe(true); // retentie ligt in de toekomst

    // AVG art. 7: consent met letterlijke, geversioneerde tekst en bron.
    expect(lead!.consentId).not.toBeNull();
    const consent = db.select().from(schema.consents).where(eq(schema.consents.id, lead!.consentId!)).get();
    expect(consent).toBeDefined();
    expect(consent!.doel).toBe("lead_doorgifte");
    expect(consent!.bron).toBe("funnel:verkopen");
    expect(consent!.tekstversie.startsWith("verkopen-v1:")).toBe(true);
    expect(consent!.tekstversie).toContain(verkopenTeksten.CONSENT_TEKST);
    expect(consent!.email).toBe("verkoper@voorbeeld.nl");
    expect(consent!.revokedAt).toBeNull();

    const events = db.select().from(schema.leadEvents).where(eq(schema.leadEvents.leadId, leadId)).all();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("aangemaakt");

    // Bevestigingsmail benoemt het type partij en de testfase.
    const mail = db.select().from(schema.emailsOutbox).all().find((m) => m.to === "verkoper@voorbeeld.nl");
    expect(mail).toBeDefined();
    expect(mail!.type).toBe("lead_bevestiging");
    expect(mail!.html).toContain("een lokale verkoopmakelaar");
    expect(mail!.html).toContain("Funnelstraat 12, Test");
    expect(mail!.html).toContain("testfase");
  });
});

describe("createLead via funnel:taxatierapport (taxatie)", () => {
  it("maakt lead + consent + event + bevestigingsmail met de juiste leadwaarde", () => {
    const { leadId } = leadsLib.createLead({
      type: "taxatie",
      adresId,
      email: "taxatie@voorbeeld.nl",
      antwoorden: { gewenstMoment: "Zo snel mogelijk" },
      consentTekst: taxatieTeksten.consentTekstversie(),
      bron: "funnel:taxatierapport",
      partijType: "een gecertificeerde taxateur",
      adresNaam: "Funnelstraat 12, Test",
    });

    const lead = db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).get();
    expect(lead).toBeDefined();
    expect(lead!.type).toBe("taxatie");
    expect(lead!.status).toBe("nieuw");
    expect(lead!.adresId).toBe(adresId);
    expect(lead!.estValueEur).toBe(leadwaardeLib.leadwaarde("taxatie", null, "nieuw"));
    expect(lead!.estValueEur).toBe(25);
    expect(JSON.parse(lead!.antwoordenJson)).toEqual({ gewenstMoment: "Zo snel mogelijk" });

    const consent = db.select().from(schema.consents).where(eq(schema.consents.id, lead!.consentId!)).get();
    expect(consent).toBeDefined();
    expect(consent!.doel).toBe("lead_doorgifte");
    expect(consent!.bron).toBe("funnel:taxatierapport");
    expect(consent!.tekstversie.startsWith("taxatie-v1:")).toBe(true);
    expect(consent!.tekstversie).toContain(taxatieTeksten.CONSENT_TEKST);

    const events = db.select().from(schema.leadEvents).where(eq(schema.leadEvents.leadId, leadId)).all();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("aangemaakt");

    const mail = db.select().from(schema.emailsOutbox).all().find((m) => m.to === "taxatie@voorbeeld.nl");
    expect(mail).toBeDefined();
    expect(mail!.type).toBe("lead_bevestiging");
    expect(mail!.html).toContain("een gecertificeerde taxateur");
    expect(mail!.html).toContain("testfase");
  });
});

describe("suppressie", () => {
  it("weigert een lead voor een gesuppresseerd adres en laat geen sporen achter", () => {
    const suppressedId = db
      .insert(schema.addresses)
      .values({
        straat: "Wegstraat", huisnummer: 9, toevoeging: null, nummerslug: "9", postcode: "5611ZZ", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1975, oppervlakteM2: 80, woningtype: "appartement", energielabel: "D",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
      .get().id;
    db.insert(schema.optouts)
      .values({
        adresId: suppressedId, postcode: "5611ZZ", nummerslug: "9", token: "optout-funnel-test",
        aangevraagdAt: "2026-07-22", bevestigdAt: "2026-07-22T10:00:00Z",
      })
      .run();

    expect(() =>
      leadsLib.createLead({
        type: "makelaar",
        adresId: suppressedId,
        email: "geweigerd@voorbeeld.nl",
        antwoorden: {},
        consentTekst: verkopenTeksten.consentTekstversie(),
        bron: "funnel:verkopen",
        partijType: "een lokale verkoopmakelaar",
      }),
    ).toThrow();

    const leadRijen = db.select().from(schema.leads).where(eq(schema.leads.email, "geweigerd@voorbeeld.nl")).all();
    expect(leadRijen).toHaveLength(0);
    const consentRijen = db.select().from(schema.consents).where(eq(schema.consents.email, "geweigerd@voorbeeld.nl")).all();
    expect(consentRijen).toHaveLength(0);
    const mail = db.select().from(schema.emailsOutbox).all().find((m) => m.to === "geweigerd@voorbeeld.nl");
    expect(mail).toBeUndefined();
  });
});

describe("leadwaarde-config (verdienmodel)", () => {
  it("volgt lib/config/leadwaarde voor makelaar en taxatie per status", () => {
    expect(leadwaardeLib.leadwaarde("makelaar", null, "nieuw")).toBe(75);
    expect(leadwaardeLib.leadwaarde("makelaar", null, "gekwalificeerd")).toBe(150);
    expect(leadwaardeLib.leadwaarde("makelaar", null, "doorgestuurd")).toBe(150);
    expect(leadwaardeLib.leadwaarde("makelaar", null, "gesloten")).toBe(500);
    expect(leadwaardeLib.leadwaarde("makelaar", null, "afgewezen")).toBe(0);
    expect(leadwaardeLib.leadwaarde("taxatie", null, "nieuw")).toBe(25);
    expect(leadwaardeLib.leadwaarde("taxatie", null, "gekwalificeerd")).toBe(50);
    expect(leadwaardeLib.leadwaarde("taxatie", null, "gesloten")).toBe(75);
  });
});
