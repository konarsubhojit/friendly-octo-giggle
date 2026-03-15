'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { PasswordToggleButton } from '@/components/auth/PasswordToggleButton';
import { PasswordStrengthChecklist } from '@/components/auth/PasswordStrengthChecklist';
import { PASSWORD_REQUIREMENTS } from '@/lib/validations';
import {
  PROFILE_ERRORS,
  PASSWORD_ERRORS,
  API_ERRORS,
} from '@/lib/constants/error-messages';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
  image: string | null;
  role: string;
  hasPassword: boolean;
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
  if (!currentPassword) errors.currentPassword = PASSWORD_ERRORS.CURRENT_REQUIRED;
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

// ─── ProfileEditForm ──────────────────────────────────────────────────────────

interface ProfileEditFormProps {
  readonly name: string;
  readonly email: string;
  readonly phoneNumber: string;
  readonly saving: boolean;
  readonly serverError: string;
  readonly fieldErrors: Record<string, string>;
  readonly onNameChange: (v: string) => void;
  readonly onEmailChange: (v: string) => void;
  readonly onPhoneChange: (v: string) => void;
  readonly onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  readonly onCancel: () => void;
}

const ProfileEditForm = ({
  name, email, phoneNumber, saving, serverError, fieldErrors,
  onNameChange, onEmailChange, onPhoneChange, onSubmit, onCancel,
}: ProfileEditFormProps) => (
  <>
    {serverError && (
      <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4" role="alert">{serverError}</p>
    )}
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          id="account-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${fieldErrors.name ? 'border-red-400' : 'border-gray-300'}`}
          placeholder="Your full name"
          autoComplete="name"
          aria-describedby={fieldErrors.name ? 'account-name-error' : undefined}
        />
        {fieldErrors.name && <p id="account-name-error" className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <label htmlFor="account-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="account-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${fieldErrors.email ? 'border-red-400' : 'border-gray-300'}`}
          placeholder="you@example.com"
          autoComplete="email"
          aria-describedby={fieldErrors.email ? 'account-email-error' : undefined}
        />
        {fieldErrors.email && <p id="account-email-error" className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
      </div>
      <div>
        <label htmlFor="account-phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="account-phone"
          type="tel"
          value={phoneNumber}
          onChange={(e) => onPhoneChange(e.target.value)}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${fieldErrors.phoneNumber ? 'border-red-400' : 'border-gray-300'}`}
          placeholder="+1234567890"
          autoComplete="tel"
          aria-describedby={fieldErrors.phoneNumber ? 'account-phone-error' : undefined}
        />
        {fieldErrors.phoneNumber && <p id="account-phone-error" className="text-xs text-red-600 mt-1">{fieldErrors.phoneNumber}</p>}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Saving\u2026' : 'Save Changes'}
        </button>
      </div>
    </form>
  </>
);

// ─── ProfileSection ────────────────────────────────────────────────────────────

const buildProfilePayload = (name: string, email: string, phoneNumber: string) => ({
  name: name || undefined,
  email: email || undefined,
  phoneNumber: phoneNumber || null,
});

interface ProfileSectionProps {
  readonly profile: UserProfile;
  readonly onProfileUpdated: () => void;
}

