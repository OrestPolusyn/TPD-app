import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Supabase client is mocked, so these assert the query this module builds
 * rather than the database's behaviour. That is the point: single-use and
 * expiry are enforced by the filters on one UPDATE statement, and dropping any
 * of them silently turns a one-time link into a permanent password.
 */
const update = vi.fn();
const insert = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "telegram_login_tokens") throw new Error(`unexpected table ${table}`);
      return { insert, update };
    },
    rpc,
  }),
}));

const { issueLoginToken, consumeLoginToken, LOGIN_TOKEN_TTL_MINUTES } = await import("./loginTokens");

interface Chain {
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function updateChain(row: { telegram_user_id: number } | null): Chain {
  const chain: Chain = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  update.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
});

describe("issueLoginToken", () => {
  it("stores only a hash, never the token that goes in the link", async () => {
    const token = await issueLoginToken(4242);
    expect(token).toBeTruthy();
    const row = insert.mock.calls[0][0];
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token as string);
  });

  it("mints an unguessable token, different every time", async () => {
    const a = await issueLoginToken(1);
    const b = await issueLoginToken(1);
    expect(a).not.toBe(b);
    expect((a as string).length).toBeGreaterThanOrEqual(43);
  });

  it("sets an expiry in the future, not far in it", async () => {
    await issueLoginToken(1);
    const expiresAt = new Date(insert.mock.calls[0][0].expires_at).getTime();
    const minutes = (expiresAt - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(LOGIN_TOKEN_TTL_MINUTES - 1);
    expect(minutes).toBeLessThanOrEqual(LOGIN_TOKEN_TTL_MINUTES);
  });

  it("returns null rather than a token the database never stored", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await issueLoginToken(1)).toBeNull();
  });
});

describe("consumeLoginToken", () => {
  it("redeems in one UPDATE guarded by unconsumed AND unexpired", async () => {
    const chain = updateChain({ telegram_user_id: 99 });
    expect(await consumeLoginToken("raw-token")).toBe(99);

    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0].consumed_at).toBeTruthy();
    // Looked up by hash, never by the raw token.
    expect(chain.eq).toHaveBeenCalledWith("token_hash", expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(chain.eq.mock.calls[0]?.[1]).not.toBe("raw-token");
    expect(chain.is).toHaveBeenCalledWith("consumed_at", null);
    expect(chain.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
  });

  it("returns null when nothing matched — expired, reused or never issued alike", async () => {
    updateChain(null);
    expect(await consumeLoginToken("stale")).toBeNull();
  });
});
