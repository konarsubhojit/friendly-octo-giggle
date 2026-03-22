"use client";

import { useCallback, useState } from "react";
import { DynamicForm, type SubmitResult } from "@/components/ui/DynamicForm";
import { Card } from "@/components/ui/Card";
import { API_ERRORS } from "@/lib/constants/error-messages";
import { PASSWORD_FIELDS } from "@/app/account/account-shared";

export function PasswordSection() {
  const [isChanging, setIsChanging] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
            confirmNewPassword: values.confirmNewPassword,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess("Password changed successfully.");
          setIsChanging(false);
        } else {
          return data.error || API_ERRORS.AUTH_CHANGE_FAILED;
        }
      } catch {
        return API_ERRORS.AUTH_CHANGE_FAILED;
      }
    },
    [],
  );

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            Password
          </h2>
        </div>
        {!isChanging && (
          <button
            type="button"
            onClick={() => {
              setSuccess("");
              setIsChanging(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--accent-rose)] bg-[var(--accent-blush)] rounded-lg hover:bg-[var(--accent-cream)] transition"
            aria-label="Change password"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            Change Password
          </button>
        )}
      </div>

      {success && !isChanging && (
        <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">
          {success}
        </output>
      )}

      {!isChanging && !success && (
        <p className="text-sm text-[var(--text-muted)]">
          Your password is set. Click &ldquo;Change Password&rdquo; above to
          update it.
        </p>
      )}

      {isChanging && (
        <DynamicForm
          fields={PASSWORD_FIELDS}
          onSubmit={handleSubmit}
          submitLabel="Change Password"
          submittingLabel="Changing…"
          onCancel={() => setIsChanging(false)}
        />
      )}
    </Card>
  );
}
