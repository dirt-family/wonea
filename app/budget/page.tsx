import type { Metadata } from "next";
import Link from "next/link";
import { Kaart } from "@/components/ui";
import { getActueleRentes, getRenteBucket, peilmaandLabel } from "@/lib/bronnen/rentes";
import { RENTEVAST_BUCKET, RENTEVAST_KEUZES } from "@/app/budget/berekening";
import { BudgetStepper, type RenteVoorinvulling } from "@/app/budget/stepper";

/**
 * Budgetberekenaar: maximale hypotheek plus bruto maandlast volgens de
 * wettelijke leennormen 2026 (lib/hypotheek.ts op lib/normen/leennormen-2026.ts).
 * De serverpagina levert alleen de DNB-rente-voorinvulling (met peildatum en
 * bron) aan de client-stepper; er is geen adres-invoer, dus geen
 * suppressie-pad, en er wordt niets opgeslagen of verstuurd.
 */

export const metadata: Metadata = {
  title: "Budgetberekenaar: hoeveel kan ik lenen?",
  description:
    "Bereken je maximale hypotheek en bruto maandlast volgens de wettelijke leennormen van 2026, met eerlijke bandbreedte en bronvermelding.",
  robots: { index: false, follow: false },
};

export default function BudgetPagina() {
  const rentes = getActueleRentes();
  const perKeuze: RenteVoorinvulling["perKeuze"] = {};
  for (const keuze of RENTEVAST_KEUZES) {
    const bucket = getRenteBucket(RENTEVAST_BUCKET[keuze]);
    if (bucket) perKeuze[keuze] = bucket.rentePct;
  }
  const voorinvulling: RenteVoorinvulling = {
    perKeuze,
    peilmaand: peilmaandLabel(rentes.peildatum),
    opgehaaldOp: rentes.opgehaaldOp,
    bron: rentes.bron,
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold sm:text-4xl">Hoeveel kan ik lenen?</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Bereken in drie korte stappen je maximale hypotheek en bruto maandlast, volgens de wettelijke leennormen van 2026.
        Gratis en zonder account; de berekening gebeurt in je browser en we slaan niets op.
      </p>

      <Kaart className="mt-8">
        <BudgetStepper voorinvulling={voorinvulling} />
      </Kaart>

      <p className="mt-8 text-sm leading-relaxed text-gedempt">
        Eerlijk is eerlijk: dit is een indicatie op basis van de wettelijke normen (Staatscourant 2025, 36471), geen
        offerte en geen advies. Geldverstrekkers hanteren eigen acceptatiebeleid. Hoe we rekenen staat bij de uitkomst en
        op de{" "}
        <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
          methodepagina
        </Link>
        .
      </p>
    </div>
  );
}
