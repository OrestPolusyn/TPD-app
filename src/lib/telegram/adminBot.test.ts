import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { cityHashtagUk, cityUk, KNOWN_CITIES } from "@/lib/cityNames";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tp.example");
const { formatChangePost, formatReportPost, formatRulePost, formatStoryPost, splitSourceLabel } = await import("./adminBot");

const LOCATION = { id: "comisaria-alicante", name: "Comisaría Policía Nacional — Alicante", city: "Alicante" };
const MADRID = [
  { id: "comisaria-pozuelo-de-alarcon", name: "Comisaría Policía Nacional — Pozuelo de Alarcón", city: "Pozuelo de Alarcón" },
  { id: "creade-pozuelo", name: "CREADE Pozuelo", city: "Pozuelo de Alarcón" },
];

describe("channel posts", () => {
  it("heads a report with the city in Ukrainian, bold, over the office", () => {
    const post = formatReportPost({
      location: LOCATION,
      outcome: "protection_granted",
      event_date: "2026-09-23",
      comment: "Прийшли о 8:00, отримали за 30 хв.",
      requested: ["Довідка ДПСУ про перетин кордону"],
      missing: [],
    });
    expect(post.startsWith("📍 <b>Аліканте</b>\n<i>Comisaría Policía Nacional — Alicante</i>")).toBe(true);
    expect(post).toContain("✅ <b>Захист надано</b>");
    expect(post).toContain("Просили: Довідка ДПСУ про перетин кордону");
    expect(post).not.toContain("Не було");
    expect(post).toContain("https://tp.example/locations/comisaria-alicante");
    expect(post.trim().endsWith("#Аліканте")).toBe(true);
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
    expect(post.length).toBeLessThan(800);
    expect(post).toContain("…");
    expect(post).toContain("Не було: Військово-обліковий документ (Резерв+)");
  });

  it("turns the chat-source prefix into a label above the quote", () => {
    const post = formatReportPost({
      location: LOCATION,
      outcome: "protection_granted",
      event_date: "2026-09-24",
      comment: "З чату спільноти: написали лист, відповідь за 2 дні.",
      requested: [],
      missing: [],
    });
    expect(post).toContain("💬 <i>З чату спільноти</i>\n«написали лист, відповідь за 2 дні.»");
    expect(splitSourceLabel("Звичайний коментар: без мітки").label).toBeNull();
  });

  it("escapes what people wrote, so it cannot break the HTML", () => {
    const post = formatChangePost([LOCATION], "Черга <30 хв> & без запису");
    expect(post).toContain("Черга &lt;30 хв&gt; &amp; без запису");
  });

  it("names Madrid, not Pozuelo, and lists every office a change covers", () => {
    const post = formatChangePost(MADRID, "З 25.09 лише штамп");
    expect(post.startsWith("📍 <b>Мадрид (Посуело-де-Аларкон)</b> · оновлення")).toBe(true);
    expect(post).toContain("<i>CREADE Pozuelo</i>");
    expect(post).toContain("https://tp.example/locations/comisaria-pozuelo-de-alarcon");
    expect(post.trim().endsWith("#Мадрид")).toBe(true);
  });

  it("marks a rule change with ⚠️, its date and the #зміни tag", () => {
    const post = formatRulePost([LOCATION], "2026-09-25", "Запис лише через сайт");
    expect(post.startsWith("⚠️ <b>Зміна правил · Аліканте</b>")).toBe(true);
    expect(post).toContain("<b>25 вересня 2026 р.:</b> Запис лише через сайт");
    expect(post).toContain("#зміни #Аліканте");
  });

  it("publishes a story anonymously, with an invitation to share one", () => {
    const post = formatStoryPost(LOCATION, "Подались за день <b>без</b> запису");
    expect(post).toContain("💬 <b>Історія підписника</b>");
    expect(post).toContain("&lt;b&gt;без&lt;/b&gt;");
    expect(post).toContain("💬 Моя історія");
    expect(post).toContain("#історії #Аліканте");
    expect(formatStoryPost(null, "текст").startsWith("💬")).toBe(true);
  });
});

describe("city names", () => {
  it("makes hashtags out of the Ukrainian name, without the bracketed hint", () => {
    expect(cityHashtagUk("Pozuelo de Alarcón")).toBe("#Мадрид");
    expect(cityHashtagUk("Castellón de la Plana")).toMatch(/^#[\p{L}\p{N}]+$/u);
  });

  it("has a Ukrainian name for every city in the seed data", () => {
    const csv = readFileSync("seed/locations.csv", "utf8").split(/\r?\n/);
    const header = csv[0].split(",");
    const cityIndex = header.indexOf("city");
    expect(cityIndex).toBeGreaterThanOrEqual(0);
    const missing = new Set<string>();
    for (const line of csv.slice(1)) {
      if (!line.trim()) continue;
      const city = parseCsvLine(line)[cityIndex];
      if (city && !KNOWN_CITIES.includes(city)) missing.add(city);
    }
    expect([...missing]).toEqual([]);
    expect(cityUk("Somewhere New")).toBe("Somewhere New");
  });
});

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}
