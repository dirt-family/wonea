import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims, emailsOutbox, leads, optouts, sales, valuations } from "@/db/schema";
import { formatEuro } from "@/lib/util";
import { Kaart, KnopPrimair, SectieLabel } from "@/components/ui";
import { POST as alertsRun } from "@/app/api/alerts/route";
import { LEAD_STATUSSEN, LEAD_TYPES, OPEN_LEAD_STATUSSEN } from "@/app/admin/leads/logic";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

/**
 * Adminoverzicht: leads per type en status, pipeline-waarde, datastatus en de
 * maandrun voor alerts. Alleen voor intern gebruik, achter basic-auth.
 */

async function draaiMaandelijkseAlerts() {
  "use server";
  // Robuustste aanroep: de route-logica direct importeren en aanroepen in
  // plaats van fetch naar onszelf (geen afhankelijkheid van poort, baseUrl of
  // een draaiende tweede request). De header x-admin-password gaat mee zodat
  // dit ook buiten development werkt; in development laat de route alles door.
  let melding: string;
  try {
    const antwoord = await alertsRun(
      new Request("http://wonea.intern/api/alerts", {
        method: "POST",
        headers: { "x-admin-password": process.env.WONEA_ADMIN_PASSWORD ?? "" },
      }),
    );
    const json = (await antwoord.json()) as {
      ok: boolean;
      totaal?: number;
      verzonden?: number;
      geskipt?: Record<string, number>;
      fout?: string;
    };
    if (!json.ok) {
      melding = `Alert-run geweigerd: ${json.fout ?? "onbekende fout"}. Staat WONEA_ADMIN_PASSWORD in de omgeving?`;
    } else {
      const geskipt = Object.entries(json.geskipt ?? {})
        .map(([reden, n]) => `${reden.replaceAll("_", " ")}: ${n}`)
        .join(", ");
      melding = `Alert-run klaar: ${json.verzonden ?? 0} van ${json.totaal ?? 0} abonnementen naar de outbox${geskipt ? ` (overgeslagen: ${geskipt})` : ""}.`;
    }
  } catch (fout) {
    console.error("Admin: alert-run mislukt", fout);
    melding = "Alert-run mislukt: zie de serverlog.";
  }
  redirect(`/admin?alerts=${encodeURIComponent(melding)}`);
}

function telRijen(query: { get: () => { n: number } | undefined }): number {
  return query.get()?.n ?? 0;
}

function Stat({ label, waarde }: { label: string; waarde: string }) {
  return (
    <Kaart>
      <SectieLabel>{label}</SectieLabel>
      <p className="mt-2 font-display text-3xl font-semibold text-merk">{waarde}</p>
    </Kaart>
  );
}

