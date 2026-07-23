/**
 * Testdatabase op de LOKALE Postgres (database "wonea_test", los van de
 * dev-database "wonea"). Tests draaien serieel (vitest.config: fileParallelism
 * false), zodat een gedeelde testdatabase veilig is: elke test-file reset de
 * tabellen aan het begin.
 *
 * Aanmaken/pushen doe je eenmalig buiten de tests:
 *   createdb wonea_test
 *   DATABASE_URL=postgresql://<user>@localhost:5432/wonea_test npx drizzle-kit push --force
 * (README/DEPLOYMENT documenteren dit.) maakTestDb() zet alleen de env goed en
 * maakt de tabellen leeg.
 */

const TEST_URL = process.env.WONEA_TEST_DATABASE_URL ?? "postgresql://mitch@localhost:5432/wonea_test";

// Alle tabellen, in willekeurige volgorde; TRUNCATE ... CASCADE regelt FK's.
const TABELLEN = [
  "municipalities",
  "neighborhoods",
  "addresses",
  "sales",
  "valuations",
  "woz_values",
  "users",
  "sessions",
  "magic_tokens",
  "claims",
  "mortgage_info",
  "consents",
  "alert_subscriptions",
  "emails_outbox",
  "leads",
  "lead_events",
  "premium_entitlements",
  "optouts",
  "widget_captures",
  "shared_reports",
  "index_gating",
  "market_stats",
];

/**
 * Zet DATABASE_URL naar de testdatabase en maakt alle tabellen leeg
 * (identiteitsreeksen resetten). MOET aangeroepen worden VOOR de eerste import
 * van lib/db (gebruik daarna dynamische imports in de test).
 */
export async function maakTestDb(): Promise<void> {
  process.env.DATABASE_URL = TEST_URL;
  const { sql } = await import("@/lib/db");
  await sql.unsafe(`TRUNCATE ${TABELLEN.join(", ")} RESTART IDENTITY CASCADE`);
}
