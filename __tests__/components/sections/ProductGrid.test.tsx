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
  default: ({
    alt,
    src,
    loading,
    fetchPriority,
  }: {
    alt: string;
    src: string;
    loading?: string;
    fetchPriority?: string;
  }) => (
    <img
      alt={alt}
      src={src}
      data-loading={loading}
      data-fetch-priority={fetchPriority}
    />
  ),
}));

const mockDispatch = vi.fn();

vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: vi.fn(() => []),
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

let intersectionCallback: IntersectionObserverCallback | null = null;

const mockIntersectionObserver = vi.fn(function (
  this: unknown,
  callback: IntersectionObserverCallback,
) {
  intersectionCallback = callback;
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});

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
    intersectionCallback = null;
    mockDispatch.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          rates: { INR: 83.12, USD: 1, EUR: 0.92, GBP: 0.79 },
        }),
      })),
    );
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

  it("eager loads the first visible product row for faster LCP", () => {
    renderGrid([
      makeProduct({ id: "1", name: "Product A", image: "/a.jpg" }),
      makeProduct({ id: "2", name: "Product B", image: "/b.jpg" }),
      makeProduct({ id: "3", name: "Product C", image: "/c.jpg" }),
      makeProduct({ id: "4", name: "Product D", image: "/d.jpg" }),
    ]);

    const firstImage = screen.getByAltText("Product A");
    const secondImage = screen.getByAltText("Product B");
    const thirdImage = screen.getByAltText("Product C");
    const fourthImage = screen.getByAltText("Product D");

    expect(firstImage).toHaveAttribute("data-loading", "eager");
    expect(firstImage).toHaveAttribute("data-fetch-priority", "high");
    expect(secondImage).toHaveAttribute("data-loading", "eager");
    expect(thirdImage).toHaveAttribute("data-loading", "eager");
    expect(fourthImage).not.toHaveAttribute("data-loading", "eager");
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

  it("shows the product count and sets up IntersectionObserver when more products are available", () => {
    renderGrid([makeProduct()], ["Flowers"], {
      search: "rose",
      selectedCategory: "Flowers",
      hasNextPage: true,
      batchSize: 20,
    });

    expect(screen.getByText("Showing 1 product so far")).toBeTruthy();
    expect(mockIntersectionObserver).toHaveBeenCalled();
  });

  it("loads another batch of products from the API via infinite scroll", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).startsWith("/api/products")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              products: [
                toGridItem(makeProduct({ id: "2", name: "Loaded Product" })),
              ],
              hasMore: false,
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          rates: { INR: 83.12, USD: 1, EUR: 0.92, GBP: 0.79 },
        }),
      } as Response;
    });

    renderGrid([makeProduct()], ["Flowers"], {
      search: "rose",
      selectedCategory: "Flowers",
      hasNextPage: true,
      batchSize: 20,
    });

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Loaded Product")).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/products?q=rose&category=Flowers&limit=20&offset=1",
      { method: "GET", headers: { Accept: "application/json" } },
    );
    expect(
      screen.getByText("You've seen all products."),
    ).toBeTruthy();
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
