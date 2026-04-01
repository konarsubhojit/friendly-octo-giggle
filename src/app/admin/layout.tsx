import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminHeaderNav } from "@/features/admin/components/AdminHeaderNav";
import { AdminNavLinks } from "@/features/admin/components/AdminNavLinks";

interface AdminLayoutProps {
  readonly children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-4 text-slate-950 dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_24%),linear-gradient(180deg,_#020617,_#0f172a_52%,_#111827)] dark:text-slate-100">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/90 p-8 text-center shadow-[0_28px_80px_-44px_rgba(15,23,42,0.55)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_28px_80px_-44px_rgba(2,6,23,0.9)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-600">
            Restricted area
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            Access Denied
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            You don&apos;t have permission to access the admin panel
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),_transparent_22%),linear-gradient(180deg,_#f8fafc,_#f1f5f9_48%,_#eef2ff)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_18%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_18%),linear-gradient(180deg,_#020617,_#0f172a_45%,_#111827)] dark:text-slate-100">
      <header className="border-b border-white/60 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="rounded-[1.9rem] border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.94),_rgba(240,249,255,0.92))] p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.58)] dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.92),_rgba(17,24,39,0.9))] dark:shadow-[0_24px_70px_-46px_rgba(2,6,23,0.9)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Operations workspace
                </p>
                <Link
                  href="/admin"
                  className="mt-3 inline-block text-3xl font-black tracking-tight text-slate-950 transition hover:text-sky-700 dark:text-slate-50 dark:hover:text-sky-300"
                >
                  Admin Control Center
                </Link>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                  Track catalog changes, fulfilment health, customer operations,
                  and system maintenance from one place.
                </p>
              </div>
              <AdminHeaderNav
                userName={session.user.name || session.user.email || ""}
              />
            </div>
          </div>
        </div>
      </header>
      <AdminNavLinks />
      {children}
    </div>
  );
}
