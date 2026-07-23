import { beforeAll, describe, expect, it, vi } from "vitest";
import { maakTestDb } from "./helpers";

// currentUser leest cookies via next/headers; buiten een Next-request-context
// mocken we die met een simpele in-memory cookie-jar.
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieStore.set(name, value),
    delete: (name: string) => void cookieStore.delete(name),
  }),
  headers: async () => new Headers(),
}));

// Dynamische imports NA maakTestDb, zodat lib/db de testdatabase pakt.
let db: typeof import("@/lib/db").db;
let schema: typeof import("@/db/schema");
let suppression: typeof import("@/lib/suppression");
let route: typeof import("@/app/api/rapport/route");
let rapportPagina: typeof import("@/app/rapport/[token]/page");
let buurtPagina: typeof import("@/app/buurt/[gemeente]/[buurt]/page");

let adres1Id: number;
let adres2Id: number;
let claim1Id: number; // user1, actief, adres1
let claimBeeindigdId: number; // user1, beeindigd
let claim2Id: number; // user1, actief, adres2 (wordt gesupprimeerd)
const sid1 = "sessie-user1";
const sid2 = "sessie-user2";

function alsUser(sid: string | null) {
  if (sid) cookieStore.set("wonea_session", sid);
  else cookieStore.delete("wonea_session");
}

/** Loopt door een React-elementboom en verzamelt alle tekst-children. */
function verzamelTekst(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(verzamelTekst).join(" ");
  if (typeof node === "object") {
    const props = (node as { props?: { children?: unknown } }).props;
    return props ? verzamelTekst(props.children) : "";
  }
  return "";
}

/** Checkt of een componentfunctie met deze naam ergens in de boom voorkomt. */
function bevatComponent(node: unknown, naam: string): boolean {
  if (node == null || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((kind) => bevatComponent(kind, naam));
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof el.type === "function" && el.type.name === naam) return true;
  return el.props ? bevatComponent(el.props.children, naam) : false;
}

function maakRequest(method: "POST" | "DELETE", body: unknown, ip: string): Request {
  return new Request("http://localhost:4123/api/rapport", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await maakTestDb();
  // Vitest/esbuild compileert JSX hier met de klassieke runtime; de
  // servercomponent-render in de tests heeft daarom React in scope nodig.
  (globalThis as { React?: unknown }).React = (await import("react")).default;
  ({ db } = await import("@/lib/db"));
  schema = await import("@/db/schema");
  suppression = await import("@/lib/suppression");
  route = await import("@/app/api/rapport/route");
  rapportPagina = await import("@/app/rapport/[token]/page");
  buurtPagina = await import("@/app/buurt/[gemeente]/[buurt]/page");

  await db.insert(schema.municipalities).values({ code: "GM0000", naam: "Test", slug: "test" });
  await db.insert(schema.neighborhoods).values({ buurtCode: "BU1", naam: "Testbuurt", slug: "testbuurt", gemeenteCode: "GM0000" });

  const adresBasis = {
    straat: "Teststraat", toevoeging: null, postcode: "5611AB", plaats: "Test", buurtCode: "BU1",
    bouwjaar: 1990, oppervlakteM2: 100, woningtype: "tussenwoning" as const, energielabel: "C",
    energielabelBron: "indicatie" as const, bron: "seed" as const, status: "actief" as const,
  };
  adres1Id = (await db.insert(schema.addresses).values({ ...adresBasis, huisnummer: 10, nummerslug: "10" }).returning({ id: schema.addresses.id }))[0].id;
  adres2Id = (await db.insert(schema.addresses).values({ ...adresBasis, huisnummer: 11, nummerslug: "11" }).returning({ id: schema.addresses.id }))[0].id;

  const user1Id = (await db.insert(schema.users).values({ email: "een@voorbeeld.nl", verifiedAt: "2026-01-01", createdAt: "2026-01-01" }).returning({ id: schema.users.id }))[0].id;
  const user2Id = (await db.insert(schema.users).values({ email: "twee@voorbeeld.nl", verifiedAt: "2026-01-01", createdAt: "2026-01-01" }).returning({ id: schema.users.id }))[0].id;
  await db.insert(schema.sessions).values({ id: sid1, userId: user1Id, expiresAt: "2999-01-01T00:00:00.000Z", createdAt: "2026-01-01" });
  await db.insert(schema.sessions).values({ id: sid2, userId: user2Id, expiresAt: "2999-01-01T00:00:00.000Z", createdAt: "2026-01-01" });

  claim1Id = (await db.insert(schema.claims).values({ userId: user1Id, adresId: adres1Id, rol: "eigenaar", createdAt: "2026-01-01" }).returning({ id: schema.claims.id }))[0].id;
  claimBeeindigdId = (
    await db
      .insert(schema.claims)
      .values({ userId: user1Id, adresId: adres1Id, rol: "bewoner", createdAt: "2026-01-01", endedAt: "2026-02-01" })
      .returning({ id: schema.claims.id })
  )[0].id;
  claim2Id = (await db.insert(schema.claims).values({ userId: user1Id, adresId: adres2Id, rol: "eigenaar", createdAt: "2026-01-01" }).returning({ id: schema.claims.id }))[0].id;
});

