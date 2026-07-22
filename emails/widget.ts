import { emailLayout } from "@/emails/layout";
import { queueEmail } from "@/lib/email/send";
import { baseUrl } from "@/lib/util";
import { WIDGET_CONSENT_CHECKBOX } from "@/app/widget/consent";

/**
 * Double opt-in voor de widget-e-mailcapture: zonder klik op deze mail sturen
 * we nooit iets, en de aanmelding wordt na 30 dagen gepurged (scripts/purge.ts).
 */
export function stuurWidgetDoubleOptin(to: string, adresNaam: string | null, token: string, bronDomein: string): void {
  const link = `${baseUrl()}/widget/bevestig/${token}`;
  const waarover = adresNaam ? `de waardeontwikkeling van <strong>${adresNaam}</strong>` : "de waardeontwikkeling van het door jou ingevulde adres";
  queueEmail({
    to,
    subject: "Bevestig je aanmelding voor waarde-updates",
    type: "widget_double_optin",
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">Nog een klik en je aanmelding staat</h1>
       <p style="line-height:1.6;">Je vulde je e-mailadres in bij de woningwaarde-widget op <strong>${bronDomein}</strong>, met deze vraag: "${WIDGET_CONSENT_CHECKBOX}". Het gaat om ${waarover}.</p>
       <p style="line-height:1.6;">Klik op de knop om dat te bevestigen. Zonder die klik sturen we je niets en verwijderen we je aanmelding na 30 dagen vanzelf.</p>
       <p style="margin:24px 0;"><a href="${link}" style="background:#16324f;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Ja, houd mij op de hoogte</a></p>
       <p style="line-height:1.6;font-size:13px;color:#6b7280;">Niet door jou ingevuld? Dan kun je deze mail negeren; er gebeurt niets zonder deze bevestiging.</p>`,
      { afmeldPad: "/privacy" },
    ),
  });
}
