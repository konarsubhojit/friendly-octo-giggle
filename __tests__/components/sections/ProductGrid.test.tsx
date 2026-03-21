import { describe, it, vi, expect, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import React from "react";
import ProductGrid from "@/components/sections/ProductGrid";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import type { Product } from "@/lib/types";
import toast from "react-hot-toast";
import type { ProductGridItem } from "@/components/sections/ProductGrid";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    href: string;
    "aria-label"?: string;
  }) => (
    <a href={href} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const mockDispatch = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: vi.fn(() => []),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const makeProduct = (overrides: Partial<Product> = {}): Product => {
  const product = {
    id: "1",
    name: "Test Product",
    description: "A nice product",
    price: 10,
    image: "/img.jpg",
    images: [],
    stock: 10,
    category: "Flowers",
    deletedAt: null,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    ...overrides,
  };

  return {
    ...product,
    images: product.images ?? [],
  };
};

const toGridItem = (product: Product): ProductGridItem => ({
  id: product.id,
  name: product.name,
  description: product.description,
  price: product.price,
  image: product.image,
  stock: product.stock,
  category: product.category,
});

const ALL_CATEGORIES = [
  "Handbag",
  "Flowers",
  "Flower Pots",
  "Keychains",
  "Hair Accessories",
];

function renderGrid(
  products: Product[],
  categories?: string[],
  props?: Partial<React.ComponentProps<typeof ProductGrid>>,
) {
  return render(
    <CurrencyProvider>
      <ProductGrid
        products={products.map(toGridItem)}
        categories={categories}
        {...props}
      />
    </CurrencyProvider>,
  );
}

describe("ProductGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch.mockReturnValue({ unwrap: () => Promise.resolve({}) });
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

  it("renders category in filter dropdown", () => {
    renderGrid([makeProduct({ category: "Flowers" })], ["Flowers"]);
    const select = screen.getByRole("combobox", {
      name: /filter by category/i,
    });
    expect(select).toBeTruthy();
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
    renderGrid([makeProduct({ id: "prod-42", name: "My Product" })]);
    const link = screen.getByRole("link", { name: /My Product/i });
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

  it("renders all products heading", () => {
    renderGrid([]);
    expect(screen.getByText(/All Products/i)).toBeTruthy();
  });
  it("renders category filter dropdown with all options", () => {
    renderGrid([], ALL_CATEGORIES);
    const select = screen.getByRole("combobox", {
      name: /filter by category/i,
    });
    expect(select).toBeTruthy();
    expect(screen.getByRole("option", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Handbag" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Flowers" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Flower Pots" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Keychains" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Hair Accessories" }),
    ).toBeTruthy();
  });

  it("filters products by search query", () => {
    renderGrid([makeProduct()], undefined, { search: "Rose" });
    expect(screen.getByDisplayValue("Rose")).toBeTruthy();
  });

  it("filters products by category", () => {
    renderGrid([makeProduct({ category: "Handbag" })], ["Flowers", "Handbag"], {
      selectedCategory: "Handbag",
    });
    const select = screen.getByRole("combobox", {
      name: /filter by category/i,
    });
    expect(select).toHaveValue("Handbag");
  });

  it("shows contextual empty message when search yields no results", () => {
    renderGrid([], undefined, { search: "xyz-no-match" });
    expect(
      screen.getByText(/Try adjusting your search or category filter/i),
    ).toBeTruthy();
  });

  it("renders next page link with current filters", () => {
    renderGrid([makeProduct()], ["Flowers"], {
      search: "rose",
      selectedCategory: "Flowers",
      page: 2,
      totalCount: 50,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    expect(
      screen.getByRole("link", { name: /Next/i }).getAttribute("href"),
    ).toBe("/shop?q=rose&category=Flowers&page=3#products");
    expect(
      screen.getByRole("link", { name: /Previous/i }).getAttribute("href"),
    ).toBe("/shop?q=rose&category=Flowers#products");
    expect(
      screen.getByRole("link", { name: /First/i }).getAttribute("href"),
    ).toBe("/shop?q=rose&category=Flowers#products");
    expect(
      screen.getByRole("link", { name: /Last/i }).getAttribute("href"),
    ).toBe("/shop?q=rose&category=Flowers&page=3#products");
    expect(screen.getByText("Showing 25-48 of 50")).toBeTruthy();
  });

  it("navigates with the quick page selector", () => {
    renderGrid([makeProduct()], ["Flowers"], {
      search: "rose",
      selectedCategory: "Flowers",
      page: 1,
      totalCount: 50,
      hasNextPage: true,
    });

    fireEvent.change(screen.getByRole("combobox", { name: /jump to page/i }), {
      target: { value: "3" },
    });

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/shop?q=rose&category=Flowers&page=3#products",
    );
  });
  it("renders quick add button for in-stock product", () => {
    renderGrid([makeProduct({ stock: 5 })]);
    const btn = screen.getByRole("button", {
      name: /Add Test Product to cart/i,
    });
    expect(btn).toBeTruthy();
  });

  it("does NOT render quick add button for out-of-stock product", () => {
    renderGrid([makeProduct({ stock: 0 })]);
    expect(screen.queryByRole("button", { name: /Add.*to cart/i })).toBeNull();
  });

  it("quick add button dispatches addToCart and shows success toast", async () => {
    mockDispatch.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    renderGrid([makeProduct({ id: "p1", name: "Flower Bouquet", stock: 5 })]);

    const addBtn = screen.getByRole("button", {
      name: /Add Flower Bouquet to cart/i,
    });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(vi.mocked(toast).success).toHaveBeenCalledWith(
        "Flower Bouquet added to cart!",
      );
    });
  });

  it("quick add button shows error toast when dispatch fails", async () => {
    mockDispatch.mockReturnValue({
      unwrap: () => Promise.reject(new Error("Out of stock")),
    });
    renderGrid([makeProduct({ id: "p2", name: "Test Bag", stock: 3 })]);

    const addBtn = screen.getByRole("button", {
      name: /Add Test Bag to cart/i,
    });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    await waitFor(() => {
      expect(vi.mocked(toast).error).toHaveBeenCalledWith(
        "Failed to add to cart. Please try again.",
      );
    });
  });

  it("quick add button is disabled while adding", async () => {
    let resolveAdd!: () => void;
    const pendingPromise = new Promise<void>((res) => {
      resolveAdd = res;
    });
    mockDispatch.mockReturnValue({ unwrap: () => pendingPromise });

    renderGrid([makeProduct({ stock: 5 })]);
    const btn = screen.getByRole("button", {
      name: /Add Test Product to cart/i,
    });

    fireEvent.click(btn);
    expect(btn).toBeDisabled();

    await act(async () => {
      resolveAdd();
    });
  });
});
