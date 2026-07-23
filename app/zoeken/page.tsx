import type { Metadata } from "next";
import Link from "next/link";
import {
  ENERGIELABELS,
  getGemeenten,
  heeftFilters,
  MAX_RESULTATEN,
  parseZoekFilters,
  WONINGTYPES,
  zoekWoningen,
} from "@/lib/zoeken";
import { formatEuro } from "@/lib/util";
import { EnergieLabelBadge, inputClass, KnopPrimair, LegeStaat, Veld } from "@/components/ui";
import { VergelijkBalk, VergelijkCheckbox, VergelijkProvider } from "./vergelijk-selectie";

/**
 * /zoeken: server-side zoekresultaten op de eigen adressen-database.
 * Adresdiepe pagina; volgt de gating-lijn en blijft dus noindex.
 * Geen kaart of map: we hebben geen betrouwbare coordinaten-weergave (backlog).
 */

export const metadata: Metadata = {
  title: "Zoek een woning",
  description: "Zoek op straat, postcode of plaats en bekijk per woning de geschatte waarde met eerlijke bandbreedte.",
  robots: { index: false, follow: false },
};

const OPPERVLAK_OPTIES = [50, 75, 100, 125, 150] as const;

function typeLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default async function ZoekenPagina({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseZoekFilters(await searchParams);
  const [{ resultaten, totaal }, gemeenten] = await Promise.all([zoekWoningen(filters), getGemeenten()]);

  return (
    <VergelijkProvider>
      <div className="mx-auto max-w-5xl px-5 py-10 pb-28">
        <h1 className="text-3xl font-semibold sm:text-4xl">Zoek een woning</h1>
        <p className="mt-2 max-w-2xl text-inkt-zacht">
          Zoek op straat, postcode of plaats en filter op wat jij belangrijk vindt. Elke waarde is een indicatie met
          bandbreedte, geen taxatie.
        </p>

        <form method="GET" action="/zoeken" className="mt-8 rounded-[14px] border border-lijn bg-paneel p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <Veld label="Zoekterm">
                <input
                  type="text"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Straat, postcode of plaats"
                  className={inputClass}
                  maxLength={80}
                />
              </Veld>
            </div>
            <Veld label="Woningtype">
              <select name="woningtype" defaultValue={filters.woningtype ?? ""} className={inputClass}>
                <option value="">Elk type</option>
                {WONINGTYPES.map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label="Energielabel">
              <select name="energielabel" defaultValue={filters.energielabel ?? ""} className={inputClass}>
                <option value="">Elk label</option>
                {ENERGIELABELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label="Minimale oppervlakte">
              <select name="minOppervlak" defaultValue={filters.minOppervlak ? String(filters.minOppervlak) : ""} className={inputClass}>
                <option value="">Elke oppervlakte</option>
                {OPPERVLAK_OPTIES.map((m) => (
                  <option key={m} value={m}>
                    Vanaf {m} m2
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label="Gemeente">
              <select name="gemeente" defaultValue={filters.gemeente ?? ""} className={inputClass}>
                <option value="">Elke gemeente</option>
                {gemeenten.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.naam}
                  </option>
                ))}
              </select>
            </Veld>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <KnopPrimair type="submit">Zoeken</KnopPrimair>
            {heeftFilters(filters) ? (
              <Link href="/zoeken" className="text-sm text-gedempt underline underline-offset-4 transition-colors hover:text-merk">
                Wis alle filters
              </Link>
            ) : null}
          </div>
        </form>

        {resultaten.length > 0 ? (
          <>
            <p className="mt-6 text-sm text-gedempt tabular-nums" aria-live="polite">
              {totaal === 1 ? "1 woning gevonden" : `${totaal} woningen gevonden`}
              {totaal > resultaten.length ? `, we tonen de eerste ${MAX_RESULTATEN}. Maak je zoekopdracht specifieker voor de rest.` : "."}
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {resultaten.map((r) => {
                const naam = `${r.straat} ${r.huisnummer}${r.toevoeging ? ` ${r.toevoeging}` : ""}`;
                return (
                  <div key={r.id} className="flex flex-col rounded-[14px] border border-lijn bg-paneel p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/woning/${r.postcode}/${r.nummerslug}`}
                          className="font-semibold text-inkt transition-colors hover:text-merk"
                        >
                          {naam}
                        </Link>
                        <p className="mt-0.5 text-sm text-gedempt">
                          {r.postcode} {r.plaats}
                        </p>
                      </div>
                      {r.energielabel ? <EnergieLabelBadge label={r.energielabel} klein /> : null}
                    </div>
                    <p className="mt-3 text-sm text-inkt-zacht tabular-nums">
                      {r.oppervlakteM2} m2 · {r.woningtype} · {r.bouwjaar}
                    </p>
                    <div className="mt-3 grow">
                      {r.waarde !== null && r.intervalLaag !== null && r.intervalHoog !== null ? (
                        <>
                          <p className="font-display text-2xl font-semibold text-merk tabular-nums">{formatEuro(r.waarde)}</p>
                          <p className="mt-0.5 text-xs text-gedempt tabular-nums">
                            {formatEuro(r.intervalLaag)} tot {formatEuro(r.intervalHoog)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm leading-relaxed text-inkt-zacht">
                          Nog geen schatting voor dit adres. Open de woningpagina voor een verse berekening.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 border-t border-lijn pt-3">
                      <VergelijkCheckbox slug={r.slug} naam={naam} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-6">
            <LegeStaat
              titel="Geen woningen gevonden"
              tekst="Wonea draait nog in een klein testgebied, dus lang niet elk adres staat er al in. Probeer een andere straat of plaats, of maak je filters ruimer."
            />
          </div>
        )}

        <VergelijkBalk />
      </div>
    </VergelijkProvider>
  );
}
