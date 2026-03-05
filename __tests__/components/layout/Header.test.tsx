import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

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
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/components/layout/CartIcon", () => ({
  default: () => <div data-testid="cart-icon" />,
}));

vi.mock("@/components/ui/CurrencySelector", () => ({
  default: () => <div data-testid="currency-selector" />,
}));

describe("Header", () => {
  let useSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const nextAuth = await import("next-auth/react");
    useSession = vi.mocked(nextAuth.useSession);
  });

  it("renders brand name", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    expect(screen.getByText("Craft & Cozy")).toBeTruthy();
  });

  it("shows Sign In link when not authenticated", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    const signInLink = screen.getByText("Sign In").closest("a");
    expect(signInLink?.getAttribute("href")).toContain("/auth/signin");
  });

  it("shows navigation links", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("About")).toBeTruthy();
    expect(screen.getByText("Contact")).toBeTruthy();
  });

  it("shows user menu when authenticated", async () => {
    const session = {
      user: {
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: "CUSTOMER",
      },
    };
    useSession.mockReturnValue({ data: session, status: "authenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    // User avatar initial should be visible
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("shows My Orders link when authenticated", async () => {
    const session = {
      user: {
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: "CUSTOMER",
      },
    };
    useSession.mockReturnValue({ data: session, status: "authenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    expect(screen.getByText("My Orders")).toBeTruthy();
  });

  it("shows Admin Dashboard link for ADMIN role", async () => {
    const session = {
      user: {
        name: "Admin",
        email: "admin@example.com",
        image: null,
        role: "ADMIN",
      },
    };
    useSession.mockReturnValue({ data: session, status: "authenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    // Open the menu
    act(() => {
      fireEvent.click(screen.getByLabelText("User menu"));
    });
    expect(screen.getByText("Admin Dashboard")).toBeTruthy();
  });

  it("opens and closes user menu on click", async () => {
    const session = {
      user: {
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: "CUSTOMER",
      },
    };
    useSession.mockReturnValue({ data: session, status: "authenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    const menuButton = screen.getByLabelText("User menu");

    act(() => {
      fireEvent.click(menuButton);
    });
    expect(screen.getByRole("menu")).toBeTruthy();

    act(() => {
      fireEvent.click(menuButton);
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes menu when clicking outside", async () => {
    const session = {
      user: {
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: "CUSTOMER",
      },
    };
    useSession.mockReturnValue({ data: session, status: "authenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);

    act(() => {
      fireEvent.click(screen.getByLabelText("User menu"));
    });
    expect(screen.getByRole("menu")).toBeTruthy();

    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders CartIcon and CurrencySelector", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    expect(screen.getByTestId("cart-icon")).toBeTruthy();
    expect(screen.getByTestId("currency-selector")).toBeTruthy();
  });
});
