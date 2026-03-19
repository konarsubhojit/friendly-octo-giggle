import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import VariationList from "@/components/admin/VariationList";
import type { ProductVariation } from "@/lib/types";

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({
    formatPrice: (n: number) => `$${n.toFixed(2)}`,
    currency: "USD",
    availableCurrencies: ["USD"],
    rates: { USD: 1 },
    setCurrency: vi.fn(),
  }),
}));

const mockVariation: ProductVariation = {
  id: "var1234",
  productId: "abc1234",
  name: "Red - Large",
  designName: "Classic Logo",
  image: "https://example.com/red.jpg",
  images: [],
  priceModifier: 5.0,
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
    expect(screen.getByText("Stock: 25")).toBeInTheDocument();
    expect(screen.getByText("Variations (1)")).toBeInTheDocument();
  });

  it("displays effective price", () => {
    render(
      <VariationList
        productId="abc1234"
        productPrice={29.99}
        initialVariations={[mockVariation]}
      />,
    );
    // Effective price = 29.99 + 5.0 = 34.99
    expect(screen.getByText("$34.99")).toBeInTheDocument();
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
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
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
});
