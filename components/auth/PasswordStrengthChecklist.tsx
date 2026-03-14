'use client';

import { PASSWORD_REQUIREMENTS } from '@/lib/validations';

interface PasswordStrengthChecklistProps {
  readonly password: string;
}

export function PasswordStrengthChecklist({ password }: PasswordStrengthChecklistProps) {
  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_REQUIREMENTS.map((req) => {
        const met = req.test(password);
        return (
          <li key={req.label} className={`text-xs flex items-center gap-1.5 ${met ? 'text-green-600' : 'text-gray-400'}`}>
            {met ? <CheckIcon /> : <CircleIcon />}
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
    </svg>
  );
}
