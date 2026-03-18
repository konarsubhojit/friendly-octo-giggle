import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareButton } from "@/components/product/ShareButton";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockWriteText = vi.fn();
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

describe("ShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Share button", () => {
    render(<ShareButton productId="abc1234" variationId={null} />);
    expect(screen.getByRole("button", { name: /share/i })).toBeTruthy();
  });

  it("shows 'Generating…' while loading", () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                json: () => ({
                  success: true,
                  data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
                }),
              }),
            200,
          ),
        ),
    );

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.getByText("Generating…")).toBeTruthy();
  });

  it("shows share URL panel after successful API call", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /share link/i })).toBeTruthy();
    });

    const input = screen.getByDisplayValue("http://localhost/s/shr1234");
    expect(input).toBeTruthy();
  });

  it("calls fetch with correct productId and variationId", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });

    render(<ShareButton productId="abc1234" variationId="var5678" />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/share",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ productId: "abc1234", variationId: "var5678" }),
        }),
      );
    });
  });

  it("shows error state on failed API call", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeTruthy();
    });
  });

  it("shows error state when API returns success=false", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({ success: false, error: "Server error" }),
    });

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeTruthy();
    });
  });

  it("copies URL to clipboard when Copy button is clicked", async () => {
    mockFetch.mockResolvedValue({
      json: () => ({
        success: true,
        data: { key: "shr1234", shareUrl: "http://localhost/s/shr1234" },
      }),
    });
    mockWriteText.mockResolvedValue();

    render(<ShareButton productId="abc1234" variationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /share link/i })).toBeTruthy();
    });

    const copyButton = screen.getByRole("button", { name: /copy link/i });
    fireEvent.click(copyButton);

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
    fireEvent.click(screen.getByRole("button", { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /share link/i })).toBeTruthy();
    });

    const closeButton = screen.getByRole("button", { name: /close share panel/i });
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

    // Click the Share button again to toggle off
    fireEvent.click(screen.getByRole("button", { name: "Share this product" }));

    expect(screen.queryByRole("region", { name: /share link/i })).toBeNull();
  });
});
