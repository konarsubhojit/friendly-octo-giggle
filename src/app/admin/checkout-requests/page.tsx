import Link from "next/link";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/AdminPageShell";
import {
  getRecentCheckoutRequests,
  type AdminCheckoutRequestRecord,
} from "@/features/cart/services/checkout-service";
import { CheckoutRequestStatusEnum } from "@/lib/validations";

export const dynamic = "force-dynamic";

interface AdminCheckoutRequestsPageProps {
  readonly searchParams?: Promise<{
    search?: string;
    status?: string;
  }>;
}

const STATUS_STYLES: Record<AdminCheckoutRequestRecord["status"], string> = {
  PENDING:
    "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30",
  PROCESSING:
    "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/30",
  COMPLETED:
    "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30",
  FAILED:
    "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-300 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-400/30",
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatTimestamp = (value: string) =>
  dateFormatter.format(new Date(value));

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const normalizeSearchParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeStatusParam = (
  value: string | string[] | undefined,
): AdminCheckoutRequestRecord["status"] | undefined => {
  const candidate = typeof value === "string" ? value : undefined;
  const parsed = CheckoutRequestStatusEnum.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
};

export default async function AdminCheckoutRequestsPage({
  searchParams,
}: AdminCheckoutRequestsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const search = normalizeSearchParam(resolvedSearchParams.search);
  const status = normalizeStatusParam(resolvedSearchParams.status);

  const records = await getRecentCheckoutRequests({
    limit: 50,
    search,
    status,
  });
  const queuedCount = records.filter(
    (record) => record.status === "PENDING",
  ).length;
  const processingCount = records.filter(
    (record) => record.status === "PROCESSING",
  ).length;
  const failedCount = records.filter(
    (record) => record.status === "FAILED",
  ).length;
  const completedCount = records.filter(
    (record) => record.status === "COMPLETED",
  ).length;

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Checkout Queue" },
      ]}
      eyebrow="Order processing"
      title="Checkout Requests"
      description="Monitor queued, processing, failed, and completed checkout requests."
      metrics={[
        {
          label: "Queued",
          value: String(queuedCount),
          hint: "Awaiting processing.",
          tone: "amber",
        },
        {
          label: "Processing",
          value: String(processingCount),
          hint: "Currently being processed.",
          tone: "sky",
        },
        {
          label: "Failed",
          value: String(failedCount),
          hint: "Requires investigation.",
          tone: "rose",
        },
        {
          label: "Completed",
          value: String(completedCount),
          hint: "Orders successfully created.",
          tone: "emerald",
        },
      ]}
    >
      <AdminPanel title="Queue" description="">
        <form
          method="GET"
          className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto_auto]"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Search
            </span>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Request, order, customer, or error"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950 shadow-inner shadow-white/40 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-900 dark:focus:ring-sky-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Status
            </span>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50 dark:focus:border-sky-500 dark:focus:bg-slate-900 dark:focus:ring-sky-500/20"
            >
              <option value="">All states</option>
              {CheckoutRequestStatusEnum.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="mt-auto inline-flex min-h-[3rem] items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
          >
            Apply filters
          </button>
          {search || status ? (
            <Link
              href="/admin/checkout-requests"
              className="mt-auto inline-flex min-h-[3rem] items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {search || status ? (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {(() => {
              const statusConjunction = search ? " and" : " with";
              const statusText = status
                ? `${statusConjunction} status ${status}`
                : "";
              const searchText = search ? ` matching "${search}"` : "";
              return `Showing ${records.length} checkout request${records.length === 1 ? "" : "s"}${searchText}${statusText}.`;
            })()}
          </p>
        ) : null}

        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            {search || status
              ? "No checkout requests matched the current filters."
              : "No checkout requests have been recorded yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3">Request</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3">Order</th>
                  <th className="px-3 py-3">Last Error</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="align-top text-slate-700 dark:text-slate-200"
                  >
                    <td className="px-3 py-4">
                      <div className="font-semibold text-slate-950 dark:text-slate-50">
                        {record.id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        User {record.userId}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.itemCount} item
                        {record.itemCount === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-950 dark:text-slate-50">
                        {record.customerName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.customerEmail}
                      </div>
                      <div className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                        {truncate(record.customerAddress, 72)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[record.status]}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      {record.orderId ? (
                        <Link
                          href={`/admin/orders?search=${record.orderId}`}
                          className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-600 dark:text-sky-300 dark:decoration-sky-600 dark:hover:text-sky-200"
                        >
                          {record.orderId}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Not created yet
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      {record.errorMessage ? (
                        <span className="max-w-xs text-xs text-rose-700 dark:text-rose-300">
                          {truncate(record.errorMessage, 88)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          None
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
                      <time dateTime={record.createdAt}>
                        {formatTimestamp(record.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </AdminPageShell>
  );
}
