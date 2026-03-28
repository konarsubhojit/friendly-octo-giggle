import { describe, expect, it } from "vitest";
import {
  CHECKOUT_POLICIES,
  CHECKOUT_POLICY_ACKNOWLEDGMENT,
  CHECKOUT_POLICY_ERROR_MESSAGE,
  SUPPORT_EMAIL,
} from "@/lib/constants/checkout-policies";

describe("checkout policies", () => {
  it("uses the canonical support email", () => {
    expect(SUPPORT_EMAIL).toBe("support@estore.example.com");
  });

  it("includes the no-cancellation-after-shipment rule", () => {
    expect(CHECKOUT_POLICIES.cancellation.items.join(" ")).toContain(
      "cannot be cancelled and no refund will be issued",
    );
  });

  it("includes the damaged-only return exception", () => {
    expect(CHECKOUT_POLICIES.returns.items.join(" ")).toContain(
      "cannot be returned unless the product is received in damaged condition",
    );
    expect(CHECKOUT_POLICIES.returns.items.join(" ")).toContain("short video");
  });

  it("includes the no-refund and replacement guidance", () => {
    expect(CHECKOUT_POLICIES.refunds.items.join(" ")).toContain(
      "Refunds are not issued",
    );
    expect(CHECKOUT_POLICIES.refunds.items.join(" ")).toContain(
      "replacement rather than refund",
    );
  });

  it("includes damaged-item contact and shipping responsibilities", () => {
    const damagedItems = CHECKOUT_POLICIES.damagedItems.items.join(" ");
    expect(damagedItems).toContain(SUPPORT_EMAIL);
    expect(damagedItems).toContain("short video");
    expect(damagedItems).toContain(
      "shipping cost to send the damaged product back",
    );
    expect(damagedItems).toContain("replacement product");
  });

  it("defines the acknowledgment and fallback error messages", () => {
    expect(CHECKOUT_POLICY_ACKNOWLEDGMENT).toContain("reviewed");
    expect(CHECKOUT_POLICY_ERROR_MESSAGE).toContain("unavailable");
  });
});
