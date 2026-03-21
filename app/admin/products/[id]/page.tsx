import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { drizzleDb } from "@/lib/db";
import { products } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import VariationList from "@/components/admin/VariationList";
import ProductEditForm from "@/components/admin/ProductEditForm";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

const AdminProductEditPage = async ({ params }: PageProps) => {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/auth/signin");
  }

  const { id } = await params;

  const product = await drizzleDb.query.products.findFirst({
    where: and(eq(products.id, id), isNull(products.deletedAt)),
    with: {
      variations: {
        where: (v, { isNull }) => isNull(v.deletedAt),
      },
    },
  });

  if (!product) {
    notFound();
  }

  const serializedVariations = product.variations.map((v) => ({
    id: v.id,
    productId: v.productId,
    name: v.name,
    designName: v.designName,
    image: v.image ?? null,
    images: v.images ?? [],
    priceModifier: v.priceModifier,
    stock: v.stock,
    deletedAt: null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));

  const serializedProduct = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    image: product.image,
    images: (product.images as string[]) ?? [],
    stock: product.stock,
    category: product.category,
    deletedAt: null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variations: serializedVariations,
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Products", href: "/admin/products" },
          { label: serializedProduct.name },
        ]}
      />

      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
          Product Overview
        </p>
      </div>

      <ProductEditForm product={serializedProduct} />

      <VariationList
        productId={product.id}
        productPrice={product.price}
        initialVariations={serializedVariations}
      />
    </main>
  );
};
export default AdminProductEditPage;
