/**
 * Rekenmodule-framework: importeer vanaf "@/components/rekenmodule".
 * - RekenModule + StapDefinitie/RekenModuleApi/SessieKoppeling: het stap-frame.
 * - RekenmoduleSamenvatting + GerelateerdeRekenhulpen: uitkomst-conventie.
 * - logica.ts: pure helpers (apart importeerbaar voor tests).
 */
export {
  GerelateerdeRekenhulpen,
  RekenModule,
  RekenmoduleSamenvatting,
  type GerelateerdeRekenhulp,
  type RekenModuleApi,
  type SamenvattingRij,
  type SessieKoppeling,
  type StapDefinitie,
} from "./rekenmodule";
