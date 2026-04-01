"use client";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function LoadingOverlay({
  message = "Loading...",
}: Readonly<{ message?: string }>) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--surface)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] p-6 flex flex-col items-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-[var(--text-secondary)] font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}
