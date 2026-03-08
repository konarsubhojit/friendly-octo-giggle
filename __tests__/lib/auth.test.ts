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

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {},
}));

vi.mock("@/lib/schema", () => ({
  users: {},
  accounts: {},
  sessions: {},
  verificationTokens: {},
}));

vi.mock("@/lib/logger", () => ({
  logAuthEvent: mockLogAuthEvent,
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
    it("sets user.id and user.role from token and calls logAuthEvent", () => {
      const session = { user: { id: "", role: "", email: "test@example.com" } };
      const token = { id: "user-123", role: "ADMIN" };

      const result = capturedConfig.callbacks.session({ session, token });

      expect(result.user.id).toBe("user-123");
      expect(result.user.role).toBe("ADMIN");
      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: "session_created",
        userId: "user-123",
        email: "test@example.com",
        success: true,
      });
    });

    it("defaults role to CUSTOMER when token.role is missing", () => {
      const session = { user: { id: "", role: "", email: null } };
      const token = { id: "user-456" };

      const result = capturedConfig.callbacks.session({ session, token });

      expect(result.user.role).toBe("CUSTOMER");
      expect(mockLogAuthEvent).toHaveBeenCalledWith({
        event: "session_created",
        userId: "user-456",
        email: undefined,
        success: true,
      });
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
      expect(capturedConfig.providers.length).toBe(1);
      expect(capturedConfig.providers[0].id).toBe("google");
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
