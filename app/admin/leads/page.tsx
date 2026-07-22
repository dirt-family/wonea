import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses, leadEvents, leads, type LeadStatus, type LeadType } from "@/db/schema";
import { leadwaarde } from "@/lib/config/leadwaarde";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { formatEuro } from "@/lib/util";
import { inputClass, Kaart, KnopPrimair, KnopSecundair, SectieLabel, Veld } from "@/components/ui";
import { LEAD_STATUSSEN, LEAD_TYPES, wijzigLeadStatus } from "./logic";

export const metadata: Metadata = { title: "Admin: leads" };
export const dynamic = "force-dynamic";

/**
 * Leadbeheer: alle leads met filter op type/status, detailweergave met de
 * antwoorden en de tijdlijn, en statuswijziging via server action. De
 * geschatte waarde komt altijd uit lib/config/leadwaarde (1 bron van waarheid).
 */

const statusSchema = z.object({
  leadId: z.coerce.number().int().positive(),
  status: z.enum(["nieuw", "gekwalificeerd", "doorgestuurd", "gesloten", "afgewezen"]),
  filterType: z.string().optional(),
  filterStatus: z.string().optional(),
});

async function wijzigStatusAction(formData: FormData) {
  "use server";
  const parsed = statusSchema.safeParse({
    leadId: formData.get("leadId") ?? "",
    status: formData.get("status") ?? "",
    filterType: formData.get("filterType") ?? "",
    filterStatus: formData.get("filterStatus") ?? "",
  });
  if (!parsed.success) redirect("/admin/leads?fout=ongeldig");

  const resultaat = wijzigLeadStatus(parsed.data.leadId, parsed.data.status);

  // Redirect-URL alleen uit gevalideerde, bekende waarden opbouwen.
  const qs = new URLSearchParams();
  if ((LEAD_TYPES as string[]).includes(parsed.data.filterType ?? "")) qs.set("type", parsed.data.filterType!);
  if ((LEAD_STATUSSEN as string[]).includes(parsed.data.filterStatus ?? "")) qs.set("status", parsed.data.filterStatus!);
  qs.set("lead", String(parsed.data.leadId));
  if (resultaat.ok) qs.set("gewijzigd", "1");
  else qs.set("fout", "onbekend");
  redirect(`/admin/leads?${qs.toString()}#detail`);
}

const FOUTEN: Record<string, string> = {
  ongeldig: "Ongeldige invoer bij de statuswijziging. Probeer het opnieuw.",
  onbekend: "Die lead bestaat niet (meer); er is niets gewijzigd.",
};

const datumTijd = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" });

