import { isSearchAvailable } from "@/lib/search";
import { AdminPageShell, AdminPanel } from "@/components/admin/AdminPageShell";
import SearchReindexClient from "@/components/admin/SearchReindexClient";

export const dynamic = "force-dynamic";

export default function AdminSearchPage() {
  const configured = isSearchAvailable();

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Search Index" },
      ]}
      eyebrow="Search infrastructure"
      title="Search indexing with clearer operational guardrails."
      description="Manage the Upstash product search index from a dedicated admin surface while keeping operational risk obvious."
      metrics={[
        {
          label: "Index status",
          value: configured ? "Configured" : "Missing config",
          hint: configured
            ? "Reindex operations are available."
            : "Environment variables still need to be set.",
          tone: configured ? "emerald" : "amber",
        },
      ]}
    >
      <AdminPanel
        title="Search reindex controls"
        description="Rebuild product search after imports, migrations, or stale index incidents."
      >
        <SearchReindexClient configured={configured} />
      </AdminPanel>
    </AdminPageShell>
  );
}
