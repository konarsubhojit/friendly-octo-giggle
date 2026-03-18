import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { ThemeProvider } from "@/contexts/ThemeContext";

const renderWithProvider = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe("ThemeSelector", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders a select element with aria-label", () => {
    renderWithProvider(<ThemeSelector />);
    const select = screen.getByRole("combobox", { name: /colour theme/i });
    expect(select).toBeTruthy();
  });

  it("shows default theme as selected by default", () => {
    renderWithProvider(<ThemeSelector />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("default");
  });

  it("lists both theme options", () => {
    renderWithProvider(<ThemeSelector />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("includes Bloom & Thread option", () => {
    renderWithProvider(<ThemeSelector />);
    expect(screen.getByRole("option", { name: /bloom/i })).toBeTruthy();
  });

  it("includes Baby Pink option", () => {
    renderWithProvider(<ThemeSelector />);
    expect(screen.getByRole("option", { name: /baby pink/i })).toBeTruthy();
  });

  it("switches to baby-pink when selected", () => {
    renderWithProvider(<ThemeSelector />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "baby-pink" } });
    expect(select.value).toBe("baby-pink");
  });

  it("applies data-theme attribute on documentElement when baby-pink is chosen", () => {
    renderWithProvider(<ThemeSelector />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "baby-pink" } });
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "baby-pink",
    );
  });
});
