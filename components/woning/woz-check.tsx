import Link from "next/link";
import { BronLabel, Kaart, ModuleTag } from "@/components/ui";
import { formatEuro } from "@/lib/util";
import { formatPct, type WozBuurtVergelijk } from "@/components/woning/data";

/**
 * Module 7: de WOZ-check. Vergelijkt de WOZ met het buurtgemiddelde en zegt
 * eerlijk wanneer die duidelijk afwijkt. Bezwaar maken is GRATIS via de eigen
 * gemeente; we pushen bewust geen no-cure-no-pay-partner (we hebben er geen,
 * en het past niet bij de merkbelofte). Zie PROTOTYPE-OOGST.md.
 */
export function WozCheckModule({
  vergelijk,
  wozBron,
  adresQuery,
}: {
  vergelijk: WozBuurtVergelijk;
  wozBron: "eigenaar" | "seed";
  adresQuery: string;
}) {
  const afwijking = vergelijk.richting !== "in_lijn";
  const absPct = formatPct(Math.abs(vergelijk.verschilPct)).replace("+", "");

  return (
    <Kaart className={afwijking ? "border-accent-200 bg-accent-wash" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">Klopt de WOZ-waarde?</h2>
        <ModuleTag>gratis check</ModuleTag>
      </div>

      {vergelijk.basis === "per_m2" && vergelijk.eigenPerM2 !== null && vergelijk.buurtPerM2 !== null ? (
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Per m2 komt de WOZ van dit huis uit op <span className="font-semibold tabular-nums">{formatEuro(Math.round(vergelijk.eigenPerM2))}</span>; het
          buurtgemiddelde is <span className="font-semibold tabular-nums">{formatEuro(Math.round(vergelijk.buurtPerM2))}</span>.{" "}
          {vergelijk.richting === "in_lijn"
            ? "Dat ligt in lijn met de buurt."
            : `Dat is ongeveer ${absPct} ${vergelijk.richting === "hoger" ? "boven" : "onder"} het buurtgemiddelde, een duidelijk verschil.`}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          {vergelijk.richting === "in_lijn"
            ? "De WOZ van dit huis ligt in lijn met het buurtgemiddelde."
            : `De WOZ van dit huis ligt ongeveer ${absPct} ${vergelijk.richting === "hoger" ? "boven" : "onder"} het buurtgemiddelde, een duidelijk verschil.`}{" "}
          Deze vergelijking kijkt naar het hele bedrag, dus grootte en type wegen mee.
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
        {vergelijk.richting === "hoger"
          ? "Een hogere WOZ kan kloppen, maar het kan ook reden zijn om je beschikking na te lopen: je betaalt er belasting over."
          : vergelijk.richting === "lager"
            ? "Een lagere WOZ is voor de belasting gunstig; controleer vooral of de kenmerken op je beschikking kloppen."
            : "Ook dan kan je beschikking fouten bevatten; nalopen kost niets."}{" "}
        Denk je dat de WOZ niet klopt? Bezwaar maken is gratis en doe je rechtstreeks bij je gemeente, meestal binnen zes
        weken na de datum op de beschikking. Daar heb je geen commercieel bureau voor nodig.
      </p>

      {wozBron === "seed" ? (
        <p className="mt-3">
          <BronLabel>gerekend met de voorbeeld-WOZ, niet de echte</BronLabel>
        </p>
      ) : null}

      <Link href={`/woz-check?${adresQuery}`} className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4">
        Vergelijk met je eigen WOZ-beschikking
      </Link>
    </Kaart>
  );
}
