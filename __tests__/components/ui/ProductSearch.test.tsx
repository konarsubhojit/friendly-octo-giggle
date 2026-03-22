import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import React from "react";
import ProductSearch from "@/components/ui/ProductSearch";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({ formatPrice: (p: number) => `₹${p}` }),
}));

interface MockProduct {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly price: number;
  readonly image: string;
  readonly deletedAt?: string | null;
}

const MOCK_PRODUCTS: readonly MockProduct[] = [
  {
    id: "prod001",
    name: "Crochet Bag",
    description: "A handmade bag",
    category: "Handbag",
    price: 500,
    image: "/bag.jpg",
    deletedAt: null,
  },
  {
    id: "prod002",
    name: "Flower Keychain",
    description: "Cute keychain",
    category: "Keychain",
    price: 150,
    image: "/key.jpg",
    deletedAt: null,
  },
];

function createSearchResponse(
  products: readonly MockProduct[] = MOCK_PRODUCTS,
) {
  return vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const requestUrl = typeof input === "string" ? input : input.toString();
    const url = new URL(requestUrl, "http://localhost");
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const filteredProducts = products.filter((product) => {
      if (product.deletedAt) {
        return false;
      }

      const searchableText =
        `${product.name} ${product.category} ${product.description}`.toLowerCase();
      return searchableText.includes(query);
    });

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ results: filteredProducts }),
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", createSearchResponse());
});

describe("ProductSearch", () => {
  it("renders the trigger button", () => {
    render(<ProductSearch />);
    expect(
      screen.getByRole("button", { name: "Search products" }),
    ).toBeTruthy();
    expect(screen.getByText("Search products...")).toBeTruthy();
  });

  it("opens dialog when trigger button is clicked", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() => {
      expect(
        screen.getByRole("search", { name: "Product search" }),
      ).toBeTruthy();
    });
  });

  it("renders dialog via portal in document.body", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() => {
      expect(document.body.querySelector("[role='search']")).toBeTruthy();
    });
  });

  it("shows placeholder text when dialog is open", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() => {
      expect(
        screen.getByText("Start typing to search products..."),
      ).toBeTruthy();
    });
  });

  it("closes dialog on Escape key", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("search", { name: "Product search" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("search", { name: "Product search" }),
      ).toBeNull();
    });
  });

  it("closes dialog when close button is clicked", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("search", { name: "Product search" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.click(
        screen.getAllByRole("button", { name: "Close search" })[0],
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("search", { name: "Product search" }),
      ).toBeNull();
    });
  });

  it("filters results based on query", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("searchbox", { name: "Search products" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search products" }),
        {
          target: { value: "bag" },
        },
      );
    });
    await waitFor(
      () => {
        expect(
          screen.getByRole("button", { name: /Crochet Bag/i }),
        ).toBeTruthy();
        expect(
          screen.queryByRole("button", { name: /Flower Keychain/i }),
        ).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it("shows no-results message when query has no match", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("searchbox", { name: "Search products" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search products" }),
        {
          target: { value: "xyznotexist" },
        },
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/No products found/)).toBeTruthy();
    });
  });

  it("highlights repeated matches consistently", async () => {
    vi.stubGlobal(
      "fetch",
      createSearchResponse([
        {
          id: "prod-repeat",
          name: "Bag Bag",
          description: "Repeated bag match",
          category: "Bags",
          price: 200,
          image: "/repeat.jpg",
          deletedAt: null,
        },
      ]),
    );

    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("searchbox", { name: "Search products" }),
      ).toBeTruthy(),
    );

    act(() => {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search products" }),
        {
          target: { value: "bag" },
        },
      );
    });

    await waitFor(() => {
      const title = screen.getByText("Bag Bag", { selector: "p" });
      expect(title.querySelectorAll("mark")).toHaveLength(2);
    });
  });

  it("navigates to product page when result is clicked", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("searchbox", { name: "Search products" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search products" }),
        {
          target: { value: "bag" },
        },
      );
    });
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /Crochet Bag/i }),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Crochet Bag/i }));
    });
    expect(mockPush).toHaveBeenCalledWith("/products/prod001");
    await waitFor(() => {
      expect(
        screen.queryByRole("search", { name: "Product search" }),
      ).toBeNull();
    });
  });

  it("calls onNavigate when a result is clicked", async () => {
    const onNavigate = vi.fn();
    render(<ProductSearch onNavigate={onNavigate} />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("searchbox", { name: "Search products" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search products" }),
        {
          target: { value: "bag" },
        },
      );
    });
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /Crochet Bag/i }),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Crochet Bag/i }));
    });
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("does not call onNavigate when dialog closes without selecting", async () => {
    const onNavigate = vi.fn();
    render(<ProductSearch onNavigate={onNavigate} />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("search", { name: "Product search" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("opens dialog with Cmd+K shortcut", async () => {
    render(<ProductSearch />);
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    await waitFor(() => {
      expect(
        screen.getByRole("search", { name: "Product search" }),
      ).toBeTruthy();
    });
  });

  it("excludes deleted products from results", async () => {
    vi.stubGlobal(
      "fetch",
      createSearchResponse([
        ...MOCK_PRODUCTS,
        {
          id: "prod003",
          name: "Deleted Item",
          description: "gone",
          category: "Other",
          price: 100,
          image: "/del.jpg",
          deletedAt: "2024-01-01",
        },
      ]),
    );
    render(<ProductSearch />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Search products" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("search", { name: "Product search" }),
      ).toBeTruthy(),
    );
    act(() => {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search products" }),
        {
          target: { value: "deleted" },
        },
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Deleted Item")).toBeNull();
      expect(screen.getByText(/No products found/)).toBeTruthy();
    });
  });
});
