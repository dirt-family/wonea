import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let logic: typeof import("@/app/account/logic");
let eq: typeof import("drizzle-orm").eq;

let adresId: number;
let userId: number;
let claimId: number;
let alertsConsentId: number;
let marketingConsentId: number;
let anderUserId: number;
let andermansConsentId: number;

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  logic = await import("@/app/account/logic");
  ({ eq } = await import("drizzle-orm"));

  await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" });
  adresId = (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Accountstraat", huisnummer: 5, toevoeging: null, nummerslug: "5", postcode: "5611AB", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 120, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
  )[0].id;

  userId = (
    await db
      .insert(schema.users)
      .values({ email: "account@voorbeeld.nl", verifiedAt: "2026-07-01T09:00:00Z", createdAt: "2026-07-01T09:00:00Z" })
      .returning({ id: schema.users.id })
  )[0].id;

  claimId = (
    await db
      .insert(schema.claims)
      .values({ userId, adresId, rol: "eigenaar", createdAt: "2026-07-01T09:05:00Z" })
      .returning({ id: schema.claims.id })
  )[0].id;

  await db.insert(schema.alertSubscriptions).values({ claimId, frequentie: "maandelijks", actief: true });
  await db.insert(schema.mortgageInfo).values({ claimId, restantEur: 250000, rentePct: 3.4, rentevastTot: "2031-01-01", updatedAt: "2026-07-01T09:10:00Z" });
  await db.insert(schema.sharedReports).values({ token: "deel-account-test", claimId, adresId, createdAt: "2026-07-02T08:00:00Z" });

  alertsConsentId = (
    await db
      .insert(schema.consents)
      .values({
        userId, email: "account@voorbeeld.nl", doel: "alerts",
        tekstversie: 'claim-v1: "Stuur mij maandelijks de waardeontwikkeling van deze woning"',
        bron: "claim-flow", consentedAt: "2026-07-01T09:05:00Z",
      })
      .returning({ id: schema.consents.id })
  )[0].id;
  marketingConsentId = (
    await db
      .insert(schema.consents)
      .values({
        userId, email: "account@voorbeeld.nl", doel: "marketing",
        tekstversie: 'claim-v1: "Wonea mag mij af en toe relevante aanbiedingen sturen, bv. hypotheekadvies"',
        bron: "claim-flow", consentedAt: "2026-07-01T09:05:00Z",
      })
      .returning({ id: schema.consents.id })
  )[0].id;

  // WOZ: 1x eigen invoer (hoort in de export) en 1x seed (hoort er NIET in).
  await db.insert(schema.wozValues).values({ adresId, peiljaar: 2026, waarde: 380000, bron: "eigenaar" });
  await db.insert(schema.wozValues).values({ adresId, peiljaar: 2025, waarde: 360000, bron: "seed" });

  await db.insert(schema.leads).values({
    type: "hypotheek", subtype: "overwaarde", adresId, userId, email: "account@voorbeeld.nl",
    antwoordenJson: '{"vraag":"overwaarde benutten"}', status: "nieuw", estValueEur: 40,
    createdAt: "2026-07-03T10:00:00Z", retentieTot: "2027-07-03",
  });

  await db.insert(schema.premiumEntitlements).values({ userId, product: "biedadvies", mockPaymentRef: "mock-123", createdAt: "2026-07-04T10:00:00Z" });

  await db.insert(schema.sessions).values([
    { id: "sessie-laptop", userId, expiresAt: "2027-01-01T00:00:00Z", createdAt: "2026-07-01T09:00:00Z" },
    { id: "sessie-telefoon", userId, expiresAt: "2027-01-01T00:00:00Z", createdAt: "2026-07-02T09:00:00Z" },
  ]);
  await db.insert(schema.magicTokens).values({ email: "account@voorbeeld.nl", tokenHash: "hash-abc", expiresAt: "2026-07-01T09:15:00Z", createdAt: "2026-07-01T09:00:00Z" });

  // Tweede gebruiker: bewijst dat intrekken en opzeggen andermans data niet raakt.
  anderUserId = (
    await db
      .insert(schema.users)
      .values({ email: "ander@voorbeeld.nl", verifiedAt: "2026-07-01T09:00:00Z", createdAt: "2026-07-01T09:00:00Z" })
      .returning({ id: schema.users.id })
  )[0].id;
  andermansConsentId = (
    await db
      .insert(schema.consents)
      .values({
        userId: anderUserId, email: "ander@voorbeeld.nl", doel: "marketing",
        tekstversie: 'claim-v1: "Wonea mag mij af en toe relevante aanbiedingen sturen, bv. hypotheekadvies"',
        bron: "claim-flow", consentedAt: "2026-07-01T09:05:00Z",
      })
      .returning({ id: schema.consents.id })
  )[0].id;
});

