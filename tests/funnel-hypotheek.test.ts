import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let leadsLib: typeof import("@/lib/leads");
let consentTekst: typeof import("@/app/hypotheek/consent-tekst");
let funnelSchema: typeof import("@/app/hypotheek/schema");
let leadwaardeConfig: typeof import("@/lib/config/leadwaarde");
let eq: typeof import("drizzle-orm").eq;

let adresId: number;

/** Precies zoals app/hypotheek/actions.ts createLead aanroept. */
function maakAanvraag(input: {
  subtype: "overwaarde" | "oversluiten" | "aankoop";
  email: string;
  adresId?: number | null;
  adresNaam?: string | null;
  antwoorden: Record<string, unknown>;
}) {
  return leadsLib.createLead({
    type: "hypotheek",
    subtype: input.subtype,
    adresId: input.adresId ?? null,
    userId: null,
    email: input.email,
    antwoorden: input.antwoorden,
    consentTekst: consentTekst.hypotheekConsentTekstversie(),
    bron: "funnel:hypotheek",
    partijType: consentTekst.HYPOTHEEK_PARTIJ_TYPE,
    adresNaam: input.adresNaam ?? null,
  });
}

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  leadsLib = await import("@/lib/leads");
  consentTekst = await import("@/app/hypotheek/consent-tekst");
  funnelSchema = await import("@/app/hypotheek/schema");
  leadwaardeConfig = await import("@/lib/config/leadwaarde");
  ({ eq } = await import("drizzle-orm"));

  db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" }).run();
  db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" }).run();
  adresId = db
    .insert(schema.addresses)
    .values({
      straat: "Hypotheekstraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
      buurtCode: "BU1", bouwjaar: 1998, oppervlakteM2: 120, woningtype: "tussenwoning", energielabel: "C",
      energielabelBron: "indicatie", bron: "seed", status: "actief",
    })
    .returning({ id: schema.addresses.id })
    .get().id;
});

describe("hypotheekfunnel via createLead", () => {
  it("maakt lead, consent, event en bevestigingsmail aan met juiste subtype en leadwaarde", () => {
    const email = "oversluiter@voorbeeld.nl";
    const { leadId } = maakAanvraag({
      subtype: "oversluiten",
      email,
      adresId,
      adresNaam: "Hypotheekstraat 12, Test",
      antwoorden: { rentevastTot: "2027-03", huidigeRentePct: 3.9, restschuld: 285000 },
    });

    const lead = db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).get();
    expect(lead).toBeDefined();
    expect(lead!.type).toBe("hypotheek");
    expect(lead!.subtype).toBe("oversluiten");
    expect(lead!.status).toBe("nieuw");
    expect(lead!.adresId).toBe(adresId);
    expect(lead!.email).toBe(email);
    expect(lead!.retentieTot > lead!.createdAt).toBe(true);
    // Leadwaarde uit lib/config/leadwaarde.ts, status "nieuw".
    expect(lead!.estValueEur).toBe(leadwaardeConfig.leadwaarde("hypotheek", "oversluiten", "nieuw"));
    expect(JSON.parse(lead!.antwoordenJson)).toEqual({ rentevastTot: "2027-03", huidigeRentePct: 3.9, restschuld: 285000 });

    // Consent: doel lead_doorgifte, letterlijke tekst met versie-id, juiste bron.
    const consent = db.select().from(schema.consents).where(eq(schema.consents.id, lead!.consentId!)).get();
    expect(consent).toBeDefined();
    expect(consent!.doel).toBe("lead_doorgifte");
    expect(consent!.bron).toBe("funnel:hypotheek");
    expect(consent!.email).toBe(email);
    expect(consent!.revokedAt).toBeNull();
    expect(consent!.tekstversie).toMatch(/^hypotheek-v1: /);
    expect(consent!.tekstversie).toContain(consentTekst.HYPOTHEEK_CONSENT_TEKST);
    expect(consent!.tekstversie).toContain("eenmalig");
    expect(consent!.tekstversie).toContain("een onafhankelijke hypotheekadviseur");

    // Lead-event "aangemaakt".
    const events = db.select().from(schema.leadEvents).where(eq(schema.leadEvents.leadId, leadId)).all();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("aangemaakt");

    // Bevestigingsmail in de outbox: type partij en adres benoemd, met afmeldlink.
    const mail = db.select().from(schema.emailsOutbox).all().find((m) => m.type === "lead_bevestiging" && m.to === email);
    expect(mail).toBeDefined();
    expect(mail!.html).toContain("een onafhankelijke hypotheekadviseur");
    expect(mail!.html).toContain("Hypotheekstraat 12, Test");
    expect(mail!.html.toLowerCase()).toContain("afmelden");
  });

  it("registreert elk trigger-subtype met de hypotheek-leadwaarde, ook zonder adres", () => {
    const overwaarde = maakAanvraag({
      subtype: "overwaarde",
      email: "overwaarde@voorbeeld.nl",
      antwoorden: { waardeBron: "eigen", woningWaarde: 450000, restantHypotheek: 250000, overwaardeIndicatie: 200000, doel: "verduurzamen" },
    });
    const aankoop = maakAanvraag({
      subtype: "aankoop",
      email: "koper@voorbeeld.nl",
      antwoorden: { fase: "bod_gedaan", budget: "300k_tot_450k", eigenInbreng: "ja" },
    });

    for (const [leadId, subtype] of [
      [overwaarde.leadId, "overwaarde"],
      [aankoop.leadId, "aankoop"],
    ] as const) {
      const lead = db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).get();
      expect(lead!.subtype).toBe(subtype);
      expect(lead!.adresId).toBeNull();
      expect(lead!.estValueEur).toBe(leadwaardeConfig.leadwaarde("hypotheek", subtype, "nieuw"));
    }
  });

  it("weigert een gesupprimeerd adres netjes en schrijft dan niets weg", () => {
    const suppressedId = db
      .insert(schema.addresses)
      .values({
        straat: "Wegstraat", huisnummer: 3, toevoeging: null, nummerslug: "3", postcode: "5611ZZ", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1975, oppervlakteM2: 95, woningtype: "hoekwoning", energielabel: "D",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
      .get().id;
    db.insert(schema.optouts)
      .values({
        adresId: suppressedId, postcode: "5611ZZ", nummerslug: "3", token: "optout-hypotheek-test",
        aangevraagdAt: "2026-07-22", bevestigdAt: "2026-07-22T10:00:00Z",
      })
      .run();

    expect(() =>
      maakAanvraag({
        subtype: "overwaarde",
        email: "geweigerd@voorbeeld.nl",
        adresId: suppressedId,
        adresNaam: "Wegstraat 3, Test",
        antwoorden: { waardeBron: "eigen", woningWaarde: 300000, restantHypotheek: 200000, overwaardeIndicatie: 100000, doel: "verbouwen" },
      }),
    ).toThrow(/verwijderd/);

    // Nette weigering betekent: geen lead, geen consent, geen mail voor dit adres.
    const leadsVoorAdres = db.select().from(schema.leads).where(eq(schema.leads.adresId, suppressedId)).all();
    expect(leadsVoorAdres).toHaveLength(0);
    const consents = db.select().from(schema.consents).where(eq(schema.consents.email, "geweigerd@voorbeeld.nl")).all();
    expect(consents).toHaveLength(0);
    const mail = db.select().from(schema.emailsOutbox).all().find((m) => m.to === "geweigerd@voorbeeld.nl");
    expect(mail).toBeUndefined();
  });
});

