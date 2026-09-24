import { describe, expect, it } from "vitest";
import { countByDay, lastDays, madridDate } from "./stats";

describe("stats day bucketing", () => {
  it("uses Spain's calendar day, not UTC's", () => {
    // 23:30 UTC on 23.09 is already 24.09 in Madrid (UTC+2 in September).
    expect(madridDate(new Date("2026-09-23T23:30:00Z"))).toBe("2026-09-24");
    expect(madridDate(new Date("2026-09-23T21:30:00Z"))).toBe("2026-09-23");
  });

  it("lists the last N days oldest first, ending today", () => {
    const days = lastDays(new Date("2026-09-24T10:00:00Z"), 3);
    expect(days).toEqual(["2026-09-22", "2026-09-23", "2026-09-24"]);
  });

  it("zero-fills quiet days and ignores anything outside the window", () => {
    const days = ["2026-09-22", "2026-09-23", "2026-09-24"];
    const counts = countByDay(
      ["2026-09-22T08:00:00Z", "2026-09-24T08:00:00Z", "2026-09-24T09:00:00Z", "2026-08-01T08:00:00Z"],
      days
    );
    expect(counts).toEqual([
      { date: "2026-09-22", count: 1 },
      { date: "2026-09-23", count: 0 },
      { date: "2026-09-24", count: 2 },
    ]);
  });
});
