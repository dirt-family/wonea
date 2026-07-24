/**
 * Rekenmodule-framework: importeer vanaf "@/components/rekenmodule".
 * - RekenModule + StapDefinitie/RekenModuleApi/SessieKoppeling: het stap-frame.
 * - KeuzeKaart + EnergieLabelKeuze: rijke keuzeopties (huisstijl v3).
 * - UitkomstMoment + BandbreedteInvaart: het uitkomst-moment (amber-wash,
 *   oversized serif-cijfer, bandbreedte die invaart).
 * - RekenmoduleSamenvatting + GerelateerdeRekenhulpen: uitkomst-conventie.
 * - logica.ts: pure helpers (apart importeerbaar voor tests).
 */
export {
  BandbreedteInvaart,
  EnergieLabelKeuze,
  GerelateerdeRekenhulpen,
  KeuzeKaart,
  RekenModule,
  RekenmoduleSamenvatting,
  UitkomstMoment,
  type GerelateerdeRekenhulp,
  type RekenModuleApi,
  type SamenvattingRij,
  type SessieKoppeling,
  type StapDefinitie,
} from "./rekenmodule";
