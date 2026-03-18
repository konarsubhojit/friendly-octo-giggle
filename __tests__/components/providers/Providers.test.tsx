import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import StoreProvider from "@/components/providers/StoreProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { useSelector } from "react-redux";
import { selectCartItemCount } from "@/lib/features/cart/cartSlice";

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="next-auth-session-provider">{children}</div>
  ),
}));

describe("StoreProvider", () => {
  it("renders children", () => {
    render(
      <StoreProvider>
        <div>Child content</div>
      </StoreProvider>,
    );
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("provides Redux store to children", () => {
    function Counter() {
      const count = useSelector(selectCartItemCount);
      return <span data-testid="count">{count}</span>;
    }
    render(
      <StoreProvider>
        <Counter />
      </StoreProvider>,
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});

describe("SessionProvider", () => {
  it("renders children inside NextAuth provider", () => {
    render(
      <SessionProvider>
        <div>Session content</div>
      </SessionProvider>,
    );
    expect(screen.getByText("Session content")).toBeTruthy();
    expect(screen.getByTestId("next-auth-session-provider")).toBeTruthy();
  });
});
