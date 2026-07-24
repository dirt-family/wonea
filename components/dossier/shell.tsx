import type { ReactNode } from "react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses, alertSubscriptions, claims } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { isAddressIdSuppressed } from "@/lib/suppression";
import { WoneaLogo } from "@/components/logo";
import { PromoBlok } from "@/components/ui";
import type { IllustratieNaam } from "@/components/illustraties";
import { ShellNav, type ShellNavItem } from "@/components/dossier/shell-nav";

/**
 * De ingelogde app-shell, flux LETTERLIJK (BRAND.md "Dashboard-shell-patroon",
 * besluit Mitch 24 jul): een afgerond shell-ZWART frame (radius 28) op de
 * achtergrond, met links de zwarte sidebar (logo, navigatie met witte
 * actief-pill, lime teller-badge, onderin precies 1 lime PromoBlok) en rechts
 * het lichtgrijze canvas waarop de pagina's hun witte blokken leggen. Alleen
 * ingelogd; de publieke site houdt de gewone header. Op kleine schermen wordt
 * de sidebar een zwarte bovenbalk met dezelfde navigatie.
 *
 * Geen data-logica: deze component leest alleen (claims + alert-status) om
 * navigatielinks en het ene functionele promo-blok te kunnen kiezen.
 */

type PromoVariant = "claim" | "alerts" | "rapport";

const PROMO: Record<PromoVariant, { titel: string; tekst: string; knop: string; illustratie: IllustratieNaam }> = {
  claim: {
    titel: "Volg je eigen woning",
    tekst: "Claim je adres en bouw je dossier op: waarde, WOZ, energie en hypotheek op een plek.",
    knop: "Zoek je adres",
    illustratie: "woningwaarde",
  },
  alerts: {
    titel: "Waarde-alerts",
    tekst: "Krijg maandelijks de waardeontwikkeling van je woning per mail. Uitzetten kan altijd.",
    knop: "Zet alerts aan",
    illustratie: "woningwaarde",
  },
  rapport: {
    titel: "Deel je rapport",
    tekst: "Een deelbare link toont alleen gegevens die ook op de publieke woningpagina staan.",
    knop: "Bekijk je rapporten",
    illustratie: "rapport",
  },
};

export async function IngelogdeShell({ children }: { children: ReactNode }) {
  const user = await currentUser();
  // Zonder sessie stuurt de pagina zelf door naar /claim; geen shell nodig.
  if (!user) return <>{children}</>;

  const actieveClaims = await db
    .select()
    .from(claims)
    .where(and(eq(claims.userId, user.id), isNull(claims.endedAt)))
    .orderBy(desc(claims.createdAt));

  // Meest recente claim met een zichtbaar adres bepaalt de dossier-links.
  let dossierHref: string | null = null;
  let alertsActief = false;
  for (const claim of actieveClaims) {
    const adres = (await db.select().from(addresses).where(eq(addresses.id, claim.adresId)).limit(1))[0];
    if (!adres || adres.status === "opted_out" || (await isAddressIdSuppressed(adres.id))) continue;
    dossierHref = `/dashboard/woning/${claim.id}`;
    const abonnement = (
      await db.select().from(alertSubscriptions).where(eq(alertSubscriptions.claimId, claim.id)).limit(1)
    )[0];
    alertsActief = !!abonnement?.actief;
    break;
  }

  const items: ShellNavItem[] = [
    { label: "Overzicht", href: "/dashboard", icoon: "grafiek" },
    ...(dossierHref
      ? ([
          { label: "Mijn woning", href: dossierHref, icoon: "huis", actiefPrefix: "/dashboard/woning", badge: actieveClaims.length },
          { label: "Waarde-alerts", href: `${dossierHref}#alerts`, icoon: "waarschuwing" },
          { label: "Rapporten", href: `${dossierHref}#rapporten`, icoon: "document" },
        ] satisfies ShellNavItem[])
      : []),
    { label: "Account", href: "/account", icoon: "schild", actiefPrefix: "/account" },
  ];

  // Maximaal 1 functioneel promo-blok: claimen als er niets te volgen is,
  // alerts aanzetten als die uitstaan, anders rapporten delen.
  const promo: { variant: PromoVariant; href: string } = !dossierHref
    ? { variant: "claim", href: "/" }
    : !alertsActief
      ? { variant: "alerts", href: `${dossierHref}#alerts` }
      : { variant: "rapport", href: `${dossierHref}#rapporten` };
  const promoInhoud = PROMO[promo.variant];

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-12 pt-4 sm:px-5 lg:pt-6">
      <div className="rounded-[28px] bg-shell p-2 shadow-zweef-lg lg:grid lg:min-h-[calc(100vh-8.5rem)] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="px-2 pb-2 pt-2 lg:px-2 lg:pb-2 lg:pt-3">
          <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:min-h-[calc(100vh-9.5rem)] lg:gap-0">
            <div className="flex items-center gap-2.5 px-2 pt-1 lg:pb-6">
              <WoneaLogo className="h-8 w-8" />
              <p className="font-display text-lg font-bold text-op-shell">Mijn Wonea</p>
            </div>
            <ShellNav items={items} />
            <div className="hidden lg:mt-auto lg:block lg:pt-6">
              <PromoBlok
                titel={promoInhoud.titel}
                tekst={promoInhoud.tekst}
                knopTekst={promoInhoud.knop}
                href={promo.href}
                illustratie={promoInhoud.illustratie}
                radius="kaart"
              />
            </div>
          </div>
        </aside>
        <div className="min-w-0 rounded-[20px] bg-canvas p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
