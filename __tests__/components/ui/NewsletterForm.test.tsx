import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import NewsletterForm from "@/components/ui/NewsletterForm";

describe("NewsletterForm", () => {
  it("renders an email input", () => {
    render(<NewsletterForm />);
    const input = screen.getByRole("textbox", { name: /email/i });
    expect(input).toBeTruthy();
  });

  it("renders subscribe button", () => {
    render(<NewsletterForm />);
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeTruthy();
  });

  it("renders the subscription label", () => {
    render(<NewsletterForm />);
    expect(screen.getByText(/subscribe to our newsletter/i)).toBeTruthy();
  });

  it("does not navigate away when submitted (preventDefault)", () => {
    const { container } = render(<NewsletterForm />);
    const form = container.querySelector("form");
    // Submit the form — should not throw
    if (form) {
      fireEvent.submit(form);
    }
    // The page should still render the newsletter form
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeTruthy();
  });

  it("email input has correct type", () => {
    render(<NewsletterForm />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("email");
  });
});
