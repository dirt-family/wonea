import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let logic: typeof import("@/app/admin/leads/logic");
let maakLead: typeof import("@/lib/leads").createLead;
let leadwaarde: typeof import("@/lib/config/leadwaarde").leadwaarde;
let eq: typeof import("drizzle-orm").eq;

let leadId: number;

const OUDE_RETENTIE = "2026-01-01T00:00:00.000Z";

function isoOverMaanden(maanden: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + maanden);
  return d.toISOString();
}

function haalLead(id: number) {
  return db.select().from(schema.leads).where(eq(schema.leads.id, id)).get()!;
}

function eventsVan(id: number) {
  return db.select().from(schema.leadEvents).where(eq(schema.leadEvents.leadId, id)).all();
}

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  logic = await import("@/app/admin/leads/logic");
  ({ createLead: maakLead } = await import("@/lib/leads"));
  ({ leadwaarde } = await import("@/lib/config/leadwaarde"));
  ({ eq } = await import("drizzle-orm"));

  // Lead via het enige toegestane pad (lib/leads.createLead), zonder adres.
  ({ leadId } = maakLead({
    type: "hypotheek",
    subtype: "oversluiten",
    email: "adminlead@voorbeeld.nl",
    antwoorden: { rentevast_tot: "2027-01-01", restant: 250000 },
    consentTekst: "hypotheek-v1: testconsent",
    bron: "test:admin",
    partijType: "een onafhankelijk hypotheekadviseur",
  }));
});

describe("wijzigLeadStatus", () => {
  it("werkt status en geschatte waarde bij en logt een gebeurtenis met tijdstempel", () => {
    // Sentinel zodat we kunnen bewijzen dat de retentie NIET verschuift.
    db.update(schema.leads).set({ retentieTot: OUDE_RETENTIE }).where(eq(schema.leads.id, leadId)).run();

    const resultaat = logic.wijzigLeadStatus(leadId, "gekwalificeerd");
    expect(resultaat.ok).toBe(true);

    const lead = haalLead(leadId);
    expect(lead.status).toBe("gekwalificeerd");
    expect(lead.estValueEur).toBe(leadwaarde("hypotheek", "oversluiten", "gekwalificeerd"));
    // Niet-eindstatus: bewaartermijn blijft staan.
    expect(lead.retentieTot).toBe(OUDE_RETENTIE);

    const events = eventsVan(leadId);
    const wijziging = events.find((e) => e.event === "status: nieuw -> gekwalificeerd");
    expect(wijziging).toBeDefined();
    expect(wijziging!.ts).toBeTruthy();
  });

  it("registreert bij gesloten de succes-fee-waarde en ververst de bewaartermijn", () => {
    const resultaat = logic.wijzigLeadStatus(leadId, "gesloten");
    expect(resultaat.ok).toBe(true);

    const lead = haalLead(leadId);
    expect(lead.status).toBe("gesloten");
    expect(lead.estValueEur).toBe(leadwaarde("hypotheek", "oversluiten", "gesloten"));
    // Retentie opnieuw gestart: nu plus 12 maanden (ruime marges rond de klok).
    expect(lead.retentieTot > isoOverMaanden(11)).toBe(true);
    expect(lead.retentieTot < isoOverMaanden(13)).toBe(true);
  });

  it("zet bij afgewezen de waarde op nul en ververst de bewaartermijn", () => {
    const { leadId: tweedeId } = maakLead({
      type: "verduurzaming",
      subtype: "warmtepomp",
      email: "afgewezen@voorbeeld.nl",
      antwoorden: { woningtype: "tussenwoning" },
      consentTekst: "verduurzaming-v1: testconsent",
      bron: "test:admin",
      partijType: "een lokale installateur",
    });
    db.update(schema.leads).set({ retentieTot: OUDE_RETENTIE }).where(eq(schema.leads.id, tweedeId)).run();

    const resultaat = logic.wijzigLeadStatus(tweedeId, "afgewezen");
    expect(resultaat.ok).toBe(true);

    const lead = haalLead(tweedeId);
    expect(lead.status).toBe("afgewezen");
    expect(lead.estValueEur).toBe(0);
    expect(lead.retentieTot > isoOverMaanden(11)).toBe(true);
  });

  it("logt geen dubbele gebeurtenis als de status niet verandert", () => {
    const voor = eventsVan(leadId).length;
    const resultaat = logic.wijzigLeadStatus(leadId, "gesloten"); // is al gesloten
    expect(resultaat.ok).toBe(true);
    expect(eventsVan(leadId)).toHaveLength(voor);
  });

  it("weigert een onbekende lead zonder iets te wijzigen", () => {
    const resultaat = logic.wijzigLeadStatus(999999, "gesloten");
    expect(resultaat.ok).toBe(false);
  });
});
