import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailsOutbox } from "@/db/schema";
import { BronLabel, Kaart, SectieLabel } from "@/components/ui";

/**
 * Dev-mailbox: leest emails_outbox zodat je lokaal elke mail kunt bekijken en
 * links (magic links!) kunt verzilveren. HARDE GUARD: bestaat alleen als
 * NODE_ENV=development EN WONEA_DEV_MAIL=1; anders notFound(). In een
 * productiebuild is deze pagina er dus niet (zie ook docs/DEPLOYMENT.md).
 */

export const metadata: Metadata = { title: "Dev-mailbox", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function devMailboxAan(): boolean {
  return process.env.NODE_ENV === "development" && process.env.WONEA_DEV_MAIL === "1";
}

function linksUitHtml(html: string): string[] {
  const out: string[] = [];
  const re = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return [...new Set(out)];
}

const datumTijd = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" });

export default async function DevMailPagina({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (!devMailboxAan()) notFound();

  const sp = await searchParams;
  const mails = db.select().from(emailsOutbox).orderBy(desc(emailsOutbox.createdAt), desc(emailsOutbox.id)).limit(200).all();

  const gekozenId = sp.id ? Number.parseInt(sp.id, 10) : null;
  const gekozen = gekozenId ? (mails.find((m) => m.id === gekozenId) ?? null) : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="rounded-[14px] border border-accent bg-accent-wash px-5 py-4">
        <p className="text-sm font-semibold text-accent">Alleen development</p>
        <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
          Dit is de lokale outbox: er wordt niets echt verstuurd. Deze pagina rendert alleen met NODE_ENV=development en
          WONEA_DEV_MAIL=1; in productie bestaat deze pagina niet.
        </p>
      </div>

      <h1 className="mt-6 text-3xl font-semibold">Dev-mailbox</h1>
      <p className="mt-1 text-sm text-inkt-zacht">
        {mails.length === 1 ? "1 mail" : `${mails.length} mails`} in de outbox, nieuwste eerst.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          {mails.length === 0 ? (
            <Kaart>
              <p className="text-sm text-inkt-zacht">
                Nog geen mails in de outbox. Vraag bijvoorbeeld een magic link of een verwijderbevestiging aan, of draai de
                alert-maandrun (POST /api/alerts).
              </p>
            </Kaart>
          ) : (
            mails.map((mail) => (
              <Link
                key={mail.id}
                href={`/dev/mail?id=${mail.id}`}
                className={`block rounded-[14px] border p-4 transition-colors ${
                  gekozen?.id === mail.id ? "border-merk bg-merk-wash" : "border-lijn bg-paneel hover:border-merk"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <BronLabel>{mail.type}</BronLabel>
                  <span className="text-xs text-gedempt">{datumTijd.format(new Date(mail.createdAt))}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-inkt">{mail.subject}</p>
                <p className="mt-0.5 text-xs text-gedempt">
                  aan {mail.to} · {mail.status}
                </p>
              </Link>
            ))
          )}
        </div>

        <div className="lg:col-span-3">
          {gekozen ? (
            <Kaart>
              <SectieLabel>Voorbeeld</SectieLabel>
              <p className="mt-2 text-sm font-semibold text-inkt">{gekozen.subject}</p>
              <p className="text-xs text-gedempt">
                aan {gekozen.to} · {gekozen.type} · {datumTijd.format(new Date(gekozen.createdAt))}
              </p>
              <iframe
                srcDoc={gekozen.html}
                title={`Mail: ${gekozen.subject}`}
                sandbox="allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                className="mt-4 h-[560px] w-full rounded-lg border border-lijn bg-paneel"
              />
              {linksUitHtml(gekozen.html).length > 0 ? (
                <div className="mt-4">
                  <SectieLabel>Links in deze mail</SectieLabel>
                  <ul className="mt-2 space-y-1.5">
                    {linksUitHtml(gekozen.html).map((href) => (
                      <li key={href}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-sm text-merk underline underline-offset-2 hover:text-merk-licht"
                        >
                          {href}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-gedempt">
                    Klikken opent de link in een nieuw tabblad, handig om magic links te verzilveren.
                  </p>
                </div>
              ) : null}
            </Kaart>
          ) : (
            <Kaart>
              <p className="text-sm text-inkt-zacht">Kies links een mail om de inhoud te bekijken.</p>
            </Kaart>
          )}
        </div>
      </div>
    </div>
  );
}