describe("trekConsentIn", () => {
  it("zet revokedAt en schakelt alerts uit bij intrekken van de alerts-consent", async () => {
    const resultaat = await logic.trekConsentIn({ userId, email: "account@voorbeeld.nl", consentId: alertsConsentId });
    expect(resultaat).toBe("ingetrokken");

    const consent = (await db.select().from(schema.consents).where(eq(schema.consents.id, alertsConsentId)))[0];
    expect(consent.revokedAt).not.toBeNull();
    // De rij blijft bestaan als bewijs; alleen revokedAt is gezet.
    expect(consent.tekstversie).toContain("waardeontwikkeling");

    const abonnement = (await db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, claimId)))[0];
    expect(abonnement.actief).toBe(false);

    const mails = (await db.select().from(schema.emailsOutbox)).filter((m) => (m.type as string) === "consent_ingetrokken");
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("account@voorbeeld.nl");
    expect(mails[0].html).toContain("Waarde-alerts per e-mail");
    expect(mails[0].html.toLowerCase()).toContain("afmelden"); // beheerlink uit emailLayout
  });

  it("is idempotent: nogmaals intrekken wijzigt niets en mailt niet opnieuw", async () => {
    const resultaat = await logic.trekConsentIn({ userId, email: "account@voorbeeld.nl", consentId: alertsConsentId });
    expect(resultaat).toBe("al-ingetrokken");
    const mails = (await db.select().from(schema.emailsOutbox)).filter((m) => (m.type as string) === "consent_ingetrokken");
    expect(mails).toHaveLength(1);
  });

  it("weigert andermans consent", async () => {
    const resultaat = await logic.trekConsentIn({ userId, email: "account@voorbeeld.nl", consentId: andermansConsentId });
    expect(resultaat).toBe("niet-gevonden");
    const consent = (await db.select().from(schema.consents).where(eq(schema.consents.id, andermansConsentId)))[0];
    expect(consent.revokedAt).toBeNull();
  });
});

