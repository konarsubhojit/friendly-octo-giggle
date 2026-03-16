import { describe, it, expect, vi } from "vitest";
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
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain("Handmade With Love");
  });

  it("renders descriptive tagline", () => {
    render(<Hero />);
    expect(screen.getByText(/crocheted flowers/i)).toBeTruthy();
  });

  it("renders Explore Shop link pointing to /shop", () => {
    render(<Hero />);
    const link = screen.getByText(/Explore Shop/).closest("a");
    expect(link?.getAttribute("href")).toBe("/shop");
  });

  it("renders feature badges", () => {
    render(<Hero />);
    expect(screen.getByText(/Crochet flowers/)).toBeTruthy();
    expect(screen.getByText(/Hair accessories/)).toBeTruthy();
    expect(screen.getByText(/Free shipping/)).toBeTruthy();
    expect(screen.getByText(/Handmade knitwear/)).toBeTruthy();
  });
});
