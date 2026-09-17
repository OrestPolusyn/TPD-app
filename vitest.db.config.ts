import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts (unit tests): these need a live Postgres at
// TEST_DATABASE_URL and are excluded from the default `npm test` run so CI
// without a database doesn't fail. Run with `npm run test:db`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 20000,
    fileParallelism: false, // tests share one database and truncate it between suites
  },
});
