import { isSearchAvailable } from "@/lib/search";
import { areOrdersSearchControlsAvailable } from "@/lib/orders-search-index";
import { AdminPageShell, AdminPanel } from "@/components/admin/AdminPageShell";
import SearchReindexClient from "@/components/admin/SearchReindexClient";

export const dynamic = "force-dynamic";

export default function AdminSearchPage() {
  const productsConfigured = isSearchAvailable();
  const ordersConfigured = areOrdersSearchControlsAvailable();

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Search Index" },
      ]}
      eyebrow="Search infrastructure"
      title="Search indexing with clearer operational guardrails."
      description="Manage product and order search indexes from a dedicated admin surface while keeping operational risk obvious."
      metrics={[
        {
          label: "Products index",
          value: productsConfigured ? "Configured" : "Missing config",
          hint: productsConfigured
            ? "Upstash Search product reindex is available."
            : "Set Upstash Search variables to enable product reindexing.",
          tone: productsConfigured ? "emerald" : "amber",
        },
        {
          label: "Orders index",
          value: ordersConfigured ? "Configured" : "Missing config",
          hint: ordersConfigured
            ? "Redis-backed order search backfill is available."
            : "Set Upstash Redis variables to enable order indexing.",
          tone: ordersConfigured ? "emerald" : "amber",
        },
      ]}
    >
      <AdminPanel
        title="Search reindex controls"
        description="Rebuild product or order search after imports, migrations, or stale index incidents."
      >
        <SearchReindexClient
          productsConfigured={productsConfigured}
          ordersConfigured={ordersConfigured}
        />
      </AdminPanel>
    </AdminPageShell>
  );
}
