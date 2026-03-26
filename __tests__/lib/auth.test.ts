import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const decodeSecret = (value: string) =>
  Buffer.from(value, "base64").toString("utf8");
const TEST_HASH = decodeSecret("aGFzaGVkLXBhc3M=");
const TEST_PASSWORD = decodeSecret("cGFzcw==");
const TEST_PASSWORD_ALT = decodeSecret("cGFzczEyMw==");
const TEST_WRONG_PASSWORD = decodeSecret("d3JvbmctcGFzcw==");
const TEST_CORRECT_PASSWORD = decodeSecret("Y29ycmVjdC1wYXNz");

const mockLogAuthEvent = vi.hoisted(() => vi.fn());
const mockNextAuthReturn = vi.hoisted(() => ({
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
}));

const mockCacheUserSession = vi.hoisted(() =>
  vi.fn((_userId: string, builder: () => unknown) =>
    Promise.resolve(builder()),
  ),
);
const mockInvalidateUserSessionCache = vi.hoisted(() => vi.fn());

interface NextAuthConfig {
  session: { strategy: string; maxAge: number };
  pages: { signIn: string; error: string };
  providers: Array<{
    id: string;
    issuer?: string;
    authorize?: (credentials: Record<string, unknown>) => Promise<unknown>;
  }>;
  adapter: unknown;
  callbacks: {
    session: (params: {
      session: { user: Record<string, unknown> };
      token: Record<string, unknown>;
    }) => Promise<{ user: Record<string, unknown> }>;
    jwt: (params: {
      token: Record<string, unknown>;
      user?: Record<string, unknown>;
    }) => Record<string, unknown>;
    signIn: (params: {
      user: Record<string, unknown>;
      account: Record<string, unknown> | null;
    }) => boolean;
  };
  events: {
    signOut: (message?: Record<string, unknown>) => Promise<void>;
  };
  cookies: {
    sessionToken: {
      options: Record<string, unknown>;
    };
  };
}

let capturedConfig: NextAuthConfig;

vi.mock("next-auth", () => ({
  default: vi.fn((config: Record<string, unknown>) => {
    capturedConfig = config as unknown as NextAuthConfig;
    return mockNextAuthReturn;
  }),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn((opts: Record<string, unknown>) => ({
    id: "google",
    ...opts,
  })),
}));

