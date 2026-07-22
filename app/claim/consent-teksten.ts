/**
 * Letterlijke consent-teksten voor de claim-flow en het dashboard.
 * AVG art. 7: elke consent-rij logt de exacte tekst die de gebruiker zag,
 * plus een versienummer. Wijzig je een tekst, verhoog dan de versie.
 */

export const CONSENT_TEKSTVERSIE = "claim-v1";

export const CONSENT_TEKST_ALERTS = "Stuur mij maandelijks de waardeontwikkeling van deze woning";

export const CONSENT_TEKST_MARKETING = "Wonea mag mij af en toe relevante aanbiedingen sturen, bv. hypotheekadvies";

/** De tekstversie zoals die in consents.tekstversie wordt opgeslagen. */
export function consentTekstversie(doel: "alerts" | "marketing"): string {
  const tekst = doel === "alerts" ? CONSENT_TEKST_ALERTS : CONSENT_TEKST_MARKETING;
  return `${CONSENT_TEKSTVERSIE}: "${tekst}"`;
}
