import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

const mockSignIn = vi.fn();
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
  let SignInClient: typeof import("@/app/auth/signin/SignInClient").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    SignInClient = (await import("@/app/auth/signin/SignInClient")).default;
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
    mockSignIn.mockResolvedValue({ error: null });
    render(<SignInClient />);

    act(() => {
      fireEvent.change(screen.getByLabelText("Email or Phone Number"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password123" },
      });
    });

    act(() => {
      fireEvent.submit(screen.getByText("Login").closest("form") as HTMLFormElement);
    });

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        identifier: "test@example.com",
        password: "password123",
        redirect: false,
      });
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
        target: { value: "wrong" },
      });
    });

    act(() => {
      fireEvent.submit(screen.getByText("Login").closest("form") as HTMLFormElement);
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Invalid email/phone or password")).toBeTruthy();
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
        target: { value: "password" },
      });
    });

    act(() => {
      fireEvent.submit(screen.getByText("Login").closest("form") as HTMLFormElement);
    });

    await waitFor(() => {
      expect(screen.getByText("An unexpected error occurred")).toBeTruthy();
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
        target: { value: "password" },
      });
    });

    act(() => {
      fireEvent.submit(screen.getByText("Login").closest("form") as HTMLFormElement);
    });

    expect(screen.getByText("Logging in...")).toBeTruthy();

    await act(() => {
      resolveSignIn?.({ error: null });
      return Promise.resolve();
    });
  });
});
