import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import cartReducer from "@/lib/features/cart/cartSlice";

const mockPush = vi.fn();
const mockPost = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: (message: string) => mockToastSuccess(message),
    error: (message: string) => mockToastError(message),
  },
}));

vi.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `₹${amount}` }),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const mockCart = {
  id: "cart0001",
  userId: "user-1",
  sessionId: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  items: [
    {
      id: "citem0001",
      cartId: "cart0001",
      productId: "prd0001",
      variationId: "var0001",
      quantity: 2,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      customizationNote: null,
      product: {
        id: "prd0001",
        name: "Hand-knitted Flower Bouquet",
        description: "Bouquet",
        price: 1499,
        image: "/flower.jpg",
        images: [],
        stock: 10,
        category: "Flowers",
        deletedAt: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      variation: {
        id: "var0001",
        productId: "prd0001",
        name: "Small (15 cm)",
        designName: "Rose Red",
        image: null,
        images: [],
        priceModifier: 0,
        stock: 10,
        deletedAt: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    },
  ],
};

function renderCheckoutForm() {
  const store = configureStore({
    reducer: {
      cart: cartReducer,
    },
    preloadedState: {
      cart: {
        cart: mockCart,
        loading: false,
        lastFetchedAt: Date.now(),
        error: null,
        stockWarning: null,
        adjustedQuantity: null,
      },
    },
  });

  return render(
    <Provider store={store}>
      <CheckoutForm customizationNotes={{ citem0001: "Use a satin ribbon" }} />
    </Provider>,
  );
}

describe("CheckoutForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          name: "Alice",
          email: "alice@example.com",
        },
        expires: "",
      },
      status: "authenticated",
      update: vi.fn(),
    });
    mockPost.mockResolvedValue({
      checkoutRequestId: "chk_1",
      status: "PENDING",
    });
    mockGet.mockResolvedValue({
      checkoutRequestId: "chk_1",
      status: "COMPLETED",
      orderId: "ord_1",
      error: null,
    });
    mockDelete.mockResolvedValue({ success: true });
  });

  it("opens the review dialog and does not submit before confirmation", async () => {
    renderCheckoutForm();

    fireEvent.change(screen.getByLabelText(/shipping address/i), {
      target: { value: "42 MG Road, Bengaluru, Karnataka 560001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("submits only after acknowledgment and confirm action", async () => {
    renderCheckoutForm();

    fireEvent.change(screen.getByLabelText(/shipping address/i), {
      target: { value: "42 MG Road, Bengaluru, Karnataka 560001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: /confirm and place order/i }),
    );

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/checkout", {
        customerName: "Alice",
        customerEmail: "alice@example.com",
        customerAddress: "42 MG Road, Bengaluru, Karnataka 560001",
        items: [
          {
            productId: "prd0001",
            variationId: "var0001",
            quantity: 2,
            customizationNote: "Use a satin ribbon",
          },
        ],
      });
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Order ord_1 placed successfully!",
      );
      expect(mockPush).toHaveBeenCalledWith("/orders");
    });
  });

  it("redirects unauthenticated users to sign in", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    renderCheckoutForm();
    fireEvent.change(screen.getByLabelText(/shipping address/i), {
      target: { value: "42 MG Road, Bengaluru, Karnataka 560001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(mockPush).toHaveBeenCalledWith("/auth/signin?callbackUrl=/cart");
    expect(mockPost).not.toHaveBeenCalled();
  });
});