export default async function AdminOverzichtPagina({ searchParams }: { searchParams: Promise<{ alerts?: string }> }) {
  const sp = await searchParams;

  // Leads per type en status (1 groepsquery, daarna opzoekbaar per cel).
  const perTypeStatus = db
    .select({ type: leads.type, status: leads.status, n: sql<number>`count(*)` })
    .from(leads)
    .groupBy(leads.type, leads.status)
    .all();
  const cel = new Map(perTypeStatus.map((r) => [`${r.type}:${r.status}`, r.n]));
  const totaalLeads = perTypeStatus.reduce((som, r) => som + r.n, 0);

  // Pipeline: som van de geschatte waarde van alle open leads.
  const pipelineWaarde =
    db
      .select({ som: sql<number>`coalesce(sum(${leads.estValueEur}), 0)` })
      .from(leads)
      .where(inArray(leads.status, OPEN_LEAD_STATUSSEN))
      .get()?.som ?? 0;

  // Datastatus: hoe vol staat de database.
  const nAdressen = telRijen(db.select({ n: sql<number>`count(*)` }).from(addresses));
  const nVerkopen = telRijen(db.select({ n: sql<number>`count(*)` }).from(sales));
  const nValuations = telRijen(db.select({ n: sql<number>`count(*)` }).from(valuations));
  const nClaims = telRijen(db.select({ n: sql<number>`count(*)` }).from(claims));
  const nActieveAlerts = telRijen(db.select({ n: sql<number>`count(*)` }).from(alertSubscriptions).where(eq(alertSubscriptions.actief, true)));
  const nOptouts = telRijen(db.select({ n: sql<number>`count(*)` }).from(optouts).where(isNotNull(optouts.bevestigdAt)));
  const nOutbox = telRijen(db.select({ n: sql<number>`count(*)` }).from(emailsOutbox));

  const getal = (n: number) => n.toLocaleString("nl-NL");

  return (
    <div className="space-y-5">
      {sp.alerts ? (
        <p className="rounded-lg border border-merk/30 bg-merk-wash px-4 py-3 text-sm text-merk">{sp.alerts}</p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Kaart className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectieLabel>Leads per type en status</SectieLabel>
            <Link href="/admin/leads" className="text-sm font-semibold text-merk underline underline-offset-4">
              Naar alle leads
            </Link>
          </div>
          {totaalLeads > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                    <th className="py-2 pr-4 font-medium">Type</th>
                    {LEAD_STATUSSEN.map((status) => (
                      <th key={status} className="py-2 pr-4 text-right font-medium">
                        {status}
                      </th>
                    ))}
                    <th className="py-2 text-right font-medium">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAD_TYPES.map((type) => {
                    const rijTotaal = LEAD_STATUSSEN.reduce((som, status) => som + (cel.get(`${type}:${status}`) ?? 0), 0);
                    return (
                      <tr key={type} className="border-b border-lijn last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{type}</td>
                        {LEAD_STATUSSEN.map((status) => {
                          const n = cel.get(`${type}:${status}`) ?? 0;
                          return (
                            <td key={status} className={`py-2.5 pr-4 text-right ${n === 0 ? "text-gedempt" : ""}`}>
                              {getal(n)}
                            </td>
                          );
                        })}
                        <td className="py-2.5 text-right font-semibold">{getal(rijTotaal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-inkt-zacht">Nog geen leads. Zodra de funnels aanvragen opleveren, verschijnen ze hier.</p>
          )}
        </Kaart>

        <Kaart className="bg-merk-wash">
          <SectieLabel>Pipeline-waarde (open leads)</SectieLabel>
          <p className="mt-3 font-display text-4xl font-semibold text-merk">{formatEuro(pipelineWaarde)}</p>
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            Som van de geschatte waarde van alle leads met status nieuw, gekwalificeerd of doorgestuurd. Schatting uit het
            verdienmodel, geen omzet.
          </p>
        </Kaart>
      </div>

      <div>
        <SectieLabel>Datastatus</SectieLabel>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Adressen" waarde={getal(nAdressen)} />
          <Stat label="Verkopen" waarde={getal(nVerkopen)} />
          <Stat label="Waardeschattingen" waarde={getal(nValuations)} />
          <Stat label="Claims" waarde={getal(nClaims)} />
          <Stat label="Actieve alerts" waarde={getal(nActieveAlerts)} />
          <Stat label="Opt-outs (bevestigd)" waarde={getal(nOptouts)} />
          <Stat label="Outbox (mails)" waarde={getal(nOutbox)} />
        </div>
      </div>

      <Kaart>
        <SectieLabel>Acties</SectieLabel>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <form action={draaiMaandelijkseAlerts}>
              <KnopPrimair type="submit">Draai maandelijkse alerts</KnopPrimair>
            </form>
            <p className="mt-2 text-xs leading-relaxed text-gedempt">
              Loopt alle actieve abonnementen langs en zet de waarde-alerts in de outbox. Suppressie en consent zijn leidend;
              er wordt niets echt verstuurd.
            </p>
          </div>
          <div>
            <details>
              <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk [&::-webkit-details-marker]:hidden">
                Draai marktdrift
              </summary>
              <div className="mt-3 rounded-lg bg-merk-wash p-4">
                <p className="text-sm leading-relaxed text-inkt-zacht">
                  Marktdrift draait bewust niet vanuit de webapp: geen shell-commando&apos;s vanaf een webpagina. Draai in een
                  terminal:
                </p>
                <code className="mt-2 block rounded-lg bg-paneel px-3 py-2 font-mono text-sm text-inkt">npx tsx scripts/market-drift.ts</code>
              </div>
            </details>
            <p className="mt-2 text-xs leading-relaxed text-gedempt">
              Simuleert de maandelijkse marktbeweging per buurt met nieuwe synthetische verkopen, zodat de alerts iets te
              melden hebben.
            </p>
          </div>
        </div>
      </Kaart>
    </div>
  );
}
