import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogAuthEvent = vi.hoisted(() => vi.fn());
const mockNextAuthReturn = vi.hoisted(() => ({
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
}));
let capturedConfig: Record<string, unknown>;

vi.mock("next-auth", () => ({
  default: vi.fn((config: Record<string, unknown>) => {
    capturedConfig = config;
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

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      users: {
        findFirst: mockFindFirst,
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
  verifyPassword: mockVerifyPassword,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  or: vi.fn((...args: unknown[]) => ({ op: "or", args })),
}));

describe("auth module", () => {
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
    expect(capturedConfig.session).toEqual({ strategy: "jwt" });
    expect(capturedConfig.pages).toEqual({
      signIn: "/auth/signin",
      error: "/auth/error",
    });
  });

  describe("callbacks.session", () => {
    it("sets user.id and user.role from token", () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = { id: "user-123", role: "ADMIN" };

      const result = capturedConfig.callbacks.session({ session, token });

      expect(result.user.id).toBe("user-123");
      expect(result.user.role).toBe("ADMIN");
      expect(mockLogAuthEvent).not.toHaveBeenCalled();
    });

    it("defaults role to CUSTOMER when token.role is missing", () => {
      const session = { user: { id: "", role: "", email: null } };
      const token = { id: "user-456" };

      const result = capturedConfig.callbacks.session({ session, token });

      expect(result.user.role).toBe("CUSTOMER");
      expect(mockLogAuthEvent).not.toHaveBeenCalled();
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
    it("calls logAuthEvent with logout event", () => {
      capturedConfig.events.signOut();

      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: "logout",
        success: true,
      });
    });
  });

  describe("Google provider config", () => {
    it("uses empty strings when env vars are not set", () => {
      // The provider config uses conditional checks for GOOGLE_CLIENT_ID/SECRET
      expect(capturedConfig.providers).toBeDefined();
      expect(Array.isArray(capturedConfig.providers)).toBe(true);
      // 3 base providers (google, microsoft-entra-id, credentials) +
      // 1 dev-only copilot provider when NODE_ENV !== 'production'
      const expectedCount = process.env.NODE_ENV !== 'production' ? 4 : 3;
      expect(capturedConfig.providers.length).toBe(expectedCount);
      expect(capturedConfig.providers[0].id).toBe("copilot-dev");
    });
  });

  describe("Microsoft provider config", () => {
    it("has microsoft-entra-id provider configured", () => {
      const msProvider = capturedConfig.providers.find(
        (p: { id: string }) => p.id === "microsoft-entra-id",
      );
      expect(msProvider).toBeDefined();
      expect(msProvider.issuer).toBe(
        "https://login.microsoftonline.com/consumers/v2.0",
      );
    });
  });

  describe("Credentials provider config", () => {
    it("has credentials provider configured", () => {
      const credProvider = capturedConfig.providers.find(
        (p: { id: string }) => p.id === "credentials",
      );
      expect(credProvider).toBeDefined();
    });
  });

  describe("Credentials authorize", () => {
    let authorize: (credentials: Record<string, unknown>) => Promise<unknown>;

    beforeEach(() => {
      const credProvider = capturedConfig.providers.find(
        (p: { id: string }) => p.id === "credentials",
      );
      authorize = credProvider.authorize;
    });

    it("returns null when identifier is missing", async () => {
      const result = await authorize({ password: "pass" });
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
        password: "pass123",
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
        password: "pass123",
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
        passwordHash: "hashed-pass",
      });
      mockVerifyPassword.mockResolvedValue(false);
      const result = await authorize({
        identifier: "test@example.com",
        password: "wrong-pass",
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
        passwordHash: "hashed-pass",
      });
      mockVerifyPassword.mockResolvedValue(true);
      const result = await authorize({
        identifier: "test@example.com",
        password: "correct-pass",
      });
      expect(result).toEqual({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        image: null,
        role: "CUSTOMER",
        phoneNumber: "+1234567890",
      });
      // login event is handled by the signIn() callback, not by authorize()
      expect(mockLogAuthEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: "login" }),
      );
    });
  });

  describe("callbacks.session phoneNumber", () => {
    it("sets phoneNumber from token when present", () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = { id: "user-123", role: "CUSTOMER", phoneNumber: "+1234567890" };

      const result = capturedConfig.callbacks.session({ session, token });

      expect(result.user.phoneNumber).toBe("+1234567890");
    });

    it("sets phoneNumber to undefined when missing from token", () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = { id: "user-123", role: "CUSTOMER" };

      const result = capturedConfig.callbacks.session({ session, token });

      expect(result.user.phoneNumber).toBeUndefined();
    });
  });

  describe("callbacks.jwt phoneNumber", () => {
    it("sets phoneNumber on token when user has it", () => {
      const token = { sub: "sub-1" };
      const user = { id: "user-123", role: "CUSTOMER", phoneNumber: "+1234567890" };

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
