import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { drizzleDb } from "@/lib/db";
import { products } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";
import { AdminPageShell } from "@/features/admin/components/AdminPageShell";
import VariationList from "@/features/admin/components/VariationList";
import ProductEditForm from "@/features/admin/components/ProductEditForm";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function AdminProductEditPage({ params }: PageProps) {
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
    variationType: (v.variationType ?? "styling") as "styling" | "colour",
    styleId: v.styleId ?? null,
    image: v.image ?? null,
    images: v.images ?? [],
    price: v.price,
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
    images: product.images ?? [],
    stock: product.stock,
    category: product.category,
    deletedAt: null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variations: serializedVariations,
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Products", href: "/admin/products" },
        { label: serializedProduct.name },
      ]}
      eyebrow="Product overview"
      title={serializedProduct.name}
      description="View product details, pricing, stock, and variations."
      actions={
        <Link
          href={`/admin/products/${serializedProduct.id}/edit`}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Edit Product
        </Link>
      }
      metrics={[
        {
          label: "Base price",
          value: `$${serializedProduct.price.toFixed(2)}`,
          hint: "Base price in INR.",
          tone: "emerald",
        },
        {
          label: "Base stock",
          value: String(serializedProduct.stock),
          hint: "Base stock level.",
          tone: serializedProduct.stock > 0 ? "sky" : "rose",
        },
        {
          label: "Variations",
          value: String(serializedVariations.length),
          hint: "Active product variations.",
          tone: "amber",
        },
      ]}
    >
      <ProductEditForm product={serializedProduct} />
      <VariationList
        productId={product.id}
        productPrice={product.price}
        initialVariations={serializedVariations}
      />
    </AdminPageShell>
  );
}
