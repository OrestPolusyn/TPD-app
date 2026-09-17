/**
 * Thin psql-over-child_process helper for the DB integration tests in this
 * directory. Deliberately avoids adding a `pg`-style npm dependency (not on
 * the build prompt's allowed-dependencies list) — `psql` is already required
 * to run the Supabase CLI locally.
 *
 * Connects to TEST_DATABASE_URL, defaulting to the Supabase CLI's local
 * Postgres (`supabase start`'s default port 54322). See README "Testing"
 * for how to point this at a different database.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function isDatabaseReachable(): boolean {
  try {
    execFileSync("psql", [TEST_DATABASE_URL, "-t", "-A", "-c", "select 1"], {
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

/** Runs a (possibly multi-statement) SQL script in one psql session/connection. */
export function sql(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), "tpd-db-test-"));
  const file = join(dir, "q.sql");
  writeFileSync(file, script);
  // -q suppresses command-completion tags ("SET", "INSERT 0 1", ...) that
  // would otherwise land in stdout ahead of the actual SELECT output whenever
  // a script starts with `set role`/`set request.jwt.claim.sub` (as sqlAs
  // always does), corrupting anything that parses the result as a single
  // value or JSON document.
  return execFileSync("psql", [TEST_DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-f", file], {
    encoding: "utf8",
  });
}

/** Runs `script` (expected to end with a single SELECT) and JSON-decodes the result. */
export function sqlJson<T>(script: string): T {
  const wrapped = `${script}\n`;
  const out = sql(wrapped);
  const trimmed = out.trim();
  return trimmed.length === 0 ? (null as T) : JSON.parse(trimmed);
}

/** Runs `script` as a given Postgres role, with request.jwt.claim.sub set to
 * simulate auth.uid() for that user (mirrors how PostgREST sets it from the
 * caller's JWT). Pass userId=null for the anon role. */
export function sqlAs(role: "anon" | "authenticated", userId: string | null, script: string): string {
  const setup = [`set role ${role};`, userId ? `set request.jwt.claim.sub = '${userId}';` : ""].join("\n");
  return sql(`${setup}\n${script}`);
}
