"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import {
  DynamicForm,
  type FieldDef,
  type SubmitResult,
} from "@/components/ui/DynamicForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { AuthRequiredState } from "@/components/ui/AuthRequiredState";
import { Card } from "@/components/ui/Card";
import { GradientHeading } from "@/components/ui/GradientHeading";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { useCurrency, type CurrencyCode } from "@/contexts/CurrencyContext";
import { PASSWORD_REQUIREMENTS } from "@/lib/validations";
import {
  PROFILE_ERRORS,
  PASSWORD_ERRORS,
  API_ERRORS,
} from "@/lib/constants/error-messages";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
  image: string | null;
  role: string;
  hasPassword: boolean;
  currencyPreference: string;
  createdAt: string;
}

// ─── Regexes ──────────────────────────────────────────────────────────────────

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

// ─── Exported pure helpers (for unit tests) ───────────────────────────────────

export const isPasswordStrong = (password: string): boolean =>
  PASSWORD_REQUIREMENTS.every((req) => req.test(password));

export const validateProfileFields = (
  name: string,
  email: string,
  phoneNumber: string,
): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!name.trim()) {
    errors.name = PROFILE_ERRORS.NAME_REQUIRED;
  }
  if (!email.trim()) {
    errors.email = PROFILE_ERRORS.EMAIL_REQUIRED;
  } else if (!EMAIL_RE.test(email)) {
    errors.email = PROFILE_ERRORS.EMAIL_INVALID;
  }
  if (phoneNumber && !PHONE_RE.test(phoneNumber)) {
    errors.phoneNumber = PROFILE_ERRORS.PHONE_INVALID;
  }
  return errors;
};

export const validatePasswordFields = (
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string,
): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!currentPassword)
    errors.currentPassword = PASSWORD_ERRORS.CURRENT_REQUIRED;
  if (!newPassword) {
    errors.newPassword = PASSWORD_ERRORS.NEW_REQUIRED;
  } else if (!isPasswordStrong(newPassword)) {
    errors.newPassword = PASSWORD_ERRORS.NEW_WEAK;
  }
  if (!confirmNewPassword) {
    errors.confirmNewPassword = PASSWORD_ERRORS.CONFIRM_REQUIRED;
  } else if (newPassword !== confirmNewPassword) {
    errors.confirmNewPassword = PASSWORD_ERRORS.CONFIRM_MISMATCH;
  }
  return errors;
};

// ─── Profile field definitions ────────────────────────────────────────────────

const PHONE_LABEL: ReactNode = (
  <>
    Phone Number <span className="text-[var(--text-muted)]">(optional)</span>
  </>
);

const PROFILE_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: "account-name",
    name: "name",
    label: "Name",
    type: "text",
    placeholder: "Your full name",
    autoComplete: "name",
    validate: (v) => (v.trim() ? undefined : PROFILE_ERRORS.NAME_REQUIRED),
  },
  {
    id: "account-email",
    name: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.com",
    autoComplete: "email",
    validate: (v) => {
      if (!v.trim()) return PROFILE_ERRORS.EMAIL_REQUIRED;
      if (!EMAIL_RE.test(v)) return PROFILE_ERRORS.EMAIL_INVALID;
      return undefined;
    },
  },
  {
    id: "account-phone",
    name: "phoneNumber",
    label: PHONE_LABEL,
    type: "tel",
    placeholder: "+1234567890",
    autoComplete: "tel",
    validate: (v) =>
      v && !PHONE_RE.test(v) ? PROFILE_ERRORS.PHONE_INVALID : undefined,
  },
];

// ─── ProfileSection ────────────────────────────────────────────────────────────

interface ProfileSectionProps {
  readonly profile: UserProfile;
  readonly onProfileUpdated: () => void;
}

const ProfileSection = ({ profile, onProfileUpdated }: ProfileSectionProps) => {
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

      {/* Read-only view */}
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

      {/* Edit form */}
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
          submittingLabel="Saving\u2026"
          onCancel={() => setIsEditing(false)}
        />
      )}
    </Card>
  );
};

