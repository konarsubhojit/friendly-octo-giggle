import Link from "next/link";

interface AdminHeaderNavProps {
  readonly userName: string;
}

export const AdminHeaderNav = ({ userName }: AdminHeaderNavProps) => {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-right sm:text-left">
      <span
        className="max-w-[220px] truncate rounded-full border border-white/70 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm sm:max-w-none dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
        title={userName}
      >
        {userName}
      </span>
      <Link
        href="/"
        className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-slate-50"
      >
        View Store
      </Link>
      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-200 dark:hover:border-rose-800 dark:hover:bg-rose-950/80"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
};
