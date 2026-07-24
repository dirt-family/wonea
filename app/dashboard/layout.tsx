import type { ReactNode } from "react";
import { IngelogdeShell } from "@/components/dossier/shell";

/** Het hele ingelogde dashboard draait in de navy app-shell (BRAND.md). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <IngelogdeShell>{children}</IngelogdeShell>;
}
