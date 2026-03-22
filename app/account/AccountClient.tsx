"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { AuthRequiredState } from "@/components/ui/AuthRequiredState";
import { Card } from "@/components/ui/Card";
import { GradientHeading } from "@/components/ui/GradientHeading";
import { API_ERRORS } from "@/lib/constants/error-messages";
import { ProfileSection } from "@/app/account/ProfileSection";
import { PreferencesSection } from "@/app/account/PreferencesSection";
import { PasswordSection } from "@/app/account/PasswordSection";
import type { UserProfile } from "@/app/account/account-shared";

export default function AccountClient() {
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
}
