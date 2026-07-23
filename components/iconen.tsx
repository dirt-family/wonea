import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowRight,
  BadgeEuro,
  Calculator,
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FileText,
  House,
  Info,
  Leaf,
  MapPin,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

/**
 * Gecureerde iconenset (Lucide, ISC-licentie). Dit is de ENIGE plek waar
 * lucide-react geimporteerd wordt: nieuwe iconen komen er alleen bij via deze
 * whitelist, zodat de set klein, consistent en on-brand blijft (dunne lijnen,
 * zelfde stroke als de illustraties). Grootte via de vaste maten hieronder.
 */
const ICONEN = {
  zoek: Search,
  huis: House,
  euro: BadgeEuro,
  rekenhulp: Calculator,
  grafiek: ChartNoAxesCombined,
  blad: Leaf,
  document: FileText,
  schild: ShieldCheck,
  weegschaal: Scale,
  locatie: MapPin,
  info: Info,
  vraag: CircleHelp,
  waarschuwing: CircleAlert,
  vinkje: CircleCheck,
  kruis: X,
  pijlRechts: ArrowRight,
  verwijderen: Trash2,
} satisfies Record<string, LucideIcon>;

export type IcoonNaam = keyof typeof ICONEN;

const MATEN = { s: 16, m: 20, l: 24 } as const;

export function Icoon({
  naam,
  maat = "m",
  className,
  ...rest
}: { naam: IcoonNaam; maat?: keyof typeof MATEN; className?: string } & Omit<LucideProps, "size">) {
  const Component = ICONEN[naam];
  return (
    <Component
      size={MATEN[maat]}
      strokeWidth={1.75}
      aria-hidden={rest["aria-label"] ? undefined : true}
      className={className}
      {...rest}
    />
  );
}
