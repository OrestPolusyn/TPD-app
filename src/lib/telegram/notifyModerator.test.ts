import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

/** The app_settings fallback, stubbed: these tests are about the messages. */
const settingsRow = vi.fn<() => Promise<{ data: { value: string } | null; error: null }>>();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: settingsRow }),
      }),
    }),
  }),
}));

const { notifyNewReport, notifyNewSuggestion, notifyNewLocation, notifyBriefChanged, getModeratorChatId } = await import(
  "./notifyModerator"
);

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
  settingsRow.mockResolvedValue({ data: null, error: null });
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

  it("relays what changed about a community brief, with a link to the office", async () => {
    const spy = okFetch();
    await notifyBriefChanged({
      locationId: "comisaria-malaga",
      locationName: "Comisaría de Málaga",
      detail: "З 25.09 Резерв+ більше не просять",
      author: "Olena",
    });

    const [call] = sent(spy);
    expect(call.params.chat_id).toBe(CHAT);
    expect(call.params.text).toContain("Comisaría de Málaga");
    expect(call.params.text).toContain("З 25.09 Резерв+ більше не просять");
    expect(call.params.text).toContain("Olena");
    expect(call.params.text).toContain("https://tp.example/locations/comisaria-malaga");
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

  it("stays silent when neither the env var nor app_settings names a chat", async () => {
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "");
    const spy = okFetch();
    await notifyNewReport(REPORT);
    expect(spy).not.toHaveBeenCalled();
  });

  /**
   * Configuring this by env var means: open the hosting dashboard, add a
   * variable, redeploy — and skipping any of it fails silently. The row is
   * the path that needs none of that.
   */
  it("falls back to app_settings when the env var is unset", async () => {
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "");
    settingsRow.mockResolvedValue({ data: { value: "999" }, error: null });
    const spy = okFetch();

    await notifyNewReport(REPORT);
    expect(sent(spy)[0].params.chat_id).toBe("999");
  });

  it("prefers the env var, so a deployment can still configure it directly", async () => {
    settingsRow.mockResolvedValue({ data: { value: "999" }, error: null });
    expect(await getModeratorChatId()).toBe(CHAT);
  });

  it("stays silent when the settings lookup fails, rather than throwing", async () => {
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "");
    settingsRow.mockRejectedValue(new Error("no database"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = okFetch();

    await expect(notifyNewReport(REPORT)).resolves.toBeUndefined();
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
