'use client';

import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { MicrosoftIcon } from '@/components/icons/MicrosoftIcon';

interface OAuthButtonsProps {
  readonly onGoogleClick: () => void;
  readonly onMicrosoftClick: () => void;
}

export function OAuthButtons({ onGoogleClick, onMicrosoftClick }: OAuthButtonsProps) {
  return (
    <div className="space-y-3">
      <button
        onClick={onGoogleClick}
        type="button"
        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <button
        onClick={onMicrosoftClick}
        type="button"
        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
      >
        <MicrosoftIcon />
        Continue with Microsoft
      </button>
    </div>
  );
}
