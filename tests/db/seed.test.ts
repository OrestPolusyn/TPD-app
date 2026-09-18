import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { isDatabaseReachable, sqlJson } from "./client";
import { resetDatabase } from "./setup";

const dbReachable = isDatabaseReachable();

describe.skipIf(!dbReachable)("seed import (supabase/tests/01_load_fixture_seed.sql)", () => {
  beforeAll(() => {
    resetDatabase();
  });

  const csvRows = parse(readFileSync("seed/locations.csv", "utf8"), { columns: true, skip_empty_lines: true }) as {
    id: string;
    verification_status: string;
  }[];

  it("imports exactly one DB row per CSV id", () => {
    const dbIds = sqlJson<string[]>(`select json_agg(id) from locations;`);
    expect(new Set(dbIds).size).toBe(dbIds.length);
    expect(dbIds.sort()).toEqual(csvRows.map((r) => r.id).sort());
  });

  it("imports every non-conflict row as published and conflict rows as pending", () => {
    const rows = sqlJson<{ id: string; moderation_status: string }[]>(
      `select json_agg(json_build_object('id', id, 'moderation_status', moderation_status)) from locations;`
    );
    const byId = new Map(rows.map((r) => [r.id, r.moderation_status]));
    for (const csvRow of csvRows) {
      const expected = csvRow.verification_status === "conflict" ? "pending" : "published";
      expect(byId.get(csvRow.id), `location ${csvRow.id}`).toBe(expected);
    }
  });

  it("matches the current fixture expectation: 70 rows, 69 published, 1 pending", () => {
    const counts = sqlJson<{ total: number; published: number; pending: number }>(
      `select json_build_object(
        'total', count(*),
        'published', count(*) filter (where moderation_status = 'published'),
        'pending', count(*) filter (where moderation_status = 'pending')
      ) from locations;`
    );
    expect(counts).toEqual({ total: 70, published: 69, pending: 1 });
  });

  it("links every seeded location to temporary_protection_application", () => {
    const [{ count }] = sqlJson<{ count: number }[]>(
      `select json_agg(row) from (
        select count(*) as count from locations l
        where not exists (
          select 1 from location_procedures lp
          where lp.location_id = l.id and lp.procedure_code = 'temporary_protection_application'
        )
      ) row;`
    );
    expect(count).toBe(0);
  });

  it("leaves policy_changes empty after seeding", () => {
    const [{ count }] = sqlJson<{ count: number }[]>(`select json_agg(row) from (select count(*) as count from policy_changes) row;`);
    expect(count).toBe(0);
  });

  it("has at least one published location in all 52 provinces", () => {
    const [{ count }] = sqlJson<{ count: number }[]>(
      `select json_agg(row) from (select count(distinct province) as count from locations where moderation_status = 'published') row;`
    );
    expect(count).toBe(52);
  });

  it("hides exactly one email (Teruel, domain polcia.es) and no others", () => {
    const hidden = sqlJson<{ id: string; email: string }[]>(
      `select json_agg(json_build_object('id', id, 'email', email)) from locations where email_hidden = true;`
    );
    expect(hidden).toEqual([{ id: "comisaria-teruel", email: "teruel.bped@polcia.es" }]);
  });
});
