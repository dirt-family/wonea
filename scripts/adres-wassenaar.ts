/**
 * Voorbeeldadres-script: Wittelaan 12, 2245VP Wassenaar (buurt Kerkehout).
 * Tweede voorbeeldadres van Wonea: bestaat als woningpagina
 * (/woning/2245VP/12) en draait mee in zoeken en buurt-rijen; de
 * homepage-hero blijft Jamaïcaring 9 (VOORBEELD_ADRES, lib/homepage-data.ts).
 *
 * Draaien:  npx tsx --env-file=.env scripts/adres-wassenaar.ts
 * Prod:     DATABASE_URL=<PROD_DATABASE_URL> npx tsx scripts/adres-wassenaar.ts
 *
 * Dunne wrapper: de gedeelde flow, de geverifieerde brondata (bron per veld)
 * en de idempotentie-garanties staan in scripts/adres-voorbeelden.ts.
 */
import { WASSENAAR, runVoorbeelden } from "./adres-voorbeelden";

runVoorbeelden([WASSENAAR]);