describe("bouwGegevensExport", () => {
  it("bevat alle categorieen: gebruiker, claims, toestemmingen, aanvragen, woz-invoer, abonnementen", async () => {
    const gegevens = await logic.bouwGegevensExport(userId);
    expect(gegevens).not.toBeNull();

    expect(gegevens!.gebruiker.email).toBe("account@voorbeeld.nl");

    expect(gegevens!.claims).toHaveLength(1);
    expect(gegevens!.claims[0].adres).toContain("Accountstraat 5");
    expect(gegevens!.claims[0].rol).toBe("eigenaar");
    expect(gegevens!.claims[0].hypotheek!.restantEur).toBe(250000);
    expect(gegevens!.claims[0].deelRapporten).toHaveLength(1);

    // Beide consents zichtbaar, inclusief de ingetrokken alerts-consent met
    // letterlijke tekstversie (het register is het bewijs).
    expect(gegevens!.toestemmingen).toHaveLength(2);
    const alerts = gegevens!.toestemmingen.find((t) => t.doel === "alerts");
    const marketing = gegevens!.toestemmingen.find((t) => t.doel === "marketing");
    expect(alerts!.ingetrokkenOp).not.toBeNull();
    expect(alerts!.letterlijkeTekst).toContain("waardeontwikkeling");
    expect(marketing!.ingetrokkenOp).toBeNull();

    expect(gegevens!.aanvragen).toHaveLength(1);
    expect(gegevens!.aanvragen[0].type).toBe("hypotheek");
    expect(gegevens!.aanvragen[0].antwoorden).toEqual({ vraag: "overwaarde benutten" });

    // Alleen de eigen WOZ-invoer; seed-WOZ is geen persoonsgegeven.
    expect(gegevens!.wozInvoer).toHaveLength(1);
    expect(gegevens!.wozInvoer[0].bron).toBe("eigenaar");
    expect(gegevens!.wozInvoer[0].waardeEur).toBe(380000);

    expect(gegevens!.abonnementen.waardeAlerts).toHaveLength(1);
    expect(gegevens!.abonnementen.waardeAlerts[0].actief).toBe(false); // uitgezet in de intrekken-test
    expect(gegevens!.abonnementen.premium).toHaveLength(1);
    expect(gegevens!.abonnementen.premium[0].product).toBe("biedadvies");
  });

  it("geeft null voor een onbekende gebruiker", async () => {
    expect(await logic.bouwGegevensExport(999999)).toBeNull();
  });
});

describe("zegAccountOp", () => {
  it("anonimiseert leads en verwijdert user, sessies, claims en aanhang", async () => {
    const resultaat = await logic.zegAccountOp(userId);
    expect(resultaat).toBe("ok");

    // Leads: e-mail eruit, koppeling met de user los; de statistiek-rij blijft.
    const lead = (await db.select().from(schema.leads))[0];
    expect(lead.email).toBe(logic.GEANONIMISEERD_EMAIL);
    expect(lead.userId).toBeNull();
    expect(lead.type).toBe("hypotheek");

    // User, sessies, magic tokens: weg.
    expect(await db.select().from(schema.users).where(eq(schema.users.id, userId))).toHaveLength(0);
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId))).toHaveLength(0);
    expect(await db.select().from(schema.magicTokens).where(eq(schema.magicTokens.email, "account@voorbeeld.nl"))).toHaveLength(0);

    // Claims en aanhang: weg.
    expect(await db.select().from(schema.claims).where(eq(schema.claims.id, claimId))).toHaveLength(0);
    expect(await db.select().from(schema.mortgageInfo).where(eq(schema.mortgageInfo.claimId, claimId))).toHaveLength(0);
    expect(await db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.claimId, claimId))).toHaveLength(0);
    expect(await db.select().from(schema.sharedReports).where(eq(schema.sharedReports.claimId, claimId))).toHaveLength(0);
    expect(await db.select().from(schema.premiumEntitlements).where(eq(schema.premiumEntitlements.userId, userId))).toHaveLength(0);

    // Consents: blijven als bewijs, maar ingetrokken en losgekoppeld.
    const marketing = (await db.select().from(schema.consents).where(eq(schema.consents.id, marketingConsentId)))[0];
    expect(marketing.revokedAt).not.toBeNull();
    expect(marketing.userId).toBeNull();

    // Bevestigingsmail in de outbox, naar het oude adres.
    const mails = (await db.select().from(schema.emailsOutbox)).filter((m) => (m.type as string) === "account_opgezegd");
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("account@voorbeeld.nl");
    expect(mails[0].html).toContain("/verwijderen");

    // Andermans data onaangeraakt.
    expect(await db.select().from(schema.users).where(eq(schema.users.id, anderUserId))).toHaveLength(1);
    const anderConsent = (await db.select().from(schema.consents).where(eq(schema.consents.id, andermansConsentId)))[0];
    expect(anderConsent.revokedAt).toBeNull();
    expect(anderConsent.userId).toBe(anderUserId);
  });

  it("is veilig herhaalbaar: nogmaals opzeggen van een verdwenen account", async () => {
    expect(await logic.zegAccountOp(userId)).toBe("niet-gevonden");
  });
});
