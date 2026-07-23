import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDb } from "./helpers";

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let route: typeof import("@/app/api/widget/route");
let consentTekst: string;

let adresId: number;

function formRequest(velden: Record<string, string>, ip: string): Request {
  return new Request("http://localhost:4123/api/widget", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip },
    body: new URLSearchParams(velden).toString(),
  });
}

const basis = {
  email: "koper@voorbeeld.nl",
  postcode: "5611 AB",
  nummer: "12",
  bron: "makelaar-demo.nl",
  consent: "1",
  bedrijfsnaam: "",
};

async function telRijen() {
  return {
    consents: (await db.select().from(schema.consents)).length,
    captures: (await db.select().from(schema.widgetCaptures)).length,
    mails: (await db.select().from(schema.emailsOutbox)).length,
  };
}

beforeAll(async () => {
  await maakTestDb();
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  route = await import("@/app/api/widget/route");
  ({ WIDGET_CONSENT_TEKST: consentTekst } = await import("@/app/widget/consent"));

  await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" });
  adresId = (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Teststraat", huisnummer: 12, toevoeging: null, nummerslug: "12", postcode: "5611AB", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
  )[0].id;

  // Tweede adres met een BEVESTIGDE opt-out: de widget mag hier nooit een
  // adres-koppeling voor opslaan.
  const wegId = (
    await db
      .insert(schema.addresses)
      .values({
        straat: "Teststraat", huisnummer: 14, toevoeging: null, nummerslug: "14", postcode: "5611AB", plaats: "Test",
        buurtCode: "BU1", bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning", energielabel: "C",
        energielabelBron: "indicatie", bron: "seed", status: "actief",
      })
      .returning({ id: schema.addresses.id })
  )[0].id;
  await db
    .insert(schema.optouts)
    .values({ adresId: wegId, postcode: "5611AB", nummerslug: "14", token: "optout-token", aangevraagdAt: "2026-07-01", bevestigdAt: "2026-07-01T12:00:00Z" });
});

describe("POST /api/widget (e-mailcapture met consent en double opt-in)", () => {
  it("slaat consent, capture en double-opt-in-mail op bij een geldige aanmelding", async () => {
    const res = await route.POST(formRequest(basis, "1.1.1.1"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("verzonden=1");

    const consent = (await db.select().from(schema.consents)).at(-1)!;
    expect(consent.doel).toBe("widget");
    expect(consent.bron).toBe("widget:makelaar-demo.nl");
    expect(consent.tekstversie).toBe(consentTekst); // letterlijke tekst + versie
    expect(consent.email).toBe("koper@voorbeeld.nl");

    const capture = (await db.select().from(schema.widgetCaptures)).at(-1)!;
    expect(capture.adresId).toBe(adresId);
    expect(capture.bevestigdAt).toBeNull(); // pas na de klik in de mail
    expect(capture.consentId).toBe(consent.id);
    expect(capture.bronDomein).toBe("makelaar-demo.nl");

    const mail = (await db.select().from(schema.emailsOutbox)).find((m) => m.type === "widget_double_optin")!;
    expect(mail.to).toBe("koper@voorbeeld.nl");
    expect(mail.html).toContain(`/widget/bevestig/${capture.bevestigToken}`);
    expect(mail.html).toContain("afmelden"); // afmeld-/beheerlink uit de layout
  });

  it("weigert zonder aangevinkte consent-checkbox en slaat niets op", async () => {
    const voor = await telRijen();
    const res = await route.POST(formRequest({ ...basis, consent: "" }, "2.2.2.2"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("fout=consent");
    expect(await telRijen()).toEqual(voor);
  });

  it("negeert bots die de honeypot invullen: stil succes, niets opgeslagen", async () => {
    const voor = await telRijen();
    const res = await route.POST(formRequest({ ...basis, bedrijfsnaam: "Spam BV" }, "3.3.3.3"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("verzonden=1");
    expect(await telRijen()).toEqual(voor);
  });

  it("koppelt nooit een adres met bevestigde opt-out (suppressie)", async () => {
    const res = await route.POST(formRequest({ ...basis, nummer: "14" }, "4.4.4.4"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("verzonden=1");
    const capture = (await db.select().from(schema.widgetCaptures)).at(-1)!;
    expect(capture.adresId).toBeNull();
  });

  it("wijst een ongeldig e-mailadres af", async () => {
    const voor = await telRijen();
    const res = await route.POST(formRequest({ ...basis, email: "geen-mailadres" }, "5.5.5.5"));
    expect(res.headers.get("location")).toContain("fout=ongeldig");
    expect(await telRijen()).toEqual(voor);
  });

  it("beperkt het aantal verzoeken per IP (rate limit)", async () => {
    let laatste: Response | null = null;
    for (let i = 0; i < 6; i++) {
      laatste = await route.POST(formRequest(basis, "9.9.9.9"));
    }
    expect(laatste!.headers.get("location")).toContain("fout=te-vaak");
  });

  it("schoont het bron-domein op tot hostname-tekens", async () => {
    const res = await route.POST(formRequest({ ...basis, bron: "Evil<script>.Example.COM" }, "6.6.6.6"));
    expect(res.status).toBe(303);
    const capture = (await db.select().from(schema.widgetCaptures)).at(-1)!;
    expect(capture.bronDomein).toBe("evilscript.example.com");
    const consent = (await db.select().from(schema.consents)).at(-1)!;
    expect(consent.bron).toBe("widget:evilscript.example.com");
  });
});
