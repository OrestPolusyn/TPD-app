import { describe, expect, it } from "vitest";
import { channelGrowth } from "./channelStats";
import { percent, signed, trend } from "./stats";

const DAYS = ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];

describe("channel growth", () => {
  it("has no 7-day change until there is a reading that old, only the change since the first one", () => {
    const g = channelGrowth([{ day: "2026-09-30", members: 40 }], 46, DAYS);
    expect(g.members).toBe(46);
    expect(g.change7).toBeNull();
    expect(g.since).toBe("2026-09-30");
    expect(g.byDay.slice(-2)).toEqual([
      { date: "2026-09-30", count: 40 },
      { date: "2026-10-01", count: 46 },
    ]);
  });

  it("compares with the reading closest before 7 days ago and carries figures over quiet days", () => {
    const g = channelGrowth(
      [
        { day: "2026-09-23", members: 10 },
        { day: "2026-09-26", members: 20 },
      ],
      35,
      DAYS
    );
    expect(g.change7).toBe(25); // 35 now vs 10 on 23.09 (the cutoff is 24.09)
    expect(g.byDay[0]).toEqual({ date: "2026-09-24", count: 10 });
    expect(g.byDay[3]).toEqual({ date: "2026-09-27", count: 20 });
  });

  it("falls back to the last reading when Telegram cannot be asked", () => {
    expect(channelGrowth([{ day: "2026-09-30", members: 12 }], null, DAYS).members).toBe(12);
    expect(channelGrowth([], null, DAYS).members).toBeNull();
  });
});

describe("stat helpers", () => {
  it("formats signed changes and percentages", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(-2)).toBe("−2");
    expect(signed(null)).toBe("—");
    expect(trend(15, 10)).toBe(50);
    expect(trend(5, 0)).toBeNull();
    expect(percent(1, 3)).toBe(33);
  });
});
