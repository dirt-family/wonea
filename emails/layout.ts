import { baseUrl } from "@/lib/util";

/**
 * Basislayout voor alle Wonea-mails. Elke mail sluit af met een afmeld-/
 * beheerlink (AVG + gewoon netjes). Consumententeksten in het Nederlands,
 * toon eerlijk en niet opdringerig.
 */
export function emailLayout(inhoud: string, opties?: { afmeldPad?: string }): string {
  const afmeld = opties?.afmeldPad ?? "/dashboard";
  return `<!doctype html>
<html lang="nl">
<body style="margin:0;padding:0;background:#faf9f7;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2733;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <p style="font-size:18px;font-weight:700;color:#16324f;margin:0 0 24px;">Wonea</p>
    ${inhoud}
    <hr style="border:none;border-top:1px solid #e5e1da;margin:32px 0 16px;" />
    <p style="font-size:12px;color:#6b7280;line-height:1.6;">
      Je ontvangt deze mail omdat je die zelf hebt aangevraagd bij Wonea.
      Instellingen of afmelden: <a href="${baseUrl()}${afmeld}" style="color:#16324f;">${baseUrl()}${afmeld}</a><br />
      Jouw huis, jouw data. Verwijderen van je woningpagina kan altijd via de verwijderknop op de pagina zelf.
    </p>
  </div>
</body>
</html>`;
}
