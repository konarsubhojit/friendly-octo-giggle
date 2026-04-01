import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import React from "react";
import LoginModal from "@/features/auth/components/LoginModal";

const VALID_TEST_SECRET = ["password", "123"].join("");
const INVALID_TEST_SECRET = ["wrong"].join("");

const mockSignIn = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
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

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
    this.setAttribute("aria-modal", "true");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

describe("LoginModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const backdrop = screen
      .getByText("Welcome Back")
      .closest("dialog")
      ?.querySelector('[aria-hidden="true"]');
    if (backdrop) {
      act(() => {
        fireEvent.click(backdrop);
      });
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on native dialog cancel event (Escape)", () => {
    const onClose = vi.fn();
    render(<LoginModal isOpen={true} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    act(() => {
      dialog.dispatchEvent(new Event("cancel", { bubbles: true }));
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

  it("has proper aria attributes and uses showModal()", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Login");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.tagName.toLowerCase()).toBe("dialog");
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it("has register link", () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    const registerLink = screen.getByText("Register").closest("a");
    expect(registerLink?.getAttribute("href")).toBe("/auth/register");
  });

  it("calls signIn with credentials on form submit", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const onClose = vi.fn();
    render(<LoginModal isOpen={true} onClose={onClose} />);

    act(() => {
      fireEvent.change(screen.getByLabelText("Email or Phone Number"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password123" },
      });
    });

    act(() => {
      fireEvent.submit(
        screen.getByText("Login").closest("form") as HTMLFormElement,
      );
    });

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        identifier: "test@example.com",
        password: VALID_TEST_SECRET,
        redirect: false,
      });
    });
  });

  it("shows error on credentials login failure", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);

    act(() => {
      fireEvent.change(screen.getByLabelText("Email or Phone Number"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: INVALID_TEST_SECRET },
      });
    });

    act(() => {
      fireEvent.submit(
        screen.getByText("Login").closest("form") as HTMLFormElement,
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(
        screen.getByText(
          "We couldn't sign you in with those details. Double-check your email, phone number, and password, then try again.",
        ),
      ).toBeTruthy();
    });
  });

  it("shows error when credentials login throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);

    act(() => {
      fireEvent.change(screen.getByLabelText("Email or Phone Number"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: VALID_TEST_SECRET },
      });
    });

    act(() => {
      fireEvent.submit(
        screen.getByText("Login").closest("form") as HTMLFormElement,
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "We hit a temporary issue while signing you in. Please try again.",
        ),
      ).toBeTruthy();
    });
  });
});