const ProfileSection = ({ profile, onProfileUpdated }: ProfileSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleEdit = () => {
    setName(profile.name || '');
    setEmail(profile.email || '');
    setPhoneNumber(profile.phoneNumber || '');
    setFieldErrors({});
    setServerError('');
    setSuccess('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFieldErrors({});
    setServerError('');
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) setFieldErrors((p) => ({ ...p, [field]: '' }));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccess('');
    setServerError('');
    const errors = validateProfileFields(name, email, phoneNumber);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildProfilePayload(name, email, phoneNumber)),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Profile updated successfully.');
        setIsEditing(false);
        onProfileUpdated();
      } else {
        setServerError(data.error ?? API_ERRORS.PROFILE_UPDATE);
      }
    } catch {
      setServerError(API_ERRORS.PROFILE_UPDATE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 mb-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
            aria-label="Edit profile"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        )}
      </div>

      {success && (
        <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">
          {success}
        </output>
      )}

      {/* Read-only view */}
      {!isEditing && (
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-base text-gray-900">{profile.name || <span className="text-gray-400 italic">Not set</span>}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-base text-gray-900">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
            <dd className="mt-1 text-base text-gray-900">{profile.phoneNumber || <span className="text-gray-400 italic">Not set</span>}</dd>
          </div>
          <div className="text-xs text-gray-400 pt-1">
            Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </dl>
      )}

      {/* Edit form */}
      {isEditing && (
        <ProfileEditForm
          name={name} email={email} phoneNumber={phoneNumber}
          saving={saving} serverError={serverError} fieldErrors={fieldErrors}
          onNameChange={(v) => { setName(v); clearFieldError('name'); }}
          onEmailChange={(v) => { setEmail(v); clearFieldError('email'); }}
          onPhoneChange={(v) => { setPhoneNumber(v); clearFieldError('phoneNumber'); }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}
    </section>
  );
};

// ─── PasswordChangeForm ───────────────────────────────────────────────────────

interface PasswordChangeFormProps {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmNewPassword: string;
  readonly showCurrentPassword: boolean;
  readonly showNewPassword: boolean;
  readonly mismatchVisible: boolean;
  readonly saving: boolean;
  readonly success: string;
  readonly serverError: string;
  readonly fieldErrors: Record<string, string>;
  readonly onCurrentPasswordChange: (v: string) => void;
  readonly onNewPasswordChange: (v: string) => void;
  readonly onConfirmPasswordChange: (v: string) => void;
  readonly onToggleCurrentPassword: () => void;
  readonly onToggleNewPassword: () => void;
  readonly onConfirmBlur: () => void;
  readonly onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  readonly onCancel: () => void;
}

