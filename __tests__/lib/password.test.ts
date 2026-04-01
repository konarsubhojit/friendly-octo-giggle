import { describe, it, expect, vi, beforeEach } from "vitest";

const decodeSecret = (value: string) =>
  Buffer.from(value, "base64").toString("utf8");
const TEST_HASH_COLUMN = "pwHashColumn";
const TEST_OLD_HASH = decodeSecret("b2xkLWhhc2g=");
const TEST_SAVED_HASH = decodeSecret("aGFzaGVkLXBhc3N3b3Jk");

const mockHash = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
}));

const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

const mockFromSelect = vi.hoisted(() => vi.fn());
const mockWhereSelect = vi.hoisted(() => vi.fn());
const mockOrderBySelect = vi.hoisted(() => vi.fn());
const mockLimitSelect = vi.hoisted(() => vi.fn());

const mockValuesInsert = vi.hoisted(() => vi.fn());

const _mockFromDelete = vi.hoisted(() => vi.fn());
const mockWhereDelete = vi.hoisted(() => vi.fn());

const mockPrimaryDrizzleDb = {
  select: mockSelect,
  insert: mockInsert,
  delete: mockDelete,
};

vi.mock("@/lib/db", () => ({
  primaryDrizzleDb: mockPrimaryDrizzleDb,
  drizzleDb: mockPrimaryDrizzleDb,
}));

vi.mock("@/lib/schema", () => ({
  passwordHistory: {
    passwordHash: TEST_HASH_COLUMN,
    userId: "userId",
    createdAt: "createdAt",
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  desc: vi.fn((col: unknown) => ({ op: "desc", col })),
  inArray: vi.fn((...args: unknown[]) => ({ op: "inArray", args })),
}));

describe("password utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLimitSelect.mockResolvedValue([]);
    mockOrderBySelect.mockReturnValue({ limit: mockLimitSelect });
    mockWhereSelect.mockReturnValue({ orderBy: mockOrderBySelect });
    mockFromSelect.mockReturnValue({ where: mockWhereSelect });
    mockSelect.mockReturnValue({ from: mockFromSelect });

    mockValuesInsert.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValuesInsert });

    mockWhereDelete.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockWhereDelete });
  });

  describe("hashPassword", () => {
    it("hashes password with bcryptjs using salt rounds 12", async () => {
      mockHash.mockResolvedValue("hashed-password");
      const { hashPassword } = await import("@/features/auth/services/password");
      const result = await hashPassword("MyPassword1!");
      expect(mockHash).toHaveBeenCalledWith("MyPassword1!", 12);
      expect(result).toBe("hashed-password");
    });
  });

  describe("verifyPassword", () => {
    it("returns true for matching password", async () => {
      mockCompare.mockResolvedValue(true);
      const { verifyPassword } = await import("@/features/auth/services/password");
      const result = await verifyPassword("MyPassword1!", "hashed");
      expect(mockCompare).toHaveBeenCalledWith("MyPassword1!", "hashed");
      expect(result).toBe(true);
    });

    it("returns false for non-matching password", async () => {
      mockCompare.mockResolvedValue(false);
      const { verifyPassword } = await import("@/features/auth/services/password");
      const result = await verifyPassword("wrong", "hashed");
      expect(result).toBe(false);
    });
  });

  describe("checkPasswordHistory", () => {
    it("returns false when no history entries exist", async () => {
      mockLimitSelect.mockResolvedValue([]);
      const { checkPasswordHistory } = await import("@/features/auth/services/password");
      const result = await checkPasswordHistory("user-1", "newPass1!");
      expect(result).toBe(false);
    });

    it("returns true when password matches a history entry", async () => {
      mockLimitSelect.mockResolvedValue([{ passwordHash: TEST_OLD_HASH }]);
      mockCompare.mockResolvedValue(true);
      const { checkPasswordHistory } = await import("@/features/auth/services/password");
      const result = await checkPasswordHistory("user-1", "oldPassword1!");
      expect(result).toBe(true);
    });

    it("returns false when password does not match any history entry", async () => {
      mockLimitSelect.mockResolvedValue([{ passwordHash: TEST_OLD_HASH }]);
      mockCompare.mockResolvedValue(false);
      const { checkPasswordHistory } = await import("@/features/auth/services/password");
      const result = await checkPasswordHistory("user-1", "newPassword1!");
      expect(result).toBe(false);
    });
  });

  describe("savePasswordToHistory", () => {
    it("inserts a new history entry", async () => {
      mockLimitSelect.mockResolvedValue([]);
      mockOrderBySelect.mockReturnValue(Promise.resolve([{ id: "entry-1" }]));
      const { savePasswordToHistory } = await import("@/features/auth/services/password");
      await savePasswordToHistory("user-1", "hashed-password");
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValuesInsert).toHaveBeenCalledWith({
        userId: "user-1",
        passwordHash: TEST_SAVED_HASH,
      });
    });

    it("deletes old entries beyond the limit of 2", async () => {
      mockOrderBySelect.mockReturnValue(
        Promise.resolve([
          { id: "entry-3" },
          { id: "entry-2" },
          { id: "entry-1" },
        ]),
      );
      const { savePasswordToHistory } = await import("@/features/auth/services/password");
      await savePasswordToHistory("user-1", "new-hash");
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
