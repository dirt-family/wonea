import { emailLayout } from "@/emails/layout";
import { queueEmail } from "@/lib/email/send";
import { baseUrl, formatEuro } from "@/lib/util";

/**
 * Maandelijkse waarde-alert voor geclaimde woningen. Eerlijk en niet
 * opdringerig: altijd met bandbreedte, het verschil met de vorige alert
 * (of "eerste alert") en het aantal nieuwe verkopen in de buurt.
 * De afmeld-/beheerlink komt uit emailLayout (afmeldPad /dashboard).
 */

export type WaardeAlertInput = {
  to: string;
  /** Bv. "Kleine Berg 12, Eindhoven" */
  adresNaam: string;
  /** Pad naar de woningpagina, bv. "/woning/5611AB/12" */
  woningPad: string;
  waarde: number;
  intervalLaag: number;
  intervalHoog: number;
  /** Waarde uit de vorige verzonden alert; null betekent: dit is de eerste alert. */
  vorigeWaarde: number | null;
  /** Aantal nieuwe verkopen in de buurt sinds de vorige alert (of de afgelopen maand). */
  nieuweVerkopen: number;
};

function verschilTekst(waarde: number, vorige: number | null): string {
  if (vorige === null) {
    return "Dit is je eerste waarde-alert voor dit adres. Deze waarde is vanaf nu je vergelijkingspunt: volgende maand zie je hier het verschil.";
  }
  const verschil = waarde - vorige;
  if (verschil === 0) {
    return `De waarde is gelijk gebleven ten opzichte van je vorige alert (${formatEuro(vorige)}).`;
  }
  const pct = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(Math.abs((verschil / vorige) * 100));
  const richting = verschil > 0 ? "gestegen" : "gedaald";
  return `De waarde is ${richting} met ${formatEuro(Math.abs(verschil))} (${pct} procent) ten opzichte van je vorige alert (${formatEuro(vorige)}).`;
}

function verkopenTekst(n: number, eersteAlert: boolean): string {
  const periode = eersteAlert ? "in de afgelopen maand" : "sinds je vorige alert";
  if (n === 0) return `Er zijn ${periode} geen nieuwe verkopen in jouw buurt geregistreerd.`;
  if (n === 1) return `Er is ${periode} 1 nieuwe verkoop in jouw buurt geregistreerd en meegenomen in de schatting.`;
  return `Er zijn ${periode} ${n} nieuwe verkopen in jouw buurt geregistreerd en meegenomen in de schatting.`;
}

/** Bouwt subject + html (los van de outbox, zodat de template testbaar is). */
export function bouwWaardeAlert(input: WaardeAlertInput): { subject: string; html: string } {
  const woningLink = `${baseUrl()}${input.woningPad}`;
  const dashboardLink = `${baseUrl()}/dashboard`;
  const subject = `Waarde-update voor ${input.adresNaam}`;

  const html = emailLayout(
    `<h1 style="font-size:20px;color:#16324f;">Je maandelijkse waarde-update</h1>
     <p style="line-height:1.6;">De geschatte waarde van <strong>${input.adresNaam}</strong> is nu:</p>
     <p style="font-size:32px;font-weight:700;color:#16324f;margin:8px 0 4px;">${formatEuro(input.waarde)}</p>
     <p style="line-height:1.6;color:#6b7280;margin:0 0 16px;">Bandbreedte: ${formatEuro(input.intervalLaag)} tot ${formatEuro(input.intervalHoog)}</p>
     <p style="line-height:1.6;">${verschilTekst(input.waarde, input.vorigeWaarde)}</p>
     <p style="line-height:1.6;">${verkopenTekst(input.nieuweVerkopen, input.vorigeWaarde === null)}</p>
     <p style="margin:24px 0;"><a href="${woningLink}" style="background:#16324f;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Bekijk je woningpagina</a></p>
     <p style="line-height:1.6;font-size:13px;color:#6b7280;">Alle details en je waardehistorie vind je in <a href="${dashboardLink}" style="color:#16324f;">je dashboard</a>.</p>
     <p style="line-height:1.6;font-size:13px;color:#6b7280;">Dit is een modelmatige schatting met een bandbreedte, geen taxatie. Hoe we rekenen lees je op <a href="${baseUrl()}/methode" style="color:#16324f;">de methodepagina</a>.</p>`,
    { afmeldPad: "/dashboard" },
  );

  return { subject, html };
}

/** Zet de waarde-alert in de outbox (nooit echt versturen, zie lib/email/send.ts). */
export async function stuurWaardeAlert(input: WaardeAlertInput): Promise<void> {
  const { subject, html } = bouwWaardeAlert(input);
  await queueEmail({ to: input.to, subject, html, type: "alert" });
}
