import Link from "next/link";
import type { addresses } from "@/db/schema";
import { getEnergielabel } from "@/lib/bronnen/energielabel";
import { ISDE_PEILDATUM } from "@/lib/normen/isde-2026";
import { BESPARING_PEILDATUM } from "@/lib/normen/besparing";
import { formatDatumNl, formatEuro } from "@/lib/util";
import { BronLabel, Kaart, SectieLabel, StatTegel } from "@/components/ui";
import {
  extraLeenruimteBijLabel,
  formatEuroBereik,
  formatTerugverdientijd,
  LEENNORMEN_BRON,
  LEENNORMEN_PEILDATUM,
  maakMaatregelAdviezen,
} from "@/app/verduurzamen/advies/advies";

/**
 * Sectie 3 van het woningdossier: het energielabel (echt via EP-Online als
 * er een API-key of cache is, anders de bouwjaar-indicatie met bronlabel) en
 * het verduurzamingsadvies uit de bestaande advies-logica: per maatregel de
 * ISDE-subsidie 2026, de indicatieve jaarbesparing en de terugverdientijd,
 * plus de extra leenruimte bij het huidige label. Alles indicatie, met bron
 * en peildatum; de volledige uitleg per maatregel staat op de adviespagina.
 */

type Adres = typeof addresses.$inferSelect;

export async function EnergieSectie({ adres, adresQuery }: { adres: Adres; adresQuery: string }) {
  const ep = await getEnergielabel(adres.postcode, adres.huisnummer, adres.toevoeging);
  const label = (ep?.label ?? adres.energielabel)?.toUpperCase() ?? null;
  const labelEcht = Boolean(ep) || adres.energielabelBron === "echt";

  const labelBronTekst = labelEcht
    ? `geregistreerd label (EP-Online/RVO${ep?.registratiedatum ? `, geregistreerd op ${formatDatumNl(ep.registratiedatum)}` : ""})`
    : label
      ? `indicatie op basis van bouwjaar ${adres.bouwjaar}, geen gemeten label`
      : "geen label bekend";

  const adviezen = maakMaatregelAdviezen(adres.woningtype);
  const leenruimte = extraLeenruimteBijLabel(label);

  return (
    <section id="energie" aria-label="Energie en verduurzaming" className="scroll-mt-6">
      <h2 className="text-2xl font-semibold">Energie en verduurzaming</h2>

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <Kaart className="lg:col-span-2">
          <SectieLabel>Energielabel</SectieLabel>
          <div className="mt-3 flex items-center gap-4">
            <span className="flex h-14 min-w-14 items-center justify-center rounded-lg bg-merk px-2 font-display text-3xl font-semibold text-white">
              {label ?? "?"}
            </span>
            <div>
              <BronLabel>{labelBronTekst}</BronLabel>
              <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                {label
                  ? "Het label telt mee in de waarde en bepaalt de extra leenruimte voor verduurzaming hiernaast."
                  : "Zonder bekend label kunnen we de extra leenruimte niet bepalen; de maatregel-cijfers hieronder gelden wel."}
              </p>
            </div>
          </div>
        </Kaart>
        <StatTegel
          label="Extra leenruimte verduurzaming"
          waarde={leenruimte ? formatEuro(leenruimte.bedrag) : "onbekend"}
          delta={
            leenruimte
              ? leenruimte.bedrag === 0
                ? `bij label ${label}: het huis is al zeer zuinig`
                : `maximum bij label ${label} (groep ${leenruimte.labelGroep})`
              : "geen herkenbaar energielabel"
          }
        />
      </div>

      <Kaart className="mt-5">
        <SectieLabel>Wat levert verduurzamen op voor dit huis</SectieLabel>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                <th className="py-2 pr-4 font-medium">Maatregel</th>
                <th className="py-2 pr-4 font-medium">ISDE-subsidie 2026</th>
                <th className="py-2 pr-4 font-medium">Besparing per jaar</th>
                <th className="py-2 font-medium">Terugverdientijd</th>
              </tr>
            </thead>
            <tbody>
              {adviezen.map((advies) => (
                <tr key={advies.key} className="border-b border-lijn last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{advies.titel}</td>
                  <td className="py-2.5 pr-4">{advies.subsidie ? formatEuro(advies.subsidie.bedrag) : "geen ISDE"}</td>
                  <td className="py-2.5 pr-4">{advies.besparing ? formatEuroBereik(advies.besparing.bereik) : "geen kental"}</td>
                  <td className="py-2.5">
                    {advies.terugverdientijd ? formatTerugverdientijd(advies.terugverdientijd) : "niet te berekenen"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gedempt">
          Alle bedragen zijn indicaties op basis van openbare bronnen: RVO (ISDE 2026, peildatum{" "}
          {formatDatumNl(ISDE_PEILDATUM)}), Milieu Centraal (besparingskentallen, opgehaald {formatDatumNl(BESPARING_PEILDATUM)}) en de{" "}
          <a href={LEENNORMEN_BRON.url} rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
            leennormen 2026
          </a>{" "}
          (geverifieerd op {formatDatumNl(LEENNORMEN_PEILDATUM)}). Geen offerte en geen financieel advies; subsidiebedragen
          zijn rekenvoorbeelden bij de ISDE-minima.
        </p>
        <Link
          href={`/verduurzamen/advies?${adresQuery}`}
          className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4"
        >
          Volledig advies per maatregel, met alle bronnen en uitleg
        </Link>
      </Kaart>
    </section>
  );
}
