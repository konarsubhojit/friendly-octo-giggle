import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerify,
  mockGetQStashReceiver,
  mockSendOrderConfirmationEmail,
  mockSendOrderStatusUpdateEmail,
  mockSaveFailedEmail,
  mockFindFirst,
  mockIsNonRetriableError,
} = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockGetQStashReceiver: vi.fn(),
  mockSendOrderConfirmationEmail: vi.fn(),
  mockSendOrderStatusUpdateEmail: vi.fn(),
  mockSaveFailedEmail: vi.fn().mockResolvedValue("mock-failed-id"),
  mockFindFirst: vi.fn(),
  mockIsNonRetriableError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/qstash", () => ({
  getQStashReceiver: mockGetQStashReceiver,
}));

vi.mock("@/lib/email", () => ({
  sendOrderConfirmationEmail: mockSendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail: mockSendOrderStatusUpdateEmail,
}));

vi.mock("@/lib/email/failed-emails", () => ({
  saveFailedEmail: mockSaveFailedEmail,
}));

vi.mock("@/lib/email/retry", () => ({
  isNonRetriableError: mockIsNonRetriableError,
  sendWithRetry: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/api-middleware", () => ({
  withApiLogging: (handler: (req: NextRequest) => Promise<Response>) =>
    handler,
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      failedEmails: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

const mockEnv = {
  QSTASH_CURRENT_SIGNING_KEY: undefined as string | undefined,
  QSTASH_NEXT_SIGNING_KEY: undefined as string | undefined,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

vi.mock("@/lib/env", () => ({
  get env() {
    return mockEnv;
  },
}));

const makeRequest = (body: unknown, signature?: string): NextRequest => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature) {
    headers["Upstash-Signature"] = signature;
    headers["Upstash-Message-Id"] = "msg-test-123";
  }
  return new NextRequest("http://localhost:3000/api/services/email", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

const validOrderCreatedBody = {
  type: "order.created",
  data: {
    orderId: "abc1234",
    customerEmail: "user@example.com",
    customerName: "Jane Doe",
    customerAddress: "123 Main St",
    totalAmount: 4999,
    items: [{ name: "Widget", quantity: 1, price: 4999 }],
  },
};

const validOrderStatusChangedBody = {
  type: "order.status_changed",
  data: {
    orderId: "abc1234",
    customerEmail: "user@example.com",
    customerName: "Jane Doe",
    newStatus: "SHIPPED",
    trackingNumber: "TRACK123",
    shippingProvider: "UPS",
  },
};

import { POST } from "@/app/api/services/email/route";

describe("POST /api/services/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQStashReceiver.mockReturnValue({ verify: mockVerify });
    mockFindFirst.mockResolvedValue(null);
    mockIsNonRetriableError.mockReturnValue(false);
    mockEnv.QSTASH_CURRENT_SIGNING_KEY = undefined;
    mockEnv.QSTASH_NEXT_SIGNING_KEY = undefined;
  });

  it("returns 200 for valid order.created event (no signing keys)", async () => {
    mockSendOrderConfirmationEmail.mockResolvedValue(undefined);
    const req = makeRequest(validOrderCreatedBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockSendOrderConfirmationEmail).toHaveBeenCalledOnce();
  });

  it("returns 200 for valid order.status_changed event", async () => {
    mockSendOrderStatusUpdateEmail.mockResolvedValue(undefined);
    const req = makeRequest(validOrderStatusChangedBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockSendOrderStatusUpdateEmail).toHaveBeenCalledOnce();
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost:3000/api/services/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid event type discriminant", async () => {
    const req = makeRequest({ type: "order.unknown", data: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with skipped:true for duplicate event", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing-id", status: "sent" });
    const req = makeRequest(validOrderCreatedBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.skipped).toBe(true);
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it("returns 401 when signature verification fails with signing keys set", async () => {
    mockEnv.QSTASH_CURRENT_SIGNING_KEY = "current-key";
    mockEnv.QSTASH_NEXT_SIGNING_KEY = "next-key";
    mockVerify.mockRejectedValue(new Error("Invalid signature"));
    const req = makeRequest(validOrderCreatedBody, "bad-signature");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when Upstash-Signature header is missing with signing keys set", async () => {
    mockEnv.QSTASH_CURRENT_SIGNING_KEY = "current-key";
    mockEnv.QSTASH_NEXT_SIGNING_KEY = "next-key";
    const req = makeRequest(validOrderCreatedBody);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 for transient email send error", async () => {
    mockIsNonRetriableError.mockReturnValue(false);
    mockSendOrderConfirmationEmail.mockRejectedValue(
      new Error("SMTP timeout"),
    );
    const req = makeRequest(validOrderCreatedBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 for non-retryable email send error", async () => {
    mockIsNonRetriableError.mockReturnValue(true);
    mockSendOrderConfirmationEmail.mockRejectedValue(
      new Error("invalid address"),
    );
    const req = makeRequest(validOrderCreatedBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockSaveFailedEmail).toHaveBeenCalledOnce();
  });
});
