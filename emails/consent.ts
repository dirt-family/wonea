import { emailLayout } from "@/emails/layout";
import { queueEmail } from "@/lib/email/send";
import { baseUrl } from "@/lib/util";
import type { ConsentDoel, EmailType } from "@/db/schema";

/**
 * Bevestigingsmails voor AVG-zelfbeheer op /account: toestemming ingetrokken
 * en account opgezegd. Alleen via de outbox (queueEmail); er wordt niets echt
 * verstuurd.
 *
 * LET OP: EmailType in db/schema.ts kent deze twee typen nog niet en dat
 * bestand is gedeeld (read-only voor deze module). De kolom is text in de
 * database, dus we casten hier bewust zodat het type-label in de outbox de
 * waarheid vertelt in plaats van een bestaand-maar-fout label te lenen.
 * TODO voor de schema-eigenaar: voeg "consent_ingetrokken" en
 * "account_opgezegd" toe aan EmailType en haal deze casts weg.
 */
const TYPE_CONSENT_INGETROKKEN = "consent_ingetrokken" as string as EmailType;
const TYPE_ACCOUNT_OPGEZEGD = "account_opgezegd" as string as EmailType;

export async function stuurConsentIngetrokken(input: { to: string; doel: ConsentDoel; doelLabel: string }): Promise<void> {
  await queueEmail({
    to: input.to,
    subject: "Bevestiging: je toestemming is ingetrokken",
    type: TYPE_CONSENT_INGETROKKEN,
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">Toestemming ingetrokken</h1>
       <p style="line-height:1.6;">Je hebt zojuist je toestemming voor <strong>${input.doelLabel}</strong> ingetrokken. Wonea gebruikt je e-mailadres hier vanaf nu niet meer voor.</p>
       ${input.doel === "alerts" ? `<p style="line-height:1.6;">Je waarde-alerts staan daarmee ook uit.</p>` : ""}
       ${input.doel === "lead_doorgifte" ? `<p style="line-height:1.6;">Eerlijk is eerlijk: een aanvraag die al is doorgestuurd halen we hiermee niet terug. Voor nieuwe doorgifte gebruiken we je gegevens niet meer.</p>` : ""}
       <p style="line-height:1.6;">Was dit niet de bedoeling? Toestemming geven kan altijd opnieuw, via <a href="${baseUrl()}/account" style="color:#16324f;">je accountpagina</a>.</p>`,
      { afmeldPad: "/account" },
    ),
  });
}

export async function stuurAccountOpgezegd(to: string): Promise<void> {
  await queueEmail({
    to,
    subject: "Je Wonea-account is opgezegd",
    type: TYPE_ACCOUNT_OPGEZEGD,
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">Je account is opgezegd</h1>
       <p style="line-height:1.6;">Zoals je vroeg hebben we je account verwijderd. Dit is er gebeurd:</p>
       <ul style="line-height:1.8;padding-left:20px;">
         <li>je claims en hypotheekgegevens zijn verwijderd;</li>
         <li>je toestemmingen zijn ingetrokken (het register bewaren we als bewijs van geven en intrekken);</li>
         <li>je sessies en inloggegevens zijn verwijderd;</li>
         <li>eerdere aanvragen zijn geanonimiseerd: je e-mailadres is eruit gehaald.</li>
       </ul>
       <p style="line-height:1.6;">De publieke woningpagina van een adres staat los van een account. Wil je die ook weg, dan kan dat altijd, in twee stappen en zonder account, via <a href="${baseUrl()}/verwijderen" style="color:#16324f;">de verwijderpagina</a>.</p>
       <p style="line-height:1.6;">Dit is de laatste mail die je van ons krijgt. Bedankt dat je Wonea probeerde.</p>`,
      { afmeldPad: "/privacy" },
    ),
  });
}
