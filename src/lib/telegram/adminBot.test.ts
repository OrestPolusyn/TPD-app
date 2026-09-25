import { describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tp.example");
const { cityHashtag, formatChangePost, formatReportPost, formatRulePost } = await import("./adminBot");

const LOCATION = { id: "comisaria-alicante", name: "Comisaría Policía Nacional — Alicante", city: "Alicante" };

describe("channel posts", () => {
  it("turns a report into a short post with its office, outcome, documents and link", () => {
    const post = formatReportPost({
      location: LOCATION,
      outcome: "protection_granted",
      event_date: "2026-09-23",
      comment: "Прийшли о 8:00, отримали за 30 хв.",
      requested: ["Довідка ДПСУ про перетин кордону"],
      missing: [],
    });
    expect(post).toContain("📍 Alicante — Comisaría Policía Nacional — Alicante");
    expect(post).toContain("✅ Захист надано");
    expect(post).toContain("Просили: Довідка ДПСУ про перетин кордону");
    expect(post).not.toContain("Не було");
    expect(post).toContain("https://tp.example/locations/comisaria-alicante");
    expect(post.trim().endsWith("#Alicante")).toBe(true);
  });

  it("clips a long comment so a post stays readable", () => {
    const post = formatReportPost({
      location: LOCATION,
      outcome: "turned_away",
      event_date: "2026-09-23",
      comment: "а".repeat(2000),
      requested: [],
      missing: ["Військово-обліковий документ (Резерв+)"],
    });
    expect(post.length).toBeLessThan(700);
    expect(post).toContain("…");
    expect(post).toContain("Не було: Військово-обліковий документ (Резерв+)");
  });

  it("announces an accepted change with the current-requirements link", () => {
    const post = formatChangePost(LOCATION, "З 25.09 Резерв+ більше не просять");
    expect(post).toContain("Alicante — оновлення");
    expect(post).toContain("З 25.09 Резерв+ більше не просять");
    expect(post).toContain("https://tp.example/locations/comisaria-alicante");
  });

  it("marks a rule change with ⚠️, its date and the #зміни tag", () => {
    const post = formatRulePost(LOCATION, "2026-09-25", "Запис лише через сайт");
    expect(post.startsWith("⚠️ Зміна правил · Alicante")).toBe(true);
    expect(post).toContain("25 вересня 2026 р.: Запис лише через сайт");
    expect(post).toContain("#зміни #Alicante");
  });

  it("makes hashtags out of multi-word city names", () => {
    expect(cityHashtag("Puerto de la Cruz")).toBe("#PuertodelaCruz");
    expect(cityHashtag("Castellón de la Plana")).toBe("#CastellóndelaPlana");
  });
});
