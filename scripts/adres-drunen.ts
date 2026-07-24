/**
 * Voorbeeldadres-script: Jamaïcaring 9, 5152ME Drunen (gemeente Heusden).
 * Dit is Mitch' eigen woonadres; op zijn eigen verzoek is dit HET vaste
 * voorbeeldadres van Wonea (zie VOORBEELD_ADRES in lib/homepage-data.ts).
 *
 * Draaien:  npx tsx --env-file=.env scripts/adres-drunen.ts
 * Prod:     DATABASE_URL=<PROD_DATABASE_URL> npx tsx scripts/adres-drunen.ts
 *
 * Dunne wrapper: de gedeelde flow, de geverifieerde brondata (bron per veld)
 * en de idempotentie-garanties staan in scripts/adres-voorbeelden.ts.
 */
import { DRUNEN, runVoorbeelden } from "./adres-voorbeelden";

runVoorbeelden([DRUNEN]);
