"use client";

import { useCallback, useState } from "react";
import { DynamicForm, type SubmitResult } from "@/components/ui/DynamicForm";
import { Card } from "@/components/ui/Card";
import { API_ERRORS } from "@/lib/constants/error-messages";
import { PROFILE_FIELDS, type UserProfile } from "@/app/account/account-shared";

interface ProfileSectionProps {
  readonly profile: UserProfile;
  readonly onProfileUpdated: () => void;
}

export function ProfileSection({
  profile,
  onProfileUpdated,
}: ProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      try {
        const res = await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name || undefined,
            email: values.email || undefined,
            phoneNumber: values.phoneNumber || null,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess("Profile updated successfully.");
          setIsEditing(false);
          onProfileUpdated();
        } else {
          return data.error ?? API_ERRORS.PROFILE_UPDATE;
        }
      } catch {
        return API_ERRORS.PROFILE_UPDATE;
      }
    },
    [onProfileUpdated],
  );

  return (
    <Card className="p-6 sm:p-8 mb-6">
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            Profile Information
          </h2>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setSuccess("");
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--accent-rose)] bg-[var(--accent-blush)] rounded-lg hover:bg-[var(--accent-cream)] transition"
            aria-label="Edit profile"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </button>
        )}
      </div>

      {success && !isEditing && (
        <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">
          {success}
        </output>
      )}

      {!isEditing && (
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-[var(--text-muted)]">
              Name
            </dt>
            <dd className="mt-1 text-base text-[var(--foreground)]">
              {profile.name || (
                <span className="text-[var(--text-muted)] italic">Not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[var(--text-muted)]">
              Email
            </dt>
            <dd className="mt-1 text-base text-[var(--foreground)]">
              {profile.email}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[var(--text-muted)]">
              Phone Number
            </dt>
            <dd className="mt-1 text-base text-[var(--foreground)]">
              {profile.phoneNumber || (
                <span className="text-[var(--text-muted)] italic">Not set</span>
              )}
            </dd>
          </div>
          <div className="text-xs text-[var(--text-muted)] pt-1">
            Member since{" "}
            {new Date(profile.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </dl>
      )}

      {isEditing && (
        <DynamicForm
          fields={PROFILE_FIELDS}
          onSubmit={handleSubmit}
          initialValues={{
            name: profile.name ?? "",
            email: profile.email,
            phoneNumber: profile.phoneNumber ?? "",
          }}
          submitLabel="Save Changes"
          submittingLabel="Saving…"
          onCancel={() => setIsEditing(false)}
        />
      )}
    </Card>
  );
}
