import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import Hero from "@/components/sections/Hero";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("Hero", () => {
  it("renders the main heading", () => {
    render(<Hero />);
    expect(screen.getByText("Handcrafted with Love")).toBeTruthy();
  });

  it("renders descriptive tagline", () => {
    render(<Hero />);
    expect(screen.getByText(/Discover beautiful handmade/i)).toBeTruthy();
  });

  it("renders Shop Now link pointing to #products", () => {
    render(<Hero />);
    const link = screen.getByText("Shop Now").closest("a");
    expect(link?.getAttribute("href")).toBe("#products");
  });

  it("renders Trending Items link pointing to #trending", () => {
    render(<Hero />);
    const link = screen.getByText("Trending Items").closest("a");
    expect(link?.getAttribute("href")).toBe("#trending");
  });

  it("renders feature badges", () => {
    render(<Hero />);
    expect(screen.getByText("✓ Free Shipping")).toBeTruthy();
    expect(screen.getByText("✓ Custom Orders Welcome")).toBeTruthy();
    expect(screen.getByText("✓ Handmade Quality")).toBeTruthy();
  });
});
