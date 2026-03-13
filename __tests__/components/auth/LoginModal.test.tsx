import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// Mock next-auth/react
const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock next/link
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

describe("LoginModal", () => {
  let LoginModal: typeof import("@/components/auth/LoginModal").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    LoginModal = (await import("@/components/auth/LoginModal")).default;
  });

  it("renders nothing when not open", () => {
    const { container } = render(
      <LoginModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders modal content when open", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Welcome Back")).toBeTruthy();
    expect(screen.getByText("Choose how to login")).toBeTruthy();
  });

  it("shows all login options", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Email or Phone Number")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
    expect(screen.getByText("Continue with Microsoft")).toBeTruthy();
    expect(screen.getByText("Register")).toBeTruthy();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<LoginModal isOpen={true} onClose={onClose} />);
    const backdrop = screen.getByText("Welcome Back")
      .closest('[role="dialog"]')
      ?.querySelector('[aria-hidden="true"]');
    if (backdrop) {
      act(() => {
        fireEvent.click(backdrop);
      });
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(<LoginModal isOpen={true} onClose={onClose} />);
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on close button click", () => {
    const onClose = vi.fn();
    render(<LoginModal isOpen={true} onClose={onClose} />);
    const closeBtn = screen.getByLabelText("Close login modal");
    act(() => {
      fireEvent.click(closeBtn);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("toggles password visibility", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput.getAttribute("type")).toBe("password");

    const toggleBtn = screen.getByLabelText("Show password");
    act(() => {
      fireEvent.click(toggleBtn);
    });
    expect(passwordInput.getAttribute("type")).toBe("text");
  });

  it("calls signIn with google provider", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    const googleBtn = screen.getByText("Continue with Google");
    act(() => {
      fireEvent.click(googleBtn);
    });
    expect(mockSignIn).toHaveBeenCalledWith("google");
  });

  it("calls signIn with microsoft provider", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    const msBtn = screen.getByText("Continue with Microsoft");
    act(() => {
      fireEvent.click(msBtn);
    });
    expect(mockSignIn).toHaveBeenCalledWith("microsoft-entra-id");
  });

  it("has proper aria attributes", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Login");
  });

  it("has register link", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    const registerLink = screen.getByText("Register").closest("a");
    expect(registerLink?.getAttribute("href")).toBe("/auth/register");
  });
});
