'use client';

import { EyeIcon } from '@/components/icons/EyeIcon';
import { EyeOffIcon } from '@/components/icons/EyeOffIcon';

interface PasswordToggleButtonProps {
  readonly showPassword: boolean;
  readonly onToggle: () => void;
  readonly label?: string;
}

export function PasswordToggleButton({ showPassword, onToggle, label }: PasswordToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      aria-label={label ?? (showPassword ? 'Hide password' : 'Show password')}
    >
      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}
