import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import Footer from "@/components/layout/Footer";

describe("Footer", () => {
  it("renders as a footer landmark", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });

  it("renders copyright text with store name", () => {
    render(<Footer />);
    expect(screen.getByText(/The Kiyon Store/)).toBeTruthy();
  });

  it("renders copyright text with all rights reserved", () => {
    render(<Footer />);
    expect(screen.getByText(/All rights reserved/)).toBeTruthy();
  });
});
