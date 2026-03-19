import Link from "next/link";
import { drizzleDb } from "@/lib/db";
import { failedEmails } from "@/lib/schema";
import { inArray, count } from "drizzle-orm";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/reviews", label: "Reviews" },
];

const fetchFailedEmailCount = async (): Promise<number> => {
  try {
    const rows = await drizzleDb
      .select({ value: count() })
      .from(failedEmails)
      .where(inArray(failedEmails.status, ["pending", "failed"]));
    return rows[0]?.value ?? 0;
  } catch {
    return 0;
  }
};

export async function AdminNavLinks() {
  const failedCount = await fetchFailedEmailCount();

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 py-3 whitespace-nowrap">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/admin/email-failures"
            className="relative text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1"
          >
            Email Failures
            {failedCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
                {failedCount > 99 ? "99+" : failedCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
