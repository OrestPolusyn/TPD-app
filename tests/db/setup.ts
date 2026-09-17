/**
 * DB integration test fixtures.
 *
 * Precondition: TEST_DATABASE_URL points at a Postgres instance that already
 * has every supabase/migrations/*.sql file applied, AND (only if it is not a
 * real Supabase project — i.e. a plain local Postgres) has
 * supabase/tests/00_supabase_stub.sql applied once beforehand to provide a
 * minimal auth.users/auth.uid()/anon/authenticated stand-in. Never run
 * 00_supabase_stub.sql against a real Supabase project: it would overwrite
 * Supabase's own auth.uid() implementation. See README "Testing without
 * Docker" for the exact commands.
 *
 * resetDatabase() only truncates application tables it owns (never touches
 * the `auth` schema, never drops/recreates schemas) and reloads the
 * seed/locations.csv fixture, so it's safe to call against a real Supabase
 * local dev database too.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { TEST_DATABASE_URL, sql } from "./client";

export function resetDatabase(): void {
  sql(`
    truncate flags, comments, report_documents, reports, location_suggestions,
             locations, profiles, policy_changes restart identity cascade;
    delete from auth.users where email like 'tg-test-%@users.invalid';
  `);
  execFileSync(
    "psql",
    [TEST_DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-f", "supabase/tests/01_load_fixture_seed.sql"],
    { encoding: "utf8" }
  );
}

/** Creates a minimal test user in both auth.users and profiles. Returns its id. */
export function createTestUser(telegramUserId: number): string {
  const id = randomUUID();
  sql(`
    insert into auth.users (id, email) values ('${id}', 'tg-test-${telegramUserId}@users.invalid')
      on conflict (id) do nothing;
    insert into profiles (id, telegram_user_id, role) values ('${id}', ${telegramUserId}, 'user')
      on conflict (id) do nothing;
  `);
  return id;
}

export function makeModerator(userId: string): void {
  sql(`update profiles set role = 'moderator' where id = '${userId}';`);
}
