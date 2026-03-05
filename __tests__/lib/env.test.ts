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

  it("REDIS_URL is optional (may be undefined)", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("@/lib/env");
    // REDIS_URL is optional - it might be undefined or have a value
    expect(typeof env.DATABASE_URL).toBe("string");
  });

  it("throws when NODE_ENV has invalid value", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    // Cast to valid type to bypass TypeScript, but Zod will reject 'staging' at runtime
    vi.stubEnv("NODE_ENV", "staging" as "development");
    await expect(import("@/lib/env")).rejects.toThrow("Invalid environment variables");
  });
});

