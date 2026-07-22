import { emailLayout } from "@/emails/layout";
import { queueEmail } from "@/lib/email/send";
import type { LeadType } from "@/db/schema";

const TITELS: Record<LeadType, string> = {
  hypotheek: "Je hypotheek-aanvraag bij Wonea",
  makelaar: "Je verkoop-aanvraag bij Wonea",
  taxatie: "Je taxatierapport-aanvraag bij Wonea",
  verduurzaming: "Je verduurzamings-aanvraag bij Wonea",
};

export function stuurLeadBevestiging(input: { to: string; type: LeadType; partijType: string; adresNaam: string | null }): void {
  queueEmail({
    to: input.to,
    subject: TITELS[input.type],
    type: "lead_bevestiging",
    html: emailLayout(
      `<h1 style="font-size:20px;color:#16324f;">We hebben je aanvraag</h1>
       <p style="line-height:1.6;">Zoals we in het formulier aangaven, geven we je aanvraag${input.adresNaam ? ` voor <strong>${input.adresNaam}</strong>` : ""} door aan ${input.partijType}. Niet aan anderen, en niet vaker dan hiervoor nodig is.</p>
       <p style="line-height:1.6;">Van gedachten veranderd? Antwoord op deze mail en we trekken de aanvraag in.</p>
       <p style="line-height:1.6;font-size:13px;color:#6b7280;">In deze testfase wordt er nog niets echt doorgestuurd; dat gebeurt pas als Wonea live is en jij daarvoor tekende.</p>`,
      { afmeldPad: "/privacy" },
    ),
  });
}
