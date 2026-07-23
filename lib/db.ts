import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

// Singleton via globalThis: Next dev/HMR maakt modules opnieuw aan, maar de
// connectie-pool moet 1x bestaan (anders pool-lek / te veel verbindingen).
const globalForDb = globalThis as unknown as {
  woneaSql?: ReturnType<typeof postgres>;
  woneaDb?: PostgresJsDatabase<typeof schema>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ontbreekt. Zet hem in .env (lokale Postgres) of in de host-omgeving (Neon).");
  }
  // sslmode staat in de URL (Neon: require; lokaal: geen). postgres-js leest dat zelf.
  // max laag houden i.v.m. Neon-verbindingslimieten en serverless.
  return postgres(url, { max: process.env.NODE_ENV === "production" ? 5 : 10 });
}

export const sql: ReturnType<typeof postgres> = globalForDb.woneaSql ?? createClient();
export const db: PostgresJsDatabase<typeof schema> = globalForDb.woneaDb ?? drizzle(sql, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.woneaSql = sql;
  globalForDb.woneaDb = db;
}

export { schema };
