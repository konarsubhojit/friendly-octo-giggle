import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import SignInClient from "@/app/auth/signin/SignInClient";

const VALID_TEST_SECRET = ["password", "123"].join("");
const INVALID_TEST_SECRET = ["wrong"].join("");

const mockSignIn = vi.hoisted(() => vi.fn());
const mockLocationAssign = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

vi.mock("@/components/auth/PasswordToggleButton", () => ({
  PasswordToggleButton: ({
    showPassword,
    onToggle,
  }: {
    showPassword: boolean;
    onToggle: () => void;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      toggle
    </button>
  ),
}));

describe("SignInClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        assign: mockLocationAssign,
      },
    });
  });

  it("renders the login form with identifier and password fields", () => {
    render(<SignInClient />);
    expect(screen.getByLabelText("Email or Phone Number")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByText("Login")).toBeTruthy();
  });

  it("toggles password visibility", () => {
    render(<SignInClient />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput.getAttribute("type")).toBe("password");

    act(() => {
      fireEvent.click(screen.getByLabelText("Show password"));
    });
    expect(passwordInput.getAttribute("type")).toBe("text");
  });

  it("calls signIn with credentials on form submit", async () => {
    mockSignIn.mockResolvedValue({ error: null, url: "/orders" });
    render(<SignInClient callbackUrl="/orders" />);

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
        callbackUrl: "/orders",
        redirect: false,
      });
    });

    expect(mockLocationAssign).toHaveBeenCalledWith("/orders");
  });

  it("falls back to the provided callbackUrl when signIn omits a URL", async () => {
    mockSignIn.mockResolvedValue({ error: null, url: null });
    render(<SignInClient callbackUrl="/account" />);

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
      expect(mockLocationAssign).toHaveBeenCalledWith("/account");
    });
  });

  it("shows error when signIn returns error", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });
    render(<SignInClient />);

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

  it("shows error when signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));
    render(<SignInClient />);

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

  it("shows loading state during submission", async () => {
    let resolveSignIn: ((value: unknown) => void) | undefined;
    mockSignIn.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    render(<SignInClient />);

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

    expect(screen.getByText("Logging in...")).toBeTruthy();

    await act(() => {
      resolveSignIn?.({ error: null });
      return Promise.resolve();
    });
  });
});
