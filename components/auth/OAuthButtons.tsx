"use client";

import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { MicrosoftIcon } from "@/components/icons/MicrosoftIcon";

interface OAuthButtonsProps {
  readonly onGoogleClick: () => void;
  readonly onMicrosoftClick: () => void;
}

export const OAuthButtons = ({
  onGoogleClick,
  onMicrosoftClick,
}: OAuthButtonsProps) => {
  return (
    <div className="space-y-3">
      <button
        onClick={onGoogleClick}
        type="button"
        className="w-full flex items-center justify-center gap-3 bg-[var(--surface)] border-2 border-[var(--border-warm)] rounded-lg px-4 py-3 font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] hover:border-[var(--accent-warm)] transition"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <button
        onClick={onMicrosoftClick}
        type="button"
        className="w-full flex items-center justify-center gap-3 bg-[var(--surface)] border-2 border-[var(--border-warm)] rounded-lg px-4 py-3 font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] hover:border-[var(--accent-warm)] transition"
      >
        <MicrosoftIcon />
        Continue with Microsoft
      </button>
    </div>
  );
}
