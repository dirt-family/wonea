import { BronLabel, EnergieLabelBadge, IcoonRondje, Kaart, KnopSecundair } from "@/components/ui";
import { formatDatumNl, formatEuro } from "@/lib/util";
import type { Woningtype } from "@/db/schema";
import {
  BESPARING_DAK,
  BESPARING_HYBRIDE_WARMTEPOMP,
  BESPARING_PEILDATUM,
  BESPARING_SPOUWMUUR,
  type BesparingKental,
  type BesparingWoningtype,
} from "@/lib/normen/besparing";

/**
 * Module 6: "Energie en verduurzamen". Label-badge plus een besparings-
 * indicatie uit de Milieu Centraal-kentallen (lib/normen/besparing), altijd
 * met de verplichte duiding en bron. Voor appartementen geeft Milieu Centraal
 * geen kentallen: dan tonen we eerlijk geen bedragen. Bij label A of B
 * beloven we geen besparing die er waarschijnlijk niet is.
 */

const MAATREGELEN: BesparingKental[] = [BESPARING_SPOUWMUUR, BESPARING_DAK, BESPARING_HYBRIDE_WARMTEPOMP];

function kentalVoorType(kental: BesparingKental, woningtype: Woningtype): number {
  if (woningtype !== "appartement" && kental.perWoningtype) {
    return kental.perWoningtype[woningtype as BesparingWoningtype].eurPerJaar;
  }
  return kental.eurPerJaar;
}

export function EnergieModule({
  energielabel,
  energielabelBron,
  woningtype,
  adresQuery,
}: {
  energielabel: string | null;
  energielabelBron: "echt" | "indicatie";
  woningtype: Woningtype;
  adresQuery: string;
}) {
  const labelBasis = (energielabel ?? "").replace(/\+/g, "").toUpperCase().charAt(0);
  const zuinig = labelBasis === "A" || labelBasis === "B";
  const toonBedragen = energielabel !== null && !zuinig && woningtype !== "appartement";

  return (
    <Kaart>
      <div className="flex items-center gap-3">
        <IcoonRondje naam="blad" tint="amber" />
        <h2 className="text-xl font-semibold">Energie en verduurzamen</h2>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {energielabel ? (
          <>
            <EnergieLabelBadge label={energielabel} />
            {energielabelBron === "echt" ? (
              <span className="text-sm text-gedempt">geregistreerd label (EP-Online)</span>
            ) : (
              <BronLabel>indicatie op basis van bouwjaar</BronLabel>
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-inkt-zacht">Voor dit adres kennen we geen energielabel.</p>
        )}
      </div>

      {toonBedragen ? (
        <>
          <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
            Wat verduurzamen ongeveer oplevert voor een gemiddelde {woningtype} waar die maatregel nog niet is genomen:
          </p>
          <ul className="mt-3">
            {MAATREGELEN.map((kental) => (
              <li key={kental.key} className="flex items-center justify-between gap-3 border-b border-lijn py-2 text-sm last:border-0">
                <span className="text-inkt-zacht">{kental.label}</span>
                <span className="font-semibold tabular-nums">{formatEuro(kentalVoorType(kental, woningtype))} per jaar</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-gedempt">
            Indicaties van Milieu Centraal (opgehaald {formatDatumNl(BESPARING_PEILDATUM)}) voor een gemiddelde woning bij
            gemiddeld gebruik. De echte besparing hangt af van je woning, de huidige isolatie en je verbruik.
          </p>
        </>
      ) : energielabel && zuinig ? (
        <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
          Met label {energielabel.toUpperCase()} zit dit huis al aan de zuinige kant. In het advies zie je of er nog iets
          te winnen valt.
        </p>
      ) : woningtype === "appartement" && energielabel ? (
        <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
          Voor appartementen geeft Milieu Centraal geen aparte besparingscijfers, dus tonen we hier geen bedragen. Het
          advies laat zien wat in jouw situatie kan lonen.
        </p>
      ) : null}

      <div className="mt-4">
        <KnopSecundair href={`/verduurzamen/advies?${adresQuery}`}>Bekijk het verduurzamingsadvies</KnopSecundair>
      </div>
    </Kaart>
  );
}
