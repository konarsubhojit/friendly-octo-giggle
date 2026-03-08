import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import {
  CurrencyProvider,
  useCurrency,
  CURRENCIES,
} from "@/contexts/CurrencyContext";

function CurrencyDisplay() {
  const {
    currency,
    setCurrency,
    formatPrice,
    convertPrice,
    currencySymbol,
    availableCurrencies,
  } = useCurrency();
  return (
    <div>
      <span data-testid="currency">{currency}</span>
      <span data-testid="symbol">{currencySymbol}</span>
      <span data-testid="formatted">{formatPrice(10)}</span>
      <span data-testid="converted">{convertPrice(10)}</span>
      <span data-testid="available">{availableCurrencies.join(",")}</span>
      <button onClick={() => setCurrency("USD")}>Set USD</button>
      <button onClick={() => setCurrency("EUR")}>Set EUR</button>
      <button onClick={() => setCurrency("GBP")}>Set GBP</button>
    </div>
  );
}

function ThrowingComponent() {
  useCurrency();
  return null;
}

describe("CurrencyProvider", () => {
  it("provides default INR currency", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    expect(screen.getByTestId("currency").textContent).toBe("INR");
    expect(screen.getByTestId("symbol").textContent).toBe("₹");
  });

  it("converts price using INR rate by default", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    const converted = parseFloat(
      screen.getByTestId("converted").textContent ?? "0",
    );
    expect(converted).toBeCloseTo(10 * CURRENCIES.INR.rate, 2);
  });

  it("formats price with Intl.NumberFormat", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    const formatted = screen.getByTestId("formatted").textContent ?? "";
    // With INR as the base currency, formatPrice(10) should format 10 INR
    expect(formatted).toContain("10");
  });

  it("updates currency when setCurrency is called", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set USD"));
    });
    expect(screen.getByTestId("currency").textContent).toBe("USD");
    expect(screen.getByTestId("symbol").textContent).toBe("$");
  });

  it("converts price using USD rate after switching", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set USD"));
    });
    const converted = parseFloat(
      screen.getByTestId("converted").textContent ?? "0",
    );
    expect(converted).toBeCloseTo(10 * CURRENCIES.USD.rate, 2);
  });

  it("switches to EUR", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set EUR"));
    });
    expect(screen.getByTestId("currency").textContent).toBe("EUR");
    expect(screen.getByTestId("symbol").textContent).toBe("€");
  });

  it("switches to GBP", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("Set GBP"));
    });
    expect(screen.getByTestId("currency").textContent).toBe("GBP");
    expect(screen.getByTestId("symbol").textContent).toBe("£");
  });

  it("provides all four available currencies", () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>,
    );
    const available = screen.getByTestId("available").textContent ?? "";
    expect(available).toContain("INR");
    expect(available).toContain("USD");
    expect(available).toContain("EUR");
    expect(available).toContain("GBP");
  });

  it("throws when useCurrency is used outside provider", () => {
    const originalError = console.error;
    console.error = () => {};
    expect(() => render(<ThrowingComponent />)).toThrow(
      "useCurrency must be used within a CurrencyProvider",
    );
    console.error = originalError;
  });
});

describe("CURRENCIES config", () => {
  it("has correct INR config", () => {
    expect(CURRENCIES.INR).toMatchObject({
      code: "INR",
      symbol: "₹",
      rate: 1,
    });
  });

  it("has USD rate less than 1 (INR is base currency)", () => {
    expect(CURRENCIES.USD.rate).toBeCloseTo(1 / 83.5, 6);
  });

  it("has all four currencies", () => {
    expect(Object.keys(CURRENCIES)).toHaveLength(4);
  });
});
