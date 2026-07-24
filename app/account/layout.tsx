import type { ReactNode } from "react";
import { IngelogdeShell } from "@/components/dossier/shell";

/** Accountpagina's delen de ingelogde navy app-shell met het dashboard. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <IngelogdeShell>{children}</IngelogdeShell>;
}
