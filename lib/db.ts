import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "@/db/schema";

// Singleton via globalThis: Next dev/HMR maakt modules opnieuw aan, maar de
// DB-handle moet 1x bestaan (anders handle-lek / locked database).
const globalForDb = globalThis as unknown as {
  woneaSqlite?: Database.Database;
  woneaDb?: BetterSQLite3Database<typeof schema>;
};

function createClient() {
  const file = process.env.WONEA_DB_PATH ?? path.join(process.cwd(), "data", "wonea.db");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export const sqlite: Database.Database = globalForDb.woneaSqlite ?? createClient();
export const db: BetterSQLite3Database<typeof schema> = globalForDb.woneaDb ?? drizzle(sqlite, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.woneaSqlite = sqlite;
  globalForDb.woneaDb = db;
}

export { schema };
