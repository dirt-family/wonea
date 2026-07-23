/**
 * Lezer-gedrag voor de per-verstrekker-rentes (lib/bronnen/rentes-verstrekkers).
 *
 * Bewaakt de eerlijkheidsregels: een geldige snapshot levert rijen, een
 * ontbrekende of verouderde snapshot levert beschikbaar=false (verouderde
 * tarieven tonen is misleidend), en onwaarschijnlijke percentages worden
 * weggefilterd. Raakt geen database: pure data + pure functies.
 */

import { describe, expect, it } from "vitest";
import snapshot from "@/lib/bronnen/rentes-verstrekkers-snapshot.json";
import {
  getVerstrekkersRentes,
  groepeerVoorTabel,
  leesVerstrekkersRentes,
  MAX_RENTE_PCT,
  MAX_SNAPSHOT_LEEFTIJD_DAGEN,
  MIN_RENTE_PCT,
  type VerstrekkerRenteRij,
} from "@/lib/bronnen/rentes-verstrekkers";

function rij(delta: Partial<VerstrekkerRenteRij> = {}): VerstrekkerRenteRij {
  return {
    verstrekker: "Testbank",
    product: "Annuïteitenhypotheek",
    rentevastJaren: 10,
    nhg: "ja",
    rentePct: 4.1,
    bronUrl: "https://www.testbank.nl/hypotheekrente",
    peildatum: "2026-07-23",
    opmerking: "",
    ...delta,
  };
}

function snapshotMet(rijen: VerstrekkerRenteRij[], opgehaaldOp = "2026-07-23") {
  return { opgehaaldOp, bron: "test", toelichting: "test", rijen };
}

// Vaste "vandaag" vlak na de peildatum, zodat de leeftijdscheck deterministisch is.
const VANDAAG = new Date("2026-07-24T12:00:00Z");

describe("leesVerstrekkersRentes (pure lezer)", () => {
  it("geldige snapshot: beschikbaar=true met de rijen en peildatum", () => {
    const uit = leesVerstrekkersRentes(snapshotMet([rij(), rij({ rentevastJaren: 20, rentePct: 4.5 })]), VANDAAG);
    expect(uit.beschikbaar).toBe(true);
    expect(uit.peildatum).toBe("2026-07-23");
    expect(uit.rijen).toHaveLength(2);
    expect(uit.rijen[0].verstrekker).toBe("Testbank");
  });

  it("ontbrekende of kapotte snapshot: beschikbaar=false", () => {
    expect(leesVerstrekkersRentes(undefined, VANDAAG).beschikbaar).toBe(false);
    expect(leesVerstrekkersRentes(null, VANDAAG).beschikbaar).toBe(false);
    expect(leesVerstrekkersRentes("onzin", VANDAAG).beschikbaar).toBe(false);
    expect(leesVerstrekkersRentes({}, VANDAAG).beschikbaar).toBe(false);
    expect(leesVerstrekkersRentes({ opgehaaldOp: "geen datum", rijen: [rij()] }, VANDAAG).beschikbaar).toBe(false);
  });

  it("lege rijen: beschikbaar=false (niets tonen is eerlijker dan een lege tabel)", () => {
    expect(leesVerstrekkersRentes(snapshotMet([]), VANDAAG).beschikbaar).toBe(false);
  });

  it("verouderde snapshot (ouder dan 45 dagen): beschikbaar=false; er net binnen: beschikbaar=true", () => {
    const opgehaald = "2026-06-01";
    const netBinnen = new Date(`2026-06-01T00:00:00Z`);
    netBinnen.setUTCDate(netBinnen.getUTCDate() + MAX_SNAPSHOT_LEEFTIJD_DAGEN);
    const netErover = new Date(netBinnen.getTime() + 24 * 60 * 60 * 1000);
    expect(leesVerstrekkersRentes(snapshotMet([rij()], opgehaald), netBinnen).beschikbaar).toBe(true);
    expect(leesVerstrekkersRentes(snapshotMet([rij()], opgehaald), netErover).beschikbaar).toBe(false);
  });

  it("plausibiliteitsfilter: percentages buiten 1-8% vallen weg, de rest blijft", () => {
    const uit = leesVerstrekkersRentes(
      snapshotMet([
        rij({ rentePct: 0.2 }),
        rij({ rentePct: 12.5 }),
        rij({ rentePct: MIN_RENTE_PCT }),
        rij({ rentePct: MAX_RENTE_PCT }),
      ]),
      VANDAAG,
    );
    expect(uit.beschikbaar).toBe(true);
    expect(uit.rijen.map((r) => r.rentePct)).toEqual([MIN_RENTE_PCT, MAX_RENTE_PCT]);
  });

  it("alleen onwaarschijnlijke rijen over: beschikbaar=false", () => {
    expect(leesVerstrekkersRentes(snapshotMet([rij({ rentePct: 0.1 })]), VANDAAG).beschikbaar).toBe(false);
  });

  it("misvormde rijen worden genegeerd in plaats van te crashen", () => {
    const bron = snapshotMet([rij()]);
    (bron.rijen as unknown[]).push({ verstrekker: "", rentePct: "vier" }, null, 42);
    const uit = leesVerstrekkersRentes(bron, VANDAAG);
    expect(uit.beschikbaar).toBe(true);
    expect(uit.rijen).toHaveLength(1);
  });
});

