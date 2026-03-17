import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockSetApiKey } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockSetApiKey: vi.fn(),
}));

vi.mock("@sendgrid/mail", () => ({
  default: { send: mockSend, setApiKey: mockSetApiKey },
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}));

import {
  escapeHtml,
} from "@/lib/email";
import { logError } from "@/lib/logger";

describe("lib/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("escapeHtml", () => {
    it("escapes &, <, >, \", and '", () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
      expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    it("returns unchanged string when no special chars", () => {
      expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
    });
  });

  describe("sendOrderConfirmationEmail", () => {
    it("skips sending when SENDGRID_API_KEY is not set", async () => {
      delete process.env.SENDGRID_API_KEY;
      // Re-import to reset sgInitialized
      vi.resetModules();
      const { sendOrderConfirmationEmail: freshSend } = await import("@/lib/email");

      await freshSend({
        to: "user@test.com",
        customerName: "Jane",
        orderId: "abc1234",
        totalAmount: "$42.00",
        items: [{ name: "Widget", quantity: 1, price: "$42.00" }],
        shippingAddress: "123 Main St",
      });

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("sends confirmation email when API key is configured", async () => {
      process.env.SENDGRID_API_KEY = "SG.test-key";
      vi.resetModules();
      const { sendOrderConfirmationEmail: freshSend } = await import("@/lib/email");
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      await freshSend({
        to: "user@test.com",
        customerName: "Jane",
        orderId: "abc1234",
        totalAmount: "$42.00",
        items: [
          { name: "Widget", quantity: 2, price: "$21.00", variation: "Red" },
        ],
        shippingAddress: "123 Main St",
      });

      expect(mockSetApiKey).toHaveBeenCalledWith("SG.test-key");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@test.com",
          subject: expect.stringContaining("ABC1234"),
        }),
      );
    });

    it("logs error but does not throw on send failure", async () => {
      process.env.SENDGRID_API_KEY = "SG.test-key";
      vi.resetModules();
      const { sendOrderConfirmationEmail: freshSend } = await import("@/lib/email");
      mockSend.mockRejectedValue(new Error("SendGrid down"));

      await expect(
        freshSend({
          to: "user@test.com",
          customerName: "Jane",
          orderId: "abc1234",
          totalAmount: "$42.00",
          items: [{ name: "Widget", quantity: 1, price: "$42.00" }],
          shippingAddress: "123 Main St",
        }),
      ).resolves.toBeUndefined();

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: "email_send_failed" }),
      );
    });
  });

  describe("sendOrderStatusUpdateEmail", () => {
    it("sends status update email for SHIPPED with tracking", async () => {
      process.env.SENDGRID_API_KEY = "SG.test-key";
      vi.resetModules();
      const { sendOrderStatusUpdateEmail: freshSend } = await import("@/lib/email");
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      await freshSend({
        to: "user@test.com",
        customerName: "Jane",
        orderId: "abc1234",
        status: "SHIPPED",
        trackingNumber: "TRK123456",
        shippingProvider: "FedEx",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@test.com",
          html: expect.stringContaining("TRK123456"),
        }),
      );
    });

    it("sends status update without tracking for DELIVERED", async () => {
      process.env.SENDGRID_API_KEY = "SG.test-key";
      vi.resetModules();
      const { sendOrderStatusUpdateEmail: freshSend } = await import("@/lib/email");
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      await freshSend({
        to: "user@test.com",
        customerName: "Jane",
        orderId: "abc1234",
        status: "DELIVERED",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Delivered"),
        }),
      );
    });

    it("falls back gracefully for unknown status", async () => {
      process.env.SENDGRID_API_KEY = "SG.test-key";
      vi.resetModules();
      const { sendOrderStatusUpdateEmail: freshSend } = await import("@/lib/email");
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      await freshSend({
        to: "user@test.com",
        customerName: "Jane",
        orderId: "abc1234",
        status: "UNKNOWN_STATUS",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("UNKNOWN_STATUS"),
        }),
      );
    });

    it("skips email when no API key", async () => {
      delete process.env.SENDGRID_API_KEY;
      vi.resetModules();
      const { sendOrderStatusUpdateEmail: freshSend } = await import("@/lib/email");

      await freshSend({
        to: "user@test.com",
        customerName: "Jane",
        orderId: "abc1234",
        status: "CANCELLED",
      });

      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
