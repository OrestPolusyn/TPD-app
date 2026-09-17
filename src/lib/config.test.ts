import { describe, it, expect, afterEach, vi } from "vitest";
import { config } from "./config";

describe("config.devLoginEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled when NODE_ENV=production, even with the flag set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOGIN_ENABLED", "true");
    expect(config.devLoginEnabled()).toBe(false);
  });

  it("is disabled outside production when the flag is unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_LOGIN_ENABLED", "");
    expect(config.devLoginEnabled()).toBe(false);
  });

  it("is disabled outside production when the flag is any value other than the string 'true'", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_LOGIN_ENABLED", "1");
    expect(config.devLoginEnabled()).toBe(false);
  });

  it("is enabled outside production when the flag is exactly 'true'", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_LOGIN_ENABLED", "true");
    expect(config.devLoginEnabled()).toBe(true);
  });
});
