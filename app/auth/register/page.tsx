'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DynamicForm, type FieldDef, type SubmitResult } from '@/components/ui/DynamicForm';
import { PASSWORD_REQUIREMENTS } from '@/lib/validations';
import { PROFILE_ERRORS } from '@/lib/constants/error-messages';

// ─── Shared regexes (mirror lib/validations.ts) ───────────────────────────────

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

const isPasswordStrong = (p: string) =>
  PASSWORD_REQUIREMENTS.every((r) => r.test(p));

// ─── Field definitions ────────────────────────────────────────────────────────

const PHONE_LABEL = (
  <>Phone Number <span className="text-[var(--text-secondary)]">(optional)</span></>
);

const REGISTER_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: 'register-name',
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Your full name',
    autoComplete: 'name',
    validate: (v) => v.trim() ? undefined : 'Name is required.',
  },
  {
    id: 'register-email',
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    autoComplete: 'email',
    validate: (v) => {
      if (!v.trim()) return PROFILE_ERRORS.EMAIL_REQUIRED;
      if (!EMAIL_RE.test(v)) return PROFILE_ERRORS.EMAIL_INVALID;
      return undefined;
    },
  },
  {
    id: 'register-phone',
    name: 'phoneNumber',
    label: PHONE_LABEL,
    type: 'tel',
    placeholder: '+1234567890',
    autoComplete: 'tel',
    validate: (v) => v && !PHONE_RE.test(v) ? PROFILE_ERRORS.PHONE_INVALID : undefined,
  },
  {
    id: 'register-password',
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Create a password',
    autoComplete: 'new-password',
    showPasswordToggle: true,
    showStrengthChecklist: true,
    validate: (v) => {
      if (!v) return 'Password is required.';
      if (!isPasswordStrong(v)) return 'Password does not meet the requirements below.';
      return undefined;
    },
  },
  {
    id: 'register-confirm-password',
    name: 'confirmPassword',
    label: 'Confirm Password',
    type: 'password',
    placeholder: 'Confirm your password',
    autoComplete: 'new-password',
    validate: (v, all) => {
      if (!v) return 'Please confirm your password.';
      if (v !== all.password) return "Passwords don't match.";
      return undefined;
    },
    validateOnBlur: true,
  },
];

const SUBMIT_BTN =
  'w-full py-3 bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white rounded-full font-semibold hover:from-[var(--accent-pink)] hover:to-[var(--accent-rose)] transition-all duration-300 shadow-warm hover:shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed focus-warm';

// ─── Header sub-component (extracted to keep JSX nesting ≤ 4 levels) ──────────

const RegisterPageHeader = () => (
  <div className="text-center mb-6">
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[var(--accent-blush)] to-[var(--accent-cream)] mb-3">
      <svg className="w-6 h-6 text-[var(--accent-rose)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    </div>
    <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mb-2">Create Account</h1>
    <p className="text-[var(--text-secondary)]">Join us and start shopping</p>
  </div>
);

// ─── API error helper (extracted to reduce handleSubmit cyclomatic complexity) ─

const parseRegisterError = (data: { details?: Record<string, string>; error?: string }): SubmitResult => {
  if (data.details) return data.details;
  return data.error ?? 'Registration failed';
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const RegisterPage = () => {
  const router = useRouter();

  const handleSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber || undefined,
            password: values.password,
            confirmPassword: values.confirmPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) return parseRegisterError(data);
        router.push('/auth/signin?registered=true');
        return undefined;
      } catch {
        return 'An unexpected error occurred';
      }
    },
    [router],
  );

  return (
    <div className="min-h-screen bg-warm-gradient flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full bg-[var(--surface)]/80 backdrop-blur-sm rounded-xl shadow-warm border border-[var(--border-warm)] p-6 sm:p-8">
        <RegisterPageHeader />

        <DynamicForm
          fields={REGISTER_FIELDS}
          onSubmit={handleSubmit}
          submitLabel="Create Account"
          submittingLabel="Creating account..."
          submitButtonClassName={SUBMIT_BTN}
          formClassName="space-y-4"
        />

        <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-semibold text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)]">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
export default RegisterPage;
