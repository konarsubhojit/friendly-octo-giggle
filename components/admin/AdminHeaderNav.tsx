"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface AdminHeaderNavProps {
  readonly userName: string;
}

export const AdminHeaderNav = ({ userName }: AdminHeaderNavProps) => {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-right sm:text-left">
      <span
        className="max-w-[220px] truncate rounded-full border border-white/70 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm sm:max-w-none dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
        title={userName}
      >
        {userName}
      </span>
      <Link
        href="/"
        className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-slate-50"
      >
        View Store
      </Link>
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-200 dark:hover:border-rose-800 dark:hover:bg-rose-950/80"
      >
        {signingOut && (
          <LoadingSpinner size="h-4 w-4" color="text-rose-700" label="Signing out…" />
        )}
        {signingOut ? "Signing out…" : "Sign Out"}
      </button>
    </div>
  );
};
