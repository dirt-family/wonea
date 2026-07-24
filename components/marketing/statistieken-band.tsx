import Link from "next/link";
import type { HomepageStats } from "@/lib/homepage-data";
import { Telcijfer } from "@/components/marketing/telcijfer";

/**
 * Statistieken-band: de ene donkere band op de site (thema-slot uit BRAND.md).
 * Alle cijfers zijn echt: live geteld in de database of afgeleid van een
 * benoembare lijst (rekenhulpen, open bronnen). De cijfers tellen op bij het
 * in beeld komen (Telcijfer, reduced-motion-veilig). Huisstijl v3: merk-900 is
 * exact de logo-navy; het amber accent-streepje per cijfer is het warme
 * merkaccent in de slot-dramaturgie (accent-500 op merk-900, decoratief).
 */
export function StatistiekenBand({ stats }: { stats: HomepageStats }) {
  const cijfers = [
    { waarde: stats.adressen, label: "adressen in het testgebied" },
    { waarde: stats.buurten, label: "buurten in beeld" },
    { waarde: stats.tools, label: "gratis rekenhulpen" },
    { waarde: stats.bronnen, label: "open databronnen" },
  ];
  return (
    <section className="bg-merk-900">
      <div className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="sr-only">Wonea in cijfers</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
          {cijfers.map((c) => (
            <div key={c.label} className="flex flex-col">
              <span aria-hidden="true" className="order-1 mb-3 h-1 w-8 rounded-full bg-accent-500" />
              <dt className="order-3 mt-2 text-sm text-merk-200">{c.label}</dt>
              <dd className="order-2 font-display text-4xl font-semibold text-white sm:text-5xl">
                <Telcijfer waarde={c.waarde} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-xs leading-relaxed text-merk-300">
          Adressen en buurten zijn live geteld in onze database. Welke bronnen we gebruiken en hoe we rekenen staat op de{" "}
          <Link href="/methode" className="text-merk-200 underline underline-offset-2 hover:text-white">
            methodepagina
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
