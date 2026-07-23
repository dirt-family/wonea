import {
  berekenTerugverdientijd,
  type Bereik,
  type MaatregelAdvies,
  type MaatregelKey,
} from "@/app/verduurzamen/advies/advies";
import { berekenIsolatieSubsidie, ISDE_ISOLATIE, type IsolatieMaatregelKey } from "@/lib/normen/isde-2026";

/**
 * Totaalplan-aggregatie voor de verduurzamings-rekenmodule: telt de bestaande
 * maatregel-adviezen (app/verduurzamen/advies/advies.ts) op tot een plan met
 * besparing per jaar, ISDE-subsidie, netto-investering en terugverdientijd.
 *
 * Pure module, geen React en geen database; getest in
 * tests/verduurzaam-plan.test.ts. Er staan hier geen nieuwe rekenregels:
 * alle bedragen komen uit lib/normen/* en advies.ts, de terugverdientijd
 * gebruikt berekenTerugverdientijd, en de ISDE-verdubbelingsregel is de
 * bestaande regel uit lib/normen/isde-2026.ts (berekenIsolatieSubsidie met
 * meerdereMaatregelen=true).
 *
 * Eerlijkheid: maatregelen zonder kental (appartement-isolatie) of zonder
 * kosten-ordegrootte (zonneboiler) tellen niet stiekem mee; ze staan met naam
 * in de *Zonder*-lijsten zodat de UI dat kan benoemen.
 */

/**
 * Maatregelen die voor de RVO-verdubbelingsregel meetellen: een
 * isolatiemaatregel gecombineerd met een andere isolatiemaatregel,
 * warmtepomp of zonneboiler (binnen 24 maanden). Zonnepanelen tellen niet
 * mee (geen ISDE-maatregel). Bron: lib/normen/isde-2026.ts.
 */
const TELT_VOOR_VERDUBBELING: readonly MaatregelKey[] = [
  "dakisolatie",
  "spouwmuurisolatie",
  "vloerisolatie",
  "glasisolatie",
  "warmtepomp",
  "zonneboiler",
] as const;

/** De drie isolatiemaatregelen waarvoor lib/normen het verdubbelde m2-tarief kan rekenen. */
const M2_ISOLATIE_KEYS: readonly MaatregelKey[] = ["dakisolatie", "spouwmuurisolatie", "vloerisolatie"] as const;

export type Totaalplan = {
  /** De gekozen maatregelen, in de vaste advies-volgorde. */
  gekozen: MaatregelAdvies[];
  /** Som van de besparingskentallen; null als geen gekozen maatregel een kental heeft. */
  besparing: Bereik | null;
  /** Gekozen maatregelen zonder besparingskental (bv. isolatie bij een appartement). */
  zonderKental: MaatregelKey[];
  /** Som van de ISDE-indicaties over de gekozen maatregelen, hele euro's. */
  subsidie: number;
  /** true als het verdubbelde m2-tarief voor dak-, spouwmuur- of vloerisolatie is gerekend. */
  isolatieVerdubbeld: boolean;
  /** Gekozen maatregelen zonder ISDE (zonnepanelen). */
  zonderSubsidie: MaatregelKey[];
  /** Som van de kosten-ordegroottes; null als geen gekozen maatregel er een heeft. */
  kosten: Bereik | null;
  /** Gekozen maatregelen zonder kosten-ordegrootte (zonneboiler). */
  zonderKosten: MaatregelKey[];
  /** Kosten min subsidie over de maatregelen met bekende kosten, begrensd op 0. */
  netto: Bereik | null;
  /** Terugverdientijd over de maatregelen met kosten en kental; null als die er niet zijn. */
  terugverdientijd: Bereik | null;
  /** Gekozen maatregelen die buiten de terugverdientijd vallen (kosten of kental ontbreekt). */
  buitenTerugverdientijd: MaatregelKey[];
};

function somBereik(bereiken: Bereik[]): Bereik | null {
  if (bereiken.length === 0) return null;
  return bereiken.reduce((acc, b) => ({ laag: acc.laag + b.laag, hoog: acc.hoog + b.hoog }), { laag: 0, hoog: 0 });
}

