import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/auth/dev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when DEV_LOGIN_ENABLED is not 'true'", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_LOGIN_ENABLED", "false");
    const res = await GET(new Request("http://localhost/api/auth/dev?user=1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 in production even when DEV_LOGIN_ENABLED=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOGIN_ENABLED", "true");
    const res = await GET(new Request("http://localhost/api/auth/dev?user=1"));
    expect(res.status).toBe(404);
  });
});
