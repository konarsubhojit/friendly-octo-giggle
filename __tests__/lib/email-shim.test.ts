import { describe, it, expect } from "vitest";

import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendEmail,
  escapeHtml,
} from "@/lib/email";

describe("lib/email re-export shim", () => {
  it("re-exports sendOrderConfirmationEmail", () => {
    expect(sendOrderConfirmationEmail).toBeDefined();
    expect(typeof sendOrderConfirmationEmail).toBe("function");
  });

  it("re-exports sendOrderStatusUpdateEmail", () => {
    expect(sendOrderStatusUpdateEmail).toBeDefined();
    expect(typeof sendOrderStatusUpdateEmail).toBe("function");
  });

  it("re-exports sendEmail", () => {
    expect(sendEmail).toBeDefined();
    expect(typeof sendEmail).toBe("function");
  });

  it("re-exports escapeHtml", () => {
    expect(escapeHtml).toBeDefined();
    expect(typeof escapeHtml).toBe("function");
  });
});