describe("kwalificatievragen (Zod)", () => {
  it("valideert de overwaarde-vragen en wijst een onbekend doel af", () => {
    const goed = funnelSchema.overwaardeVragenSchema.safeParse({ eigenWaarde: "450000", restant: "250000", doel: "verduurzamen" });
    expect(goed.success).toBe(true);
    if (goed.success) {
      expect(goed.data.eigenWaarde).toBe(450000);
      expect(goed.data.restant).toBe(250000);
    }
    expect(funnelSchema.overwaardeVragenSchema.safeParse({ restant: "250000", doel: "beleggen" }).success).toBe(false);
  });

  it("eist bij oversluiten een maand, een rente binnen grenzen en een restschuld", () => {
    expect(
      funnelSchema.oversluitenVragenSchema.safeParse({ rentevastTot: "2027-03", huidigeRente: "3.9", restschuld: "285000" }).success,
    ).toBe(true);
    expect(
      funnelSchema.oversluitenVragenSchema.safeParse({ rentevastTot: "volgend jaar", huidigeRente: "3.9", restschuld: "285000" }).success,
    ).toBe(false);
    expect(
      funnelSchema.oversluitenVragenSchema.safeParse({ rentevastTot: "2027-03", huidigeRente: "42", restschuld: "285000" }).success,
    ).toBe(false);
  });

  it("laatste stap: e-mail verplicht, consent-checkbox verplicht, honeypot moet leeg zijn", () => {
    expect(funnelSchema.contactSchema.safeParse({ email: "jij@voorbeeld.nl", consent: "1", bedrijfsnaam: "" }).success).toBe(true);
    expect(funnelSchema.contactSchema.safeParse({ email: "jij@voorbeeld.nl", bedrijfsnaam: "" }).success).toBe(false);
    expect(funnelSchema.contactSchema.safeParse({ email: "geen-mail", consent: "1", bedrijfsnaam: "" }).success).toBe(false);
    expect(funnelSchema.contactSchema.safeParse({ email: "jij@voorbeeld.nl", consent: "1", bedrijfsnaam: "Bot BV" }).success).toBe(false);
  });
});
