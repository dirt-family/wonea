/** Klein energielabel-chipje voor woningkaarten. Indicaties worden eerlijk benoemd. */
export function EnergielabelChip({ label, bron }: { label: string; bron: "echt" | "indicatie" }) {
  return (
    <span className="inline-flex items-center rounded-full bg-merk-wash px-2.5 py-0.5 text-[11px] font-medium text-merk">
      Label {label.toUpperCase()}
      {bron === "indicatie" ? <span className="ml-1 text-merk-400">(indicatie)</span> : null}
    </span>
  );
}
