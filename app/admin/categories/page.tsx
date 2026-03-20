import { drizzleDb } from "@/lib/db";
import { categories } from "@/lib/schema";
import { isNull, asc } from "drizzle-orm";
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Categories
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Add, edit, or remove product categories
        </p>
      </div>
      <CategoriesClient initialCategories={serialized} />
    </main>
  );
}
