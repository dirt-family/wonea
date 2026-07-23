"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

function euro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

/** Vergelijkt client-side; er wordt bewust niets opgeslagen of verstuurd. */
export function WozVergelijker({ marktwaarde, intervalLaag, intervalHoog }: { marktwaarde: number; intervalLaag: number; intervalHoog: number }) {
  const [invoer, setInvoer] = useState("");
  const woz = Number(invoer.replace(/[^\d]/g, ""));
  const geldig = woz > 10000;

  let oordeel: { titel: string; tekst: string; kleur: string } | null = null;
  if (geldig) {
    const verschil = woz - marktwaarde;
    const pct = Math.round((verschil / marktwaarde) * 100);
    if (woz > intervalHoog) {
      oordeel = {
        titel: `Je WOZ ligt ${euro(verschil)} (${pct}%) boven onze schatting`,
        tekst: "Dat is boven onze hele bandbreedte. Bezwaar kan zinvol zijn; check de vergelijkbare verkopen op de woningpagina als onderbouwing.",
        kleur: "text-negatief",
      };
    } else if (woz < intervalLaag) {
      oordeel = {
        titel: `Je WOZ ligt ${euro(Math.abs(verschil))} (${Math.abs(pct)}%) onder onze schatting`,
        tekst: "Een lage WOZ betekent minder belasting. Bezwaar is dan meestal niet in je voordeel.",
        kleur: "text-positief",
      };
    } else {
      oordeel = {
        titel: "Je WOZ valt binnen onze bandbreedte",
        tekst: "Het verschil met de markt is kleiner dan de onzekerheid van elke schatting. Bezwaar heeft dan weinig kans.",
        kleur: "text-inkt",
      };
    }
  }

  return (
    <div className="mt-4">
      <label className="block max-w-xs">
        <span className="mb-1 block text-sm font-medium text-inkt">WOZ-waarde van je beschikking</span>
        <input
          inputMode="numeric"
          placeholder="bv. 425000"
          value={invoer}
          onChange={(e) => setInvoer(e.target.value)}
          className={inputClass}
        />
      </label>
      {oordeel ? (
        <div className="mt-4 rounded-lg bg-achtergrond p-4">
          <p className={`text-sm font-semibold ${oordeel.kleur}`}>{oordeel.titel}</p>
          <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">{oordeel.tekst}</p>
          {geldig && woz > intervalHoog ? (
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Rekenvoorbeeld: komt je WOZ na bezwaar uit op onze schatting, dan gaat hij {euro(woz - marktwaarde)} omlaag.
              Bij een voorbeeldtarief van 0,1% OZB scheelt dat ongeveer {euro(Math.round((woz - marktwaarde) * 0.001))} per
              jaar. Het echte tarief staat op de aanslag van je gemeente; meer uitleg staat onder deze check.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
