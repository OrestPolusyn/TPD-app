import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";

const findPendingLoginRequest = vi.fn();
const approveLoginRequest = vi.fn();

vi.mock("@/lib/telegram/loginRequests", () => ({
  findPendingLoginRequest: (...args: unknown[]) => findPendingLoginRequest(...args),
  approveLoginRequest: (...args: unknown[]) => approveLoginRequest(...args),
}));

const { POST } = await import("./route");

const TOKEN = "123:test-token";
const SECRET = deriveWebhookSecret(TOKEN);

function update(body: unknown, secret?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers["x-telegram-bot-api-secret-token"] = secret;
  return new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const START = { message: { chat: { id: 1 }, text: "/start" } };

describe("POST /api/telegram/webhook", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects a call with no secret header", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    expect((await POST(update(START))).status).toBe(403);
  });

  it("rejects a wrong secret", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    expect((await POST(update(START, "guess"))).status).toBe(403);
  });

  it("rejects an empty secret header rather than falling open", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    expect((await POST(update(START, ""))).status).toBe(403);
  });

  it("accepts exactly the secret derived from the bot token", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })
    );
    expect((await POST(update(START, SECRET))).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("derives a different secret for a different token, so one bot's secret cannot drive another", () => {
    expect(deriveWebhookSecret("123:a")).not.toBe(deriveWebhookSecret("123:b"));
    expect(deriveWebhookSecret(TOKEN)).toBe(deriveWebhookSecret(TOKEN));
  });

  /**
   * Telegram retries any non-2xx update indefinitely, so malformed input and a
   * missing token must still answer 200 — silence, not a retry loop.
   */
  it("answers 200 to an unparseable body", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    expect((await POST(update("not json", SECRET))).status).toBe(200);
  });

  it("answers 200 and sends nothing for a non-command message", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(update({ message: { chat: { id: 1 }, text: "привіт" } }, SECRET));
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers 200 without a token instead of retrying forever", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(update(START, SECRET))).status).toBe(200);
  });
});

/**
 * The chat's only role in signing in is to approve a request the browser
 * already made. Nothing here may hand out a session or a link that creates
 * one — that is what put the session in Telegram's in-app browser before.
 */
describe("sign-in confirmation", () => {
  let calls: { method: string; params: Record<string, unknown> }[];

  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    calls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push({
        method: String(url).split("/").pop() ?? "",
        params: JSON.parse(String(init?.body ?? "{}")),
      });
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("answers a login deep link with the pairing code and a confirm button", async () => {
    findPendingLoginRequest.mockResolvedValue({ code: "4242" });

    const res = await POST(update({ message: { chat: { id: 7 }, from: { id: 99 }, text: "/start login_req-abc" } }, SECRET));
    expect(res.status).toBe(200);
    expect(findPendingLoginRequest).toHaveBeenCalledWith("req-abc");

    const sent = calls.find((c) => c.method === "sendMessage");
    expect(sent?.params.text).toContain("4242");
    const keyboard = sent?.params.reply_markup as { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] };
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe("login:req-abc");
    // A url button here would reopen the old bug: tapped in Telegram it signs
    // in Telegram's own browser, not the one the person started from.
    expect(keyboard.inline_keyboard[0][0].url).toBeUndefined();
  });

  it("does not offer a confirm button for a request that is gone", async () => {
    findPendingLoginRequest.mockResolvedValue(null);

    await POST(update({ message: { chat: { id: 7 }, from: { id: 99 }, text: "/start login_stale" } }, SECRET));

    const sent = calls.find((c) => c.method === "sendMessage");
    expect(sent?.params.reply_markup).toBeUndefined();
  });

  it("approves on the confirm button, with the identity Telegram signed", async () => {
    approveLoginRequest.mockResolvedValue(true);

    const res = await POST(
      update(
        {
          callback_query: {
            id: "cb-1",
            from: { id: 99, first_name: "Олена", username: "olena" },
            data: "login:req-abc",
            message: { chat: { id: 7 }, message_id: 5 },
          },
        },
        SECRET
      )
    );
    expect(res.status).toBe(200);
    expect(approveLoginRequest).toHaveBeenCalledWith("req-abc", {
      id: 99,
      first_name: "Олена",
      username: "olena",
    });

    expect(calls.map((c) => c.method)).toContain("answerCallbackQuery");
    // Rewriting the message drops the button, so it cannot be tapped twice.
    expect(calls.find((c) => c.method === "editMessageText")?.params.message_id).toBe(5);
  });

  /**
   * The failure this repairs is silent and total: a webhook registered before
   * the confirm button existed gets `message` only, Telegram drops every
   * button press, and pressing confirm does nothing at all. It happened in
   * production, so the repair cannot be a manual step someone must remember.
   */
  it("re-subscribes the webhook to callback_query before offering the button", async () => {
    vi.resetModules();
    const { POST: freshPost } = await import("./route");
    findPendingLoginRequest.mockResolvedValue({ code: "4242" });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const method = String(url).split("/").pop() ?? "";
      const params = JSON.parse(String(init?.body ?? "{}"));
      calls.push({ method, params });
      const result =
        method === "getWebhookInfo"
          ? { url: "https://example.test/api/telegram/webhook", allowed_updates: ["message"], pending_update_count: 0 }
          : true;
      return new Response(JSON.stringify({ ok: true, result }), {
        headers: { "Content-Type": "application/json" },
      });
    });

    await freshPost(update({ message: { chat: { id: 7 }, from: { id: 99 }, text: "/start login_req-abc" } }, SECRET));

    const setWebhook = calls.find((c) => c.method === "setWebhook");
    expect(setWebhook?.params.allowed_updates).toContain("callback_query");
    // Repaired in place: re-pointing the webhook elsewhere would break it.
    expect(setWebhook?.params.url).toBe("https://example.test/api/telegram/webhook");
    // And the button is only sent afterwards, so the first tap already works.
    expect(calls.findIndex((c) => c.method === "setWebhook")).toBeLessThan(
      calls.findIndex((c) => c.method === "sendMessage")
    );
  });

  /** How whoever runs the deployment finds the value for TELEGRAM_ADMIN_CHAT_ID. */
  it("answers /id with this chat's id", async () => {
    await POST(update({ message: { chat: { id: 745616671 }, from: { id: 745616671 }, text: "/id" } }, SECRET));

    const sent = calls.find((c) => c.method === "sendMessage");
    expect(sent?.params.chat_id).toBe(745616671);
    expect(sent?.params.text).toContain("745616671");
  });

  it("approves nothing for callback data that is not a login", async () => {
    await POST(
      update({ callback_query: { id: "cb-2", from: { id: 99 }, data: "something-else" } }, SECRET)
    );

    expect(approveLoginRequest).not.toHaveBeenCalled();
    expect(calls.map((c) => c.method)).toEqual(["answerCallbackQuery"]);
  });
});
