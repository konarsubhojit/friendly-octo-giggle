"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBanner } from "@/components/ui/AlertBanner";
import type { EmailAttemptRecord } from "@/lib/schema";

interface FailedEmailRecord {
  readonly id: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly emailType: string;
  readonly referenceId: string;
  readonly attemptCount: number;
  readonly lastError: string | null;
  readonly isRetriable: boolean;
  readonly status: string;
  readonly errorHistory: EmailAttemptRecord[];
  readonly createdAt: Date;
  readonly lastAttemptedAt: Date | null;
  readonly sentAt: Date | null;
}

interface EmailFailuresClientProps {
  readonly initialRecords: FailedEmailRecord[];
}

const formatDate = (date: Date | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleString();
};

const StatusBadge = ({ status }: { readonly status: string }) => {
  const classes: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes[status] ?? ""}`}
    >
      {status}
    </span>
  );
};

export const EmailFailuresClient = ({
  initialRecords,
}: EmailFailuresClientProps) => {
  const [records, setRecords] = useState<FailedEmailRecord[]>(initialRecords);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-failures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Retry failed");
        return;
      }
      const result = data.data?.results?.[0];
      if (result?.success) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
      } else {
        setError(result?.error ?? "Retry failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div>
      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      {records.length === 0 ? (
        <EmptyState
          title="No failed emails"
          message="All emails have been delivered successfully."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {[
                    "Recipient",
                    "Type",
                    "Order ID",
                    "Attempts",
                    "Status",
                    "Last Error",
                    "Created",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {record.recipientEmail}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {record.emailType}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">
                      {record.referenceId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {record.attemptCount}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-red-600 dark:text-red-400 max-w-xs truncate"
                      title={record.lastError ?? ""}
                    >
                      {record.lastError ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {record.status !== "sent" && (
                        <button
                          onClick={() => handleRetry(record.id)}
                          disabled={retryingId === record.id}
                          className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {retryingId === record.id ? "Retrying…" : "Retry"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
