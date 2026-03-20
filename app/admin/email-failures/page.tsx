import { drizzleDb } from "@/lib/db";
import { failedEmails } from "@/lib/schema";
import { desc, inArray } from "drizzle-orm";
import { EmailFailuresClient } from "@/components/admin/EmailFailuresClient";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";

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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Failures" },
        ]}
      />
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Email Failures
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and retry failed email deliveries
        </p>
      </div>
      <EmailFailuresClient initialRecords={records} />
    </main>
  );
};

export default EmailFailuresPage;
