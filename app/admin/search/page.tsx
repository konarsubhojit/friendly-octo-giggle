import { isSearchAvailable } from "@/lib/search";
import SearchReindexClient from "@/components/admin/SearchReindexClient";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";

export const dynamic = "force-dynamic";

export default function AdminSearchPage() {
  const configured = isSearchAvailable();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Search Index" }]}
      />
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Search Index
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage Upstash Search indexes for products and orders
        </p>
      </div>

      <SearchReindexClient configured={configured} />
    </main>
  );
}