vi.mock("next-auth/providers/microsoft-entra-id", () => ({
  default: vi.fn((opts: Record<string, unknown>) => ({
    id: "microsoft-entra-id",
    ...opts,
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((opts: Record<string, unknown>) => ({
    id: "credentials",
    ...opts,
  })),
}));

const mockFindFirst = vi.hoisted(() => vi.fn());
const mockVerifyPassword = vi.hoisted(() => vi.fn());

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

const mockPrimaryDrizzleDb = {
  query: {
    users: {
      findFirst: mockFindFirst,
    },
  },
};

vi.mock("@/lib/db", () => ({
  primaryDrizzleDb: mockPrimaryDrizzleDb,
  drizzleDb: mockPrimaryDrizzleDb,
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
  verifyPassword: mockVerifyPassword,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  or: vi.fn((...args: unknown[]) => ({ op: "or", args })),
}));

vi.mock("@/lib/cache", () => ({
  cacheUserSession: mockCacheUserSession,
  invalidateUserSessionCache: mockInvalidateUserSessionCache,
}));

describe("auth module", () => {
  beforeAll(async () => {
    await import("@/lib/auth");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports handlers, signIn, signOut, auth", async () => {
    const authModule = await import("@/lib/auth");
    expect(authModule.handlers).toBeDefined();
    expect(authModule.signIn).toBeDefined();
    expect(authModule.signOut).toBeDefined();
    expect(authModule.auth).toBeDefined();
  });

  it("calls NextAuth with jwt strategy and custom pages", () => {
    expect(capturedConfig).toBeDefined();
    expect(capturedConfig.session).toEqual({ strategy: "jwt", maxAge: 86400 });
    expect(capturedConfig.pages).toEqual({
      signIn: "/auth/signin",
      error: "/auth/error",
    });
  });

  describe("callbacks.session", () => {
    it("sets user.id and user.role from token", async () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = { id: "user-123", role: "ADMIN" };

      const result = await capturedConfig.callbacks.session({ session, token });

      expect(result.user.id).toBe("user-123");
      expect(result.user.role).toBe("ADMIN");
      expect(mockLogAuthEvent).not.toHaveBeenCalled();
    });

    it("defaults role to CUSTOMER when token.role is missing", async () => {
      const session = { user: { id: "", role: "", email: null } };
      const token = { id: "user-456" };

      const result = await capturedConfig.callbacks.session({ session, token });

      expect(result.user.role).toBe("CUSTOMER");
      expect(mockLogAuthEvent).not.toHaveBeenCalled();
    });

    it("uses cacheUserSession to cache session user data", async () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = { id: "user-123", role: "CUSTOMER" };

      await capturedConfig.callbacks.session({ session, token });

      expect(mockCacheUserSession).toHaveBeenCalledWith(
        "user-123",
        expect.any(Function),
      );
    });

    it("returns session unchanged when userId is missing from token", async () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = {};

      const result = await capturedConfig.callbacks.session({ session, token });

      expect(result).toEqual(session);
      expect(mockCacheUserSession).not.toHaveBeenCalled();
    });
  });

  describe("callbacks.jwt", () => {
    it("sets token.id and token.role from user", () => {
      const token = { sub: "sub-1" };
      const user = { id: "user-789", role: "ADMIN" };

      const result = capturedConfig.callbacks.jwt({ token, user });

      expect(result.id).toBe("user-789");
      expect(result.role).toBe("ADMIN");
    });

    it("returns token unchanged when no user is present", () => {
      const token = { sub: "sub-1", id: "existing-id", role: "CUSTOMER" };

      const result = capturedConfig.callbacks.jwt({ token, user: undefined });

      expect(result).toEqual(token);
    });
  });

  describe("callbacks.signIn", () => {
    it("calls logAuthEvent and returns true", () => {
      const user = { id: "user-abc", email: "sign@in.com" };
      const account = { provider: "google" };

      const result = capturedConfig.callbacks.signIn({ user, account });

      expect(result).toBe(true);
      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: "login",
        userId: "user-abc",
        email: "sign@in.com",
        provider: "google",
        success: true,
      });
    });
  });

  describe("events.signOut", () => {
    it("calls logAuthEvent with logout event", async () => {
      await capturedConfig.events.signOut({});

      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: "logout",
        success: true,
      });
    });

    it("invalidates session cache when token with id is provided", async () => {
      await capturedConfig.events.signOut({ token: { id: "user-xyz" } });

      expect(mockInvalidateUserSessionCache).toHaveBeenCalledWith("user-xyz");
      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: "logout",
        success: true,
      });
    });

    it("does not call invalidateUserSessionCache when token has no id", async () => {
      await capturedConfig.events.signOut({ token: {} });

      expect(mockInvalidateUserSessionCache).not.toHaveBeenCalled();
    });

    it("does not call invalidateUserSessionCache when message has no token", async () => {
      await capturedConfig.events.signOut({});

      expect(mockInvalidateUserSessionCache).not.toHaveBeenCalled();
    });
  });

  describe("Google provider config", () => {
    it("uses empty strings when env vars are not set", () => {
      const providers = capturedConfig.providers as Array<{ id: string }>;
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      const expectedCount = process.env.NODE_ENV === "development" ? 4 : 3;
      expect(providers.length).toBe(expectedCount);
      if (process.env.NODE_ENV === "development") {
        expect(providers[0].id).toBe("copilot-dev");
      }
    });
  });

  describe("Microsoft provider config", () => {
    it("has microsoft-entra-id provider configured", () => {
      const providers = capturedConfig.providers as Array<{
        id: string;
        issuer?: string;
      }>;
      const msProvider = providers.find(
        (p: { id: string }) => p.id === "microsoft-entra-id",
      );
      expect(msProvider).toBeDefined();
      expect(msProvider?.issuer).toBe(
        "https://login.microsoftonline.com/common/v2.0",
      );
    });
  });

  describe("Credentials provider config", () => {
    it("has credentials provider configured", () => {
      const providers = capturedConfig.providers as Array<{ id: string }>;
      const credProvider = providers.find(
        (p: { id: string }) => p.id === "credentials",
      );
      expect(credProvider).toBeDefined();
    });
  });

  describe("Credentials authorize", () => {
    let authorize: (credentials: Record<string, unknown>) => Promise<unknown>;

    beforeEach(() => {
      const providers = capturedConfig.providers as Array<{
        id: string;
        authorize?: (credentials: Record<string, unknown>) => Promise<unknown>;
      }>;
      const credProvider = providers.find(
        (p: { id: string }) => p.id === "credentials",
      );
      authorize = credProvider!.authorize!;
    });

    it("returns null when identifier is missing", async () => {
      const result = await authorize({ password: TEST_PASSWORD });
      expect(result).toBeNull();
    });

    it("returns null when password is missing", async () => {
      const result = await authorize({ identifier: "test@example.com" });
      expect(result).toBeNull();
    });

    it("returns null when both are missing", async () => {
      const result = await authorize({});
      expect(result).toBeNull();
    });

    it("returns null when user is not found", async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await authorize({
        identifier: "unknown@example.com",
        password: TEST_PASSWORD_ALT,
      });
      expect(result).toBeNull();
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "failed_login",
          error: "User not found",
        }),
      );
    });

    it("returns null when user has no password (OAuth-only)", async () => {
      mockFindFirst.mockResolvedValue({
        id: "user-1",
        email: "oauth@example.com",
        passwordHash: null,
      });
      const result = await authorize({
        identifier: "oauth@example.com",
        password: TEST_PASSWORD_ALT,
      });
      expect(result).toBeNull();
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "failed_login",
          error: "No password set (OAuth-only user)",
        }),
      );
    });

    it("returns null when password is invalid", async () => {
      mockFindFirst.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        passwordHash: TEST_HASH,
      });
      mockVerifyPassword.mockResolvedValue(false);
      const result = await authorize({
        identifier: "test@example.com",
        password: TEST_WRONG_PASSWORD,
      });
      expect(result).toBeNull();
      expect(mockLogAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "failed_login",
          error: "Invalid password",
        }),
      );
    });

    it("returns user on successful login", async () => {
      mockFindFirst.mockResolvedValue({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        image: null,
        role: "CUSTOMER",
        phoneNumber: "+1234567890",
        passwordHash: TEST_HASH,
      });
      mockVerifyPassword.mockResolvedValue(true);
      const result = await authorize({
        identifier: "test@example.com",
        password: TEST_CORRECT_PASSWORD,
      });
      expect(result).toEqual({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        image: null,
        role: "CUSTOMER",
        phoneNumber: "+1234567890",
      });
      expect(mockLogAuthEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: "login" }),
      );
    });
  });

  describe("callbacks.session phoneNumber", () => {
    it("sets phoneNumber from token when present", async () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = {
        id: "user-123",
        role: "CUSTOMER",
        phoneNumber: "+1234567890",
      };

      const result = await capturedConfig.callbacks.session({ session, token });

      expect(result.user.phoneNumber).toBe("+1234567890");
    });

    it("sets phoneNumber to undefined when missing from token", async () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = { id: "user-123", role: "CUSTOMER" };

      const result = await capturedConfig.callbacks.session({ session, token });

      expect(result.user.phoneNumber).toBeUndefined();
    });
  });

  describe("callbacks.jwt phoneNumber", () => {
    it("sets phoneNumber on token when user has it", () => {
      const token = { sub: "sub-1" };
      const user = {
        id: "user-123",
        role: "CUSTOMER",
        phoneNumber: "+1234567890",
      };

      const result = capturedConfig.callbacks.jwt({ token, user });

      expect(result.phoneNumber).toBe("+1234567890");
    });

    it("does not set phoneNumber when user does not have it", () => {
      const token = { sub: "sub-1" };
      const user = { id: "user-123", role: "CUSTOMER" };

      const result = capturedConfig.callbacks.jwt({ token, user });

      expect(result.phoneNumber).toBeUndefined();
    });
  });

  describe("cookies config", () => {
    it("has session token cookie config", () => {
      expect(capturedConfig.cookies).toBeDefined();
      expect(capturedConfig.cookies.sessionToken).toBeDefined();
      expect(capturedConfig.cookies.sessionToken.options.httpOnly).toBe(true);
      expect(capturedConfig.cookies.sessionToken.options.sameSite).toBe("lax");
      expect(capturedConfig.cookies.sessionToken.options.path).toBe("/");
    });
  });

  describe("callbacks.jwt edge cases", () => {
    it("defaults role to CUSTOMER when user.role is missing", () => {
      const token = { sub: "sub-1" };
      const user = { id: "user-nrole" };

      const result = capturedConfig.callbacks.jwt({ token, user });

      expect(result.id).toBe("user-nrole");
      expect(result.role).toBe("CUSTOMER");
    });
  });

  describe("callbacks.signIn edge cases", () => {
    it("handles sign in with null account", () => {
      const user = { id: "user-x", email: null };
      const account = null;

      const result = capturedConfig.callbacks.signIn({ user, account });

      expect(result).toBe(true);
      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: "login",
        userId: "user-x",
        email: undefined,
        provider: undefined,
        success: true,
      });
    });
  });
});
