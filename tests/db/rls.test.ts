import { describe, it, expect, beforeAll } from "vitest";
import { isDatabaseReachable, sql, sqlAs, sqlJson } from "./client";
import { resetDatabase, createTestUser, makeModerator } from "./setup";

const dbReachable = isDatabaseReachable();
const LOCATION = "comisaria-vigo";
const PROCEDURE = "temporary_protection_application";

function insertBaseReport(userId: string, docs = '[{"document_code":"international_passport","status":"requested"}]') {
  return sqlAs(
    "authenticated",
    userId,
    `select submit_report('${LOCATION}', '${PROCEDURE}', current_date - 1, 'protection_granted', true, '${docs}'::jsonb);`
  ).trim();
}

describe.skipIf(!dbReachable)("RLS", () => {
  let userA: string, userB: string, moderator: string;

  beforeAll(() => {
    resetDatabase();
    userA = createTestUser(401);
    userB = createTestUser(402);
    moderator = createTestUser(403);
    makeModerator(moderator);
  });

  it("rejects an anonymous insert into reports", () => {
    expect(() =>
      sqlAs(
        "anon",
        null,
        `insert into reports (location_id, procedure_code, user_id, event_date, outcome, requested_list_complete)
         values ('${LOCATION}', '${PROCEDURE}', '${userA}', current_date, 'protection_granted', true);`
      )
    ).toThrow();
  });

  it("rejects an anonymous insert into comments, flags, location_suggestions, locations", () => {
    expect(() => sqlAs("anon", null, `insert into comments (report_id, user_id, body) values (gen_random_uuid(), '${userA}', 'x');`)).toThrow();
    expect(() =>
      sqlAs("anon", null, `insert into flags (target_type, target_id, user_id) values ('report', gen_random_uuid(), '${userA}');`)
    ).toThrow();
    expect(() =>
      sqlAs(
        "anon",
        null,
        `insert into location_suggestions (location_id, field, proposed_value, user_id) values ('${LOCATION}', 'address', 'x', '${userA}');`
      )
    ).toThrow();
    expect(() =>
      sqlAs(
        "anon",
        null,
        `insert into locations (id, name, type, region, province, city, appointment_method, source_url, verification_status, moderation_status)
         values ('anon-test', 'x', 'police_station', 'r', 'p', 'c', 'phone', 'https://x', 'user_submitted', 'pending');`
      )
    ).toThrow();
  });

  it("a report whose user_id differs from auth.uid() is rejected", () => {
    expect(() =>
      sqlAs(
        "authenticated",
        userA,
        `insert into reports (location_id, procedure_code, user_id, event_date, outcome, requested_list_complete)
         values ('${LOCATION}', '${PROCEDURE}', '${userB}', current_date - 1, 'protection_granted', true);`
      )
    ).toThrow();
  });

  it("user A cannot update or delete user B's report; a moderator can change moderation_status", () => {
    const reportId = insertBaseReport(userA);

    sqlAs("authenticated", userB, `update reports set moderation_status = 'hidden' where id = '${reportId}';`);
    let status = sqlJson<string>(`select to_jsonb(moderation_status) from reports where id = '${reportId}';`);
    expect(status).toBe("published");

    // No DELETE grant exists for `authenticated` at all (see 0006_rls.sql) —
    // blocked at the privilege level, which is strictly stronger than an RLS no-op.
    expect(() => sqlAs("authenticated", userB, `delete from reports where id = '${reportId}';`)).toThrow();
    const stillThereCount = sql(`select count(*) from reports where id = '${reportId}';`).trim();
    expect(stillThereCount).toBe("1");

    sqlAs("authenticated", moderator, `update reports set moderation_status = 'hidden' where id = '${reportId}';`);
    status = sqlJson<string>(`select to_jsonb(moderation_status) from reports where id = '${reportId}';`);
    expect(status).toBe("hidden");
  });

  it("a moderator cannot insert a report for another user", () => {
    expect(() =>
      sqlAs(
        "authenticated",
        moderator,
        `insert into reports (location_id, procedure_code, user_id, event_date, outcome, requested_list_complete)
         values ('${LOCATION}', '${PROCEDURE}', '${userA}', current_date - 2, 'protection_granted', true);`
      )
    ).toThrow();
  });

  it("rejects a second report for the same user/location/procedure/event_date, accepts a different date", () => {
    resetDatabase();
    const u = createTestUser(404);
    sqlAs(
      "authenticated",
      u,
      `select submit_report('${LOCATION}', '${PROCEDURE}', current_date - 3, 'protection_granted', true, '[{"document_code":"international_passport","status":"requested"}]'::jsonb);`
    );
    expect(() =>
      sqlAs(
        "authenticated",
        u,
        `select submit_report('${LOCATION}', '${PROCEDURE}', current_date - 3, 'turned_away', true, '[{"document_code":"international_passport","status":"requested"}]'::jsonb);`
      )
    ).toThrow();

    sqlAs(
      "authenticated",
      u,
      `select submit_report('${LOCATION}', '${PROCEDURE}', current_date - 4, 'turned_away', true, '[{"document_code":"international_passport","status":"requested"}]'::jsonb);`
    );
    const [{ count }] = sqlJson<{ count: number }[]>(`select json_agg(row) from (select count(*) as count from reports where user_id = '${u}') row;`);
    expect(count).toBe(2);
  });

  it("rejects a 6th report by the same user on the same day", () => {
    resetDatabase();
    const u = createTestUser(405);
    const locations = ["comisaria-vigo", "comisaria-lugo", "comisaria-ourense", "comisaria-cadiz", "comisaria-cordoba", "comisaria-huelva"];
    for (let i = 0; i < 5; i++) {
      sqlAs(
        "authenticated",
        u,
        `select submit_report('${locations[i]}', '${PROCEDURE}', current_date - ${i + 1}, 'turned_away', true, '[{"document_code":"international_passport","status":"requested"}]'::jsonb);`
      );
    }
    expect(() =>
      sqlAs(
        "authenticated",
        u,
        `select submit_report('${locations[5]}', '${PROCEDURE}', current_date - 6, 'turned_away', true, '[{"document_code":"international_passport","status":"requested"}]'::jsonb);`
      )
    ).toThrow();
  });

  it("rejects a report missing event_date/outcome/documents; rejects a future event_date", () => {
    resetDatabase();
    const u = createTestUser(406);
    expect(() =>
      sqlAs("authenticated", u, `select submit_report('${LOCATION}', '${PROCEDURE}', null, 'protection_granted', true, '[]'::jsonb);`)
    ).toThrow();
    expect(() =>
      sqlAs(
        "authenticated",
        u,
        `select submit_report('${LOCATION}', '${PROCEDURE}', current_date - 1, 'protection_granted', true, '[]'::jsonb);`
      )
    ).toThrow();
    expect(() =>
      sqlAs(
        "authenticated",
        u,
        `select submit_report('${LOCATION}', '${PROCEDURE}', current_date + 1, 'protection_granted', true, '[{"document_code":"international_passport","status":"requested"}]'::jsonb);`
      )
    ).toThrow();
  });

  it("a report flagged by 3 distinct users becomes flagged: collapsed, excluded from counts, never hidden", () => {
    resetDatabase();
    const author = createTestUser(407);
    const flaggers = [createTestUser(408), createTestUser(409), createTestUser(410)];
    const reportId = insertBaseReport(author);

    for (const f of flaggers) {
      sqlAs("authenticated", f, `insert into flags (target_type, target_id, user_id) values ('report', '${reportId}', '${f}');`);
    }
    const status = sqlJson<string>(`select to_jsonb(moderation_status) from reports where id = '${reportId}';`);
    expect(status).toBe("flagged");

    const data = sqlJson<{ matches: unknown[]; flagged_count: number }>(
      `select fn_location_page_data('${LOCATION}', '${PROCEDURE}', array['international_passport']::text[], null);`
    );
    expect(data.matches.length).toBe(0);
    expect(data.flagged_count).toBe(1);
  });

  it("the same user cannot flag the same item twice", () => {
    resetDatabase();
    const author = createTestUser(411);
    const flagger = createTestUser(412);
    const reportId = insertBaseReport(author);
    sqlAs("authenticated", flagger, `insert into flags (target_type, target_id, user_id) values ('report', '${reportId}', '${flagger}');`);
    expect(() =>
      sqlAs("authenticated", flagger, `insert into flags (target_type, target_id, user_id) values ('report', '${reportId}', '${flagger}');`)
    ).toThrow();
  });

  it("a location suggestion stores current_value equal to the location's value at submit time, and stays private while pending", () => {
    resetDatabase();
    const u = createTestUser(413);
    const currentAddress = sqlJson<string | null>(`select to_jsonb(address) from locations where id = '${LOCATION}';`);
    sqlAs(
      "authenticated",
      u,
      `insert into location_suggestions (location_id, field, proposed_value, user_id) values ('${LOCATION}', 'address', 'New Address 1', '${u}');`
    );
    const stored = sqlJson<{ current_value: string | null; proposed_value: string }>(
      `select json_build_object('current_value', current_value, 'proposed_value', proposed_value) from location_suggestions where location_id = '${LOCATION}' and user_id = '${u}';`
    );
    expect(stored.current_value).toBe(currentAddress);
    expect(stored.proposed_value).toBe("New Address 1");

    const visibleToOther = sqlAs("authenticated", userA, `select json_agg(1) from location_suggestions where user_id = '${u}';`).trim();
    expect(visibleToOther).toBe("");
  });

  it("a user-submitted location is pending and not publicly listed, but visible to its creator", () => {
    resetDatabase();
    const u = createTestUser(414);
    sqlAs(
      "authenticated",
      u,
      `select submit_new_location('user-loc-test', 'Test Loc', 'police_station', 'Region', 'Province', 'City', 'phone');`
    );
    const anonCount = sqlAs("anon", null, `select count(*) from locations where id = 'user-loc-test';`).trim();
    expect(anonCount).toBe("0");
    const ownerCount = sqlAs("authenticated", u, `select count(*) from locations where id = 'user-loc-test';`).trim();
    expect(ownerCount).toBe("1");
    const status = sql(`select moderation_status from locations where id = 'user-loc-test';`).trim();
    expect(status).toBe("pending");
  });
});
