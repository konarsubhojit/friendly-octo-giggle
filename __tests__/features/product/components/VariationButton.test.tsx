import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { VariationButton } from "@/features/product/components/VariationButton";
import type { ProductVariation } from "@/lib/types";

const baseVariation: ProductVariation = {
  id: "var1",
  productId: "prod1",
  styleId: null,
  name: "Red",
  designName: "Crimson Rose",
  variationType: "colour",
  image: null,
  images: [],
  price: 499,
  stock: 10,
  deletedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockFormatPrice = (amount: number) => `₹${amount.toFixed(2)}`;

describe("VariationButton", () => {
  it("renders design name and variation name", () => {
    render(
      <VariationButton
        variation={baseVariation}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Crimson Rose")).toBeTruthy();
    expect(screen.getByText("Red")).toBeTruthy();
  });

  it("renders formatted price", () => {
    render(
      <VariationButton
        variation={baseVariation}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("₹499.00")).toBeTruthy();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(
      <VariationButton
        variation={baseVariation}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(baseVariation);
  });

  it("shows low stock warning when stock < 6", () => {
    const lowStockVariation = { ...baseVariation, stock: 3 };
    render(
      <VariationButton
        variation={lowStockVariation}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Only 3 left")).toBeTruthy();
  });

  it("does not show low stock when stock >= 6", () => {
    render(
      <VariationButton
        variation={baseVariation}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Only \d+ left/)).toBeNull();
  });

  it("does not show low stock when stock is 0", () => {
    const outOfStock = { ...baseVariation, stock: 0 };
    render(
      <VariationButton
        variation={outOfStock}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Only \d+ left/)).toBeNull();
  });

  it("shows cart quantity badge when cartQuantity > 0", () => {
    render(
      <VariationButton
        variation={baseVariation}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
        cartQuantity={3}
      />,
    );

    expect(screen.getByText("3 in cart")).toBeTruthy();
  });

  it("does not show cart quantity when cartQuantity is 0", () => {
    render(
      <VariationButton
        variation={baseVariation}
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
        cartQuantity={0}
      />,
    );

    expect(screen.queryByText(/in cart/)).toBeNull();
  });

  it("applies selected styles when isSelected is true", () => {
    render(
      <VariationButton
        variation={baseVariation}
        isSelected={true}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />,
    );

    const button = screen.getByRole("button");
    expect(button.className).toContain("scale-105");
    expect(button.className).toContain("shadow-warm");
  });
});
