'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { PasswordToggleButton } from '@/components/auth/PasswordToggleButton';
import { PasswordStrengthChecklist } from '@/components/auth/PasswordStrengthChecklist';
import { PASSWORD_REQUIREMENTS } from '@/lib/validations';

// ----- types -----
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

// ----- helpers -----
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password));
}

export function validateProfileFields(
  name: string,
  email: string,
  phoneNumber: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Name is required.';
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (phoneNumber && !PHONE_RE.test(phoneNumber)) {
    errors.phoneNumber = 'Enter a valid phone number (e.g. +1234567890).';
  }
  return errors;
}

export function validatePasswordFields(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!currentPassword) errors.currentPassword = 'Current password is required.';
  if (!newPassword) {
    errors.newPassword = 'New password is required.';
  } else if (!isPasswordStrong(newPassword)) {
    errors.newPassword = 'Password does not meet the requirements below.';
  }
  if (!confirmNewPassword) {
    errors.confirmNewPassword = 'Please confirm your new password.';
  } else if (newPassword !== confirmNewPassword) {
    errors.confirmNewPassword = "Passwords don't match.";
  }
  return errors;
}

// ----- component -----
export default function AccountPage() {
  const { data: session, status: authStatus } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Profile section state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});

  // Password section state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmNewPasswordTouched, setConfirmNewPasswordTouched] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/account');
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setName(data.data.name || '');
        setEmail(data.data.email || '');
        setPhoneNumber(data.data.phoneNumber || '');
      } else {
        setError('Could not load your profile. Please refresh the page.');
      }
    } catch {
      setError('Could not load your profile. Please refresh the page.');
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

  const handleStartEditProfile = () => {
    setName(profile?.name || '');
    setEmail(profile?.email || '');
    setPhoneNumber(profile?.phoneNumber || '');
    setProfileFieldErrors({});
    setProfileError('');
    setProfileSuccess('');
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setIsEditingProfile(false);
    setProfileFieldErrors({});
    setProfileError('');
  };

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');

    const errors = validateProfileFields(name, email, phoneNumber);
    if (Object.keys(errors).length > 0) {
      setProfileFieldErrors(errors);
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          email: email || undefined,
          phoneNumber: phoneNumber || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfileSuccess('Profile updated successfully.');
        setIsEditingProfile(false);
        await fetchProfile();
      } else {
        setProfileError(data.error || 'Could not update your profile. Please try again.');
      }
    } catch {
      setProfileError('Could not update your profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  const handleStartChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordFieldErrors({});
    setPasswordError('');
    setPasswordSuccess('');
    setIsChangingPassword(true);
  };

  const handleCancelChangePassword = () => {
    setIsChangingPassword(false);
    setPasswordFieldErrors({});
    setPasswordError('');
  };

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    const errors = validatePasswordFields(currentPassword, newPassword, confirmNewPassword);
    if (Object.keys(errors).length > 0) {
      setPasswordFieldErrors(errors);
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordSuccess('Password changed successfully.');
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordError(data.error || 'Could not change your password. Please try again.');
      }
    } catch {
      setPasswordError('Could not change your password. Please try again.');
    } finally {
      setPasswordSaving(false);
    }
  }

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
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to manage your account.</p>
            <Link
              href="/auth/signin?callbackUrl=/account"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
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
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200" role="alert">
            {error}
          </div>
        )}

        {/* Profile Information */}
        <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
            </div>
            {!isEditingProfile && (
              <button
                type="button"
                onClick={handleStartEditProfile}
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

          {profileSuccess && (
            <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">
              {profileSuccess}
            </output>
          )}

          {/* Read-only view */}
          {!isEditingProfile && profile && (
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
          {isEditingProfile && (
            <>
              {profileError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4" role="alert">
                  {profileError}
                </p>
              )}
              <form onSubmit={handleProfileSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    id="account-name"
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (profileFieldErrors.name) setProfileFieldErrors((p) => ({ ...p, name: '' })); }}
                    className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${profileFieldErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="Your full name"
                    autoComplete="name"
                    aria-describedby={profileFieldErrors.name ? 'account-name-error' : undefined}
                  />
                  {profileFieldErrors.name && (
                    <p id="account-name-error" className="text-xs text-red-600 mt-1">{profileFieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="account-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="account-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (profileFieldErrors.email) setProfileFieldErrors((p) => ({ ...p, email: '' })); }}
                    className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${profileFieldErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-describedby={profileFieldErrors.email ? 'account-email-error' : undefined}
                  />
                  {profileFieldErrors.email && (
                    <p id="account-email-error" className="text-xs text-red-600 mt-1">{profileFieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="account-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="account-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value); if (profileFieldErrors.phoneNumber) setProfileFieldErrors((p) => ({ ...p, phoneNumber: '' })); }}
                    className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${profileFieldErrors.phoneNumber ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="+1234567890"
                    autoComplete="tel"
                    aria-describedby={profileFieldErrors.phoneNumber ? 'account-phone-error' : undefined}
                  />
                  {profileFieldErrors.phoneNumber && (
                    <p id="account-phone-error" className="text-xs text-red-600 mt-1">{profileFieldErrors.phoneNumber}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEditProfile}
                    disabled={profileSaving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {profileSaving ? 'Saving\u2026' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* Change Password */}
        {profile?.hasPassword && (
          <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h2 className="text-xl font-bold text-gray-900">Password</h2>
              </div>
              {!isChangingPassword && (
                <button
                  type="button"
                  onClick={handleStartChangePassword}
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

            {!isChangingPassword && (
              <p className="text-sm text-gray-500">
                Your password is set. Click &ldquo;Change Password&rdquo; above to update it.
              </p>
            )}

            {isChangingPassword && (
              <>
                {passwordSuccess && (
                  <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">
                    {passwordSuccess}
                  </output>
                )}
                {passwordError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4" role="alert">
                    {passwordError}
                  </p>
                )}

                <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); if (passwordFieldErrors.currentPassword) setPasswordFieldErrors((p) => ({ ...p, currentPassword: '' })); }}
                        className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12 ${passwordFieldErrors.currentPassword ? 'border-red-400' : 'border-gray-300'}`}
                        placeholder="Enter current password"
                        autoComplete="current-password"
                        aria-describedby={passwordFieldErrors.currentPassword ? 'current-password-error' : undefined}
                      />
                      <PasswordToggleButton
                        showPassword={showCurrentPassword}
                        onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                        label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                      />
                    </div>
                    {passwordFieldErrors.currentPassword && (
                      <p id="current-password-error" className="text-xs text-red-600 mt-1">{passwordFieldErrors.currentPassword}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); if (passwordFieldErrors.newPassword) setPasswordFieldErrors((p) => ({ ...p, newPassword: '' })); }}
                        className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12 ${passwordFieldErrors.newPassword ? 'border-red-400' : 'border-gray-300'}`}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        aria-describedby={passwordFieldErrors.newPassword ? 'new-password-error' : undefined}
                      />
                      <PasswordToggleButton
                        showPassword={showNewPassword}
                        onToggle={() => setShowNewPassword(!showNewPassword)}
                        label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      />
                    </div>
                    {passwordFieldErrors.newPassword && (
                      <p id="new-password-error" className="text-xs text-red-600 mt-1">{passwordFieldErrors.newPassword}</p>
                    )}
                    <PasswordStrengthChecklist password={newPassword} />
                  </div>

                  <div>
                    <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-new-password"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => { setConfirmNewPassword(e.target.value); if (passwordFieldErrors.confirmNewPassword) setPasswordFieldErrors((p) => ({ ...p, confirmNewPassword: '' })); }}
                      onBlur={() => setConfirmNewPasswordTouched(true)}
                      className={`w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${passwordFieldErrors.confirmNewPassword ? 'border-red-400' : 'border-gray-300'}`}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      aria-describedby={passwordFieldErrors.confirmNewPassword ? 'confirm-new-password-error' : undefined}
                    />
                    {passwordFieldErrors.confirmNewPassword ? (
                      <p id="confirm-new-password-error" className="text-xs text-red-600 mt-1">{passwordFieldErrors.confirmNewPassword}</p>
                    ) : confirmNewPasswordTouched && confirmNewPassword && newPassword !== confirmNewPassword ? (
                      <p className="text-xs text-red-600 mt-1">Passwords don&apos;t match.</p>
                    ) : null}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCancelChangePassword}
                      disabled={passwordSaving}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordSaving ? 'Changing\u2026' : 'Change Password'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        )}

        {/* OAuth-only notice */}
        {profile && !profile.hasPassword && (
          <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-900">Password</h2>
            </div>
            <p className="text-sm text-gray-600">
              Your account uses social login (Google or Microsoft). Password management is not available for social login accounts.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
