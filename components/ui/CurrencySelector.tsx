"use client";

import { useCurrency, type CurrencyCode } from "@/contexts/CurrencyContext";

export default function CurrencySelector() {
  const { currency, setCurrency, availableCurrencies } = useCurrency();

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      className="bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--foreground)] rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)] cursor-pointer"
      aria-label="Select currency"
    >
      {availableCurrencies.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}
