import Link from "next/link";

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string;
}

interface AdminBreadcrumbsProps {
  readonly items: BreadcrumbItem[];
}

export default function AdminBreadcrumbs({ items }: AdminBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-2"
            >
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "rounded-full bg-slate-950 px-3 py-1 font-medium text-white dark:bg-sky-500 dark:text-slate-950"
                      : undefined
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}

              {isLast ? null : (
                <svg
                  className="h-4 w-4 text-slate-300 dark:text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
