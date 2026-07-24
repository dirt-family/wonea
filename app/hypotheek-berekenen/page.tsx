import type { Metadata } from "next";
import Link from "next/link";
import { Kaart } from "@/components/ui";
import { getActueleRentes, getRenteBucket, peilmaandLabel } from "@/lib/bronnen/rentes";
import { getVerstrekkersRentes } from "@/lib/bronnen/rentes-verstrekkers";
import { DNB_BUCKET } from "@/app/hypotheek-berekenen/berekening";
import { HypotheekBerekenenStepper, type RenteContext } from "@/app/hypotheek-berekenen/stepper";

/**
 * Hypotheekberekenaar: maximale hypotheek, maandlasten en benodigd eigen geld
 * in een uitkomst. De rekenlagen zijn lib/hypotheek.ts (leennormen 2026),
 * lib/normen/overdrachtsbelasting-2026.ts via app/kosten-koper/berekening.ts,
 * en de rente-snapshots in lib/bronnen. De serverpagina leest alleen de
 * DNB-rente (met peildatum en bron) en de verstrekkerstarieven en geeft ze aan
 * de client-stepper; er is geen adres-invoer, dus geen suppressie-pad, en er
 * wordt niets opgeslagen of verstuurd.
 *
 * SEO volgt /budget: noindex zolang de Fase 5-gating er niet is (CONTRACTS).
 * Zodra de rekenhulpen indexeerbaar worden, hoort deze pagina met /budget mee
 * in /sitemaps/statisch.xml (lib/seo/sitemap.ts, buiten de scope van deze
 * module).
 */

export const metadata: Metadata = {
  title: "Hypotheek berekenen: maximale hypotheek, maandlasten en eigen geld",
  description:
    "Bereken in drie stappen je maximale hypotheek volgens de leennormen 2026, de maandlasten bij de actuele gemiddelde rente en het eigen geld dat je nodig hebt. Met bron en peildatum bij elk cijfer.",
  robots: { index: false, follow: false },
};

export default function HypotheekBerekenenPagina() {
  const rentes = getActueleRentes();
  const bucket = getRenteBucket(DNB_BUCKET);
  const rente: RenteContext | null = bucket
    ? {
        pct: bucket.rentePct,
        peilmaand: peilmaandLabel(rentes.peildatum),
        opgehaaldOp: rentes.opgehaaldOp,
        bron: rentes.bron,
      }
    : null;
  const verstrekkers = getVerstrekkersRentes();

  return (
    <div className="relative">
      {/* Hero-wash (v3, zelfde patroon als /claim en /hypotheek): rekenhulpen
          krijgen de navy-variant (wash-dramaturgie in docs/BRAND.md); de
          uitkomststap van de stepper is al het warme amber-moment. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 [background-image:var(--gradient-hero-wash-navy)]" />
      <div className="relative mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold sm:text-4xl">Bereken je hypotheek</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        In drie korte stappen zie je je maximale hypotheek volgens de wettelijke leennormen van 2026, de maandlasten bij
        de actuele gemiddelde rente en hoeveel eigen geld je nodig hebt. Gratis en zonder account; de berekening gebeurt
        in je browser en we slaan niets op.
      </p>

      <Kaart className="mt-8">
        <HypotheekBerekenenStepper rente={rente} verstrekkers={verstrekkers} />
      </Kaart>

      <p className="mt-8 text-sm leading-relaxed text-gedempt">
        Eerlijk is eerlijk: dit is informatie op basis van de wettelijke normen (Staatscourant 2025, 36471) en actuele
        gemiddelden, geen offerte en geen financieel advies. Geldverstrekkers hanteren eigen acceptatiebeleid. Hoe we
        rekenen staat bij de uitkomst en op de{" "}
        <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
          methodepagina
        </Link>
        .
      </p>
      </div>
    </div>
  );
}
