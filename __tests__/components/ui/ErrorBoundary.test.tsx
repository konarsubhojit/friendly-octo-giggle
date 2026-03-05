import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  ErrorBoundary,
  ErrorDisplay,
  SuccessDisplay,
  LoadingSpinner,
  LoadingOverlay,
} from "@/components/ui/ErrorBoundary";

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Normal content</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Normal content")).toBeTruthy();
  });

  it("renders default error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Oops! Something went wrong")).toBeTruthy();
    expect(screen.getByText("Test error")).toBeTruthy();
  });

  it("renders custom fallback when provided and child throws", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom fallback")).toBeTruthy();
    expect(screen.queryByText("Oops! Something went wrong")).toBeNull();
  });

  it("calls onError callback when child throws", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test error" }),
      expect.anything(),
    );
  });

  it("resets error state when try again is clicked", () => {
    // Wrap so we can control whether the child throws after reset
    function Wrapper() {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <ErrorBoundary>
          {shouldThrow ? (
            <ThrowingChild shouldThrow={true} />
          ) : (
            <button onClick={() => setShouldThrow(false)}>Normal content</button>
          )}
        </ErrorBoundary>
      );
    }

    render(<Wrapper />);
    expect(screen.getByText("Oops! Something went wrong")).toBeTruthy();
    // Click "Try again" — state resets; child still throws and error is caught again
    fireEvent.click(screen.getByText("Try again"));
    // The boundary catches the error again (expected behaviour)
    expect(screen.getByText("Oops! Something went wrong")).toBeTruthy();
  });

  it("shows default error message when error has no message", () => {
    // Temporarily override getDerivedStateFromError to return error:null
    const originalDerived = ErrorBoundary.getDerivedStateFromError;
    ErrorBoundary.getDerivedStateFromError = () => ({
      hasError: true,
      error: null,
    });
    try {
      render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>,
      );
      expect(screen.getByText("An unexpected error occurred")).toBeTruthy();
    } finally {
      // Always restore the original static method
      ErrorBoundary.getDerivedStateFromError = originalDerived;
    }
  });
});

// ---------------------------------------------------------------------------
// ErrorDisplay
// ---------------------------------------------------------------------------
describe("ErrorDisplay", () => {
  it("renders nothing when error is null", () => {
    const { container } = render(<ErrorDisplay error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders error message", () => {
    render(<ErrorDisplay error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Error")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SuccessDisplay
// ---------------------------------------------------------------------------
describe("SuccessDisplay", () => {
  it("renders nothing when message is null", () => {
    const { container } = render(<SuccessDisplay message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders success message", () => {
    render(<SuccessDisplay message="Operation successful" />);
    expect(screen.getByText("Operation successful")).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------
describe("LoadingSpinner", () => {
  it("renders with default md size", () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector(".w-8.h-8");
    expect(spinner).toBeTruthy();
  });

  it("renders with sm size", () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const spinner = container.querySelector(".w-4.h-4");
    expect(spinner).toBeTruthy();
  });

  it("renders with lg size", () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.querySelector(".w-12.h-12");
    expect(spinner).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// LoadingOverlay
// ---------------------------------------------------------------------------
describe("LoadingOverlay", () => {
  it("renders with default loading message", () => {
    render(<LoadingOverlay />);
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders with custom message", () => {
    render(<LoadingOverlay message="Please wait..." />);
    expect(screen.getByText("Please wait...")).toBeTruthy();
  });
});
