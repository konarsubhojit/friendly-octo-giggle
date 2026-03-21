import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

vi.mock("next/font/google", () => ({
  Nunito: () => ({ className: "nunito" }),
  Playfair_Display: () => ({ className: "playfair", variable: "--font-display" }),
}));

vi.mock("@/components/layout/HeaderWrapper", () => ({
  default: () => <div data-testid="header-wrapper" />,
}));

vi.mock("@/components/providers/StoreProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/CurrencyContext", () => ({
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/providers/SessionProvider", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-hot-toast", () => ({
  Toaster: () => null,
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => null,
}));

describe("app/layout.tsx", () => {
  it("wraps children in a div, not a main element", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const { container } = render(
      <RootLayout>
        <span data-testid="child">content</span>
      </RootLayout>,
    );
    const mainElements = container.querySelectorAll("main");
    expect(mainElements.length).toBe(0);
    const child = container.querySelector("[data-testid='child']");
    expect(child?.closest("div")).toBeTruthy();
  });

  it("renders HeaderWrapper", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const { getByTestId } = render(
      <RootLayout>
        <span>content</span>
      </RootLayout>,
    );
    expect(getByTestId("header-wrapper")).toBeTruthy();
  });

  it("renders children", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const { getByTestId } = render(
      <RootLayout>
        <span data-testid="child">content</span>
      </RootLayout>,
    );
    expect(getByTestId("child")).toBeTruthy();
  });
});
