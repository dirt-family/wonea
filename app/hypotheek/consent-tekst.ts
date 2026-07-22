/**
 * Letterlijke consent-tekst voor de hypotheekfunnel.
 * AVG art. 7: de consent-rij logt exact de tekst die de gebruiker zag, met
 * versienummer. Wijzig je de tekst, verhoog dan de versie (hypotheek-v2, ...).
 */

export const HYPOTHEEK_CONSENT_TEKSTVERSIE = "hypotheek-v1";

export const HYPOTHEEK_CONSENT_TEKST =
  "Ik geef Wonea toestemming om deze aanvraag, met mijn antwoorden en e-mailadres, eenmalig door te geven aan een onafhankelijke hypotheekadviseur, alleen voor dit doel: contact over mijn hypotheekvraag. Voor iets anders wordt mijn e-mailadres niet gebruikt.";

/** Zoals opgeslagen in consents.tekstversie. */
export function hypotheekConsentTekstversie(): string {
  return `${HYPOTHEEK_CONSENT_TEKSTVERSIE}: "${HYPOTHEEK_CONSENT_TEKST}"`;
}

/** Type partij dat de lead ontvangt; staat ook voor de verzendknop in de UI. */
export const HYPOTHEEK_PARTIJ_TYPE = "een onafhankelijke hypotheekadviseur";
