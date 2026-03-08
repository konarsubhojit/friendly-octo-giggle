import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import CartIcon from "@/components/layout/CartIcon";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    "aria-label": ariaLabel,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    "aria-label"?: string;
  }) => (
    <a href={href} aria-label={ariaLabel} {...props}>
      {children}
    </a>
  ),
}));

function renderCartIcon(_preloadedState?: object) {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <CartIcon />
    </Provider>,
  );
}

describe("CartIcon", () => {
  it("renders a link to /cart", () => {
    renderCartIcon();
    const link = screen.getByRole("link", { name: /shopping cart/i });
    expect(link.getAttribute("href")).toBe("/cart");
  });

  it("does not show badge when cart is empty", () => {
    renderCartIcon();
    // No count badge visible
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  it("renders the cart SVG icon", () => {
    const { container } = renderCartIcon();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
