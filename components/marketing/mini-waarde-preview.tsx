import Link from "next/link";
import { Bandbreedte, Kaart, SectieLabel, StatTegel, VoorbeelddataLabel } from "@/components/ui";
import { EnergielabelChip } from "@/components/marketing/energielabel-chip";
import { formatEuro } from "@/lib/format";
import type { VoorbeeldWoning } from "@/lib/homepage-data";

const CONFIDENCE_TEKST: Record<"hoog" | "middel" | "laag", string> = {
  hoog: "Hoog",
  middel: "Middel",
  laag: "Laag",
};

/**
 * Echte mini-woningwaarde-preview voor de hero: onze eigen componenten
 * (Kaart, Bandbreedte, StatTegel) op klein formaat, gevuld met de data van
 * 1 echt voorbeeldadres uit de database. Geen nep-screenshot.
 */
export function MiniWaardePreview({ voorbeeld }: { voorbeeld: VoorbeeldWoning }) {
  const { adres, valuation, niveau } = voorbeeld;
  const naam = `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}`;
  const url = `/woning/${adres.postcode}/${adres.nummerslug}`;
  const plek = niveau === "straat" ? "in deze straat" : "in deze buurt";

  return (
    <Kaart className="shadow-zweef-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-inkt">{naam}</p>
          <p className="mt-0.5 text-xs text-gedempt">
            {adres.postcode} {adres.plaats}
          </p>
        </div>
        {adres.energielabel ? <EnergielabelChip label={adres.energielabel} bron={adres.energielabelBron} /> : null}
      </div>

      <div className="mt-5">
        <SectieLabel>Geschatte woningwaarde</SectieLabel>
        <p className="mt-2 font-display text-4xl font-semibold text-merk">{formatEuro(valuation.waarde)}</p>
        <Bandbreedte laag={valuation.intervalLaag} waarde={valuation.waarde} hoog={valuation.intervalHoog} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatTegel tint="merk" label="Zekerheid" waarde={CONFIDENCE_TEKST[valuation.confidence]} />
        <StatTegel tint="merk" label="Verkopen" waarde={String(valuation.nComparables)} delta={plek} deltaRichting="neutraal" />
      </div>

      <div className="mt-4">
        <VoorbeelddataLabel />
      </div>
      <Link href={url} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
        Bekijk de voorbeeldpagina
      </Link>
    </Kaart>
  );
}