describe("POST /api/rapport", () => {
  it("weigert zonder sessie", async () => {
    alsUser(null);
    const res = await route.POST(maakRequest("POST", { claimId: 1 }, "ip-anoniem"));
    expect(res.status).toBe(401);
  });

  it("weigert ongeldige invoer", async () => {
    alsUser(sid1);
    const res = await route.POST(maakRequest("POST", { claimId: "geen-nummer" }, "ip-invoer"));
    expect(res.status).toBe(400);
  });

  it("maakt een token voor een eigen actieve claim", async () => {
    alsUser(sid1);
    const res = await route.POST(maakRequest("POST", { claimId: claim1Id }, "ip-eigen"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token.length).toBeGreaterThanOrEqual(16);

    const { eq } = await import("drizzle-orm");
    const rij = (await db.select().from(schema.sharedReports).where(eq(schema.sharedReports.token, body.token)).limit(1))[0];
    expect(rij).toBeDefined();
    expect(rij!.claimId).toBe(claim1Id);
    expect(rij!.adresId).toBe(adres1Id);
    expect(rij!.revokedAt).toBeNull();
  });

  it("behandelt andermans claim als niet gevonden", async () => {
    alsUser(sid2);
    const res = await route.POST(maakRequest("POST", { claimId: claim1Id }, "ip-ander"));
    expect(res.status).toBe(404);
  });

  it("weigert een beeindigde claim", async () => {
    alsUser(sid1);
    const res = await route.POST(maakRequest("POST", { claimId: claimBeeindigdId }, "ip-beeindigd"));
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/rapport", () => {
  let token: string;

  beforeAll(async () => {
    alsUser(sid1);
    const res = await route.POST(maakRequest("POST", { claimId: claim1Id }, "ip-delete-setup"));
    token = ((await res.json()) as { token: string }).token;
  });

  it("laat een ander het token niet intrekken", async () => {
    alsUser(sid2);
    const res = await route.DELETE(maakRequest("DELETE", { token }, "ip-delete-ander"));
    expect(res.status).toBe(404);

    const { eq } = await import("drizzle-orm");
    const rij = (await db.select().from(schema.sharedReports).where(eq(schema.sharedReports.token, token)).limit(1))[0];
    expect(rij!.revokedAt).toBeNull();
  });

  it("laat de eigenaar het token intrekken en de pagina verdwijnt", async () => {
    alsUser(sid1);
    const res = await route.DELETE(maakRequest("DELETE", { token }, "ip-delete-eigen"));
    expect(res.status).toBe(200);

    const { eq } = await import("drizzle-orm");
    const rij = (await db.select().from(schema.sharedReports).where(eq(schema.sharedReports.token, token)).limit(1))[0];
    expect(rij!.revokedAt).not.toBeNull();

    // Ingetrokken token = notFound op de publieke rapportpagina.
    await expect(rapportPagina.default({ params: Promise.resolve({ token }) })).rejects.toThrow();
  });
});

describe("suppressie wint altijd", () => {
  it("blokkeert delen van een gesupprimeerd adres en revoceert bestaande rapporten", async () => {
    // Eerst een geldig rapport voor adres2.
    alsUser(sid1);
    const eerst = await route.POST(maakRequest("POST", { claimId: claim2Id }, "ip-suppressie-1"));
    expect(eerst.status).toBe(200);
    const token2 = ((await eerst.json()) as { token: string }).token;

    // Publieke pagina werkt op dit moment nog.
    const element = await rapportPagina.default({ params: Promise.resolve({ token: token2 }) });
    expect(element).toBeTruthy();

    // Opt-out bevestigd + cascade (zoals app/verwijderen/[token] doet).
    await db
      .insert(schema.optouts)
      .values({ adresId: adres2Id, postcode: "5611AB", nummerslug: "11", token: "optout-token-11", aangevraagdAt: "2026-07-22", bevestigdAt: "2026-07-22T12:00:00Z" });
    await suppression.applyOptoutCascade(adres2Id);

    // Nieuw rapport delen kan niet meer. Let op: de cascade beeindigt de
    // claim, dus zowel 409-redenen (claim beeindigd of adres gesupprimeerd)
    // zijn correct; het mag nooit een 200 met token zijn.
    const daarna = await route.POST(maakRequest("POST", { claimId: claim2Id }, "ip-suppressie-2"));
    expect(daarna.status).toBe(409);

    // Bestaand rapport is door de cascade ingetrokken en de pagina is weg.
    const { eq } = await import("drizzle-orm");
    const rij = (await db.select().from(schema.sharedReports).where(eq(schema.sharedReports.token, token2)).limit(1))[0];
    expect(rij!.revokedAt).not.toBeNull();
    await expect(rapportPagina.default({ params: Promise.resolve({ token: token2 }) })).rejects.toThrow();
  });
});

describe("buurtpagina", () => {
  it("rendert kerncijfers, verkopen en trend en filtert gesupprimeerde kadaster-verkopen", async () => {
    // Seed-verkoop (nooit adres_id) + kadaster-verkoop aan het gesupprimeerde
    // adres2: die laatste hoort tijdens de render weggefilterd te worden.
    await db
      .insert(schema.sales)
      .values({ buurtCode: "BU1", straat: "Teststraat", datum: "2026-06-15", prijs: 400000, oppervlakteM2: 100, woningtype: "tussenwoning", bron: "seed" });
    await db
      .insert(schema.sales)
      .values({ buurtCode: "BU1", straat: "Teststraat", adresId: adres2Id, datum: "2026-05-15", prijs: 410000, oppervlakteM2: 105, woningtype: "tussenwoning", bron: "kadaster" });
    for (const [i, maand] of ["2026-04", "2026-05", "2026-06"].entries()) {
      await db
        .insert(schema.marketStats)
        .values({ buurtCode: "BU1", maand, mediaanPrijs: 390000 + i * 5000, doorlooptijdDagen: 30 - i, overbiedingPct: 1.5, volume: 4, bron: "seed" });
    }

    const element = await buurtPagina.default({ params: Promise.resolve({ gemeente: "test", buurt: "testbuurt" }) });
    expect(element).toBeTruthy();
    const tekst = verzamelTekst(element);
    expect(tekst).toContain("Testbuurt");
    // De prijs van de gesupprimeerde kadaster-verkoop mag nergens opduiken.
    expect(tekst).not.toContain("410.000");
    // De seed-verkoop staat er wel, met het voorbeelddata-label.
    expect(tekst).toContain("400.000");
    expect(bevatComponent(element, "VoorbeelddataLabel")).toBe(true);
  });

  it("geeft notFound bij onbekende gemeente of buurt", async () => {
    await expect(buurtPagina.default({ params: Promise.resolve({ gemeente: "bestaat-niet", buurt: "testbuurt" }) })).rejects.toThrow();
    await expect(buurtPagina.default({ params: Promise.resolve({ gemeente: "test", buurt: "bestaat-niet" }) })).rejects.toThrow();
  });
});

describe("rate limiting", () => {
  it("remt na te veel verzoeken vanaf hetzelfde ip", async () => {
    alsUser(null);
    let laatste = 0;
    for (let i = 0; i < 11; i++) {
      const res = await route.POST(maakRequest("POST", { claimId: 1 }, "ip-limiet"));
      laatste = res.status;
    }
    expect(laatste).toBe(429);
  });
});
