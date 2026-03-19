import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockInsert,
  mockUpdate,
  mockSelect,
  mockLogBusinessEvent,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    query: {
      failedEmails: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logBusinessEvent: mockLogBusinessEvent,
}));

vi.mock("@/lib/email/providers", () => ({
  sendEmail: vi.fn(),
}));

import {
  saveFailedEmail,
  markFailedEmailSent,
  countPendingFailedEmails,
} from "@/lib/email/failed-emails";

describe("lib/email/failed-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveFailedEmail", () => {
    it("inserts a record and returns the id", async () => {
      const chainMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "abc1234" }]),
      };
      mockInsert.mockReturnValue(chainMock);

      const id = await saveFailedEmail({
        recipientEmail: "user@test.com",
        subject: "Test Subject",
        bodyHtml: "<p>Hello</p>",
        bodyText: "Hello",
        emailType: "order_confirmation",
        referenceId: "ord1234",
        errorHistory: [],
        isRetriable: true,
        attemptCount: 3,
        lastError: "ETIMEDOUT",
      });

      expect(id).toBe("abc1234");
      expect(mockInsert).toHaveBeenCalled();
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({ event: "failed_email_saved", success: true }),
      );
    });
  });

  describe("markFailedEmailSent", () => {
    it("updates status to sent", async () => {
      const chainMock = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockUpdate.mockReturnValue(chainMock);

      await markFailedEmailSent("abc1234");

      expect(mockUpdate).toHaveBeenCalled();
      expect(chainMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: "sent" }),
      );
    });
  });

  describe("countPendingFailedEmails", () => {
    it("returns count from DB", async () => {
      const chainMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
      };
      mockSelect.mockReturnValue(chainMock);

      const count = await countPendingFailedEmails();
      expect(count).toBe(5);
    });

    it("returns 0 when no rows returned", async () => {
      const chainMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockSelect.mockReturnValue(chainMock);

      const count = await countPendingFailedEmails();
      expect(count).toBe(0);
    });
  });
});
