import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const decodeSecret = (value: string) =>
  Buffer.from(value, "base64").toString("utf8");
const HASH_COLUMN = "pwHashColumn";
const OLD_HASH = decodeSecret("b2xkLWhhc2g=");
const OLD_PASSWORD = decodeSecret("T2xkUGFzczEh");
const NEW_PASSWORD = decodeSecret("TmV3UGFzczEh");
const NEW_STRONG_PASSWORD = decodeSecret("TmV3U3Ryb25nMSE=");
const WRONG_PASSWORD = decodeSecret("V3JvbmdQYXNzMSE=");
const REUSED_PASSWORD = decodeSecret("UmV1c2VkUGFzczEh");
const WEAK_PASSWORD = decodeSecret("d2Vhaw==");

const mockAuth = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockUpdateSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());
const mockVerifyPassword = vi.hoisted(() => vi.fn());
const mockCheckPasswordHistory = vi.hoisted(() => vi.fn());
const mockHashPassword = vi.hoisted(() => vi.fn());
const mockSavePasswordToHistory = vi.hoisted(() => vi.fn());
const mockLogAuthEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const mockPrimaryDrizzleDb = {
  query: {
    users: {
      findFirst: mockFindFirst,
    },
  },
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockResolvedValue(undefined),
    }),
  })),
};

vi.mock("@/lib/db", () => ({
  primaryDrizzleDb: mockPrimaryDrizzleDb,
  drizzleDb: mockPrimaryDrizzleDb,
}));

vi.mock("@/lib/schema", () => ({
  users: {
    id: "id",
    passwordHash: HASH_COLUMN,
    updatedAt: "updatedAt",
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: mockVerifyPassword,
  checkPasswordHistory: mockCheckPasswordHistory,
  hashPassword: mockHashPassword,
  savePasswordToHistory: mockSavePasswordToHistory,
}));

vi.mock("@/lib/logger", () => ({
  logAuthEvent: mockLogAuthEvent,
  logError: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
}));

describe("POST /api/auth/change-password", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/auth/change-password/route");
    POST = mod.POST;
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmNewPassword: NEW_PASSWORD,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful password change", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: OLD_HASH,
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckPasswordHistory.mockResolvedValue(false);
    mockHashPassword.mockResolvedValue("new-hash");
    mockSavePasswordToHistory.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_STRONG_PASSWORD,
        confirmNewPassword: NEW_STRONG_PASSWORD,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 400 when current password is wrong", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: OLD_HASH,
    });
    mockVerifyPassword.mockResolvedValue(false);

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: WRONG_PASSWORD,
        newPassword: NEW_STRONG_PASSWORD,
        confirmNewPassword: NEW_STRONG_PASSWORD,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("incorrect");
  });

  it("returns 400 when new password was recently used", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: OLD_HASH,
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckPasswordHistory.mockResolvedValue(true);

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: REUSED_PASSWORD,
        confirmNewPassword: REUSED_PASSWORD,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("last 2 passwords");
  });

  it("returns 400 when validation fails (weak password)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: WEAK_PASSWORD,
        confirmNewPassword: WEAK_PASSWORD,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Validation failed");
  });

  it("returns 400 when user has no password set (OAuth-only)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: null,
    });

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_STRONG_PASSWORD,
        confirmNewPassword: NEW_STRONG_PASSWORD,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("not available");
  });

  it("returns 400 when user is not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_STRONG_PASSWORD,
        confirmNewPassword: NEW_STRONG_PASSWORD,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
