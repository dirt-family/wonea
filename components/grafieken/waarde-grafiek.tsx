"use client";

import { useReducedMotion } from "motion/react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";

/**
 * Waarde-ontwikkelingsgrafiek voor de donkere AnalyseKaart (flux-patroon):
 * gedempte staven voor de historie (--chart-1) en precies een actieve staaf
 * in lime (--chart-actueel). Binnen AnalyseKaart (klasse chart-op-shell)
 * lossen die tokens op naar gedempt-wit en het lime-anker; op licht naar
 * merk en lime-600 (graphics-contrast). Techniek: twee gestapelde reeksen
 * waarvan er per staaf altijd een 0 is, zodat elke x-positie een enkele
 * staaf in de juiste kleur toont.
 * Alleen echte reeksen doorgeven; actueelIndex default = laatste punt.
 */
export function WaardeGrafiek({
  data,
  actueelIndex,
  maxLabels = 12,
}: {
  data: { label: string; waarde: number }[];
  actueelIndex?: number;
  /** Maximum aantal x-as-labels; verlaag in smalle kolommen (bijv. 6). */
  maxLabels?: number;
}) {
  // De Bklit-Bar kent zelf geen reduced-motion; hier afvangen zodat de
  // groei-animatie uit staat voor wie dat vraagt (staven staan er dan direct).
  const rustig = useReducedMotion() === true;
  const actueel = actueelIndex ?? data.length - 1;
  const rijen = data.map((d, i) => ({
    label: d.label,
    historie: i === actueel ? 0 : d.waarde,
    actueel: i === actueel ? d.waarde : 0,
  }));
  return (
    <BarChart data={rijen} xDataKey="label" stacked aspectRatio="5 / 2" barGap={0.35} margin={{ top: 12, right: 8, bottom: 28, left: 8 }}>
      <Grid horizontal vertical={false} />
      <Bar dataKey="historie" fill="var(--chart-1)" lineCap={3} staggerDelay={0.03} animate={!rustig} />
      <Bar dataKey="actueel" fill="var(--chart-actueel)" lineCap={3} animate={!rustig} />
      <BarXAxis maxLabels={maxLabels} />
    </BarChart>
  );
}
