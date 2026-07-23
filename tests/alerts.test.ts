import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let POST: typeof import("@/app/api/alerts/route").POST;
let bouwWaardeAlert: typeof import("@/emails/alert").bouwWaardeAlert;
let formatEuro: typeof import("@/lib/util").formatEuro;

const WACHTWOORD = "test-geheim";

function verzoek(metWachtwoord: boolean) {
  return new Request("http://localhost:4123/api/alerts", {
    method: "POST",
    headers: metWachtwoord ? { "x-admin-password": WACHTWOORD } : {},
  });
}

function isoDagenTerug(dagen: number): string {
  return new Date(Date.now() - dagen * 86_400_000).toISOString().slice(0, 10);
}

let adresA: number;
let subA: number;

beforeAll(async () => {
  await maakTestDb();
  process.env.WONEA_ADMIN_PASSWORD = WACHTWOORD;
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  ({ POST } = await import("@/app/api/alerts/route"));
  ({ bouwWaardeAlert } = await import("@/emails/alert"));
  ({ formatEuro } = await import("@/lib/util"));

  await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
  await db
    .insert(schema.neighborhoods)
    .values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000", gemWoz: 420000, ankerM2Prijs: 4200 });

  // Genoeg recente verkopen zodat de AVM een waarde kan berekenen.
  for (let i = 0; i < 6; i++) {
    await db
      .insert(schema.sales)
      .values({
        buurtCode: "BU1",
        straat: "Teststraat",
        adresId: null,
        datum: isoDagenTerug(20 + i * 10),
        prijs: 400000 + i * 10000,
        oppervlakteM2: 95 + i * 3,
        woningtype: "tussenwoning",
        bron: "seed",
      });
  }

  const maakAdres = async (nummer: number): Promise<number> =>
    (
      await db
        .insert(schema.addresses)
        .values({
          straat: "Teststraat", huisnummer: nummer, toevoeging: null, nummerslug: String(nummer), postcode: "5611AB",
          plaats: "Test", buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning",
          energielabel: "C", energielabelBron: "indicatie", bron: "seed", status: "actief",
        })
        .returning({ id: schema.addresses.id })
    )[0].id;

  const maakGebruiker = async (email: string): Promise<number> =>
    (await db.insert(schema.users).values({ email, verifiedAt: "2026-01-01", createdAt: "2026-01-01" }).returning({ id: schema.users.id }))[0].id;

  const maakClaim = async (userId: number, adresId: number, endedAt: string | null = null): Promise<number> =>
    (await db.insert(schema.claims).values({ userId, adresId, rol: "eigenaar", createdAt: "2026-01-01", endedAt }).returning({ id: schema.claims.id }))[0].id;

  const maakSub = async (claimId: number): Promise<number> =>
    (await db.insert(schema.alertSubscriptions).values({ claimId, actief: true }).returning({ id: schema.alertSubscriptions.id }))[0].id;

  const maakConsent = async (email: string, revokedAt: string | null = null): Promise<void> => {
    await db
      .insert(schema.consents)
      .values({ email, doel: "alerts", tekstversie: "Ja, mail mij maandelijks de waarde-update. (v1)", bron: "test", consentedAt: "2026-01-01", revokedAt });
  };

  // A: geldig abonnement, actieve consent (de enige die een mail moet krijgen).
  adresA = await maakAdres(1);
  await maakConsent("a@voorbeeld.nl");
  subA = await maakSub(await maakClaim(await maakGebruiker("a@voorbeeld.nl"), adresA));

  // B: claim beeindigd.
  await maakConsent("b@voorbeeld.nl");
  await maakSub(await maakClaim(await maakGebruiker("b@voorbeeld.nl"), await maakAdres(2), "2026-06-01"));

  // C: consent ingetrokken.
  await maakConsent("c@voorbeeld.nl", "2026-06-15");
  await maakSub(await maakClaim(await maakGebruiker("c@voorbeeld.nl"), await maakAdres(3)));

  // D: adres met bevestigde opt-out (suppressie is leidend).
  const adresD = await maakAdres(4);
  await maakConsent("d@voorbeeld.nl");
  await maakSub(await maakClaim(await maakGebruiker("d@voorbeeld.nl"), adresD));
  await db
    .insert(schema.optouts)
    .values({ adresId: adresD, postcode: "5611AB", nummerslug: "4", token: "optout-d", aangevraagdAt: "2026-07-01", bevestigdAt: "2026-07-02" });

  // E: geen consent-rij (dan ook geen mail).
  await maakSub(await maakClaim(await maakGebruiker("e@voorbeeld.nl"), await maakAdres(5)));
});

