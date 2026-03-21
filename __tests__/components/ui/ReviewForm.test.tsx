import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewForm } from "@/components/ui/ReviewForm";

const mockSession = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  useSession: mockSession,
}));

vi.mock("@/components/ui/GradientButton", () => ({
  GradientButton: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

describe("ReviewForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows sign-in message when user is not authenticated", () => {
    mockSession.mockReturnValue({ data: null });
    render(<ReviewForm productId="prod001" />);
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it("renders form for authenticated user", () => {
    mockSession.mockReturnValue({
      data: { user: { id: "user1", name: "Jane" } },
    });
    render(<ReviewForm productId="prod001" />);
    expect(screen.getByRole("group", { name: "Select star rating" })).toBeInTheDocument();
    expect(screen.getByLabelText(/your review/i)).toBeInTheDocument();
    expect(screen.getByText("Submit Review")).toBeInTheDocument();
  });

  it("shows validation error when no rating is selected", async () => {
    mockSession.mockReturnValue({
      data: { user: { id: "user1", name: "Jane" } },
    });
    render(<ReviewForm productId="prod001" />);

    fireEvent.click(screen.getByText("Submit Review"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please select a star rating",
    );
  });

  it("shows validation error when comment is too short", async () => {
    mockSession.mockReturnValue({
      data: { user: { id: "user1", name: "Jane" } },
    });
    render(<ReviewForm productId="prod001" />);

    const starButtons = screen.getAllByRole("button");
    fireEvent.click(starButtons[3]); // 4 stars

    fireEvent.change(screen.getByLabelText(/your review/i), {
      target: { value: "Good" },
    });

    fireEvent.click(screen.getByText("Submit Review"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "at least 10 characters",
    );
  });

  it("submits review successfully", async () => {
    mockSession.mockReturnValue({
      data: { user: { id: "user1", name: "Jane" } },
    });
    const onSuccess = vi.fn();

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { review: { id: "rev1" } } }),
    } as Response);

    render(<ReviewForm productId="prod001" onSuccess={onSuccess} />);

    const starButtons = screen.getAllByRole("button");
    fireEvent.click(starButtons[4]); // 5 stars

    fireEvent.change(screen.getByLabelText(/your review/i), {
      target: { value: "This is an excellent product!" },
    });

    fireEvent.click(screen.getByText("Submit Review"));

    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("displays server error on failed submission", async () => {
    mockSession.mockReturnValue({
      data: { user: { id: "user1", name: "Jane" } },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({ error: "You have already reviewed this product" }),
    } as Response);

    render(<ReviewForm productId="prod001" />);

    const starButtons = screen.getAllByRole("button");
    fireEvent.click(starButtons[2]); // 3 stars
    fireEvent.change(screen.getByLabelText(/your review/i), {
      target: { value: "Decent product overall, worth the price." },
    });
    fireEvent.click(screen.getByText("Submit Review"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already reviewed",
    );
  });

  it("handles network error gracefully", async () => {
    mockSession.mockReturnValue({
      data: { user: { id: "user1", name: "Jane" } },
    });

    vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

    render(<ReviewForm productId="prod001" />);

    const starButtons = screen.getAllByRole("button");
    fireEvent.click(starButtons[0]); // 1 star
    fireEvent.change(screen.getByLabelText(/your review/i), {
      target: { value: "This product was a bit disappointing." },
    });
    fireEvent.click(screen.getByText("Submit Review"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
  });

  it("allows anonymous submission toggle", () => {
    mockSession.mockReturnValue({
      data: { user: { id: "user1", name: "Jane" } },
    });
    render(<ReviewForm productId="prod001" />);

    const checkbox = screen.getByLabelText(/anonymously/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
