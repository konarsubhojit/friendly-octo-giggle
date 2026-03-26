import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ReturnsPage from "@/app/returns/page";

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

describe("ReturnsPage", () => {
  it("renders the shared damaged-item and no-refund policy", () => {
    render(<ReturnsPage />);

    expect(
      screen.getByText(/refunds are not issued for orders/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/support@estore.example.com/i).length).toBe(2);
    expect(
      screen.getByText(/shipping cost to send the damaged product back/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/replacement product/i)).toBeInTheDocument();
  });
});
