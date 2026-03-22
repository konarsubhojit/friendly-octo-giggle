import { drizzleDb } from "@/lib/db";
import { failedEmails } from "@/lib/schema";
import { desc, inArray } from "drizzle-orm";
import { AdminPageShell, AdminPanel } from "@/components/admin/AdminPageShell";
import { EmailFailuresClient } from "@/components/admin/EmailFailuresClient";

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
      title="Failed delivery triage without leaving the admin flow."
      description="Track pending retries, inspect repeated failures, and retry stuck transactional emails from a focused queue."
      metrics={[
        {
          label: "Retry queue",
          value: String(records.length),
          hint: "Pending and failed deliveries still needing attention.",
          tone: "rose",
        },
        {
          label: "Pending",
          value: String(pendingCount),
          hint: "Queued for another delivery attempt.",
          tone: "amber",
        },
        {
          label: "Failed",
          value: String(failedCount),
          hint: "Requires closer review or manual retry.",
          tone: "slate",
        },
      ]}
    >
      <AdminPanel
        title="Email failure queue"
        description="Inspect delivery errors, retry individual emails, and keep transactional communication healthy."
      >
        <EmailFailuresClient initialRecords={records} />
      </AdminPanel>
    </AdminPageShell>
  );
};

export default EmailFailuresPage;
