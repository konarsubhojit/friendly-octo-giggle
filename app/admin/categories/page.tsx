import { drizzleDb } from "@/lib/db";
import { categories } from "@/lib/schema";
import { isNull, asc } from "drizzle-orm";
import { AdminPageShell, AdminPanel } from "@/components/admin/AdminPageShell";
import CategoriesClient from "@/components/admin/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const list = await drizzleDb
    .select()
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const serialized = list.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: null as string | null,
  }));

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Categories" },
      ]}
      eyebrow="Catalog structure"
      title="Category controls with less friction."
      description="Keep product classification tidy with a dedicated workspace for adding, sorting, and retiring categories."
      metrics={[
        {
          label: "Active categories",
          value: String(serialized.length),
          hint: "Visible in admin and storefront filters.",
          tone: "sky",
        },
      ]}
    >
      <AdminPanel
        title="Manage category taxonomy"
        description="Create new groups, adjust sort order, and clean up unused categories without leaving the admin workspace."
      >
        <CategoriesClient initialCategories={serialized} />
      </AdminPanel>
    </AdminPageShell>
  );
}
