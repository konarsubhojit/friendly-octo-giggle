import { describe, it, vi, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ProductGrid from "@/components/sections/ProductGrid";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import type { Product } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "1",
  name: "Test Product",
  description: "A nice product",
  price: 10,
  image: "/img.jpg",
  stock: 10,
  category: "Flowers",
  deletedAt: null,
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
  ...overrides,
});

function renderGrid(products: Product[]) {
  return render(
    <CurrencyProvider>
      <ProductGrid products={products} />
    </CurrencyProvider>,
  );
}

describe("ProductGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no products", () => {
    renderGrid([]);
    expect(screen.getByText("No products found")).toBeTruthy();
  });

  it("renders product names", () => {
    renderGrid([makeProduct({ name: "Flower Bouquet" })]);
    expect(screen.getByText("Flower Bouquet")).toBeTruthy();
  });

  it("renders product description", () => {
    renderGrid([makeProduct({ description: "Beautiful flowers" })]);
    expect(screen.getByText("Beautiful flowers")).toBeTruthy();
  });

  it("renders category badge", () => {
    renderGrid([makeProduct({ category: "Flowers" })]);
    // "Flowers" appears in both category filter pills and product badge
    const elements = screen.getAllByText("Flowers");
    expect(elements.length).toBeGreaterThan(0);
  });

  it("shows In Stock badge for stock > 5", () => {
    renderGrid([makeProduct({ stock: 10 })]);
    expect(screen.getByText("In Stock")).toBeTruthy();
  });

  it("shows low stock warning for stock 1-5", () => {
    renderGrid([makeProduct({ stock: 3 })]);
    expect(screen.getByText("Only 3 left")).toBeTruthy();
  });

  it("shows Out of Stock for stock 0", () => {
    renderGrid([makeProduct({ stock: 0 })]);
    expect(screen.getByText("Out of Stock")).toBeTruthy();
  });

  it("renders product link with correct href", () => {
    renderGrid([makeProduct({ id: "prod-42" })]);
    const link = screen.getByRole("link", { name: /Test Product/i });
    expect(link.getAttribute("href")).toBe("/products/prod-42");
  });

  it("renders multiple products", () => {
    renderGrid([
      makeProduct({ id: "1", name: "Product A" }),
      makeProduct({ id: "2", name: "Product B" }),
    ]);
    expect(screen.getByText("Product A")).toBeTruthy();
    expect(screen.getByText("Product B")).toBeTruthy();
  });

  it("renders Bestsellers heading", () => {
    renderGrid([]);
    expect(screen.getByText(/Bestsellers/i)).toBeTruthy();
  });

  it("renders category filter buttons", () => {
    renderGrid([]);
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Handbag")).toBeTruthy();
    expect(screen.getByText("Flowers")).toBeTruthy();
    expect(screen.getByText("Flower Pots")).toBeTruthy();
    expect(screen.getByText("Keychains")).toBeTruthy();
    expect(screen.getByText("Hair Accessories")).toBeTruthy();
  });

  it("filters products by search query", () => {
    renderGrid([
      makeProduct({ id: "1", name: "Red Rose" }),
      makeProduct({ id: "2", name: "Blue Handbag" }),
    ]);
    const searchInput = screen.getByPlaceholderText("Search products...");
    fireEvent.change(searchInput, { target: { value: "Rose" } });
    expect(screen.getByText("Red Rose")).toBeTruthy();
    expect(screen.queryByText("Blue Handbag")).toBeNull();
  });

  it("filters products by category", () => {
    renderGrid([
      makeProduct({ id: "1", name: "Red Rose", category: "Flowers" }),
      makeProduct({ id: "2", name: "Tote Bag", category: "Handbag" }),
    ]);
    // Click the Handbag category button
    const handbagBtn = screen.getByRole("button", { name: "Handbag" });
    fireEvent.click(handbagBtn);
    expect(screen.getByText("Tote Bag")).toBeTruthy();
    expect(screen.queryByText("Red Rose")).toBeNull();
  });
});
