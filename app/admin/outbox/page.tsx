import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailsOutbox } from "@/db/schema";
import { BronLabel, Kaart, SectieLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Admin: outbox" };
export const dynamic = "force-dynamic";

/**
 * Outbox-inzage voor de admin: zelfde patroon als /dev/mail, maar zonder de
 * dev-guard omdat dit al achter basic-auth zit (middleware.ts). Er wordt niets
 * echt verstuurd; dit is de wachtrij (retentie 90 dagen via scripts/purge.ts).
 */

const datumTijd = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminOutboxPagina({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const sp = await searchParams;
  const mails = await db.select().from(emailsOutbox).orderBy(desc(emailsOutbox.createdAt), desc(emailsOutbox.id)).limit(200);

  const gekozenId = sp.id ? Number.parseInt(sp.id, 10) : null;
  const gekozen = gekozenId ? (mails.find((m) => m.id === gekozenId) ?? null) : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Outbox</h2>
        <p className="mt-1 text-sm text-inkt-zacht">
          {mails.length === 1 ? "1 mail" : `${mails.length} mails`} in de wachtrij, nieuwste eerst. Er wordt niets echt
          verstuurd.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          {mails.length === 0 ? (
            <Kaart>
              <p className="text-sm text-inkt-zacht">
                De outbox is leeg. Mails verschijnen hier zodra een flow ze aanmaakt, bijvoorbeeld de alert-maandrun op het
                overzicht.
              </p>
            </Kaart>
          ) : (
            mails.map((mail) => (
              <Link
                key={mail.id}
                href={`/admin/outbox?id=${mail.id}`}
                className={`block rounded-[14px] border p-4 transition-colors ${
                  gekozen?.id === mail.id ? "border-merk bg-merk-wash" : "border-lijn bg-paneel hover:border-merk"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <BronLabel>{mail.type}</BronLabel>
                  <span className="text-xs text-gedempt">{datumTijd.format(new Date(mail.createdAt))}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-inkt">{mail.subject}</p>
                <p className="mt-0.5 break-all text-xs text-gedempt">
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
              <p className="break-all text-xs text-gedempt">
                aan {gekozen.to} · {gekozen.type} · {datumTijd.format(new Date(gekozen.createdAt))}
              </p>
              <iframe
                srcDoc={gekozen.html}
                title={`Mail: ${gekozen.subject}`}
                sandbox=""
                className="mt-4 h-[560px] w-full rounded-lg border border-lijn bg-paneel"
              />
              <p className="mt-2 text-xs text-gedempt">
                Links en formulieren zijn in deze voorvertoning bewust uitgeschakeld; magic links verzilver je via /dev/mail.
              </p>
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
