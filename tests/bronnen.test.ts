/**
 * Open-cijferbronnen: snapshots parsen, ranges gezond, peildatum aanwezig.
 *
 * Deze tests raken geen database: de bronmodules (lib/bronnen, lib/normen)
 * zijn pure data + pure functies. Ze bewaken dat een verse ingest-run
 * (scripts/ingest-open/) geen kapotte of onwaarschijnlijke data commit.
 */

import { describe, expect, it } from "vitest";
import snapshot from "@/lib/bronnen/rentes-snapshot.json";
import { getActueleRentes, getRenteBucket, peilmaandLabel } from "@/lib/bronnen/rentes";
import {
  berekenIsolatieSubsidie,
  ISDE_BRONNEN,
  ISDE_GLAS,
  ISDE_ISOLATIE,
  ISDE_PEILDATUM,
  ISDE_WARMTEPOMP_MINIMUM_EUR,
  ISDE_WARMTEPOMPEN,
  ISDE_ZONNEBOILERS,
} from "@/lib/normen/isde-2026";
import {
  BESPARING_DISCLAIMER,
  BESPARING_GASPRIJS_EUR_PER_M3,
  BESPARING_KENTALLEN,
  BESPARING_PEILDATUM,
  BESPARING_ZONNEPANELEN,
} from "@/lib/normen/besparing";