/**
 * ISDE-indicatie voor een gekozen maatregel binnen het plan. Bij 2 of meer
 * maatregelen die voor de verdubbelingsregel meetellen geldt voor dak-,
 * spouwmuur- en vloerisolatie het verdubbelde bedrag per m2 (zelfde
 * rekenvoorbeeld bij het minimumoppervlak als in advies.ts). Glas houdt
 * bewust het basisbedrag: lib/normen kent daarvoor geen verdubbeld tarief,
 * en te laag tonen is eerlijker dan te hoog.
 */
function subsidieInPlan(advies: MaatregelAdvies, meerdereMaatregelen: boolean): number {
  if (!advies.subsidie) return 0;
  if (meerdereMaatregelen && M2_ISOLATIE_KEYS.includes(advies.key)) {
    const isde = ISDE_ISOLATIE.find((m) => m.key === (advies.key as IsolatieMaatregelKey));
    if (isde) return berekenIsolatieSubsidie(isde.key, isde.minM2, true);
  }
  return advies.subsidie.bedrag;
}

/** Bouwt het totaalplan voor een selectie van maatregel-keys. */
export function maakTotaalplan(adviezen: MaatregelAdvies[], gekozenKeys: MaatregelKey[]): Totaalplan {
  const gekozen = adviezen.filter((a) => gekozenKeys.includes(a.key));

  const aantalVoorVerdubbeling = gekozen.filter((a) => TELT_VOOR_VERDUBBELING.includes(a.key)).length;
  const meerdere = aantalVoorVerdubbeling >= 2;
  const isolatieVerdubbeld = meerdere && gekozen.some((a) => M2_ISOLATIE_KEYS.includes(a.key));

  const metKental = gekozen.filter((a) => a.besparing !== null);
  const metKosten = gekozen.filter((a) => a.kosten !== null);
  const compleet = gekozen.filter((a) => a.besparing !== null && a.kosten !== null);

  const subsidie = gekozen.reduce((som, a) => som + subsidieInPlan(a, meerdere), 0);

  const besparing = somBereik(metKental.map((a) => a.besparing!.bereik));
  const kosten = somBereik(metKosten.map((a) => a.kosten!.bereik));

  // Netto-investering: alleen over de maatregelen met bekende kosten, en met
  // alleen de subsidie van diezelfde maatregelen (anders drukt bv. de
  // zonneboiler-subsidie de kosten van een andere maatregel).
  const subsidieMetKosten = metKosten.reduce((som, a) => som + subsidieInPlan(a, meerdere), 0);
  const netto: Bereik | null = kosten
    ? {
        laag: Math.max(0, kosten.laag - subsidieMetKosten),
        hoog: Math.max(0, kosten.hoog - subsidieMetKosten),
      }
    : null;

  // Terugverdientijd: alleen over de maatregelen waarvan kosten en kental
  // allebei bekend zijn, met de bestaande formule uit advies.ts.
  const kostenCompleet = somBereik(compleet.map((a) => a.kosten!.bereik));
  const besparingCompleet = somBereik(compleet.map((a) => a.besparing!.bereik));
  const subsidieCompleet = compleet.reduce((som, a) => som + subsidieInPlan(a, meerdere), 0);
  const terugverdientijd =
    kostenCompleet && besparingCompleet
      ? berekenTerugverdientijd(kostenCompleet, subsidieCompleet, besparingCompleet)
      : null;

  return {
    gekozen,
    besparing,
    zonderKental: gekozen.filter((a) => a.besparing === null).map((a) => a.key),
    subsidie,
    isolatieVerdubbeld,
    zonderSubsidie: gekozen.filter((a) => a.subsidie === null).map((a) => a.key),
    kosten,
    zonderKosten: gekozen.filter((a) => a.kosten === null).map((a) => a.key),
    netto,
    terugverdientijd,
    buitenTerugverdientijd: gekozen.filter((a) => a.besparing === null || a.kosten === null).map((a) => a.key),
  };
}
