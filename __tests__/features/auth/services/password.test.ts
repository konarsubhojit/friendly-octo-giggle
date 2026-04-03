import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockHash,
  mockCompare,
  mockSelect,
  mockInsert,
  mockDelete,
  _mockOrderBy,
  _mockLimit,
  _mockWhere,
} = vi.hoisted(() => ({
  mockHash: vi.fn(),
  mockCompare: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
  _mockOrderBy: vi.fn(),
  _mockLimit: vi.fn(),
  _mockWhere: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
}));

vi.mock("@/lib/db", () => ({
  primaryDrizzleDb: {
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  },
}));

vi.mock("@/lib/schema", () => ({
  passwordHistory: {
    id: "id",
    userId: "userId",
    passwordHash: "passwordHash",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  inArray: vi.fn((...args: unknown[]) => args),
}));

import {
  hashPassword,
  verifyPassword,
  checkPasswordHistory,
  savePasswordToHistory,
} from "@/features/auth/services/password";

describe("password service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hashPassword", () => {
    it("hashes password with 12 salt rounds", async () => {
      mockHash.mockResolvedValue("hashed_value");

      const result = await hashPassword("my-password");

      expect(result).toBe("hashed_value");
      expect(mockHash).toHaveBeenCalledWith("my-password", 12);
    });

    it("propagates bcrypt errors", async () => {
      mockHash.mockRejectedValue(new Error("hash failure"));

      await expect(hashPassword("test")).rejects.toThrow("hash failure");
    });
  });

  describe("verifyPassword", () => {
    it("returns true when passwords match", async () => {
      mockCompare.mockResolvedValue(true);

      const result = await verifyPassword("plain", "hashed");

      expect(result).toBe(true);
      expect(mockCompare).toHaveBeenCalledWith("plain", "hashed");
    });

    it("returns false when passwords do not match", async () => {
      mockCompare.mockResolvedValue(false);

      const result = await verifyPassword("wrong", "hashed");

      expect(result).toBe(false);
    });
  });

  describe("checkPasswordHistory", () => {
    it("returns true when new password matches a recent entry", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([
            { passwordHash: "old_hash_1" },
            { passwordHash: "old_hash_2" },
          ]),
      };
      mockSelect.mockReturnValue(selectChain);
      mockCompare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const result = await checkPasswordHistory("user1", "reused-password");

      expect(result).toBe(true);
      expect(mockCompare).toHaveBeenCalledTimes(2);
    });

    it("returns false when new password does not match any entry", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ passwordHash: "old_hash_1" }]),
      };
      mockSelect.mockReturnValue(selectChain);
      mockCompare.mockResolvedValue(false);

      const result = await checkPasswordHistory("user1", "new-password");

      expect(result).toBe(false);
    });

    it("returns false when no history entries exist", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockSelect.mockReturnValue(selectChain);

      const result = await checkPasswordHistory("user1", "any-password");

      expect(result).toBe(false);
      expect(mockCompare).not.toHaveBeenCalled();
    });

    it("returns true on first matching entry without checking rest", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([
            { passwordHash: "match_hash" },
            { passwordHash: "other_hash" },
          ]),
      };
      mockSelect.mockReturnValue(selectChain);
      mockCompare.mockResolvedValueOnce(true);

      const result = await checkPasswordHistory("user1", "reused");

      expect(result).toBe(true);
      expect(mockCompare).toHaveBeenCalledTimes(1);
    });
  });

  describe("savePasswordToHistory", () => {
    it("inserts new entry and trims old entries beyond limit", async () => {
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockInsert.mockReturnValue(insertChain);

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi
          .fn()
          .mockResolvedValue([
            { id: "entry1" },
            { id: "entry2" },
            { id: "entry3" },
          ]),
      };
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDelete.mockReturnValue(deleteChain);

      await savePasswordToHistory("user1", "new_hash");

      expect(insertChain.values).toHaveBeenCalledWith({
        userId: "user1",
        passwordHash: "new_hash",
      });
      expect(mockDelete).toHaveBeenCalled();
    });

    it("does not delete when entries are within limit", async () => {
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockInsert.mockReturnValue(insertChain);

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi
          .fn()
          .mockResolvedValue([{ id: "entry1" }, { id: "entry2" }]),
      };
      mockSelect.mockReturnValue(selectChain);

      await savePasswordToHistory("user1", "new_hash");

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("does not delete when only one entry exists", async () => {
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockInsert.mockReturnValue(insertChain);

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([{ id: "entry1" }]),
      };
      mockSelect.mockReturnValue(selectChain);

      await savePasswordToHistory("user1", "hash");

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
