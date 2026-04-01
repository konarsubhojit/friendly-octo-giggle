import { drizzleDb } from "@/lib/db";
import { failedEmails } from "@/lib/schema";
import { desc, inArray } from "drizzle-orm";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/AdminPageShell";
import { EmailFailuresClient } from "@/features/admin/components/EmailFailuresClient";

export const dynamic = "force-dynamic";

const fetchEmailFailures = async () => {
  const records = await drizzleDb
    .select()
    .from(failedEmails)
    .where(inArray(failedEmails.status, ["pending", "failed"]))
    .orderBy(desc(failedEmails.createdAt))
    .limit(50);
  return records;
};

const EmailFailuresPage = async () => {
  const records = await fetchEmailFailures();
  const pendingCount = records.filter(
    (record) => record.status === "pending",
  ).length;
  const failedCount = records.filter(
    (record) => record.status === "failed",
  ).length;

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Email Failures" },
      ]}
      eyebrow="Messaging reliability"
      title="Email Failures"
      description="Monitor and retry failed email deliveries."
      metrics={[
        {
          label: "Retry queue",
          value: String(records.length),
          hint: "Pending and failed deliveries.",
          tone: "rose",
        },
        {
          label: "Pending",
          value: String(pendingCount),
          hint: "Scheduled for retry.",
          tone: "amber",
        },
        {
          label: "Failed",
          value: String(failedCount),
          hint: "Requires manual review.",
          tone: "slate",
        },
      ]}
    >
      <AdminPanel title="Failed Emails" description="">
        <EmailFailuresClient initialRecords={records} />
      </AdminPanel>
    </AdminPageShell>
  );
};

export default EmailFailuresPage;