describe("waarde-alerts maandrun (POST /api/alerts)", () => {
  it("weigert zonder admin-wachtwoord buiten development", async () => {
    const res = await POST(verzoek(false));
    expect(res.status).toBe(401);
  });

  it("verstuurt alleen naar geldige abonnementen en telt de skips per reden", async () => {
    const res = await POST(verzoek(true));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.totaal).toBe(5);
    expect(json.verzonden).toBe(1);
    expect(json.geskipt).toMatchObject({
      claim_beeindigd: 1,
      consent_ingetrokken: 1,
      adres_verwijderd: 1,
      consent_ontbreekt: 1,
    });

    const alerts = (await db.select().from(schema.emailsOutbox)).filter((m) => m.type === "alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].to).toBe("a@voorbeeld.nl");
    expect(alerts[0].html).toContain("eerste waarde-alert");
    expect(alerts[0].html).toContain("/woning/5611AB/1");
    expect(alerts[0].html).toContain("/dashboard"); // afmeld-/beheerlink

    const { eq } = await import("drizzle-orm");
    const sub = (await db.select().from(schema.alertSubscriptions).where(eq(schema.alertSubscriptions.id, subA)).limit(1))[0];
    expect(sub!.laatstVerzonden).not.toBeNull();
  });

  it("verstuurt nooit twee keer in dezelfde kalendermaand", async () => {
    const res = await POST(verzoek(true));
    const json = await res.json();
    expect(json.verzonden).toBe(0);
    expect(json.geskipt.al_verzonden_deze_maand).toBe(1);
    const alerts = (await db.select().from(schema.emailsOutbox)).filter((m) => m.type === "alert");
    expect(alerts).toHaveLength(1);
  });

  it("vergelijkt met de waarde uit de vorige verzonden alert", async () => {
    const { eq, and } = await import("drizzle-orm");
    const huidige = (
      await db
        .select()
        .from(schema.valuations)
        .where(and(eq(schema.valuations.adresId, adresA)))
    ).at(-1)!;

    // Vorige alert: 35 dagen terug (vorige kalendermaand), met een lagere waarde.
    const vorigeWaarde = huidige.waarde - 15000;
    await db
      .insert(schema.valuations)
      .values({
        adresId: adresA, datum: isoDagenTerug(40), waarde: vorigeWaarde,
        intervalLaag: vorigeWaarde - 20000, intervalHoog: vorigeWaarde + 20000,
        confidence: "middel", nComparables: 6, modelVersie: "wonea-avm-1.0", inputsJson: "{}",
      });
    await db
      .update(schema.alertSubscriptions)
      .set({ laatstVerzonden: new Date(Date.now() - 35 * 86_400_000).toISOString() })
      .where(eq(schema.alertSubscriptions.id, subA));

    const res = await POST(verzoek(true));
    const json = await res.json();
    expect(json.verzonden).toBe(1);

    const alerts = (await db.select().from(schema.emailsOutbox)).filter((m) => m.type === "alert");
    const laatste = alerts.at(-1)!;
    expect(laatste.html).toContain("gestegen");
    expect(laatste.html).toContain(formatEuro(vorigeWaarde));
    expect(laatste.html).not.toContain("eerste waarde-alert");
  });
});

describe("waarde-alert template", () => {
  it("eerste alert: benoemt het vergelijkingspunt en bevat de beheerlink", () => {
    const { subject, html } = bouwWaardeAlert({
      to: "a@voorbeeld.nl", adresNaam: "Teststraat 1, Test", woningPad: "/woning/5611AB/1",
      waarde: 400000, intervalLaag: 380000, intervalHoog: 420000, vorigeWaarde: null, nieuweVerkopen: 0,
    });
    expect(subject).toContain("Teststraat 1");
    expect(html).toContain("eerste waarde-alert");
    expect(html).toContain("geen nieuwe verkopen");
    expect(html).toContain(formatEuro(380000));
    expect(html).toContain("/dashboard");
  });

  it("daling: eerlijk benoemd in euro en procent", () => {
    const { html } = bouwWaardeAlert({
      to: "a@voorbeeld.nl", adresNaam: "Teststraat 1, Test", woningPad: "/woning/5611AB/1",
      waarde: 390000, intervalLaag: 370000, intervalHoog: 410000, vorigeWaarde: 400000, nieuweVerkopen: 3,
    });
    expect(html).toContain("gedaald");
    expect(html).toContain(formatEuro(10000));
    expect(html).toContain("2,5 procent");
    expect(html).toContain("3 nieuwe verkopen");
  });
});