const PasswordChangeForm = ({
  currentPassword, newPassword, confirmNewPassword,
  showCurrentPassword, showNewPassword, mismatchVisible,
  saving, success, serverError, fieldErrors,
  onCurrentPasswordChange, onNewPasswordChange, onConfirmPasswordChange,
  onToggleCurrentPassword, onToggleNewPassword, onConfirmBlur,
  onSubmit, onCancel,
}: PasswordChangeFormProps) => (
  <>
    {success && (
      <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">{success}</output>
    )}
    {serverError && (
      <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4" role="alert">{serverError}</p>
    )}
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
        <div className="relative">
          <input
            id="current-password"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => onCurrentPasswordChange(e.target.value)}
            className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12 ${fieldErrors.currentPassword ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="Enter current password"
            autoComplete="current-password"
            aria-describedby={fieldErrors.currentPassword ? 'current-password-error' : undefined}
          />
          <PasswordToggleButton showPassword={showCurrentPassword} onToggle={onToggleCurrentPassword}
            label={showCurrentPassword ? 'Hide current password' : 'Show current password'} />
        </div>
        {fieldErrors.currentPassword && (
          <p id="current-password-error" className="text-xs text-red-600 mt-1">{fieldErrors.currentPassword}</p>
        )}
      </div>
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
        <div className="relative">
          <input
            id="new-password"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12 ${fieldErrors.newPassword ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="Enter new password"
            autoComplete="new-password"
            aria-describedby={fieldErrors.newPassword ? 'new-password-error' : undefined}
          />
          <PasswordToggleButton showPassword={showNewPassword} onToggle={onToggleNewPassword}
            label={showNewPassword ? 'Hide new password' : 'Show new password'} />
        </div>
        {fieldErrors.newPassword && (
          <p id="new-password-error" className="text-xs text-red-600 mt-1">{fieldErrors.newPassword}</p>
        )}
        <PasswordStrengthChecklist password={newPassword} />
      </div>
      <div>
        <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
        <input
          id="confirm-new-password"
          type="password"
          value={confirmNewPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          onBlur={onConfirmBlur}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${fieldErrors.confirmNewPassword ? 'border-red-400' : 'border-gray-300'}`}
          placeholder="Confirm new password"
          autoComplete="new-password"
          aria-describedby={fieldErrors.confirmNewPassword ? 'confirm-new-password-error' : undefined}
        />
        {fieldErrors.confirmNewPassword && (
          <p id="confirm-new-password-error" className="text-xs text-red-600 mt-1">{fieldErrors.confirmNewPassword}</p>
        )}
        {!fieldErrors.confirmNewPassword && mismatchVisible && (
          <p className="text-xs text-red-600 mt-1">{PASSWORD_ERRORS.CONFIRM_MISMATCH}</p>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Changing\u2026' : 'Change Password'}
        </button>
      </div>
    </form>
  </>
);

// ─── PasswordSection ──────────────────────────────────────────────────────────

const PasswordSection = () => {
  const [isChanging, setIsChanging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleStart = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setFieldErrors({});
    setServerError('');
    setSuccess('');
    setIsChanging(true);
  };

  const handleCancel = () => { setIsChanging(false); setFieldErrors({}); setServerError(''); };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) setFieldErrors((p) => ({ ...p, [field]: '' }));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccess('');
    setServerError('');
    const errors = validatePasswordFields(currentPassword, newPassword, confirmNewPassword);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Password changed successfully.');
        setIsChanging(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setServerError(data.error || API_ERRORS.AUTH_CHANGE_FAILED);
      }
    } catch {
      setServerError(API_ERRORS.AUTH_CHANGE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  const mismatchVisible = confirmTouched && confirmNewPassword && newPassword !== confirmNewPassword;

  return (
    <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900">Password</h2>
        </div>
        {!isChanging && (
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
            aria-label="Change password"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Change Password
          </button>
        )}
      </div>

      {!isChanging && (
        <p className="text-sm text-gray-500">
          Your password is set. Click &ldquo;Change Password&rdquo; above to update it.
        </p>
      )}

      {isChanging && (
        <PasswordChangeForm
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmNewPassword={confirmNewPassword}
          showCurrentPassword={showCurrentPassword}
          showNewPassword={showNewPassword}
          mismatchVisible={!!mismatchVisible}
          saving={saving}
          success={success}
          serverError={serverError}
          fieldErrors={fieldErrors}
          onCurrentPasswordChange={(v) => { setCurrentPassword(v); clearFieldError('currentPassword'); }}
          onNewPasswordChange={(v) => { setNewPassword(v); clearFieldError('newPassword'); }}
          onConfirmPasswordChange={(v) => { setConfirmNewPassword(v); clearFieldError('confirmNewPassword'); }}
          onToggleCurrentPassword={() => setShowCurrentPassword((s) => !s)}
          onToggleNewPassword={() => setShowNewPassword((s) => !s)}
          onConfirmBlur={() => setConfirmTouched(true)}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}
    </section>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const AccountPage = () => {
  const { data: session, status: authStatus } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/account');
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
    if (authStatus === 'authenticated') {
      fetchProfile();
    } else if (authStatus === 'unauthenticated') {
      setLoading(false);
    }
  }, [authStatus, fetchProfile]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to manage your account.</p>
            <Link href="/auth/signin?callbackUrl=/account"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all">
              Sign In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          My Account
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200" role="alert">{error}</div>
        )}

        {profile && <ProfileSection profile={profile} onProfileUpdated={fetchProfile} />}

        {profile?.hasPassword && <PasswordSection />}

        {profile && !profile.hasPassword && (
          <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Password</h2>
            <p className="text-sm text-gray-600">
              Your account uses social login (Google or Microsoft). Password management is not available for social login accounts.
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default AccountPage;
