"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { useCurrency, type CurrencyCode } from "@/contexts/CurrencyContext";
import type { UserProfile } from "@/app/account/account-shared";

interface PreferencesSectionProps {
  readonly profile: UserProfile | null;
}

export function PreferencesSection({ profile }: PreferencesSectionProps) {
  const { currency, setCurrency } = useCurrency();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (
      profile?.currencyPreference &&
      (["INR", "USD", "EUR", "GBP"] as string[]).includes(
        profile.currencyPreference,
      )
    ) {
      setCurrency(profile.currencyPreference as CurrencyCode);
    }
  }, [profile?.currencyPreference, setCurrency]);

  const handleCurrencyChange = useCallback(
    async (code: CurrencyCode) => {
      setCurrency(code);
      setSaving(true);
      try {
        await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currencyPreference: code }),
        });
      } finally {
        setSaving(false);
      }
    },
    [setCurrency],
  );

  return (
    <Card className="p-6 sm:p-8 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <svg
          className="w-6 h-6 text-[var(--accent-warm)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <h2 className="text-xl font-bold text-[var(--foreground)]">
          Preferences
        </h2>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
          Colour Theme
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Choose your preferred look. Your selection is saved and restored on
          every visit.
        </p>
        <ThemeSelector />
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
          Currency
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Choose your preferred currency. This will also be used in order
          emails.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={currency}
            onChange={(e) =>
              handleCurrencyChange(e.target.value as CurrencyCode)
            }
            disabled={saving}
            className="bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--foreground)] rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)] cursor-pointer disabled:opacity-50"
            aria-label="Select currency"
          >
            {(["INR", "USD", "EUR", "GBP"] as const).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {saving && (
            <span className="text-xs text-[var(--text-muted)]">Saving…</span>
          )}
        </div>
      </div>
    </Card>
  );
}
