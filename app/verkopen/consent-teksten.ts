/**
 * Letterlijke consent-tekst voor de verkoopfunnel (makelaarslead).
 * AVG art. 7: de consent-rij logt de exacte tekst die de gebruiker zag,
 * plus een versienummer. Wijzig je de tekst, verhoog dan de versie.
 */

export const CONSENT_TEKSTVERSIE = "verkopen-v1";

export const CONSENT_TEKST =
  "Wonea mag mijn aanvraag en mijn antwoorden eenmalig doorgeven aan een lokale verkoopmakelaar, zodat die contact met mij kan opnemen over de verkoop van mijn woning.";

/** De tekstversie zoals die in consents.tekstversie wordt opgeslagen. */
export function consentTekstversie(): string {
  return `${CONSENT_TEKSTVERSIE}: "${CONSENT_TEKST}"`;
}
