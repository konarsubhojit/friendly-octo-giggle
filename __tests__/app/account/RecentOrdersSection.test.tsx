import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentOrdersSection } from "@/app/account/RecentOrdersSection";

describe("RecentOrdersSection", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads recent orders with compact product summaries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          orders: [
            {
              id: "ord0009",
              status: "SHIPPED",
              createdAt: "2026-03-20T10:30:00.000Z",
              items: [
                {
                  quantity: 1,
                  product: { name: "Rose Gift Box" },
                  variation: null,
                },
                {
                  quantity: 2,
                  product: { name: "Lily Vase" },
                  variation: null,
                },
                {
                  quantity: 1,
                  product: { name: "Tulip Candle" },
                  variation: null,
                },
              ],
            },
          ],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<RecentOrdersSection />);

    expect(
      await screen.findByText("Rose Gift Box, Lily Vase and 1 more", {}, {
        timeout: 15000,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Recent Orders")).toBeInTheDocument();
    expect(screen.getByText("4 items")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/orders",
    );
  }, 15000);
});
