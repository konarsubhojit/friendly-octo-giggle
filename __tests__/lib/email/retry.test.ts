import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockSendEmail,
  mockSaveFailedEmail,
  mockLogError,
  mockLogBusinessEvent,
  mockWaitUntil,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockSaveFailedEmail: vi.fn().mockResolvedValue("saved-id"),
  mockLogError: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
  mockWaitUntil: vi.fn((p: Promise<unknown>) => {
    p.catch(() => undefined);
  }),
}));

vi.mock("@/lib/email/providers", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email/failed-emails", () => ({
  saveFailedEmail: mockSaveFailedEmail,
}));
vi.mock("@/lib/logger", () => ({
  logError: mockLogError,
  logBusinessEvent: mockLogBusinessEvent,
}));
vi.mock("@vercel/functions", () => ({ waitUntil: mockWaitUntil }));

import {
  isNonRetriableError,
  runRetryChain,
  sendWithRetry,
} from "@/lib/email/retry";

vi.mock("@/lib/email/retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/retry")>();
  return {
    ...actual,
  };
});

describe("lib/email/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isNonRetriableError", () => {
    it("returns true for 401 status code", () => {
      const err = Object.assign(new Error("Unauthorized"), {
        response: { statusCode: 401 },
      });
      expect(isNonRetriableError(err)).toBe(true);
    });

    it("returns true for 403 status code", () => {
      const err = Object.assign(new Error("Forbidden"), {
        response: { statusCode: 403 },
      });
      expect(isNonRetriableError(err)).toBe(true);
    });

    it("returns true for EAUTH in message", () => {
      expect(
        isNonRetriableError(new Error("EAUTH authentication failed")),
      ).toBe(true);
    });

    it("returns true for EENVELOPE in message", () => {
      expect(isNonRetriableError(new Error("EENVELOPE bad envelope"))).toBe(
        true,
      );
    });

    it("returns true for invalid address in message", () => {
      expect(isNonRetriableError(new Error("invalid address format"))).toBe(
        true,
      );
    });

    it("returns false for timeout errors", () => {
      expect(
        isNonRetriableError(new Error("ETIMEDOUT connection timed out")),
      ).toBe(false);
    });

    it("returns false for service unavailable", () => {
      expect(isNonRetriableError(new Error("Service Unavailable"))).toBe(false);
    });

    it("handles non-Error values", () => {
      expect(isNonRetriableError("EAUTH error")).toBe(true);
      expect(isNonRetriableError("network timeout")).toBe(false);
    });
  });

  describe("runRetryChain", () => {
    const msg = {
      to: "u@test.com",
      subject: "Test",
      html: "<p>hi</p>",
      text: "hi",
    };
    const ctx = {
      emailType: "order_confirmation" as const,
      referenceId: "ord1234",
    };

    it("succeeds on first retry if sendEmail resolves", async () => {
      mockSendEmail.mockResolvedValue(undefined);

      const promise = runRetryChain(msg, ctx);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSaveFailedEmail).not.toHaveBeenCalled();
    });

    it("saves to DB after send fails", async () => {
      mockSendEmail.mockRejectedValue(new Error("ETIMEDOUT"));

      const promise = runRetryChain(msg, ctx);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSaveFailedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: "u@test.com",
          emailType: "order_confirmation",
          referenceId: "ord1234",
          isRetriable: true,
        }),
      );
    });

    it("stops retrying on non-retriable error", async () => {
      mockSendEmail.mockRejectedValue(
        Object.assign(new Error("EAUTH failed"), {
          response: { statusCode: 401 },
        }),
      );

      const promise = runRetryChain(msg, ctx);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSaveFailedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ isRetriable: false }),
      );
    });

    it("logs the failed attempt on send error", async () => {
      mockSendEmail.mockRejectedValue(new Error("ETIMEDOUT"));

      const promise = runRetryChain(msg, ctx);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogError).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendWithRetry", () => {
    it("calls waitUntil with the retry chain promise", () => {
      const msg = {
        to: "u@test.com",
        subject: "Test",
        html: "<p>hi</p>",
        text: "hi",
      };
      const ctx = {
        emailType: "order_confirmation" as const,
        referenceId: "ord1234",
      };

      sendWithRetry(msg, ctx);

      expect(mockWaitUntil).toHaveBeenCalledWith(expect.any(Promise));
    });

    it("returns void", () => {
      const msg = {
        to: "u@test.com",
        subject: "Test",
        html: "<p>hi</p>",
        text: "hi",
      };
      const ctx = { emailType: "order_status_update" as const };

      const result = sendWithRetry(msg, ctx);
      expect(result).toBeUndefined();
    });
  });
});
