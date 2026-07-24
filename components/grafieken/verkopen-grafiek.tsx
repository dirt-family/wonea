"use client";

import { useReducedMotion } from "motion/react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";

/**
 * Verkoopvolume per maand (Bklit-chartlaag, Wonea-tokens uit globals.css).
 * Bewust sober: staven, raster en maandlabels; geen tooltip-laag of effecten.
 * De data komt server-side uit lib/woningmarkt (som van gemeten buurt-volumes).
 * Flux-taal (BRAND.md, flux-kleurlaag): een reeks = merk-familie (merk-500 als
 * zachte eerste-reeks-tint) en precies de laatste maand als actieve staaf in
 * --chart-actueel (lime-600 op licht, het lime-anker op shell). Techniek:
 * twee gestapelde reeksen waarvan er per staaf altijd een 0 is, zelfde
 * patroon als waarde-grafiek.tsx.
 */
export function VerkopenGrafiek({ data }: { data: { maand: string; verkopen: number }[] }) {
  // Bklit-Bar kent zelf geen reduced-motion; hier afvangen (zie waarde-grafiek).
  const rustig = useReducedMotion() === true;
  const laatste = data.length - 1;
  const rijen = data.map((d, i) => ({
    maand: d.maand,
    historie: i === laatste ? 0 : d.verkopen,
    actueel: i === laatste ? d.verkopen : 0,
  }));
  return (
    <BarChart data={rijen} xDataKey="maand" stacked aspectRatio="5 / 2" barGap={0.35} margin={{ top: 12, right: 8, bottom: 28, left: 8 }}>
      <Grid horizontal vertical={false} />
      <Bar dataKey="historie" fill="var(--color-merk-500)" lineCap={3} staggerDelay={0.03} animate={!rustig} />
      <Bar dataKey="actueel" fill="var(--chart-actueel)" lineCap={3} animate={!rustig} />
      <BarXAxis maxLabels={12} />
    </BarChart>
  );
}
