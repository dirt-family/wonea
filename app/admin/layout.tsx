import Link from "next/link";

/**
 * Admin-schil: interne beheeromgeving. Auth zit in middleware.ts (basic-auth,
 * gebruiker admin + env WONEA_ADMIN_PASSWORD); hier bewust geen eigen auth.
 * Elke adminpagina toont bovenaan de PII-regel: admin toont persoonsgegevens
 * (e-mailadressen), die gebruiken we alleen waarvoor ze zijn afgegeven.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="rounded-lg border border-accent bg-accent-wash px-4 py-2.5 text-sm font-medium text-accent">
        Intern. Persoonsgegevens: alleen gebruiken waarvoor ze zijn afgegeven.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Wonea admin</h1>
        <nav aria-label="Adminsecties" className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin" className="rounded-full border border-lijn bg-paneel px-4 py-1.5 font-semibold text-merk transition-colors hover:border-merk">
            Overzicht
          </Link>
          <Link href="/admin/leads" className="rounded-full border border-lijn bg-paneel px-4 py-1.5 font-semibold text-merk transition-colors hover:border-merk">
            Leads
          </Link>
          <Link href="/admin/outbox" className="rounded-full border border-lijn bg-paneel px-4 py-1.5 font-semibold text-merk transition-colors hover:border-merk">
            Outbox
          </Link>
          <Link href="/admin/gating" className="rounded-full border border-lijn bg-paneel px-4 py-1.5 font-semibold text-merk transition-colors hover:border-merk">
            Gating
          </Link>
        </nav>
      </div>

      <div className="mt-8">{children}</div>
    </div>
  );
}
