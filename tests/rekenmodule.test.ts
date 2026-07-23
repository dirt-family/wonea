import { describe, expect, it } from "vitest";
import {
  bewaarSessie,
  klemStap,
  laadSessie,
  parseStapParam,
  sessieSleutel,
  STAP_PARAM,
  stapZoekdeel,
  type SessieOpslag,
} from "@/components/rekenmodule/logica";

/**
 * Rekenmodule-framework (components/rekenmodule): de pure logica achter het
 * stap-frame. De UI-schil (rekenmodule.tsx) leunt volledig op deze functies
 * voor stap-in-de-URL, het klemmen van deelbare links op de validatiestand en
 * de sessie-persistentie; hier bewijzen we de randgevallen zonder DOM.
 */

describe("parseStapParam: ?stap= naar stapindex, stil terugvallen op stap 1", () => {
  it("vertaalt geldige 1-gebaseerde waarden naar 0-gebaseerde indexen", () => {
    expect(parseStapParam("1", 4)).toBe(0);
    expect(parseStapParam("2", 4)).toBe(1);
    expect(parseStapParam("4", 4)).toBe(3);
  });

  it("valt stil terug op stap 1 bij ontbrekende of onzinnige waarden", () => {
    expect(parseStapParam(null, 4)).toBe(0);
    expect(parseStapParam("", 4)).toBe(0);
    expect(parseStapParam("abc", 4)).toBe(0);
    expect(parseStapParam("2.5", 4)).toBe(0);
    expect(parseStapParam("-2", 4)).toBe(0);
    expect(parseStapParam("0", 4)).toBe(0);
    expect(parseStapParam("1e2", 4)).toBe(0);
  });

  it("valt terug op stap 1 als de stap buiten het bereik van de module ligt", () => {
    expect(parseStapParam("5", 4)).toBe(0);
    expect(parseStapParam("99", 4)).toBe(0);
  });

  it("accepteert voorloopnullen als dezelfde stap", () => {
    expect(parseStapParam("02", 4)).toBe(1);
  });
});

describe("klemStap: nooit verder dan de eerste onaffe invoerstap", () => {
  const ok = null;
  const mis = "Vul dit veld in.";

  it("laat elke stap toe als alle validaties in orde zijn, inclusief de uitkomst", () => {
    expect(klemStap(0, [ok, ok, ok])).toBe(0);
    expect(klemStap(2, [ok, ok, ok])).toBe(2);
    // Uitkomststap = index meldingen.length.
    expect(klemStap(3, [ok, ok, ok])).toBe(3);
  });

  it("klemt een diepe deel-link op de eerste stap met een melding", () => {
    expect(klemStap(3, [mis, ok, ok])).toBe(0);
    expect(klemStap(3, [ok, mis, ok])).toBe(1);
    expect(klemStap(2, [ok, ok, mis])).toBe(2);
  });

  it("laat teruggaan altijd toe, ook als een latere stap onaf is", () => {
    expect(klemStap(0, [ok, mis, ok])).toBe(0);
    expect(klemStap(1, [ok, mis, ok])).toBe(1);
  });

  it("klemt negatieve indexen op stap 1", () => {
    expect(klemStap(-1, [ok, ok])).toBe(0);
  });
});

describe("stapZoekdeel: deelbare URL met behoud van andere parameters", () => {
  it("geeft stap 1 een schone URL zonder parameter", () => {
    expect(stapZoekdeel("", 0)).toBe("");
    expect(stapZoekdeel("?stap=3", 0)).toBe("");
  });

  it("schrijft latere stappen als 1-gebaseerde ?stap=", () => {
    expect(stapZoekdeel("", 1)).toBe("?stap=2");
    expect(stapZoekdeel("?stap=2", 3)).toBe("?stap=4");
  });

  it("laat andere parameters met rust", () => {
    expect(stapZoekdeel("?bron=mail", 1)).toBe("?bron=mail&stap=2");
    expect(stapZoekdeel("?bron=mail&stap=4", 0)).toBe("?bron=mail");
  });

  it("is rond-reisbaar met parseStapParam", () => {
    for (const index of [0, 1, 2, 3]) {
      const zoekdeel = stapZoekdeel("", index);
      const raw = new URLSearchParams(zoekdeel).get(STAP_PARAM);
      expect(parseStapParam(raw, 4)).toBe(index);
    }
  });
});

describe("sessie-opslag: invoer overleeft een refresh, en falen is stil", () => {
  function maakOpslag(): SessieOpslag & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }

  it("bewaart en laadt een invoerstand per module-id", () => {
    const opslag = maakOpslag();
    bewaarSessie("budget", JSON.stringify({ inkomen1: "48000", samen: true }), opslag);
    expect(opslag.data.has(sessieSleutel("budget"))).toBe(true);
    expect(laadSessie("budget", opslag)).toEqual({ inkomen1: "48000", samen: true });
    // Andere module-id: eigen sleutel, dus leeg.
    expect(laadSessie("kosten-koper", opslag)).toBeNull();
  });

  it("geeft null bij corrupte of niet-object-inhoud", () => {
    const opslag = maakOpslag();
    opslag.data.set(sessieSleutel("budget"), "{kapot");
    expect(laadSessie("budget", opslag)).toBeNull();
    opslag.data.set(sessieSleutel("budget"), "42");
    expect(laadSessie("budget", opslag)).toBeNull();
    opslag.data.set(sessieSleutel("budget"), '["geen","object"]');
    expect(laadSessie("budget", opslag)).toBeNull();
    opslag.data.set(sessieSleutel("budget"), "null");
    expect(laadSessie("budget", opslag)).toBeNull();
  });

  it("faalt stil als de opslag zelf gooit (privemodus, vol)", () => {
    const kapot: SessieOpslag = {
      getItem: () => {
        throw new Error("geblokkeerd");
      },
      setItem: () => {
        throw new Error("vol");
      },
      removeItem: () => {
        throw new Error("geblokkeerd");
      },
    };
    expect(() => bewaarSessie("budget", "{}", kapot)).not.toThrow();
    expect(laadSessie("budget", kapot)).toBeNull();
  });

  it("doet niets buiten de browser (geen window): geen fout, geen data", () => {
    // De testomgeving is node, dus zonder meegegeven opslag is er geen window.
    expect(() => bewaarSessie("budget", "{}")).not.toThrow();
    expect(laadSessie("budget")).toBeNull();
  });
});
