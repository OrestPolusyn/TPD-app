import { describe, it, expect, beforeAll } from "vitest";
import { isDatabaseReachable, sql, sqlAs, sqlJson } from "./client";
import { resetDatabase, createTestUser } from "./setup";

const dbReachable = isDatabaseReachable();

interface LocationPageData {
  matches: { report_id: string; event_date: string; is_fresh: boolean }[];
  incomplete: { report_id: string }[];
  more_docs: { report_id: string; extra_docs: string[] }[];
  unsuccessful: { report_id: string }[];
  not_requested: { document_code: string; user_count: number; highlighted: boolean }[];
  walk_in_count: number;
  walk_in_highlighted: boolean;
  fresh_matching_count: number;
  latest_matching_date: string | null;
  fresh_unsuccessful_count: number;
  policy_change: { effective_date: string; title_uk: string } | null;
}

function submitReport(
  userId: string,
  locationId: string,
  daysAgo: number,
  outcome: string,
  documents: { document_code: string; status: string }[],
  extra: Partial<{
    requestedListComplete: boolean;
    appointmentType: string;
    peopleCount: number;
    timeAtOffice: string;
    militaryObligationsApply: string;
    comment: string;
  }> = {}
): void {
  const complete = extra.requestedListComplete ?? true;
  const docsJson = JSON.stringify(documents).replace(/'/g, "''");
  sqlAs(
    "authenticated",
    userId,
    `select submit_report(
      '${locationId}', 'temporary_protection_application', current_date - ${daysAgo}, '${outcome}',
      ${complete}, '${docsJson}'::jsonb,
      ${extra.appointmentType ? `'${extra.appointmentType}'` : "null"},
      null,
      ${extra.timeAtOffice ? `'${extra.timeAtOffice}'` : "null"},
      ${extra.peopleCount ?? "null"},
      ${extra.militaryObligationsApply ? `'${extra.militaryObligationsApply}'` : "null"},
      ${extra.comment ? `'${extra.comment.replace(/'/g, "''")}'` : "null"}
    );`
  );
}

function getPageData(locationId: string, userDocs: string[] = []): LocationPageData {
  const docsArray = `array[${userDocs.map((d) => `'${d}'`).join(",")}]::text[]`;
  return sqlJson<LocationPageData>(
    `select fn_location_page_data('${locationId}', 'temporary_protection_application', ${docsArray}, null);`
  );
}

describe.skipIf(!dbReachable)("matching function (fn_location_page_data)", () => {
  let u1: string, u2: string, u3: string, u4: string, u5: string, u6: string;

  beforeAll(() => {
    resetDatabase();
    u1 = createTestUser(101);
    u2 = createTestUser(102);
    u3 = createTestUser(103);
    u4 = createTestUser(104);
    u5 = createTestUser(105);
    u6 = createTestUser(106);
  });

  describe("base matching table, U = {international_passport, internal_passport_or_id_card}", () => {
    const U = ["international_passport", "internal_passport_or_id_card"];
    const LOCATION = "comisaria-vigo";

    beforeAll(() => {
      submitReport(u1, LOCATION, 10, "protection_granted", [{ document_code: "international_passport", status: "requested" }]);
      submitReport(u2, LOCATION, 5, "protection_granted", [
        { document_code: "international_passport", status: "requested" },
        { document_code: "spanish_address_or_empadronamiento", status: "requested" },
      ]);
      submitReport(u3, LOCATION, 5, "turned_away", [{ document_code: "international_passport", status: "requested" }]);
      submitReport(u4, LOCATION, 120, "protection_granted", [{ document_code: "international_passport", status: "requested" }]);
      submitReport(u5, LOCATION, 2, "protection_granted", [
        { document_code: "passport_photos", status: "requested" },
        { document_code: "spanish_address_or_empadronamiento", status: "not_requested" },
      ]);
      submitReport(
        u6,
        LOCATION,
        1,
        "protection_granted",
        [
          { document_code: "international_passport", status: "requested" },
          { document_code: "other", status: "requested" },
        ],
        { comment: "asked for an extra local permit" }
      );
    });

    it("R={international_passport}, protection_granted, 10 days ago -> fresh match", () => {
      const data = getPageData(LOCATION, U);
      const match = data.matches.find((m) => m.event_date === isoDaysAgo(10));
      expect(match).toBeDefined();
      expect(match?.is_fresh).toBe(true);
    });

    it("R={international_passport, empadronamiento} -> more_docs with empadronamiento listed", () => {
      const data = getPageData(LOCATION, U);
      const entry = data.more_docs.find((m) => m.extra_docs.includes("spanish_address_or_empadronamiento"));
      expect(entry).toBeDefined();
    });

    it("turned_away report -> unsuccessful, never a match", () => {
      const data = getPageData(LOCATION, U);
      expect(data.unsuccessful.length).toBeGreaterThan(0);
      expect(data.matches.some((m) => m.event_date === isoDaysAgo(5))).toBe(false);
    });

    it("120-day-old match is stale: in matches[] but is_fresh=false and excluded from fresh_matching_count", () => {
      const data = getPageData(LOCATION, U);
      const stale = data.matches.find((m) => m.event_date === isoDaysAgo(120));
      expect(stale?.is_fresh).toBe(false);
    });

    it("empty R (not_requested + passport_photos only) with requested_list_complete=true -> counted as a match", () => {
      const data = getPageData(LOCATION, U);
      expect(data.matches.some((m) => m.event_date === isoDaysAgo(2))).toBe(true);
    });

    it("R={international_passport, other} -> never a match (more_docs instead)", () => {
      const data = getPageData(LOCATION, U);
      expect(data.matches.some((m) => m.event_date === isoDaysAgo(1))).toBe(false);
      expect(data.more_docs.some((m) => m.extra_docs.includes("other"))).toBe(true);
    });

    it("fresh_matching_count only counts the two fresh matches (10d, 2d ago), not the 120d-old one", () => {
      const data = getPageData(LOCATION, U);
      expect(data.fresh_matching_count).toBe(2);
    });
  });

  describe("requested_list_complete = false", () => {
    const LOCATION = "comisaria-ourense";
    let reportUser: string;

    beforeAll(() => {
      reportUser = u1;
      submitReport(
        reportUser,
        LOCATION,
        3,
        "protection_granted",
        [
          { document_code: "passport_photos", status: "requested" },
          { document_code: "spanish_address_or_empadronamiento", status: "not_requested" },
        ],
        { requestedListComplete: false }
      );
    });

    it("is never a match, and its not_requested rows still feed the not_requested aggregate", () => {
      const data = getPageData(LOCATION, []);
      expect(data.matches.length).toBe(0);
      expect(data.incomplete.length).toBe(1);
      expect(data.not_requested.some((n) => n.document_code === "spanish_address_or_empadronamiento")).toBe(true);
    });
  });

  describe("Lugo walk-in fixture", () => {
    const LOCATION = "comisaria-lugo";
    const MILITARY_CODES = ["military_document_paper", "military_document_reserve_plus", "passport_exit_stamp"];
    const docs = [
      { document_code: "passport_photos", status: "requested" },
      { document_code: "military_document_paper", status: "not_requested" },
      { document_code: "military_document_reserve_plus", status: "not_requested" },
      { document_code: "passport_exit_stamp", status: "not_requested" },
    ];

    it("with both reports: walk-in badge highlighted, military not_requested lines highlighted (2 users)", () => {
      resetDatabase();
      const a = createTestUser(201);
      const b = createTestUser(202);
      submitReport(a, LOCATION, 3, "application_accepted_pending", docs, {
        appointmentType: "walk_in",
        peopleCount: 2,
        timeAtOffice: "under_1h",
        militaryObligationsApply: "yes",
      });
      submitReport(b, LOCATION, 2, "application_accepted_pending", docs, {
        appointmentType: "walk_in",
        peopleCount: 2,
        timeAtOffice: "under_1h",
        militaryObligationsApply: "yes",
      });

      const data = getPageData(LOCATION, []);
      expect(data.walk_in_count).toBe(2);
      expect(data.walk_in_highlighted).toBe(true);
      for (const code of MILITARY_CODES) {
        const line = data.not_requested.find((n) => n.document_code === code);
        expect(line?.user_count).toBe(2);
        expect(line?.highlighted).toBe(true);
      }
    });

    it("with only one report: plain text (1 user, not highlighted)", () => {
      resetDatabase();
      const a = createTestUser(201);
      submitReport(a, LOCATION, 3, "application_accepted_pending", docs, {
        appointmentType: "walk_in",
        peopleCount: 2,
        timeAtOffice: "under_1h",
        militaryObligationsApply: "yes",
      });

      const data = getPageData(LOCATION, []);
      expect(data.walk_in_count).toBe(1);
      expect(data.walk_in_highlighted).toBe(false);
      for (const code of MILITARY_CODES) {
        const line = data.not_requested.find((n) => n.document_code === code);
        expect(line?.user_count).toBe(1);
        expect(line?.highlighted).toBe(false);
      }
    });

    it("with military_obligations_apply=no on both: no not_requested line for military codes, walk-in badge still appears", () => {
      resetDatabase();
      const a = createTestUser(201);
      const b = createTestUser(202);
      submitReport(a, LOCATION, 3, "application_accepted_pending", docs, {
        appointmentType: "walk_in",
        peopleCount: 2,
        timeAtOffice: "under_1h",
        militaryObligationsApply: "no",
      });
      submitReport(b, LOCATION, 2, "application_accepted_pending", docs, {
        appointmentType: "walk_in",
        peopleCount: 2,
        timeAtOffice: "under_1h",
        militaryObligationsApply: "no",
      });

      const data = getPageData(LOCATION, []);
      expect(data.walk_in_count).toBe(2);
      for (const code of MILITARY_CODES) {
        expect(data.not_requested.some((n) => n.document_code === code)).toBe(false);
      }
    });
  });

  describe("policy change", () => {
    const LOCATION = "comisaria-cadiz";

    it("a report before the latest policy change is excluded from default counts; one after stays counted", () => {
      resetDatabase();
      const a = createTestUser(301);
      const b = createTestUser(302);
      submitReport(a, LOCATION, 10, "protection_granted", [{ document_code: "international_passport", status: "requested" }]);
      submitReport(b, LOCATION, 2, "protection_granted", [{ document_code: "international_passport", status: "requested" }]);

      // policy_changes has no INSERT policy for any client role (moderator-only,
      // via the Supabase dashboard/service role) — inserted here as the DB admin.
      sql(
        `insert into policy_changes (procedure_code, effective_date, title_uk, source_url)
         values ('temporary_protection_application', current_date - 5, 'Test policy change', 'https://example.org');`
      );

      const data = getPageData(LOCATION, ["international_passport"]);
      const old = data.matches.find((m) => m.event_date === isoDaysAgo(10));
      const recent = data.matches.find((m) => m.event_date === isoDaysAgo(2));
      expect(old?.is_fresh).toBe(false);
      expect(recent?.is_fresh).toBe(true);
      expect(data.fresh_matching_count).toBe(1);
      expect(data.policy_change?.title_uk).toBe("Test policy change");
    });
  });
});

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
