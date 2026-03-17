'use client';

import { useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { DynamicForm, type FieldDef, type SubmitResult } from '@/components/ui/DynamicForm';
import { CopilotDevLoginButton } from '@/components/auth/CopilotDevLoginButton';

const SIGNIN_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: 'signin-identifier',
    name: 'identifier',
    label: 'Email or Phone Number',
    type: 'text',
    placeholder: 'you@example.com or +1234567890',
    autoComplete: 'username',
    validate: (v) => v.trim() ? undefined : 'Email or phone number is required.',
  },
  {
    id: 'signin-password',
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    autoComplete: 'current-password',
    showPasswordToggle: true,
    validate: (v) => v ? undefined : 'Password is required.',
  },
];

const SUBMIT_BTN =
  'w-full py-3 bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white rounded-full font-semibold hover:from-[var(--accent-pink)] hover:to-[var(--accent-rose)] transition-all duration-300 shadow-warm hover:shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed focus-warm';

const SignInClient = () => {
  const handleSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      try {
        const result = await signIn('credentials', {
          identifier: values.identifier,
          password: values.password,
          redirect: false,
        });
        if (result?.error) return 'Invalid email/phone or password';
        globalThis.location.href = '/';
        return undefined;
      } catch {
        return 'An unexpected error occurred';
      }
    },
    [],
  );

  return (
    <>
      <DynamicForm
        fields={SIGNIN_FIELDS}
        onSubmit={handleSubmit}
        submitLabel="Login"
        submittingLabel="Logging in..."
        submitButtonClassName={SUBMIT_BTN}
        formClassName="space-y-4"
      />
      {/* Dev-only: Copilot Admin sign-in — navigates to /admin on success */}
      <CopilotDevLoginButton />
    </>
  );
};

export default SignInClient;

