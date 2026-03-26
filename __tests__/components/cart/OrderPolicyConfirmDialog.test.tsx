import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { OrderPolicyConfirmDialog } from "@/components/cart/OrderPolicyConfirmDialog";

const mockLineItems = [
  {
    name: "Hand-knitted Flower Bouquet",
    variationLabel: "Small (15 cm) - Rose Red",
    quantity: 2,
    unitPrice: 1499,
    lineTotal: 2998,
    customizationNote: "Use a satin ribbon",
  },
  {
    name: "Macramé Wall Hanging",
    variationLabel: null,
    quantity: 1,
    unitPrice: 2299,
    lineTotal: 2299,
    customizationNote: null,
  },
] as const;

const mockPricingSummary = {
  itemCount: 3,
  subtotal: 5297,
  shippingAmount: 0,
  total: 5297,
} as const;

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

describe("OrderPolicyConfirmDialog", () => {
  it("renders selected items, totals, and policy sections", () => {
    render(
      <OrderPolicyConfirmDialog
        isOpen={true}
        lineItems={mockLineItems}
        pricingSummary={mockPricingSummary}
        isAcknowledged={false}
        onAcknowledgedChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        formatPrice={(amount) => `₹${amount}`}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Review Order Policy")).toBeInTheDocument();
    expect(screen.getByText("Order Policy")).toBeInTheDocument();
    expect(screen.getByText("Order Summary")).toBeInTheDocument();
    expect(screen.getByText("Selected Products")).toBeInTheDocument();
    expect(screen.getByText("Hand-knitted Flower Bouquet")).toBeInTheDocument();
    expect(screen.getByText("Macramé Wall Hanging")).toBeInTheDocument();
    expect(screen.getByText("Cancellation")).toBeInTheDocument();
    expect(screen.getByText("Returns")).toBeInTheDocument();
    expect(screen.getByText("Refunds")).toBeInTheDocument();
    expect(screen.getByText("Damaged Items")).toBeInTheDocument();
    expect(screen.getAllByText(/support@estore.example.com/i).length).toBe(2);
    expect(screen.getAllByText(/₹5297/).length).toBeGreaterThan(0);
  });

  it("requires acknowledgment before confirm is enabled", () => {
    const onAcknowledgedChange = vi.fn();
    render(
      <OrderPolicyConfirmDialog
        isOpen={true}
        lineItems={mockLineItems}
        pricingSummary={mockPricingSummary}
        isAcknowledged={false}
        onAcknowledgedChange={onAcknowledgedChange}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        formatPrice={(amount) => `₹${amount}`}
      />,
    );

    const acknowledgment = screen.getByRole("checkbox");
    const confirmButton = screen.getByRole("button", {
      name: /confirm and place order/i,
    });

    expect(confirmButton).toBeDisabled();
    fireEvent.click(acknowledgment);
    expect(onAcknowledgedChange).toHaveBeenCalledWith(true);
  });

  it("shows a blocking error state when policy content is unavailable", () => {
    const onConfirm = vi.fn();
    render(
      <OrderPolicyConfirmDialog
        isOpen={true}
        lineItems={mockLineItems}
        pricingSummary={mockPricingSummary}
        isAcknowledged={true}
        onAcknowledgedChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        errorMessage="Order policy details are currently unavailable."
        formatPrice={(amount) => `₹${amount}`}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(
      screen.getByRole("button", { name: /confirm and place order/i }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: /confirm and place order/i }),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