describe("DNB-rentes (lib/bronnen)", () => {
  it("snapshot parseert en heeft peildatum, bron en de vier buckets", () => {
    expect(snapshot.peildatum).toMatch(/^\d{4}-\d{2}$/);
    expect(snapshot.opgehaaldOp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot.bron).toContain("DNB");
    expect(snapshot.bronUrl).toMatch(/^https:\/\/www\.dnb\.nl\//);
    expect(snapshot.buckets).toHaveLength(4);
  });

  it("getActueleRentes levert exact de vier bekende buckets in vaste volgorde", () => {
    const rentes = getActueleRentes();
    expect(rentes.buckets.map((b) => b.bucket)).toEqual(["variabel_tot_1", "1_tot_5", "5_tot_10", "vanaf_10"]);
    for (const bucket of rentes.buckets) {
      expect(bucket.label.length).toBeGreaterThan(5);
      expect(bucket.reeksDnb.length).toBeGreaterThan(3);
    }
  });

  it("alle rentes liggen in een gezonde bandbreedte (1-10 procent)", () => {
    const rentes = getActueleRentes();
    for (const bucket of rentes.buckets) {
      expect(bucket.rentePct).toBeGreaterThanOrEqual(1);
      expect(bucket.rentePct).toBeLessThanOrEqual(10);
    }
    if (rentes.totaalRentePct !== null) {
      expect(rentes.totaalRentePct).toBeGreaterThanOrEqual(1);
      expect(rentes.totaalRentePct).toBeLessThanOrEqual(10);
    }
  });

  it("getRenteBucket vindt een bucket op sleutel", () => {
    expect(getRenteBucket("5_tot_10")?.rentePct).toBe(getActueleRentes().buckets[2].rentePct);
    expect(getRenteBucket("variabel_tot_1")).toBeDefined();
  });

  it("peilmaandLabel maakt er een Nederlandse maandnaam van", () => {
    expect(peilmaandLabel("2026-05")).toBe("mei 2026");
    expect(peilmaandLabel()).toMatch(/^[a-z]+ \d{4}$/);
    // kapotte invoer: geef de invoer terug, verzin geen datum
    expect(peilmaandLabel("onzin")).toBe("onzin");
  });
});

describe("ISDE 2026 (lib/normen/isde-2026)", () => {
  it("heeft een peildatum en bron-URL's", () => {
    expect(ISDE_PEILDATUM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const url of Object.values(ISDE_BRONNEN)) {
      expect(url).toMatch(/^https:\/\/www\.rvo\.nl\//);
    }
  });

  it("alle isolatiebedragen zijn positief met logische min/max-oppervlakken", () => {
    expect(ISDE_ISOLATIE.length).toBe(6);
    for (const maatregel of ISDE_ISOLATIE) {
      expect(maatregel.eurPerM2).toBeGreaterThan(0);
      expect(maatregel.biobasedBonusEurPerM2).toBeGreaterThan(0);
      expect(maatregel.minM2).toBeGreaterThan(0);
      expect(maatregel.maxM2).toBeGreaterThan(maatregel.minM2);
    }
  });

  it("glas-tarieven zijn positief en het oppervlak is begrensd", () => {
    expect(ISDE_GLAS.tarieven.length).toBeGreaterThanOrEqual(4);
    for (const tarief of ISDE_GLAS.tarieven) {
      expect(tarief.eurPerM2).toBeGreaterThan(0);
    }
    expect(ISDE_GLAS.minM2Totaal).toBeGreaterThan(0);
    expect(ISDE_GLAS.maxM2Totaal).toBeGreaterThan(ISDE_GLAS.minM2Totaal);
  });

  it("berekenIsolatieSubsidie: onder minimum 0, boven maximum begrensd, verdubbeling klopt", () => {
    // dakisolatie: 16,25 per m2, min 20, max 200
    expect(berekenIsolatieSubsidie("dakisolatie", 10, false)).toBe(0);
    expect(berekenIsolatieSubsidie("dakisolatie", 40, false)).toBe(Math.round(40 * 16.25));
    expect(berekenIsolatieSubsidie("dakisolatie", 40, true)).toBe(Math.round(40 * 16.25 * 2));
    expect(berekenIsolatieSubsidie("dakisolatie", 500, false)).toBe(Math.round(200 * 16.25));
  });

  it("apparaat-indicaties zijn consistent (n > 0, min <= mediaan <= max, alles > 0)", () => {
    for (const indicatie of [...ISDE_WARMTEPOMPEN, ...ISDE_ZONNEBOILERS]) {
      expect(indicatie.nApparaten).toBeGreaterThan(0);
      expect(indicatie.minEur).toBeGreaterThan(0);
      expect(indicatie.mediaanEur).toBeGreaterThanOrEqual(indicatie.minEur);
      expect(indicatie.maxEur).toBeGreaterThanOrEqual(indicatie.mediaanEur);
      expect(indicatie.gemiddeldEur).toBeGreaterThanOrEqual(indicatie.minEur);
      expect(indicatie.gemiddeldEur).toBeLessThanOrEqual(indicatie.maxEur);
    }
  });

  it("warmtepomp-minimum is het RVO-minimum van 500 euro", () => {
    expect(ISDE_WARMTEPOMP_MINIMUM_EUR).toBe(500);
    for (const wp of ISDE_WARMTEPOMPEN) {
      expect(wp.minEur).toBeGreaterThanOrEqual(ISDE_WARMTEPOMP_MINIMUM_EUR);
    }
  });
});

describe("Besparingskentallen (lib/normen/besparing)", () => {
  it("heeft peildatum, gasprijs-basis en een disclaimer die de indicatie benoemt", () => {
    expect(BESPARING_PEILDATUM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(BESPARING_GASPRIJS_EUR_PER_M3).toBeGreaterThan(0.5);
    expect(BESPARING_GASPRIJS_EUR_PER_M3).toBeLessThan(5);
    expect(BESPARING_DISCLAIMER).toContain("Indicatie");
    expect(BESPARING_DISCLAIMER).toContain("1,37");
  });

  it("elk kental heeft een positieve, plausibele jaarbesparing plus bron en peildatum", () => {
    expect(BESPARING_KENTALLEN.length).toBeGreaterThanOrEqual(7);
    for (const kental of BESPARING_KENTALLEN) {
      expect(kental.eurPerJaar).toBeGreaterThan(0);
      expect(kental.eurPerJaar).toBeLessThan(5000);
      expect(kental.bronUrl).toMatch(/^https:\/\/www\.milieucentraal\.nl\//);
      expect(kental.bronGewijzigd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(kental.basisgeval.length).toBeGreaterThan(10);
    }
  });

  it("per woningtype: een vrijstaande woning bespaart nooit minder dan een tussenwoning", () => {
    for (const kental of BESPARING_KENTALLEN) {
      if (!kental.perWoningtype) continue;
      const { tussenwoning, vrijstaand } = kental.perWoningtype;
      expect(tussenwoning.eurPerJaar).toBeGreaterThan(0);
      expect(vrijstaand.eurPerJaar).toBeGreaterThanOrEqual(tussenwoning.eurPerJaar);
      expect(kental.eurPerJaar).toBe(tussenwoning.eurPerJaar);
    }
  });

  it("zonnepanelen: de besparing na 2027 (einde salderen) is lager dan die van 2026", () => {
    expect(BESPARING_ZONNEPANELEN.eurPerJaar2026).toBeGreaterThan(0);
    expect(BESPARING_ZONNEPANELEN.eurPerJaarVanaf2027).toBeGreaterThan(0);
    expect(BESPARING_ZONNEPANELEN.eurPerJaarVanaf2027).toBeLessThan(BESPARING_ZONNEPANELEN.eurPerJaar2026);
  });
});
