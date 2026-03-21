import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogAuthEvent = vi.hoisted(() => vi.fn());
const mockNextAuthReturn = vi.hoisted(() => ({
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
}));

interface NextAuthConfig {
  providers: Array<{
    id: string;
    authorize?: (credentials: Record<string, unknown>) => Promise<unknown>;
  }>;
}

let capturedConfig: NextAuthConfig;

vi.mock("next-auth", () => ({
  default: vi.fn((config: Record<string, unknown>) => {
    capturedConfig = config as unknown as NextAuthConfig;
    return mockNextAuthReturn;
  }),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn((options: Record<string, unknown>) => ({
    id: "google",
    ...options,
  })),
}));

vi.mock("next-auth/providers/microsoft-entra-id", () => ({
  default: vi.fn((options: Record<string, unknown>) => ({
    id: "microsoft-entra-id",
    ...options,
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((options: Record<string, unknown>) => ({
    id: options.id ?? "credentials",
    ...options,
  })),
}));

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/schema", () => ({
  users: { email: "email", phoneNumber: "phoneNumber" },
  accounts: {},
  sessions: {},
  verificationTokens: {},
}));

vi.mock("@/lib/logger", () => ({
  logAuthEvent: mockLogAuthEvent,
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  or: vi.fn((...args: unknown[]) => ({ op: "or", args })),
}));

describe("auth copilot-dev provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
  });

  const loadAuthorize = async () => {
    await import("@/lib/auth");
    const provider = capturedConfig.providers.find(
      (item: { id: string }) => item.id === "copilot-dev",
    );
    expect(provider?.authorize).toBeDefined();
    return provider!.authorize!;
  };

  it("returns null when COPILOT_DEV_KEY is missing", async () => {
    const authorize = await loadAuthorize();

    await expect(authorize({ devToken: "provided-key" })).resolves.toBeNull();
  });

  it("returns null when the provided token does not match", async () => {
    vi.stubEnv("COPILOT_DEV_KEY", "expected-key");
    const authorize = await loadAuthorize();

    await expect(authorize({ devToken: "wrong-key" })).resolves.toBeNull();
  });

  it("returns the Copilot admin user when the token matches", async () => {
    vi.stubEnv("COPILOT_DEV_KEY", "expected-key");
    const authorize = await loadAuthorize();

    await expect(authorize({ devToken: "expected-key" })).resolves.toEqual({
      id: "dev-copilot-admin",
      name: "Copilot Admin",
      email: "copilot@dev.local",
      image: null,
      role: "ADMIN",
      phoneNumber: null,
    });
  });
});
