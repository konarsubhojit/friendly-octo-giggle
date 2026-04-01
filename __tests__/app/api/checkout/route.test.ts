import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/checkout/route";
import { GET } from "@/app/api/checkout/[id]/route";

const mockAuth = vi.hoisted(() => vi.fn());
const mockEnqueueCheckoutForUser = vi.hoisted(() => vi.fn());
const mockGetCheckoutRequestStatusForUser = vi.hoisted(() => vi.fn());
const mockIsCheckoutRequestError = vi.hoisted(() => vi.fn());
const mockLogBusinessEvent = vi.hoisted(() => vi.fn());
const mockLogError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-middleware", () => ({
  withLogging: vi.fn((handler) => handler),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/features/cart/services/checkout-service", () => ({
  enqueueCheckoutForUser: mockEnqueueCheckoutForUser,
  getCheckoutRequestStatusForUser: mockGetCheckoutRequestStatusForUser,
  isCheckoutRequestError: mockIsCheckoutRequestError,
}));

vi.mock("@/lib/logger", () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: mockLogError,
}));

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCheckoutRequestError.mockReturnValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Authentication required");
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "checkout_request_failed",
        details: { reason: "not_authenticated" },
        success: false,
      }),
    );
  });

  it("returns 202 when checkout is enqueued", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    });
    mockEnqueueCheckoutForUser.mockResolvedValue({
      checkoutRequestId: "CHK1234",
      status: "PENDING",
    });

    const body = {
      customerAddress: "123 Test Street, Kolkata, 700001",
      items: [{ productId: "ABC1234", quantity: 1 }],
    };

    const response = await POST(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.checkoutRequestId).toBe("CHK1234");
    expect(mockEnqueueCheckoutForUser).toHaveBeenCalledWith({
      body,
      user: {
        id: "user1",
        name: "Test",
        email: "test@example.com",
      },
    });
  });

  it("returns validation errors from the checkout service", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    });
    mockEnqueueCheckoutForUser.mockRejectedValue({
      message: "At least one item is required",
      status: 400,
    });
    mockIsCheckoutRequestError.mockReturnValue(true);

    const response = await POST(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          customerAddress: "123 Test Street, Kolkata, 700001",
          items: [],
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("At least one item is required");
  });

  it("returns 500 on unexpected errors", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    });
    mockEnqueueCheckoutForUser.mockRejectedValue(
      new Error("Queue unavailable"),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          customerAddress: "123 Test Street, Kolkata, 700001",
          items: [{ productId: "ABC1234", quantity: 1 }],
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create checkout request");
    expect(mockLogError).toHaveBeenCalled();
  });
});

describe("GET /api/checkout/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCheckoutRequestError.mockReturnValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/checkout/CHK1234"),
      { params: Promise.resolve({ id: "CHK1234" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns checkout request status for the signed-in user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    });
    mockGetCheckoutRequestStatusForUser.mockResolvedValue({
      checkoutRequestId: "CHK1234",
      status: "COMPLETED",
      orderId: "ORD12345",
      error: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/checkout/CHK1234"),
      { params: Promise.resolve({ id: "CHK1234" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      checkoutRequestId: "CHK1234",
      status: "COMPLETED",
      orderId: "ORD12345",
      error: null,
    });
    expect(mockGetCheckoutRequestStatusForUser).toHaveBeenCalledWith({
      checkoutRequestId: "CHK1234",
      userId: "user1",
    });
  });

  it("returns request-specific errors", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    });
    mockGetCheckoutRequestStatusForUser.mockRejectedValue({
      message: "Checkout request not found",
      status: 404,
    });
    mockIsCheckoutRequestError.mockReturnValue(true);

    const response = await GET(
      new NextRequest("http://localhost/api/checkout/CHK4040"),
      { params: Promise.resolve({ id: "CHK4040" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Checkout request not found");
  });
});
