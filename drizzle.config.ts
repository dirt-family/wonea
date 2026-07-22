import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: process.env.WONEA_DB_PATH ?? "./data/wonea.db" },
});
