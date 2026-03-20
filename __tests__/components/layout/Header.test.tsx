import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
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

vi.mock("@/components/auth/LoginModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="login-modal" /> : null,
}));

vi.mock("@/components/ui/ProductSearch", () => ({
  default: () => <div data-testid="product-search" />,
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
    expect(screen.getByText("The Kiyon Store")).toBeTruthy();
  });

  it("shows Login button when not authenticated", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    const loginButton = screen.getByText("Login");
    expect(loginButton.tagName).toBe("BUTTON");
  });

  it("opens login modal when Login button is clicked", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    expect(screen.queryByTestId("login-modal")).toBeNull();
    act(() => {
      fireEvent.click(screen.getByText("Login"));
    });
    expect(screen.getByTestId("login-modal")).toBeTruthy();
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
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("does not show My Orders or Wishlist in main nav", async () => {
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
    // My Orders and Wishlist should not appear in the header — only in the user icon dropdown
    expect(screen.queryByText("My Orders")).toBeNull();
    expect(screen.queryByText("Wishlist")).toBeNull();
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

  it("renders CartIcon", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    expect(screen.getByTestId("cart-icon")).toBeTruthy();
  });

  it("renders user profile image when session.user.image is provided", async () => {
    const session = {
      user: {
        name: "Alice",
        email: "alice@example.com",
        image: "https://example.com/avatar.jpg",
        role: "CUSTOMER",
      },
    };
    useSession.mockReturnValue({ data: session, status: "authenticated" });
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);
    const menuButton = screen.getByLabelText("User menu");
    const img = menuButton.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.com/avatar.jpg");
    expect(screen.queryByText("A")).toBeNull();
  });

  it("calls signOut and closes menu when Sign Out is clicked", async () => {
    const session = {
      user: {
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: "CUSTOMER",
      },
    };
    useSession.mockReturnValue({ data: session, status: "authenticated" });
    const nextAuth = await import("next-auth/react");
    const signOutMock = vi.mocked(nextAuth.signOut);
    const Header = (await import("@/components/layout/Header")).default;
    render(<Header />);

    act(() => {
      fireEvent.click(screen.getByLabelText("User menu"));
    });
    expect(screen.getByRole("menu")).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByText("Sign Out"));
    });
    expect(signOutMock).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes menu when clicking My Orders link in dropdown", async () => {
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
    const menu = screen.getByRole("menu");
    expect(menu).toBeTruthy();

    const myOrdersLink = menu.querySelector("a[href='/orders']");
    expect(myOrdersLink).not.toBeNull();
    act(() => {
      fireEvent.click(myOrdersLink as HTMLElement);
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes menu when clicking Admin Dashboard link", async () => {
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

    act(() => {
      fireEvent.click(screen.getByLabelText("User menu"));
    });
    const menu = screen.getByRole("menu");
    const adminLink = menu.querySelector("a[href='/admin']");
    expect(adminLink).not.toBeNull();
    act(() => {
      fireEvent.click(adminLink as HTMLElement);
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows My Account link in user menu", async () => {
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
    const menu = screen.getByRole("menu");
    const accountLink = menu.querySelector("a[href='/account']");
    expect(accountLink).not.toBeNull();
    expect(accountLink?.textContent).toContain("My Account");
  });
});
