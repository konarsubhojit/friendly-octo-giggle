import Link from "next/link";

interface AdminHeaderNavProps {
  readonly userName: string;
}

export const AdminHeaderNav = ({ userName }: AdminHeaderNavProps) => {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-right sm:text-left">
      <span
        className="max-w-[180px] truncate text-sm text-gray-600 dark:text-gray-400 sm:max-w-none"
        title={userName}
      >
        {userName}
      </span>
      <Link
        href="/"
        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white whitespace-nowrap"
      >
        View Store
      </Link>
      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="text-sm text-red-600 hover:text-red-900 whitespace-nowrap"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
};
