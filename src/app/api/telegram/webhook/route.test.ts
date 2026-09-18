import { describe, it, expect, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

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
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret");
    expect((await POST(update(START))).status).toBe(403);
  });

  it("rejects a wrong secret", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret");
    expect((await POST(update(START, "guess"))).status).toBe(403);
  });

  it("rejects everything when no secret is configured, rather than falling open", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    expect((await POST(update(START, ""))).status).toBe(403);
  });

  /**
   * Telegram retries any non-2xx update indefinitely, so malformed input and a
   * missing token must still answer 200 — silence, not a retry loop.
   */
  it("answers 200 to an unparseable body", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret");
    expect((await POST(update("not json", "s3cret"))).status).toBe(200);
  });

  it("answers 200 and sends nothing for a non-command message", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(update({ message: { chat: { id: 1 }, text: "привіт" } }, "s3cret"));
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers 200 without a token instead of retrying forever", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(update(START, "s3cret"))).status).toBe(200);
  });
});
