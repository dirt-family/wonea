import { emailLayout } from "@/emails/layout";
import { queueEmail } from "@/lib/email/send";
import { CONSENT_TEKST_ALERTS, CONSENT_TEKST_MARKETING } from "@/app/claim/consent-teksten";

/**
 * Magic-link-mail voor de claim-flow. De keuzes (rol, alerts, marketing)
 * reizen mee in de verzilverlink en worden pas na de bevestigingsklik
 * vastgelegd; deze mail herhaalt ze zodat de ontvanger precies weet wat er
 * gebeurt bij het klikken.
 */
export function stuurMagicLink(input: {
  to: string;
  adresNaam: string;
  rol: "eigenaar" | "bewoner";
  alerts: boolean;
  marketing: boolean;
  verzilverUrl: string;
}): void {
  const keuzes: string[] = [`Je claimt dit adres als ${input.rol} (zelfverklaring, we controleren geen eigendom).`];
  if (input.alerts) keuzes.push(`Je vinkte aan: "${CONSENT_TEKST_ALERTS}".`);
  if (input.marketing) keuzes.push(`Je vinkte aan: "${CONSENT_TEKST_MARKETING}".`);
  if (!input.alerts && !input.marketing) keuzes.push("Je vinkte geen extra mails aan; je krijgt dus alleen deze bevestiging.");

  queueEmail({
    to: input.to,
    subject: `Bevestig je e-mailadres voor ${input.adresNaam}`,
    type: "magic_link",
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">Nog een klik en de woning staat in je dashboard</h1>
       <p style="line-height:1.6;">Je wilt <strong>${input.adresNaam}</strong> claimen op Wonea. Klik op de knop om je e-mailadres te bevestigen. Daarna kom je direct in je dashboard.</p>
       <ul style="line-height:1.8;font-size:14px;color:#4b5563;padding-left:20px;">
         ${keuzes.map((k) => `<li>${k}</li>`).join("\n         ")}
       </ul>
       <p style="margin:24px 0;"><a href="${input.verzilverUrl}" style="background:#16324f;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Bevestig en open mijn dashboard</a></p>
       <p style="line-height:1.6;font-size:13px;color:#6b7280;">De link is 15 minuten geldig en werkt maar één keer. Vroeg jij dit niet aan? Negeer deze mail, er gebeurt dan niets.</p>`,
      { afmeldPad: "/privacy" },
    ),
  });
}
