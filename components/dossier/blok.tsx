import type { ReactNode } from "react";
import { IcoonRondje } from "@/components/ui";
import type { IcoonNaam } from "@/components/iconen";

/**
 * Bouwstenen van het flux-dashboard (BRAND.md "Dashboard-shell-patroon"):
 * grote WITTE blokken (radius-blok 24) op het lichtgrijze canvas binnen het
 * zwarte shell-frame. Alleen voor de ingelogde omgeving; buiten het
 * dashboard-frame geldt gewoon Kaart (radius 14).
 */

export function Blok({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[24px] bg-paneel p-6 shadow-zweef ${className}`}>{children}</div>;
}

/**
 * Vaste blokkop: icoon in tint-rondje + stille titel, met optioneel een
 * actie-slot rechts (link, label). Het flux-patroon "kop met icoon in
 * tint-rondje plus een stil element rechts".
 */
export function BlokKop({
  icoon,
  titel,
  actie,
}: {
  icoon: IcoonNaam;
  titel: string;
  actie?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <IcoonRondje naam={icoon} tint="merk" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">{titel}</p>
      </div>
      {actie ? <div className="shrink-0">{actie}</div> : null}
    </div>
  );
}
