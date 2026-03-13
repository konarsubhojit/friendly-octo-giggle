import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoisted mocks
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

vi.mock("@/lib/db", () => ({
  drizzleDb: {
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
  },
}));

vi.mock("@/lib/schema", () => ({
  users: {
    id: "id",
    passwordHash: "passwordHash",
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

    const req = new NextRequest(
      "http://localhost/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPass1!",
          newPassword: "NewPass1!",
          confirmNewPassword: "NewPass1!",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful password change", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "old-hash",
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckPasswordHistory.mockResolvedValue(false);
    mockHashPassword.mockResolvedValue("new-hash");
    mockSavePasswordToHistory.mockResolvedValue(undefined);

    const req = new NextRequest(
      "http://localhost/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPass1!",
          newPassword: "NewStrong1!",
          confirmNewPassword: "NewStrong1!",
        }),
      },
    );

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
      passwordHash: "old-hash",
    });
    mockVerifyPassword.mockResolvedValue(false);

    const req = new NextRequest(
      "http://localhost/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "WrongPass1!",
          newPassword: "NewStrong1!",
          confirmNewPassword: "NewStrong1!",
        }),
      },
    );

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
      passwordHash: "old-hash",
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCheckPasswordHistory.mockResolvedValue(true);

    const req = new NextRequest(
      "http://localhost/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPass1!",
          newPassword: "ReusedPass1!",
          confirmNewPassword: "ReusedPass1!",
        }),
      },
    );

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("last 2 passwords");
  });
});
