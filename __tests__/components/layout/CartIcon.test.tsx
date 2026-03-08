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

  it("shows badge when cart has items", () => {
    const store = makeStore();
    // Manually set cart state with items
    store.dispatch({
      type: "cart/fetchCart/fulfilled",
      payload: {
        id: "cart-1",
        items: [
          { id: "item-1", cartId: "cart-1", productId: "p1", quantity: 3, createdAt: "", updatedAt: "", product: { id: "p1", name: "P", description: "", price: 10, image: "", stock: 5, category: "C", deletedAt: null, createdAt: "", updatedAt: "" } },
        ],
        createdAt: "",
        updatedAt: "",
      },
    });
    render(
      <Provider store={store}>
        <CartIcon />
      </Provider>,
    );
    expect(screen.getByText("3")).toBeTruthy();
  });
});
