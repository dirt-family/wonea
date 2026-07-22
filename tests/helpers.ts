import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Maakt een tijdelijke testdatabase en wijst lib/db ernaar via WONEA_DB_PATH.
 * MOET aangeroepen worden VOOR de eerste import van lib/db (gebruik daarna
 * dynamische imports in de test).
 */
export function maakTestDb(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "wonea-test-"));
  const file = path.join(dir, "test.db");
  process.env.WONEA_DB_PATH = file;
  execSync("npx drizzle-kit push --force", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, WONEA_DB_PATH: file },
    stdio: "pipe",
  });
  return file;
}
