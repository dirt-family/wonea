import { emailLayout } from "@/emails/layout";
import { queueEmail } from "@/lib/email/send";
import { baseUrl } from "@/lib/util";

export async function stuurOptoutBevestiging(to: string, adresNaam: string, token: string): Promise<void> {
  const link = `${baseUrl()}/verwijderen/${token}`;
  await queueEmail({
    to,
    subject: `Bevestig het verwijderen van ${adresNaam}`,
    type: "optout_bevestiging",
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">Nog een klik en de pagina is weg</h1>
       <p style="line-height:1.6;">Je vroeg ons de woningpagina van <strong>${adresNaam}</strong> te verwijderen. Klik op de knop om dat te bevestigen. Daarna verdwijnt het adres overal op Wonea en komt het ook bij nieuwe data-imports niet terug.</p>
       <p style="margin:24px 0;"><a href="${link}" style="background:#16324f;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Ja, verwijder deze pagina</a></p>
       <p style="line-height:1.6;font-size:13px;color:#6b7280;">Niet door jou aangevraagd? Dan kun je deze mail negeren; er verandert niets zonder deze bevestiging.</p>`,
      { afmeldPad: "/privacy" },
    ),
  });
}

export async function stuurOptoutAfgerond(to: string, adresNaam: string): Promise<void> {
  await queueEmail({
    to,
    subject: `${adresNaam} is verwijderd van Wonea`,
    type: "optout_afgerond",
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">Verwijderd, en het blijft zo</h1>
       <p style="line-height:1.6;">De woningpagina van <strong>${adresNaam}</strong> is verwijderd: de pagina zelf, gedeelde rapporten en waarde-alerts. Bij nieuwe data-imports blijft dit adres op onze verwijderlijst staan.</p>
       <p style="line-height:1.6;">Bedenk je je later? Mail ons, dan zetten we de pagina terug.</p>`,
      { afmeldPad: "/privacy" },
    ),
  });
}
