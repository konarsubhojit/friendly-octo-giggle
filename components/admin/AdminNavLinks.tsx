import { drizzleDb } from "@/lib/db";
import { failedEmails } from "@/lib/schema";
import { inArray, count } from "drizzle-orm";
import { AdminNavLinksClient } from "./AdminNavLinksClient";

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

export const AdminNavLinks = async () => {
  const failedCount = await fetchFailedEmailCount();

  return <AdminNavLinksClient failedEmailCount={failedCount} />;
};
