import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  orderConfirmationTemplate,
  orderStatusUpdateTemplate,
} from "@/lib/email/templates";
import type {
  OrderConfirmationData,
  OrderStatusUpdateData,
} from "@/lib/email/templates";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"double" and \'single\'')).toBe(
      "&quot;double&quot; and &#39;single&#39;",
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles multiple special chars", () => {
    expect(escapeHtml("<b>Tom & Jerry's \"show\"</b>")).toBe(
      "&lt;b&gt;Tom &amp; Jerry&#39;s &quot;show&quot;&lt;/b&gt;",
    );
  });
});

describe("orderConfirmationTemplate", () => {
  const data: OrderConfirmationData = {
    to: "customer@example.com",
    customerName: "Alice",
    orderId: "ORDabc1234",
    totalAmount: "₹2,499.00",
    items: [
      { name: "Handmade Basket", quantity: 2, price: "₹999.00" },
      {
        name: "Candle Set",
        quantity: 1,
        price: "₹501.00",
        variation: "Rose Gold",
      },
    ],
    shippingAddress: "123 Main St\nBangalore, KA 560001",
  };

  it("returns subject with order ID", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.subject).toContain("ORDABC1234");
    expect(result.subject).toContain("Order Confirmed");
  });

  it("HTML contains customer name", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.html).toContain("Alice");
  });

  it("HTML contains order ID", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.html).toContain("ORDABC1234");
  });

  it("HTML contains item names", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.html).toContain("Handmade Basket");
    expect(result.html).toContain("Candle Set");
  });

  it("HTML contains variation info", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.html).toContain("Rose Gold");
  });

  it("HTML contains total amount", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.html).toContain("₹2,499.00");
  });

  it("HTML contains shipping address", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.html).toContain("123 Main St");
  });

  it("returns plain text version", () => {
    const result = orderConfirmationTemplate(data);
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("ORDABC1234");
    expect(result.text).toContain("Handmade Basket x2");
    expect(result.text).toContain("(Rose Gold)");
  });

  it("escapes HTML in customer name", () => {
    const xssData = { ...data, customerName: "<script>alert(1)</script>" };
    const result = orderConfirmationTemplate(xssData);
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });
});

describe("orderStatusUpdateTemplate", () => {
  const data: OrderStatusUpdateData = {
    to: "customer@example.com",
    customerName: "Bob",
    orderId: "ORDxyz5678",
    status: "SHIPPED",
    trackingNumber: "TRACK123",
    shippingProvider: "BlueDart",
  };

  it("returns subject with order ID and status label", () => {
    const result = orderStatusUpdateTemplate(data);
    expect(result.subject).toContain("ORDXYZ5678");
    expect(result.subject).toContain("Shipped");
  });

  it("HTML contains customer name", () => {
    const result = orderStatusUpdateTemplate(data);
    expect(result.html).toContain("Bob");
  });

  it("HTML includes tracking section for SHIPPED status", () => {
    const result = orderStatusUpdateTemplate(data);
    expect(result.html).toContain("Tracking Information");
    expect(result.html).toContain("TRACK123");
    expect(result.html).toContain("BlueDart");
  });

  it("omits tracking section for non-SHIPPED status", () => {
    const pendingData = { ...data, status: "PENDING" };
    const result = orderStatusUpdateTemplate(pendingData);
    expect(result.html).not.toContain("Tracking Information");
  });

  it("handles unknown status gracefully", () => {
    const unknownData = { ...data, status: "UNKNOWN_STATUS" };
    const result = orderStatusUpdateTemplate(unknownData);
    expect(result.html).toContain("UNKNOWN_STATUS");
  });

  it("plain text includes tracking when shipped", () => {
    const result = orderStatusUpdateTemplate(data);
    expect(result.text).toContain("Tracking: TRACK123");
    expect(result.text).toContain("Carrier: BlueDart");
  });

  it("plain text omits tracking when not shipped", () => {
    const deliveredData = {
      ...data,
      status: "DELIVERED",
      trackingNumber: null,
      shippingProvider: null,
    };
    const result = orderStatusUpdateTemplate(deliveredData);
    expect(result.text).not.toContain("Tracking:");
    expect(result.text).not.toContain("Carrier:");
  });

  it("handles all known statuses", () => {
    for (const status of [
      "PENDING",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ]) {
      const result = orderStatusUpdateTemplate({ ...data, status });
      expect(result.subject).toBeTruthy();
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
    }
  });
});
