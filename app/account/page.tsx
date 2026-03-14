'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { PasswordToggleButton } from '@/components/auth/PasswordToggleButton';
import { PasswordStrengthChecklist } from '@/components/auth/PasswordStrengthChecklist';

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

export default function AccountPage() {
  const { data: session, status: authStatus } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Profile form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

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
        setError(data.error || 'Failed to load profile');
      }
    } catch {
      setError('Failed to load profile');
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

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
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
        setProfileSuccess('Profile updated successfully');
        await fetchProfile();
      } else {
        setProfileError(data.error || 'Failed to update profile');
      }
    } catch {
      setProfileError('An unexpected error occurred');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    setPasswordSaving(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch {
      setPasswordError('An unexpected error occurred');
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
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {/* ─── Profile Information ──────────────────────── */}
        <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
          </div>

          {profileSuccess && (
            <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">
              {profileSuccess}
            </output>
          )}
          {profileError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4" role="alert">
              {profileError}
            </p>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="account-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="account-phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                id="account-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="+1234567890"
                autoComplete="tel"
              />
            </div>

            {profile && (
              <div className="text-xs text-gray-400 pt-1">
                Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* ─── Change Password ─────────────────────────── */}
        {profile?.hasPassword && (
          <section className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
            </div>

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

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                    placeholder="Enter current password"
                    required
                    autoComplete="current-password"
                  />
                  <PasswordToggleButton
                    showPassword={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                    label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  />
                </div>
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
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                    placeholder="Enter new password"
                    required
                    autoComplete="new-password"
                  />
                  <PasswordToggleButton
                    showPassword={showNewPassword}
                    onToggle={() => setShowNewPassword(!showNewPassword)}
                    label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  />
                </div>

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
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Confirm new password"
                  required
                  autoComplete="new-password"
                />
                {confirmNewPassword && newPassword !== confirmNewPassword && (
                  <p className="text-xs text-red-600 mt-1">Passwords don&apos;t match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={passwordSaving}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordSaving ? 'Changing...' : 'Change Password'}
              </button>
            </form>
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
              Your account uses social login (Google or Microsoft). Password management is not available for OAuth-only accounts.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
