/**
 * Letterlijke consent-tekst voor de taxatierapport-funnel.
 * AVG art. 7: de consent-rij logt de exacte tekst die de gebruiker zag,
 * plus een versienummer. Wijzig je de tekst, verhoog dan de versie.
 */

export const CONSENT_TEKSTVERSIE = "taxatie-v1";

export const CONSENT_TEKST =
  "Wonea mag mijn aanvraag eenmalig doorgeven aan een gecertificeerde taxateur, zodat die contact met mij kan opnemen over een gevalideerd taxatierapport voor mijn woning.";

/** De tekstversie zoals die in consents.tekstversie wordt opgeslagen. */
export function consentTekstversie(): string {
  return `${CONSENT_TEKSTVERSIE}: "${CONSENT_TEKST}"`;
}