const PASSWORD_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: "current-password",
    name: "currentPassword",
    label: "Current Password",
    type: "password",
    placeholder: "Enter current password",
    autoComplete: "current-password",
    showPasswordToggle: true,
    validate: (v) => (v ? undefined : PASSWORD_ERRORS.CURRENT_REQUIRED),
  },
  {
    id: "new-password",
    name: "newPassword",
    label: "New Password",
    type: "password",
    placeholder: "Enter new password",
    autoComplete: "new-password",
    showPasswordToggle: true,
    showStrengthChecklist: true,
    validate: (v) => {
      if (!v) return PASSWORD_ERRORS.NEW_REQUIRED;
      if (!isPasswordStrong(v)) return PASSWORD_ERRORS.NEW_WEAK;
      return undefined;
    },
  },
  {
    id: "confirm-new-password",
    name: "confirmNewPassword",
    label: "Confirm New Password",
    type: "password",
    placeholder: "Confirm new password",
    autoComplete: "new-password",
    validate: (v, all) => {
      if (!v) return PASSWORD_ERRORS.CONFIRM_REQUIRED;
      if (v !== all.newPassword) return PASSWORD_ERRORS.CONFIRM_MISMATCH;
      return undefined;
    },
    validateOnBlur: true,
  },
];

// ─── PasswordSection ──────────────────────────────────────────────────────────

const PasswordSection = () => {
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
          submittingLabel="Changing\u2026"
          onCancel={() => setIsChanging(false)}
        />
      )}
    </Card>
  );
};

// ─── PreferencesSection ───────────────────────────────────────────────────────

interface PreferencesSectionProps {
  readonly profile: UserProfile | null;
}

const PreferencesSection = ({ profile }: PreferencesSectionProps) => {
  const { currency, setCurrency } = useCurrency();
  const [saving, setSaving] = useState(false);

  // Sync CurrencyContext with the profile's saved preference on load
  useEffect(() => {
    if (
      profile?.currencyPreference &&
      (["INR", "USD", "EUR", "GBP"] as string[]).includes(
        profile.currencyPreference,
      )
    ) {
      setCurrency(profile.currencyPreference as CurrencyCode);
    }
  }, [profile?.currencyPreference, setCurrency]);

  const handleCurrencyChange = useCallback(
    async (code: CurrencyCode) => {
      setCurrency(code);
      setSaving(true);
      try {
        await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currencyPreference: code }),
        });
      } catch {
        // Silently keep the local preference even if the save fails
      } finally {
        setSaving(false);
      }
    },
    [setCurrency],
  );

  return (
    <Card className="p-6 sm:p-8 mb-6">
      <div className="flex items-center gap-3 mb-6">
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
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <h2 className="text-xl font-bold text-[var(--foreground)]">
          Preferences
        </h2>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
          Colour Theme
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Choose your preferred look. Your selection is saved and restored on
          every visit.
        </p>
        <ThemeSelector />
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
          Currency
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Choose your preferred currency. This will also be used in order
          emails.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={currency}
            onChange={(e) =>
              handleCurrencyChange(e.target.value as CurrencyCode)
            }
            disabled={saving}
            className="bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--foreground)] rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)] cursor-pointer disabled:opacity-50"
            aria-label="Select currency"
          >
            {(["INR", "USD", "EUR", "GBP"] as const).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {saving && (
            <span className="text-xs text-[var(--text-muted)]">Saving…</span>
          )}
        </div>
      </div>
    </Card>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const AccountPage = () => {
  const { data: session, status: authStatus } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
      } else {
        setError(API_ERRORS.PROFILE_LOAD);
      }
    } catch {
      setError(API_ERRORS.PROFILE_LOAD);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchProfile();
    } else if (authStatus === "unauthenticated") {
      setLoading(false);
    }
  }, [authStatus, fetchProfile]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <AuthRequiredState
            callbackUrl="/account"
            message="Please sign in to manage your account."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <GradientHeading className="mb-8">My Account</GradientHeading>

        {error && (
          <AlertBanner message={error} variant="error" className="mb-6" />
        )}

        {profile && (
          <ProfileSection profile={profile} onProfileUpdated={fetchProfile} />
        )}

        <PreferencesSection profile={profile} />

        {profile?.hasPassword && <PasswordSection />}

        {profile && !profile.hasPassword && (
          <Card className="p-6 sm:p-8">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
              Password
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Your account uses social login (Google or Microsoft). Password
              management is not available for social login accounts.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AccountPage;
