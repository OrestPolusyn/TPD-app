import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Supabase client is mocked, so these assert the queries this module
 * builds rather than the database's behaviour. That is the point: single-use,
 * expiry and "approved by the chat, redeemed by the browser" are all enforced
 * by the filters on one UPDATE, and dropping any of them silently turns a
 * login request into a permanent password.
 */
const insert = vi.fn();
const update = vi.fn();
const select = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "telegram_login_requests") throw new Error(`unexpected table ${table}`);
      return { insert, update, select };
    },
    rpc,
  }),
}));

const {
  createLoginRequest,
  findPendingLoginRequest,
  findPendingRequestByNonce,
  approveLoginRequest,
  consumeApprovedLoginRequest,
  LOGIN_REQUEST_TTL_MINUTES,
} = await import("./loginRequests");

interface Chain {
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function chainReturning(row: unknown): Chain {
  const chain: Chain = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
});

describe("createLoginRequest", () => {
  it("stores only a hash of the nonce, never the nonce the browser keeps", async () => {
    const created = await createLoginRequest();
    expect(created).not.toBeNull();
    const row = insert.mock.calls[0][0];
    expect(row.nonce_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.nonce_hash).not.toBe(created!.nonce);
    expect(JSON.stringify(row)).not.toContain(created!.nonce);
  });

  it("keeps the deep-link id within Telegram's start-parameter charset", async () => {
    const created = await createLoginRequest();
    // https://core.telegram.org/bots/features#deep-linking — A-Z a-z 0-9 _ -,
    // 64 chars, and the webhook prefixes it with "login_".
    expect(`login_${created!.requestId}`).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("mints an unguessable nonce, different every time", async () => {
    const a = await createLoginRequest();
    const b = await createLoginRequest();
    expect(a!.nonce).not.toBe(b!.nonce);
    expect(a!.requestId).not.toBe(b!.requestId);
    expect(a!.nonce.length).toBeGreaterThanOrEqual(43);
  });

  it("shows a four-digit pairing code, stored to be quoted back by the bot", async () => {
    const created = await createLoginRequest();
    expect(created!.code).toMatch(/^\d{4}$/);
    expect(insert.mock.calls[0][0].code).toBe(created!.code);
  });

  it("sets an expiry in the future, not far in it", async () => {
    await createLoginRequest();
    const minutes = (new Date(insert.mock.calls[0][0].expires_at).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(LOGIN_REQUEST_TTL_MINUTES - 1);
    expect(minutes).toBeLessThanOrEqual(LOGIN_REQUEST_TTL_MINUTES);
  });

  it("returns null rather than a request the database never stored", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createLoginRequest()).toBeNull();
  });
});

describe("findPendingLoginRequest", () => {
  it("only quotes a code for a request that is unapproved, unspent and unexpired", async () => {
    const chain = chainReturning({ code: "4242" });
    select.mockReturnValue(chain);

    expect(await findPendingLoginRequest("req-1")).toEqual({ code: "4242" });
    expect(chain.eq).toHaveBeenCalledWith("request_id", "req-1");
    expect(chain.is).toHaveBeenCalledWith("approved_at", null);
    expect(chain.is).toHaveBeenCalledWith("consumed_at", null);
    expect(chain.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("returns null when nothing matched", async () => {
    select.mockReturnValue(chainReturning(null));
    expect(await findPendingLoginRequest("gone")).toBeNull();
  });
});

/**
 * Reloading /me must resume the login already in flight rather than mint a
 * second one: the bot's message quotes the first request's code, so a fresh
 * request would leave the browser polling for something nobody confirmed —
 * which looks exactly like "the confirm button does nothing".
 */
describe("findPendingRequestByNonce", () => {
  it("finds this browser's request by nonce hash, unspent and unexpired", async () => {
    const chain = chainReturning({ request_id: "req-1", code: "4242" });
    select.mockReturnValue(chain);

    expect(await findPendingRequestByNonce("raw-nonce")).toEqual({ requestId: "req-1", code: "4242" });
    expect(chain.eq).toHaveBeenCalledWith("nonce_hash", expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(chain.eq.mock.calls[0]?.[1]).not.toBe("raw-nonce");
    expect(chain.is).toHaveBeenCalledWith("consumed_at", null);
    expect(chain.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("returns null once the request is spent, so a new one gets minted", async () => {
    select.mockReturnValue(chainReturning(null));
    expect(await findPendingRequestByNonce("spent")).toBeNull();
  });
});

describe("approveLoginRequest", () => {
  it("records the Telegram identity in one UPDATE guarded against re-approval", async () => {
    const chain = chainReturning({ request_id: "req-1" });
    update.mockReturnValue(chain);

    const ok = await approveLoginRequest("req-1", { id: 99, first_name: "Олена", username: "olena" });
    expect(ok).toBe(true);

    const patch = update.mock.calls[0][0];
    expect(patch.telegram_user_id).toBe(99);
    // The name the old link flow discarded, leaving every author as "Користувач".
    expect(patch.telegram_first_name).toBe("Олена");
    expect(patch.telegram_username).toBe("olena");
    expect(patch.approved_at).toBeTruthy();

    expect(chain.eq).toHaveBeenCalledWith("request_id", "req-1");
    expect(chain.is).toHaveBeenCalledWith("approved_at", null);
    expect(chain.is).toHaveBeenCalledWith("consumed_at", null);
    expect(chain.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("reports failure when the request was already approved, spent or expired", async () => {
    update.mockReturnValue(chainReturning(null));
    expect(await approveLoginRequest("stale", { id: 1 })).toBe(false);
  });
});

describe("consumeApprovedLoginRequest", () => {
  it("redeems by nonce hash, and only an approval that is unspent and unexpired", async () => {
    const chain = chainReturning({ telegram_user_id: 99, telegram_first_name: "Олена", telegram_username: null });
    update.mockReturnValue(chain);

    expect(await consumeApprovedLoginRequest("raw-nonce")).toEqual({
      status: "approved",
      telegramUserId: 99,
      firstName: "Олена",
      username: undefined,
    });

    expect(update.mock.calls[0][0].consumed_at).toBeTruthy();
    // Looked up by hash, never by the nonce itself.
    expect(chain.eq).toHaveBeenCalledWith("nonce_hash", expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(chain.eq.mock.calls[0]?.[1]).not.toBe("raw-nonce");
    expect(chain.not).toHaveBeenCalledWith("approved_at", "is", null);
    expect(chain.is).toHaveBeenCalledWith("consumed_at", null);
    expect(chain.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("reports pending, with the code, while the chat has not confirmed yet", async () => {
    update.mockReturnValue(chainReturning(null));
    select.mockReturnValue(
      chainReturning({ code: "4242", consumed_at: null, expires_at: new Date(Date.now() + 60_000).toISOString() })
    );

    expect(await consumeApprovedLoginRequest("raw-nonce")).toEqual({ status: "pending", code: "4242" });
  });

  it("reports expired for a spent request, so a redeemed approval cannot be replayed", async () => {
    update.mockReturnValue(chainReturning(null));
    select.mockReturnValue(
      chainReturning({ code: "4242", consumed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString() })
    );

    expect(await consumeApprovedLoginRequest("raw-nonce")).toEqual({ status: "expired" });
  });

  it("reports none when this browser never started a login", async () => {
    update.mockReturnValue(chainReturning(null));
    select.mockReturnValue(chainReturning(null));

    expect(await consumeApprovedLoginRequest("stranger")).toEqual({ status: "none" });
  });
});
