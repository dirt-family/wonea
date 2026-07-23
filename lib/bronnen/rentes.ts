/**
 * Actuele gemiddelde hypotheekrentes (DNB) uit de in-repo snapshot.
 *
 * De snapshot (rentes-snapshot.json) wordt geschreven door
 * scripts/ingest-open/dnb-rentes.py en komt uit DNB Tabel 5.2.7.1: gemiddelde
 * bancaire rente op zuiver nieuw afgesloten woninghypotheken aan huishoudens,
 * per rentevaste periode. Het zijn maandgemiddelden over banken, GEEN tarieven
 * per geldverstrekker en GEEN NHG-splitsing (docs/DATABRONNEN.md punt 5).
 *
 * UI-regel (CONTRACTS): toon bij elk rentecijfer ALTIJD peildatum en bron.
 * Gebruik daarvoor peilmaandLabel() en de bron/bronUrl uit getActueleRentes().
 */

import snapshot from "./rentes-snapshot.json";

export type RenteBucketKey = "variabel_tot_1" | "1_tot_5" | "5_tot_10" | "vanaf_10";

export type RenteBucket = {
  /** Stabiele sleutel voor logica en tests. */
  bucket: RenteBucketKey;
  /** NL-label voor de UI, bv. "1 tot en met 5 jaar rentevast". */
  label: string;
  /** Oorspronkelijke DNB-reeksnaam, voor de methode-uitleg. */
  reeksDnb: string;
  /** Gemiddelde rente in procenten, bv. 3.79. */
  rentePct: number;
};

export type ActueleRentes = {
  /** Maand waarop de cijfers slaan, "YYYY-MM". DNB publiceert met ~2 maanden vertraging. */
  peildatum: string;
  /** Datum waarop de snapshot is opgehaald, "YYYY-MM-DD". */
  opgehaaldOp: string;
  /** Bronvermelding voor de UI. */
  bron: string;
  bronUrl: string;
  dashboardUrl: string;
  /** Eerlijke duiding van wat dit cijfer wel en niet is; toon in de methode-uitleg. */
  toelichting: string;
  /** Gemiddelde over alle rentevaste perioden samen (kan ontbreken in de bron). */
  totaalRentePct: number | null;
  /** De vier DNB-rentevast-buckets, in oplopende rentevast-volgorde. */
  buckets: RenteBucket[];
};

const rentes: ActueleRentes = {
  peildatum: snapshot.peildatum,
  opgehaaldOp: snapshot.opgehaaldOp,
  bron: snapshot.bron,
  bronUrl: snapshot.bronUrl,
  dashboardUrl: snapshot.dashboardUrl,
  toelichting: snapshot.toelichting,
  totaalRentePct: snapshot.totaalRentePct ?? null,
  buckets: snapshot.buckets as RenteBucket[],
};

/** De actuele DNB-gemiddelden per rentevast-bucket, met peildatum en bron. */
export function getActueleRentes(): ActueleRentes {
  return rentes;
}

/** Eén bucket opzoeken op stabiele sleutel. */
export function getRenteBucket(bucket: RenteBucketKey): RenteBucket | undefined {
  return rentes.buckets.find((b) => b.bucket === bucket);
}

/** "2026-05" -> "mei 2026", voor de verplichte peildatum-vermelding in de UI. */
export function peilmaandLabel(peildatum: string = rentes.peildatum): string {
  const [jaar, maand] = peildatum.split("-").map(Number);
  if (!jaar || !maand || maand < 1 || maand > 12) return peildatum;
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(Date.UTC(jaar, maand - 1, 1)));
}
