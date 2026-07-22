import type { LeadStatus, LeadType } from "@/db/schema";

/**
 * Geschatte leadwaarde in euro, per type/subtype en status.
 * Bedragen komen uit het verdienmodel (marktanalyse par. 8):
 * hypotheek 35-350 per lead, succes-fee 500-1500 per gesloten deal;
 * makelaar tot ~500 bij succesvolle verkoop; taxatie-doorverwijzing marge
 * op NWWI-rapport (450-800); verduurzaming per-lead per verticaal.
 * Een gesloten hypotheeklead registreert de succes-fee-waarde.
 */

type Waardering = { perLead: number; gekwalificeerd: number; gesloten: number };

const HYPOTHEEK: Waardering = { perLead: 45, gekwalificeerd: 150, gesloten: 1000 };

const WAARDERING: Record<LeadType, Record<string, Waardering>> = {
  hypotheek: {
    overwaarde: HYPOTHEEK,
    oversluiten: HYPOTHEEK,
    aankoop: HYPOTHEEK,
    default: HYPOTHEEK,
  },
  makelaar: {
    default: { perLead: 75, gekwalificeerd: 150, gesloten: 500 },
  },
  taxatie: {
    default: { perLead: 25, gekwalificeerd: 50, gesloten: 75 },
  },
  verduurzaming: {
    zonnepanelen: { perLead: 35, gekwalificeerd: 60, gesloten: 90 },
    warmtepomp: { perLead: 50, gekwalificeerd: 90, gesloten: 140 },
    isolatie: { perLead: 30, gekwalificeerd: 55, gesloten: 80 },
    default: { perLead: 35, gekwalificeerd: 60, gesloten: 90 },
  },
};

export function leadwaarde(type: LeadType, subtype: string | null | undefined, status: LeadStatus): number {
  const perType = WAARDERING[type];
  const w = perType[subtype ?? "default"] ?? perType.default;
  switch (status) {
    case "nieuw":
      return w.perLead;
    case "gekwalificeerd":
    case "doorgestuurd":
      return w.gekwalificeerd;
    case "gesloten":
      return w.gesloten;
    case "afgewezen":
      return 0;
  }
}
