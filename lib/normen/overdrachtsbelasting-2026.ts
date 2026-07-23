/**
 * Overdrachtsbelasting 2026: tarieven en startersvrijstelling.
 *
 * PRIMAIRE BRON (geverifieerd op de peildatum hieronder):
 *   Wet op belastingen van rechtsverkeer, geldend vanaf 01-01-2026.
 *   URL: https://wetten.overheid.nl/BWBR0002740/2026-01-01
 *   - Artikel 14, eerste lid: algemeen tarief 10,4% (niet-woningen, zoals
 *     bedrijfspanden en kantoren).
 *   - Artikel 14, tweede lid: 8% voor woningen die NIET als hoofdverblijf van
 *     de verkrijger gaan dienen (beleggers, tweede woning, vakantiewoning).
 *     Nieuw per 1 januari 2026; tot en met 2025 gold hier 10,4%.
 *   - Artikel 14, derde lid: 2% voor de verkrijging door een natuurlijk
 *     persoon van een woning die deze zelf, anders dan tijdelijk, als
 *     hoofdverblijf gaat gebruiken.
 *   - Artikel 15, eerste lid, onderdeel p (startersvrijstelling): eenmalige
 *     vrijstelling voor een meerderjarig natuurlijk persoon jonger dan
 *     35 jaar die de woning zelf als hoofdverblijf gaat gebruiken, mits de
 *     waarde van de woning (met aanhorigheden) niet uitkomt boven 555.000
 *     euro. Boven die grens vervalt de vrijstelling volledig (geen
 *     drempelvrijstelling): er is dan 2% verschuldigd over de hele waarde.
 *
 * TWEEDE BRON (cross-check, zelfde peildatum):
 *   belastingdienst.nl, "Het tarief van de overdrachtsbelasting" en
 *   "Wanneer kunt u de startersvrijstelling krijgen": bevestigt 2% / 8% /
 *   10,4% voor 2026, de leeftijd 18 tot 35 jaar en de woningwaardegrens van
 *   555.000 euro voor 2026.
 *
 * Alle percentages zijn procentpunten (10.4 betekent 10,4%); bedragen zijn
 * hele euro's.
 */

/** Datum waarop de bronnen hierboven zijn nagelezen. */
export const OVB_PEILDATUM = "2026-07-23";

/** Bron-URL van de wettekst (geldend vanaf 1 januari 2026). */
export const OVB_BRON_URL = "https://wetten.overheid.nl/BWBR0002740/2026-01-01";

/** Tarief voor een woning die de koper zelf als hoofdverblijf gaat gebruiken (art. 14 lid 3). */
export const OVB_TARIEF_HOOFDVERBLIJF_PCT = 2;

/** Tarief voor een woning die niet het hoofdverblijf wordt, zoals verhuur of een tweede woning (art. 14 lid 2, per 2026). */
export const OVB_TARIEF_WONING_OVERIG_PCT = 8;

/** Algemeen tarief voor niet-woningen (art. 14 lid 1). */
export const OVB_TARIEF_ALGEMEEN_PCT = 10.4;

/** Startersvrijstelling: minimumleeftijd (meerderjarig, art. 15 lid 1 onderdeel p, 1e). */
export const STARTERS_LEEFTIJD_VANAF = 18;

/** Startersvrijstelling: de koper moet jonger zijn dan deze leeftijd (art. 15 lid 1 onderdeel p, 1e). */
export const STARTERS_LEEFTIJD_TOT = 35;

/** Startersvrijstelling 2026: de woningwaarde mag niet boven dit bedrag uitkomen (art. 15 lid 1 onderdeel p, 4e). */
export const STARTERS_WONINGWAARDEGRENS = 555_000;

/**
 * Voor welke situatie gerekend wordt. De rekenhulp op /kosten-koper gaat over
 * kopen om er zelf te wonen; "woning_overig" bestaat zodat de niet-hoofdverblijf
 * situatie (beleggers, tweede woning) met dezelfde normlaag te berekenen is.
 */
export type OvbSituatie = "hoofdverblijf" | "woning_overig";

export interface OverdrachtsbelastingInvoer {
  /**
   * Waarde van de woning in hele euro's. De wet toetst op de waarde in het
   * economische verkeer (minimaal de koopsom); de rekenhulp gebruikt de
   * koopsom als benadering en zegt dat er eerlijk bij.
   */
  woningwaarde: number;
  /** Wordt de woning het eigen hoofdverblijf van de koper? */
  situatie: OvbSituatie;
  /**
   * True als de koper aan de persoonlijke starters-voorwaarden voldoet:
   * 18 tot 35 jaar op het moment van overdracht en de vrijstelling nog nooit
   * gebruikt. De waardegrens toetst deze functie zelf.
   */
  startersvrijstelling: boolean;
}

export interface OverdrachtsbelastingUitkomst {
  /** Toegepast tarief in procentpunten (0 bij vrijstelling). */
  tariefPct: number;
  /** Verschuldigde overdrachtsbelasting in hele euro's. */
  belasting: number;
  /** True als de startersvrijstelling is toegepast (0%). */
  vrijstellingToegepast: boolean;
  /**
   * True als om de vrijstelling gevraagd is maar de woningwaarde boven de
   * grens ligt: de vrijstelling vervalt dan volledig en het tarief van 2%
   * geldt over de hele waarde. De UI legt dit expliciet uit.
   */
  vrijstellingVervallenDoorWaardegrens: boolean;
}

/**
 * Berekent de overdrachtsbelasting 2026. Puur en zonder afronding onderweg:
 * alleen het eindbedrag wordt afgerond op hele euro's.
 */
export function berekenOverdrachtsbelasting(invoer: OverdrachtsbelastingInvoer): OverdrachtsbelastingUitkomst {
  const waarde = Math.max(0, invoer.woningwaarde);

  if (invoer.situatie === "woning_overig") {
    // Geen hoofdverblijf: 8% (art. 14 lid 2). De startersvrijstelling vereist
    // zelfbewoning en is hier dus nooit van toepassing.
    return {
      tariefPct: OVB_TARIEF_WONING_OVERIG_PCT,
      belasting: Math.round((waarde * OVB_TARIEF_WONING_OVERIG_PCT) / 100),
      vrijstellingToegepast: false,
      vrijstellingVervallenDoorWaardegrens: false,
    };
  }

  if (invoer.startersvrijstelling && waarde <= STARTERS_WONINGWAARDEGRENS) {
    return {
      tariefPct: 0,
      belasting: 0,
      vrijstellingToegepast: true,
      vrijstellingVervallenDoorWaardegrens: false,
    };
  }

  // Hoofdverblijf zonder (geldige) vrijstelling: 2% over de hele waarde. Boven
  // de waardegrens is er geen gedeeltelijke vrijstelling (alles-of-niets).
  return {
    tariefPct: OVB_TARIEF_HOOFDVERBLIJF_PCT,
    belasting: Math.round((waarde * OVB_TARIEF_HOOFDVERBLIJF_PCT) / 100),
    vrijstellingToegepast: false,
    vrijstellingVervallenDoorWaardegrens: invoer.startersvrijstelling && waarde > STARTERS_WONINGWAARDEGRENS,
  };
}
