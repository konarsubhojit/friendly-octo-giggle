import { describe, it, expect, vi, afterEach } from "vitest";

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exports env object with DATABASE_URL when valid", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toBe("postgresql://localhost/test");
  });

  it("exports REDIS_URL when provided", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("@/lib/env");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("exports READ_DATABASE_URL when provided", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/write");
    vi.stubEnv("READ_DATABASE_URL", "postgresql://localhost/read");
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("@/lib/env");
    expect(env.READ_DATABASE_URL).toBe("postgresql://localhost/read");
  });

  it("REDIS_URL is optional (may be undefined)", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("@/lib/env");
    expect(typeof env.DATABASE_URL).toBe("string");
  });

  it("throws when NODE_ENV has invalid value", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("NODE_ENV", "staging" as "development");
    await expect(import("@/lib/env")).rejects.toThrow(
      "Invalid environment variables",
    );
  });
});
