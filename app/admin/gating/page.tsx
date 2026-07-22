import type { Metadata } from "next";
import { db } from "@/lib/db";
import { indexGating } from "@/db/schema";
import { Kaart, SectieLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Admin: gating" };
export const dynamic = "force-dynamic";

/**
 * Alleen-lezen overzicht van de indexatie-gating. De vullogica (whitelist per
 * gebied plus datadiepte per pagina) komt in Fase 5; tot die tijd staat de
 * site sitewide op noindex en is deze tabel vooral leeg.
 */

export default async function AdminGatingPagina() {
  const rijen = db.select().from(indexGating).orderBy(indexGating.scope, indexGating.code).all();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Indexatie-gating</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Welke gebieden mogen in de zoekmachine-index. Dit overzicht is alleen-lezen: Fase 5 levert de logica die deze tabel
          vult (gebiedswhitelist plus datadiepte per pagina). Tot die tijd staat de hele site op noindex.
        </p>
      </div>

      <Kaart>
        <SectieLabel>{rijen.length === 1 ? "1 regel" : `${rijen.length} regels`}</SectieLabel>
        {rijen.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                  <th className="py-2 pr-4 font-medium">Scope</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Indexeerbaar</th>
                  <th className="py-2 font-medium">Reden</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((r) => (
                  <tr key={r.id} className="border-b border-lijn last:border-0">
                    <td className="py-2.5 pr-4">{r.scope}</td>
                    <td className="py-2.5 pr-4 font-medium">{r.code}</td>
                    <td className={`py-2.5 pr-4 font-medium ${r.indexeerbaar ? "text-positief" : "text-negatief"}`}>
                      {r.indexeerbaar ? "ja" : "nee"}
                    </td>
                    <td className="py-2.5 text-inkt-zacht">{r.reden ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-inkt-zacht">
            Nog geen gating-regels. Dat klopt in deze fase: Fase 5 vult deze tabel.
          </p>
        )}
      </Kaart>
    </div>
  );
}
