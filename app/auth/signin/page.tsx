import Link from "next/link";
import { signIn } from "@/lib/auth";
import SignInClient from "./SignInClient";

export const dynamic = "force-dynamic";

function SignInHeader() {
  return (
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[var(--accent-blush)] to-[var(--accent-cream)] mb-3">
        <svg
          className="w-6 h-6 text-[var(--accent-rose)]"
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
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mb-2">
        Welcome Back
      </h1>
      <p className="text-[var(--text-secondary)]">
        Sign in to continue shopping
      </p>
    </div>
  );
}

interface SignInPageProps {
  readonly searchParams: Promise<{ callbackUrl?: string }>;
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  async function handleGoogleSignIn() {
    "use server";
    const params = await searchParams;
    await signIn("google", { redirectTo: params.callbackUrl || "/" });
  }

  async function handleMicrosoftSignIn() {
    "use server";
    const params = await searchParams;
    await signIn("microsoft-entra-id", {
      redirectTo: params.callbackUrl || "/",
    });
  }

  return (
    <div className="min-h-screen bg-warm-gradient px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <main className="mx-auto w-full max-w-md bg-[var(--surface)]/80 backdrop-blur-sm rounded-xl shadow-warm border border-[var(--border-warm)] p-6 sm:p-8">
        <SignInHeader />

        {/* Client-side credentials form */}
        <SignInClient />

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-warm)]" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-[var(--surface)] text-[var(--text-secondary)]">
              or continue with
            </span>
          </div>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          <form action={handleGoogleSignIn}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-[var(--surface)] border-2 border-[var(--border-warm)] rounded-lg px-4 py-3 font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] hover:border-[var(--accent-warm)] transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </form>

          <form action={handleMicrosoftSignIn}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-[var(--surface)] border-2 border-[var(--border-warm)] rounded-lg px-4 py-3 font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] hover:border-[var(--accent-warm)] transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" aria-hidden="true">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Continue with Microsoft
            </button>
          </form>
        </div>

        {/* Links */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)]"
            >
              Register
            </Link>
          </p>
          <Link
            href="/"
            className="text-sm text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)] block"
          >
            Back to store
          </Link>
        </div>
      </main>
    </div>
  );
}
