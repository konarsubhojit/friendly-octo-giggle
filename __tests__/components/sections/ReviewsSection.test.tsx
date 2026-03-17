import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ReviewsSection } from "@/components/sections/ReviewsSection";

// Mock sub-components
vi.mock("@/components/ui/ReviewForm", () => ({
  ReviewForm: ({ productId }: { productId: string }) => (
    <div data-testid="review-form">ReviewForm for {productId}</div>
  ),
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

describe("ReviewsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows loading spinner initially", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<ReviewsSection productId="prod001" />);
    expect(screen.getByLabelText("Loading reviews")).toBeInTheDocument();
  });

  it("shows empty state when no reviews exist", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { reviews: [] } }),
    } as Response);

    render(<ReviewsSection productId="prod001" />);

    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });
  });

  it("renders reviews when data is fetched", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            reviews: [
              {
                id: "rev1",
                rating: 5,
                comment: "Excellent product!",
                isAnonymous: false,
                createdAt: "2024-01-15T10:00:00Z",
                user: { name: "Jane", image: null },
              },
            ],
          },
        }),
    } as Response);

    render(<ReviewsSection productId="prod001" />);

    await waitFor(() => {
      expect(screen.getByText("Excellent product!")).toBeInTheDocument();
      expect(screen.getByText("Jane")).toBeInTheDocument();
    });
  });

  it("shows Anonymous for anonymous reviews", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            reviews: [
              {
                id: "rev2",
                rating: 3,
                comment: "It was okay.",
                isAnonymous: true,
                createdAt: "2024-01-15T10:00:00Z",
                user: null,
              },
            ],
          },
        }),
    } as Response);

    render(<ReviewsSection productId="prod001" />);

    await waitFor(() => {
      expect(screen.getByText("Anonymous")).toBeInTheDocument();
    });
  });

  it("fetches reviews with correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { reviews: [] } }),
    } as Response);

    render(<ReviewsSection productId="prod001" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("productId=prod001"),
      );
    });
  });

  it("shows review form when 'Write a review' is clicked", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { reviews: [] } }),
    } as Response);

    render(<ReviewsSection productId="prod001" />);

    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Write a review"));

    expect(screen.getByTestId("review-form")).toBeInTheDocument();
  });

  it("renders rating summary for multiple reviews", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            reviews: [
              {
                id: "rev1",
                rating: 5,
                comment: "Great product!",
                isAnonymous: false,
                createdAt: "2024-01-15T10:00:00Z",
                user: { name: "Jane", image: null },
              },
              {
                id: "rev2",
                rating: 3,
                comment: "Average quality.",
                isAnonymous: false,
                createdAt: "2024-01-14T10:00:00Z",
                user: { name: "John", image: null },
              },
            ],
          },
        }),
    } as Response);

    render(<ReviewsSection productId="prod001" />);

    await waitFor(() => {
      // Average should be 4.0
      expect(screen.getByText("4.0")).toBeInTheDocument();
      expect(screen.getByText("2 reviews")).toBeInTheDocument();
    });
  });
});