function Antwoorden({ json }: { json: string }) {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    data = undefined;
  }
  if (data === undefined || data === null || typeof data !== "object" || Array.isArray(data)) {
    // Geen leesbaar object: toon de ruwe inhoud, dan gaat er niets verloren.
    return <pre className="mt-2 overflow-x-auto rounded-lg bg-merk-wash p-4 text-xs text-inkt">{json}</pre>;
  }
  const paren = Object.entries(data as Record<string, unknown>);
  if (paren.length === 0) return <p className="mt-2 text-sm text-inkt-zacht">Geen antwoorden vastgelegd.</p>;
  return (
    <dl className="mt-2 space-y-2 text-sm">
      {paren.map(([sleutel, waarde]) => (
        <div key={sleutel} className="flex justify-between gap-4 border-b border-lijn pb-2 last:border-0 last:pb-0">
          <dt className="text-gedempt">{sleutel}</dt>
          <dd className="max-w-[60%] break-words text-right font-medium">
            {typeof waarde === "object" ? JSON.stringify(waarde) : String(waarde)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type SearchParams = { type?: string; status?: string; lead?: string; gewijzigd?: string; fout?: string };

export default async function AdminLeadsPagina({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const typeFilter = (LEAD_TYPES as string[]).includes(sp.type ?? "") ? (sp.type as LeadType) : null;
  const statusFilter = (LEAD_STATUSSEN as string[]).includes(sp.status ?? "") ? (sp.status as LeadStatus) : null;

  const condities = [
    ...(typeFilter ? [eq(leads.type, typeFilter)] : []),
    ...(statusFilter ? [eq(leads.status, statusFilter)] : []),
  ];
  const rijen = db
    .select()
    .from(leads)
    .where(condities.length > 0 ? and(...condities) : undefined)
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(500)
    .all();

  // Detail kan buiten het filter vallen; los ophalen op id.
  const detailId = sp.lead ? Number.parseInt(sp.lead, 10) : Number.NaN;
  const detail = Number.isInteger(detailId) && detailId > 0 ? (db.select().from(leads).where(eq(leads.id, detailId)).get() ?? null) : null;
  const detailEvents = detail
    ? db.select().from(leadEvents).where(eq(leadEvents.leadId, detail.id)).orderBy(leadEvents.ts, leadEvents.id).all()
    : [];

  // Adressen in 1 query erbij; gesupprimeerde adressen tonen we niet (opt-out
  // is leidend, ook intern).
  const adresIds = [
    ...new Set([...rijen.map((l) => l.adresId), detail?.adresId ?? null].filter((id): id is number => id != null)),
  ];
  const adresRijen = adresIds.length > 0 ? db.select().from(addresses).where(inArray(addresses.id, adresIds)).all() : [];
  const adresMap = new Map(adresRijen.map((a) => [a.id, a]));
  const gesupprimeerd = new Set(adresIds.filter((id) => isAddressIdSuppressed(id)));

  function adresWeergave(adresId: number | null): string {
    if (adresId == null) return "geen adres";
    if (gesupprimeerd.has(adresId)) return "adres verwijderd (opt-out)";
    const a = adresMap.get(adresId);
    if (!a) return "onbekend adres";
    return `${a.straat} ${a.huisnummer}${a.toevoeging ? ` ${a.toevoeging}` : ""}, ${a.plaats}`;
  }

  function detailHref(id: number): string {
    const qs = new URLSearchParams();
    if (typeFilter) qs.set("type", typeFilter);
    if (statusFilter) qs.set("status", statusFilter);
    qs.set("lead", String(id));
    return `/admin/leads?${qs.toString()}#detail`;
  }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Leads</h2>

      {sp.gewijzigd ? (
        <p className="rounded-lg border border-positief/30 bg-positief/5 px-4 py-3 text-sm text-positief">
          Status gewijzigd: waarde herberekend en gebeurtenis gelogd.
        </p>
      ) : null}
      {sp.fout ? (
        <p className="rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
          {FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw."}
        </p>
      ) : null}

      <Kaart>
        <form method="get" action="/admin/leads" className="flex flex-wrap items-end gap-4">
          <Veld label="Type">
            <select name="type" defaultValue={typeFilter ?? ""} className={inputClass}>
              <option value="">alle types</option>
              {LEAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Veld>
          <Veld label="Status">
            <select name="status" defaultValue={statusFilter ?? ""} className={inputClass}>
              <option value="">alle statussen</option>
              {LEAD_STATUSSEN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Veld>
          <div className="flex gap-3 pb-0.5">
            <KnopSecundair type="submit">Filter</KnopSecundair>
            {typeFilter || statusFilter ? (
              <Link href="/admin/leads" className="inline-flex items-center text-sm font-semibold text-merk underline underline-offset-4">
                Wis filters
              </Link>
            ) : null}
          </div>
        </form>
      </Kaart>

      <Kaart>
        <SectieLabel>
          {rijen.length === 1 ? "1 lead" : `${rijen.length} leads`}
          {typeFilter || statusFilter ? " (gefilterd)" : ""}
        </SectieLabel>
        {rijen.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                  <th className="py-2 pr-4 font-medium">Datum</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Subtype</th>
                  <th className="py-2 pr-4 font-medium">E-mail</th>
                  <th className="py-2 pr-4 font-medium">Adres</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Waarde</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((lead) => (
                  <tr key={lead.id} className={`border-b border-lijn last:border-0 ${detail?.id === lead.id ? "bg-merk-wash" : ""}`}>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{datumTijd.format(new Date(lead.createdAt))}</td>
                    <td className="py-2.5 pr-4">{lead.type}</td>
                    <td className="py-2.5 pr-4">{lead.subtype ?? "-"}</td>
                    <td className="py-2.5 pr-4 break-all">{lead.email}</td>
                    <td className="py-2.5 pr-4">{adresWeergave(lead.adresId)}</td>
                    <td className="py-2.5 pr-4">{lead.status}</td>
                    <td className="py-2.5 pr-4 text-right font-medium">{formatEuro(leadwaarde(lead.type, lead.subtype, lead.status))}</td>
                    <td className="py-2.5">
                      <Link href={detailHref(lead.id)} className="font-semibold text-merk underline underline-offset-4">
                        Bekijk
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-inkt-zacht">Geen leads gevonden{typeFilter || statusFilter ? " met dit filter" : ""}.</p>
        )}
        {rijen.length === 500 ? (
          <p className="mt-3 text-xs text-gedempt">We tonen maximaal 500 leads; verfijn het filter voor de rest.</p>
        ) : null}
      </Kaart>

      {detail ? (
        <div id="detail">
          <Kaart>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectieLabel>Lead #{detail.id}</SectieLabel>
              <Link
                href={typeFilter || statusFilter ? `/admin/leads?${new URLSearchParams({ ...(typeFilter ? { type: typeFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}) }).toString()}` : "/admin/leads"}
                className="text-sm font-semibold text-merk underline underline-offset-4"
              >
                Sluit detail
              </Link>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">Aangemaakt</dt><dd className="font-medium">{datumTijd.format(new Date(detail.createdAt))}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">Type</dt><dd className="font-medium">{detail.type}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">Subtype</dt><dd className="font-medium">{detail.subtype ?? "-"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">E-mail</dt><dd className="break-all font-medium">{detail.email}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">Adres</dt><dd className="text-right font-medium">{adresWeergave(detail.adresId)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">Status</dt><dd className="font-medium">{detail.status}</dd></div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gedempt">Geschatte waarde</dt>
                    <dd className="font-medium">{formatEuro(leadwaarde(detail.type, detail.subtype, detail.status))}</dd>
                  </div>
                  <div className="flex justify-between gap-4"><dt className="text-gedempt">Bewaren tot</dt><dd className="font-medium">{datumTijd.format(new Date(detail.retentieTot))}</dd></div>
                </dl>

                <form action={wijzigStatusAction} className="mt-6 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="leadId" value={detail.id} />
                  <input type="hidden" name="filterType" value={typeFilter ?? ""} />
                  <input type="hidden" name="filterStatus" value={statusFilter ?? ""} />
                  <Veld label="Status wijzigen">
                    <select name="status" defaultValue={detail.status} className={inputClass}>
                      {LEAD_STATUSSEN.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Veld>
                  <KnopPrimair type="submit">Opslaan</KnopPrimair>
                </form>
                <p className="mt-2 text-xs leading-relaxed text-gedempt">
                  Bij elke wijziging wordt de geschatte waarde herberekend en een gebeurtenis gelogd. Bij gesloten of
                  afgewezen start de bewaartermijn opnieuw: 12 maanden vanaf nu.
                </p>
              </div>

              <div>
                <SectieLabel>Antwoorden</SectieLabel>
                <Antwoorden json={detail.antwoordenJson} />

                <div className="mt-6">
                  <SectieLabel>Tijdlijn</SectieLabel>
                  {detailEvents.length > 0 ? (
                    <ol className="mt-2 space-y-2 text-sm">
                      {detailEvents.map((e) => (
                        <li key={e.id} className="flex justify-between gap-4 border-b border-lijn pb-2 last:border-0 last:pb-0">
                          <span className="font-medium">{e.event}</span>
                          <span className="whitespace-nowrap text-gedempt">{datumTijd.format(new Date(e.ts))}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm text-inkt-zacht">Nog geen gebeurtenissen.</p>
                  )}
                </div>
              </div>
            </div>
          </Kaart>
        </div>
      ) : null}
    </div>
  );
}
