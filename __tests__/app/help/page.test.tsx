import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import HelpPage from "@/app/help/page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/layout/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

describe("HelpPage", () => {
  it("renders the updated cancellation and return policy guidance", () => {
    render(<HelpPage />);

    expect(
      screen.getAllByText(/only be cancelled before they are shipped/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /orders cannot be returned unless the product arrives damaged/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /email us/i })).toHaveAttribute(
      "href",
      "mailto:support@estore.example.com",
    );
  });
});
