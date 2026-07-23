import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Serieel: alle test-files delen dezelfde lokale Postgres-testdatabase
    // (wonea_test) en resetten die per file. Parallel draaien zou ze door
    // elkaar laten schrijven.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
