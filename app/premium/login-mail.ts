import { emailLayout } from "@/emails/layout";
import { queueEmail } from "@/lib/email/send";
import { formatEuro } from "@/lib/util";

/**
 * Inloglink-mail voor de premium-checkout. Eigen template (de claim-mail in
 * emails/magic-link.ts is aan een woningclaim gebonden); zelfde regels:
 * via queueEmail + emailLayout, met afmeld-/beheerlink, eenmalige link.
 */
export async function stuurPremiumLoginMail(input: { to: string; productNaam: string; prijs: number; verzilverUrl: string }): Promise<void> {
  await queueEmail({
    to: input.to,
    subject: "Je inloglink voor Wonea",
    type: "magic_link",
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">Inloggen bij Wonea</h1>
       <p style="line-height:1.6;">Je wilde <strong>${input.productNaam}</strong> (eenmalig ${formatEuro(input.prijs)}) afrekenen. Log eerst in, dan koppelen we de aankoop aan je account.</p>
       <p style="margin:24px 0;">
         <a href="${input.verzilverUrl}" style="display:inline-block;background:#16324f;color:#ffffff;border-radius:999px;padding:12px 24px;font-size:14px;font-weight:600;text-decoration:none;">Log in en ga verder naar afrekenen</a>
       </p>
       <p style="line-height:1.6;font-size:13px;color:#6b7280;">De link is 15 minuten geldig en werkt één keer. Niets aangevraagd? Negeer deze mail, dan gebeurt er niets.</p>
       <p style="line-height:1.6;font-size:13px;color:#6b7280;">Ter herinnering: dit is de testfase van Wonea. Er wordt niets afgeschreven en we vragen geen betaalgegevens.</p>`,
      { afmeldPad: "/privacy" },
    ),
  });
}
