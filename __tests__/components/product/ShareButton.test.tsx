import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareButton } from "@/features/product/components/ShareButton";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockWriteText = vi.fn();
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// jsdom has no layout engine — provide a minimal getBoundingClientRect
const mockGetBoundingClientRect = vi.fn(() => ({
  bottom: 50,
  top: 10,
  left: 10,
  right: 60,
  width: 50,
  height: 40,
  x: 10,
  y: 10,
  toJSON: () => ({}),
}));

describe("ShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
    // Attach mock to all button elements rendered after this point
    Object.defineProperty(
      window.HTMLButtonElement.prototype,
      "getBoundingClientRect",
      {
        value: mockGetBoundingClientRect,
        configurable: true,
      },
    );
  });

  it("renders the Share button with icon only (no visible text)", () => {
    render(<ShareButton productId="abc1234" variationId={null} />);
    const btn = screen.getByRole("button", { name: "Share this product" });
    expect(btn).toBeTruthy();
    // Button must not contain visible text nodes
    expect(btn.textContent?.trim()).toBe("");
  });

  it("disables the button while loading", () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                json: () => ({
                  success: true,
                  data: {
                    key: "shr1234",
                    shareUrl: "http://localhost/s/shr1234",
                  },
                }),
              }),
            200,
          ),
        ),
    );

    render(<ShareButton productId="abc1234" variationId={null} />);
    const btn = screen.getByRole("button", { name: "Share this product" });
    fireEvent.click(btn);

    expect(
      screen.getByRole("button", { name: "Generating share link…" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Generating share link…" }),
    ).toBeDisabled();
  });

  it("shows share URL panel after successful API call", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /share link/i })).toBeTruthy();
    });

    const input = screen.getByDisplayValue("http://localhost/s/shr1234");
    expect(input).toBeTruthy();
  });

  it("auto-copies URL to clipboard on successful share", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("http://localhost/s/shr1234");
    });
  });

  it("shows 'Copied!' state immediately when panel opens (auto-copied)", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeTruthy();
    });
  });

  it("calls fetch with correct productId and variationId", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId="var5678" />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/share",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            productId: "abc1234",
            variationId: "var5678",
          }),
        }),
      );
    });
  });

  it("shows error aria-label on failed API call", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Failed to share – click to retry",
        }),
      ).toBeTruthy();
    });
  });

  it("shows error aria-label when API returns success=false", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({ success: false, error: "Server error" }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Failed to share – click to retry",
        }),
      ).toBeTruthy();
    });
  });

  it("copies URL to clipboard again when Copy button is clicked inside panel", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /share link/i })).toBeTruthy();
    });

    // Panel opens with "Copied!" state (auto-copied). Clear previous calls and
    // click the button again to verify it triggers another clipboard write.
    mockWriteText.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Copied!" }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("http://localhost/s/shr1234");
    });

    expect(screen.getByText("Copied!")).toBeTruthy();
  });

  it("closes the share panel when close button is clicked", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /share link/i })).toBeTruthy();
    });

    const closeButton = screen.getByRole("button", {
      name: /close share panel/i,
    });
    fireEvent.click(closeButton);

    expect(screen.queryByRole("region", { name: /share link/i })).toBeNull();
  });

  it("toggles share panel off when clicking Share again while panel is open", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /share link/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    expect(screen.queryByRole("region", { name: /share link/i })).toBeNull();
  });
});
