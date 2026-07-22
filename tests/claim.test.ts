import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let logic: typeof import("@/app/claim/verzilver/logic");
let teksten: typeof import("@/app/claim/consent-teksten");
let magicLink: typeof import("@/emails/magic-link");
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;

let adresId: number;
let userId: number;

beforeAll(async () => {
  maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  logic = await import("@/app/claim/verzilver/logic");
  teksten = await import("@/app/claim/consent-teksten");
  magicLink = await import("@/emails/magic-link");
  ({ eq, and } = await import("drizzle-orm"));

  db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" }).run();
  db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" }).run();
  adresId = db
    .insert(schema.addresses)
    .values({
      straat: "Claimstraat", huisnummer: 7, toevoeging: null, nummerslug: "7", postcode: "5611CD", plaats: "Test",
      buurtCode: "BU1", bouwjaar: 1995, oppervlakteM2: 110, woningtype: "hoekwoning", energielabel: "B",
      energielabelBron: "indicatie", bron: "seed", status: "actief",
    })
    .returning({ id: schema.addresses.id })
    .get().id;
  userId = db
    .insert(schema.users)
    .values({ email: "claimer@voorbeeld.nl", verifiedAt: "2026-07-22", createdAt: "2026-07-22" })
    .returning({ id: schema.users.id })
    .get().id;
});

describe("verzilverClaim", () => {
  it("maakt claim, logt consents letterlijk en zet alerts aan", () => {
    const resultaat = logic.verzilverClaim({
      userId, postcode: "5611CD", nummerslug: "7", rol: "eigenaar", alerts: true, marketing: true,
    });
    expect(resultaat).not.toBeNull();
    expect(resultaat!.adresId).toBe(adresId);

    const claim = db.select().from(schema.claims).where(eq(schema.claims.id, resultaat!.claimId)).get();
    expect(claim!.userId).toBe(userId);
    expect(claim!.rol).toBe("eigenaar");
    expect(claim!.endedAt).toBeNull();

    const rijen = db.select().from(schema.consents).where(eq(schema.consents.email, "claimer@voorbeeld.nl")).all();
    expect(rijen).toHaveLength(2);
    const alertsConsent = rijen.find((r) => r.doel === "alerts");
    const marketingConsent = rijen.find((r) => r.doel === "marketing");
    // AVG art. 7: letterlijke tekstversie plus bron vastgelegd.
    expect(alertsConsent!.tekstversie).toContain(teksten.CONSENT_TEKST_ALERTS);
    expect(marketingConsent!.tekstversie).toContain(teksten.CONSENT_TEKST_MARKETING);
    expect(alertsConsent!.bron).toBe("claim-flow");
    expect(alertsConsent!.userId).toBe(userId);
    expect(alertsConsent!.revokedAt).toBeNull();

    const abonnement = db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, resultaat!.claimId)).get();
    expect(abonnement!.actief).toBe(true);
    expect(abonnement!.frequentie).toBe("maandelijks");
  });

  it("dupliceert claim en abonnement niet bij een tweede verzilvering", () => {
    const eerste = db
      .select()
      .from(schema.claims)
      .where(and(eq(schema.claims.userId, userId), eq(schema.claims.adresId, adresId)))
      .all();
    expect(eerste).toHaveLength(1);

    const resultaat = logic.verzilverClaim({
      userId, postcode: "5611CD", nummerslug: "7", rol: "eigenaar", alerts: true, marketing: false,
    });
    expect(resultaat!.claimId).toBe(eerste[0].id);

    const claimsNa = db
      .select()
      .from(schema.claims)
      .where(and(eq(schema.claims.userId, userId), eq(schema.claims.adresId, adresId)))
      .all();
    expect(claimsNa).toHaveLength(1);

    const abonnementen = db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, eerste[0].id)).all();
    expect(abonnementen).toHaveLength(1);
    expect(abonnementen[0].actief).toBe(true);
  });

  it("logt niets en abonneert niet zonder vinkjes", () => {
    const kaleUserId = db
      .insert(schema.users)
      .values({ email: "kaal@voorbeeld.nl", verifiedAt: "2026-07-22", createdAt: "2026-07-22" })
      .returning({ id: schema.users.id })
      .get().id;

    const resultaat = logic.verzilverClaim({
      userId: kaleUserId, postcode: "5611CD", nummerslug: "7", rol: "bewoner", alerts: false, marketing: false,
    });
    expect(resultaat).not.toBeNull();

    const rijen = db.select().from(schema.consents).where(eq(schema.consents.email, "kaal@voorbeeld.nl")).all();
    expect(rijen).toHaveLength(0);
    const abonnement = db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, resultaat!.claimId)).get();
    expect(abonnement).toBeUndefined();
  });

  it("weigert een gesuppresseerd adres (opt-out is leidend)", () => {
    const suppressedId = db
      .insert(schema.addresses)
      .values({
        straat: "Wegstraat", huisnummer: 1, toevoeging: null, nummerslug: "1", postcode: "5611EF", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1980, oppervlakteM2: 90, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
      .get().id;
    db.insert(schema.optouts)
      .values({
        adresId: suppressedId, postcode: "5611EF", nummerslug: "1", token: "optout-claim-test",
        aangevraagdAt: "2026-07-22", bevestigdAt: "2026-07-22T10:00:00Z",
      })
      .run();

    const resultaat = logic.verzilverClaim({
      userId, postcode: "5611EF", nummerslug: "1", rol: "eigenaar", alerts: true, marketing: true,
    });
    expect(resultaat).toBeNull();

    const claim = db.select().from(schema.claims).where(eq(schema.claims.adresId, suppressedId)).get();
    expect(claim).toBeUndefined();
  });
});

describe("magic-link-mail", () => {
  it("komt in de outbox met verzilverlink en afmeldlink", () => {
    magicLink.stuurMagicLink({
      to: "claimer@voorbeeld.nl",
      adresNaam: "Claimstraat 7, Test",
      rol: "eigenaar",
      alerts: true,
      marketing: false,
      verzilverUrl: "http://localhost:4123/claim/verzilver?token=abc&postcode=5611CD&nummer=7&rol=eigenaar&alerts=1&marketing=0",
    });

    const mail = db.select().from(schema.emailsOutbox).all().find((m) => m.type === "magic_link");
    expect(mail).toBeDefined();
    expect(mail!.to).toBe("claimer@voorbeeld.nl");
    expect(mail!.html).toContain("/claim/verzilver?token=abc");
    expect(mail!.html).toContain(teksten.CONSENT_TEKST_ALERTS); // gekozen opties herhaald in de mail
    expect(mail!.html).not.toContain(teksten.CONSENT_TEKST_MARKETING); // niet-gekozen optie niet
    expect(mail!.html).toContain("15 minuten");
    expect(mail!.html.toLowerCase()).toContain("afmelden"); // afmeld-/beheerlink uit emailLayout
  });
});
