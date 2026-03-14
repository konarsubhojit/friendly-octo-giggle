import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock validations
vi.mock("@/lib/validations", () => ({
  PASSWORD_REQUIREMENTS: [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "One number", test: (p: string) => /\d/.test(p) },
    {
      label: "One special character",
      test: (p: string) => /[!@#$%^&*]/.test(p),
    },
  ],
}));

import { PasswordToggleButton } from "@/components/auth/PasswordToggleButton";
import { PasswordStrengthChecklist } from "@/components/auth/PasswordStrengthChecklist";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

describe("PasswordToggleButton", () => {
  it('renders with "Show password" label when hidden', () => {
    render(
      <PasswordToggleButton showPassword={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByLabelText("Show password")).toBeTruthy();
  });

  it('renders with "Hide password" label when visible', () => {
    render(
      <PasswordToggleButton showPassword={true} onToggle={vi.fn()} />,
    );
    expect(screen.getByLabelText("Hide password")).toBeTruthy();
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(
      <PasswordToggleButton showPassword={false} onToggle={onToggle} />,
    );
    act(() => {
      fireEvent.click(screen.getByLabelText("Show password"));
    });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("uses custom label when provided", () => {
    render(
      <PasswordToggleButton
        showPassword={false}
        onToggle={vi.fn()}
        label="Toggle visibility"
      />,
    );
    expect(screen.getByLabelText("Toggle visibility")).toBeTruthy();
  });
});

describe("PasswordStrengthChecklist", () => {
  it("renders nothing when password is empty", () => {
    const { container } = render(<PasswordStrengthChecklist password="" />);
    expect(container.querySelector("ul")).toBeNull();
  });

  it("renders all requirements when password is provided", () => {
    render(<PasswordStrengthChecklist password="a" />);
    expect(screen.getByText("At least 8 characters")).toBeTruthy();
    expect(screen.getByText("One uppercase letter")).toBeTruthy();
    expect(screen.getByText("One lowercase letter")).toBeTruthy();
    expect(screen.getByText("One number")).toBeTruthy();
    expect(screen.getByText("One special character")).toBeTruthy();
  });

  it("shows met requirements in green", () => {
    render(<PasswordStrengthChecklist password="abcdefgh" />);
    const charReq = screen.getByText("At least 8 characters").closest("li");
    expect(charReq?.className).toContain("text-green-600");
  });

  it("shows unmet requirements in gray", () => {
    render(<PasswordStrengthChecklist password="abc" />);
    const charReq = screen.getByText("At least 8 characters").closest("li");
    expect(charReq?.className).toContain("text-gray-400");
  });

  it("shows all met for a strong password", () => {
    render(<PasswordStrengthChecklist password="StrongP1!" />);
    const items = screen.getAllByRole("listitem");
    items.forEach((item) => {
      expect(item.className).toContain("text-green-600");
    });
  });
});

describe("OAuthButtons", () => {
  it("renders Google and Microsoft buttons", () => {
    render(
      <OAuthButtons onGoogleClick={vi.fn()} onMicrosoftClick={vi.fn()} />,
    );
    expect(screen.getByText("Continue with Google")).toBeTruthy();
    expect(screen.getByText("Continue with Microsoft")).toBeTruthy();
  });

  it("calls onGoogleClick when Google button is clicked", () => {
    const onGoogleClick = vi.fn();
    render(
      <OAuthButtons onGoogleClick={onGoogleClick} onMicrosoftClick={vi.fn()} />,
    );
    act(() => {
      fireEvent.click(screen.getByText("Continue with Google"));
    });
    expect(onGoogleClick).toHaveBeenCalledTimes(1);
  });

  it("calls onMicrosoftClick when Microsoft button is clicked", () => {
    const onMicrosoftClick = vi.fn();
    render(
      <OAuthButtons onGoogleClick={vi.fn()} onMicrosoftClick={onMicrosoftClick} />,
    );
    act(() => {
      fireEvent.click(screen.getByText("Continue with Microsoft"));
    });
    expect(onMicrosoftClick).toHaveBeenCalledTimes(1);
  });
});
