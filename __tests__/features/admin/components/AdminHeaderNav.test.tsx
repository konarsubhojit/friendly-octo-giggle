import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminHeaderNav } from "@/features/admin/components/AdminHeaderNav";

const mockSignOut = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-auth/react", () => ({
  signOut: mockSignOut,
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: ({ size, color }: { size?: string; color?: string }) => (
    <div data-testid="loading-spinner" data-size={size} data-color={color} />
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminHeaderNav", () => {
  it("displays the user name", () => {
    render(<AdminHeaderNav userName="Admin User" />);

    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByTitle("Admin User")).toBeInTheDocument();
  });

  it("shows a View Store link pointing to /", () => {
    render(<AdminHeaderNav userName="Admin User" />);

    const viewStoreLink = screen.getByRole("link", { name: "View Store" });
    expect(viewStoreLink).toBeInTheDocument();
    expect(viewStoreLink).toHaveAttribute("href", "/");
  });

  it("shows a Sign Out button", () => {
    render(<AdminHeaderNav userName="Admin User" />);

    const signOutButton = screen.getByRole("button", { name: "Sign Out" });
    expect(signOutButton).toBeInTheDocument();
    expect(signOutButton).not.toBeDisabled();
  });

  it("calls signOut with callbackUrl when button is clicked", async () => {
    mockSignOut.mockResolvedValue(undefined);
    render(<AdminHeaderNav userName="Admin User" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    });
  });

  it("shows signing out state while signOut is pending", async () => {
    mockSignOut.mockReturnValue(new Promise(() => {}));
    render(<AdminHeaderNav userName="Admin User" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => {
      expect(screen.getByText("Signing out…")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /signing out/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("re-enables the button after signOut resolves", async () => {
    let resolveSignOut: () => void = () => {};
    mockSignOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        })
    );
    render(<AdminHeaderNav userName="Admin User" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => {
      expect(screen.getByText("Signing out…")).toBeInTheDocument();
    });

    resolveSignOut();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign Out" })).not.toBeDisabled();
    });
  });
});
