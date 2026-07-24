import { EnergieLabelBadge } from "@/components/ui";

/**
 * Energielabel voor de hero-preview: de echte EnergieLabelBadge (EU-labelkleuren,
 * overal identiek — BRAND-regel), met het bron-suffix als meta-tekst.
 * Indicaties worden eerlijk benoemd.
 */
export function EnergielabelChip({ label, bron }: { label: string; bron: "echt" | "indicatie" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <EnergieLabelBadge label={label} klein />
      {bron === "indicatie" ? <span className="text-[11px] text-gedempt">(indicatie)</span> : null}
    </span>
  );
}
