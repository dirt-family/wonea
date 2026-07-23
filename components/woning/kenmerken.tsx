import type { ReactNode } from "react";
import { BronLabel, EnergieLabelBadge, FeitenLijst, Kaart } from "@/components/ui";
import type { addresses } from "@/db/schema";

/**
 * Module 9: kenmerken als FeitenLijst. Alleen velden die we echt hebben
 * (type, bouwjaar, oppervlak, energielabel); ontbreekt een veld, dan valt de
 * rij weg in plaats van "onbekend" te raden.
 */
export function KenmerkenModule({ adres }: { adres: typeof addresses.$inferSelect }) {
  const feiten: [string, ReactNode][] = [
    ["Woningtype", adres.woningtype],
    ["Bouwjaar", String(adres.bouwjaar)],
    ["Woonoppervlakte", `${adres.oppervlakteM2} m2`],
  ];
  if (adres.energielabel) {
    feiten.push([
      "Energielabel",
      <span key="label" className="inline-flex items-center gap-2">
        <EnergieLabelBadge label={adres.energielabel} klein />
        {adres.energielabelBron === "indicatie" ? <BronLabel>indicatie</BronLabel> : null}
      </span>,
    ]);
  }
  return (
    <Kaart>
      <h2 className="text-xl font-semibold">Kenmerken</h2>
      <div className="mt-4">
        <FeitenLijst feiten={feiten} />
      </div>
    </Kaart>
  );
}
