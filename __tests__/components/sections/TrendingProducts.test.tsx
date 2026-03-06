import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import TrendingProducts from "@/components/sections/TrendingProducts";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

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

function renderTrending() {
  return render(
    <CurrencyProvider>
      <TrendingProducts />
    </CurrencyProvider>,
  );
}

const mockProduct = (id: string, name: string) => ({
  id,
  name,
  description: "Great product",
  price: 15,
  image: "/img.jpg",
  stock: 5,
  category: "Accessories",
  totalSold: 50,
  deletedAt: null,
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
});

describe("TrendingProducts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading skeleton initially", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderTrending();
    expect(screen.getByText("🔥 Trending Now")).toBeTruthy();
    // Skeleton pulse divs should exist
    const { container } = renderTrending();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders trending products when fetch succeeds (data.data.products)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              products: [
                mockProduct("1", "Trending Item"),
              ],
            },
          }),
      }),
    );
    renderTrending();
    await waitFor(() => {
      expect(screen.getAllByText("Trending Item").length).toBeGreaterThan(0);
    });
  });

  it("renders trending products when fetch succeeds (data.products)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            products: [mockProduct("2", "Popular Item")],
          }),
      }),
    );
    renderTrending();
    await waitFor(() => {
      expect(screen.getAllByText("Popular Item").length).toBeGreaterThan(0);
    });
  });

  it("renders nothing when no products returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { products: [] } }),
      }),
    );
    const { container } = renderTrending();
    await waitFor(() => {
      // The trending section should not render when products is empty
      expect(container.querySelector("#trending")).toBeNull();
    });
  });

  it("renders nothing when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const { container } = renderTrending();
    await waitFor(() => {
      expect(container.querySelector("#trending")).toBeNull();
    });
  });

  it("renders nothing when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      }),
    );
    const { container } = renderTrending();
    await waitFor(() => {
      expect(container.querySelector("#trending")).toBeNull();
    });
  });

  it("shows trending rank badge for first 3 products", async () => {
    const products = [
      mockProduct("1", "First"),
      mockProduct("2", "Second"),
      mockProduct("3", "Third"),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { products } }),
      }),
    );
    renderTrending();
    await waitFor(() => {
      expect(screen.getByText("#1 Trending")).toBeTruthy();
      expect(screen.getByText("#2 Trending")).toBeTruthy();
      expect(screen.getByText("#3 Trending")).toBeTruthy();
    });
  });
});
