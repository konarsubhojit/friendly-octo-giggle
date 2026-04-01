import { drizzleDb } from "@/lib/db";
import { categories } from "@/lib/schema";
import { isNull, asc } from "drizzle-orm";
import {
  AdminPageShell,
  AdminPanel,
} from "@/features/admin/components/AdminPageShell";
import CategoriesClient from "@/features/admin/components/CategoriesClient";

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
      title="Category Management"
      description="Add, organise, and delete product categories."
      metrics={[
        {
          label: "Active categories",
          value: String(serialized.length),
          hint: "Active categories in the catalogue.",
          tone: "sky",
        },
      ]}
    >
      <AdminPanel title="" description="">
        <CategoriesClient initialCategories={serialized} />
      </AdminPanel>
    </AdminPageShell>
  );
}