describe("groepeerVoorTabel", () => {
  it("zet 10- en 20-jaarsrijen van dezelfde verstrekker+NHG naast elkaar", () => {
    const uit = groepeerVoorTabel([
      rij({ rentevastJaren: 10, rentePct: 4.1, opmerking: "basis" }),
      rij({ rentevastJaren: 20, rentePct: 4.5, opmerking: "basis" }),
      rij({ rentevastJaren: 10, nhg: "nee", rentePct: 4.4, opmerking: "klasse >90%" }),
    ]);
    expect(uit).toHaveLength(2);
    expect(uit[0]).toMatchObject({ nhg: "ja", pct10: 4.1, pct20: 4.5, opmerkingen: ["basis"] });
    expect(uit[1]).toMatchObject({ nhg: "nee", pct10: 4.4, pct20: null });
  });

  it("sorteert op verstrekker en daarbinnen NHG voor niet-NHG (neutraal, geen rangorde op rente)", () => {
    const uit = groepeerVoorTabel([
      rij({ verstrekker: "Zuidbank", nhg: "nee" }),
      rij({ verstrekker: "Aabank", nhg: "nee", rentePct: 7.9 }),
      rij({ verstrekker: "Aabank", nhg: "ja" }),
    ]);
    expect(uit.map((r) => `${r.verstrekker}/${r.nhg}`)).toEqual(["Aabank/ja", "Aabank/nee", "Zuidbank/nee"]);
  });
});

describe("de gecommitte snapshot zelf", () => {
  it("parseert en heeft de verplichte velden per rij", () => {
    expect(snapshot.opgehaaldOp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot.bron.length).toBeGreaterThan(10);
    expect(Array.isArray(snapshot.rijen)).toBe(true);
    expect(snapshot.rijen.length).toBeGreaterThan(0);
    for (const r of snapshot.rijen) {
      expect(r.verstrekker.length).toBeGreaterThan(1);
      expect([10, 20]).toContain(r.rentevastJaren);
      expect(["ja", "nee", "onbekend"]).toContain(r.nhg);
      expect(r.rentePct).toBeGreaterThanOrEqual(MIN_RENTE_PCT);
      expect(r.rentePct).toBeLessThanOrEqual(MAX_RENTE_PCT);
      expect(r.bronUrl).toMatch(/^https:\/\//);
      expect(r.peildatum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("elke geslaagde verstrekker heeft zowel een 10- als een 20-jaarstarief", () => {
    for (const naam of new Set(snapshot.rijen.map((r) => r.verstrekker))) {
      const jaren = snapshot.rijen.filter((r) => r.verstrekker === naam).map((r) => r.rentevastJaren);
      expect(jaren, naam).toContain(10);
      expect(jaren, naam).toContain(20);
    }
  });

  it("overgeslagen banken staan er met een reden in (eerlijk ontbreken)", () => {
    for (const o of snapshot.overgeslagen) {
      expect(o.verstrekker.length).toBeGreaterThan(1);
      expect(o.reden.length).toBeGreaterThan(10);
    }
  });

  it("getVerstrekkersRentes: beschikbaar zolang de snapshot vers is, en nooit met implausibele rijen", () => {
    const dagNaSnapshot = new Date(`${snapshot.opgehaaldOp}T00:00:00Z`);
    dagNaSnapshot.setUTCDate(dagNaSnapshot.getUTCDate() + 1);
    const uit = getVerstrekkersRentes(dagNaSnapshot);
    expect(uit.beschikbaar).toBe(true);
    expect(uit.rijen.length).toBe(snapshot.rijen.length);
  });
});
