"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";

/**
 * Verkoopvolume per maand (Bklit-chartlaag, Wonea-tokens uit globals.css).
 * Bewust sober: staven, raster en maandlabels; geen tooltip-laag of effecten.
 * De data komt server-side uit lib/woningmarkt (som van gemeten buurt-volumes).
 */
export function VerkopenGrafiek({ data }: { data: { maand: string; verkopen: number }[] }) {
  return (
    <BarChart data={data} xDataKey="maand" aspectRatio="5 / 2" barGap={0.35} margin={{ top: 12, right: 8, bottom: 28, left: 8 }}>
      <Grid horizontal vertical={false} />
      <Bar dataKey="verkopen" fill="var(--chart-2)" lineCap={3} staggerDelay={0.03} />
      <BarXAxis maxLabels={12} />
    </BarChart>
  );
}
