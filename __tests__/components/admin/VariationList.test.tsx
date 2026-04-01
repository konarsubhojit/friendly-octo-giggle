import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import VariationList from "@/features/admin/components/VariationList";
import type { ProductVariation } from "@/lib/types";

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({
    formatPrice: (n: number) => `$${n.toFixed(2)}`,
    currency: "USD",
    availableCurrencies: ["USD"],
    rates: { INR: 1, USD: 1 },
    setCurrency: vi.fn(),
  }),
}));

const mockVariation: ProductVariation = {
  id: "var1234",
  productId: "abc1234",
  styleId: null,
  name: "Red - Large",
  designName: "Classic Logo",
  image: "https://example.com/red.jpg",
  images: [],
  price: 150,
  variationType: "colour" as const,
  stock: 25,
  deletedAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockVariationNoImage: ProductVariation = {
  ...mockVariation,
  id: "var5678",
  name: "Blue - Small",
  image: null,
};

describe("VariationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders empty state when no variations", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[]}
      />,
    );
    expect(screen.getByText("No variations yet")).toBeInTheDocument();
    expect(screen.getByText("Add Variation")).toBeInTheDocument();
  });

  it("renders variation cards with correct data", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );
    expect(screen.getByText("Red - Large")).toBeInTheDocument();
    expect(screen.getByText("Classic Logo")).toBeInTheDocument();
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(screen.getAllByText("25").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Variations (1)")).toBeInTheDocument();
  });

  it("displays variation price", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );
    // mockVariation.price = 150
    expect(screen.getByText("$150.00")).toBeInTheDocument();
  });

  it("shows placeholder for variations without image", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariationNoImage]}
      />,
    );
    expect(screen.getByText("Blue - Small")).toBeInTheDocument();
  });

  it("renders Edit and Delete buttons", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Open quick edit for Red - Large",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Red - Large" }),
    ).toBeInTheDocument();
  });

  it("renders Add Variation button when variations exist", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );
    expect(screen.getByText("Add Variation")).toBeInTheDocument();
  });

  it("keeps quick edit fields collapsed until edit is opened", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );

    expect(
      screen.queryByLabelText("Price for Red - Large"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Stock for Red - Large"),
    ).not.toBeInTheDocument();
  });

  it("expands quick edit fields when the edit action is clicked", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open quick edit for Red - Large",
      }),
    );

    expect(screen.getByLabelText("Price for Red - Large")).toBeInTheDocument();
    expect(screen.getByLabelText("Stock for Red - Large")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("saves inline quick edits for stock and price", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          variation: {
            ...mockVariation,
            stock: 30,
            price: 200,
            updatedAt: "2025-01-02T00:00:00.000Z",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open quick edit for Red - Large",
      }),
    );

    fireEvent.change(screen.getByLabelText("Price for Red - Large"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Stock for Red - Large"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/variations/var1234",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ price: 200, stock: 30 }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("30").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("$200.00")).toBeInTheDocument();
    });
  });
});
