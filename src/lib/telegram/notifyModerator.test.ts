import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { notifyNewReport, notifyNewSuggestion, notifyNewLocation } from "./notifyModerator";

const TOKEN = "123:test-token";
const CHAT = "555";

function sent(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((call) => {
    const [url, init] = call as [unknown, RequestInit | undefined];
    return {
      method: String(url).split("/").pop() ?? "",
      params: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    };
  });
}

function okFetch() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })
  );
}

const REPORT = {
  locationId: "creade-madrid",
  locationName: "CREADE Pozuelo",
  outcome: "Захист надано",
  eventDate: "18 вересня 2026 р.",
  author: "Olena",
};

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
  vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", CHAT);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tp.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("moderator notifications", () => {
  it("sends a report to the configured chat, with a link to the location", async () => {
    const spy = okFetch();
    await notifyNewReport(REPORT);

    const [call] = sent(spy);
    expect(call.method).toBe("sendMessage");
    expect(call.params.chat_id).toBe(CHAT);
    expect(call.params.text).toContain("CREADE Pozuelo");
    expect(call.params.text).toContain("Захист надано");
    expect(call.params.text).toContain("https://tp.example/locations/creade-madrid");
    // No placeholder should survive into a message a person reads.
    expect(call.params.text).not.toMatch(/\{\w+\}/);
  });

  it("sends a suggestion as before → after", async () => {
    const spy = okFetch();
    await notifyNewSuggestion({
      locationId: "creade-madrid",
      locationName: "CREADE Pozuelo",
      field: "Адреса",
      currentValue: "Стара вулиця, 1",
      proposedValue: "Нова вулиця, 2",
      author: "Olena",
    });

    const text = sent(spy)[0].params.text as string;
    expect(text).toContain("Стара вулиця, 1");
    expect(text).toContain("Нова вулиця, 2");
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it("writes an em dash when the field was empty, not the word null", async () => {
    const spy = okFetch();
    await notifyNewSuggestion({
      locationId: "x",
      locationName: "X",
      field: "Телефон",
      currentValue: null,
      proposedValue: "+34 600 000 000",
      author: "",
    });

    const text = sent(spy)[0].params.text as string;
    expect(text).toContain("—");
    expect(text).not.toContain("null");
  });

  /** A pending location has no page yet, so a link would only 404. */
  it("sends a new location by id, with no link", async () => {
    const spy = okFetch();
    await notifyNewLocation({ locationId: "suggestion-abc", description: "Новий офіс у Валенсії", author: "Olena" });

    const text = sent(spy)[0].params.text as string;
    expect(text).toContain("suggestion-abc");
    expect(text).toContain("Новий офіс у Валенсії");
    expect(text).not.toContain("https://tp.example/locations/");
  });

  it("stays silent when no moderator chat is configured", async () => {
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "");
    const spy = okFetch();
    await notifyNewReport(REPORT);
    expect(spy).not.toHaveBeenCalled();
  });

  /**
   * The submission is already saved by the time these run. A bot that is down
   * must not turn it into an error on the person's screen.
   */
  it("swallows a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyNewReport(REPORT)).resolves.toBeUndefined();
  });

  it("swallows a rejection from Telegram", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "chat not found" }), {
        headers: { "Content-Type": "application/json" },
      })
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyNewReport(REPORT)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});
