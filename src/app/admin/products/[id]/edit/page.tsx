import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminPageShell } from "@/features/admin/components/AdminPageShell";
import ProductEditPageForm from "@/features/admin/components/ProductEditPageForm";
import VariationList from "@/features/admin/components/VariationList";
import { auth } from "@/lib/auth";
import { drizzleDb } from "@/lib/db";
import { products } from "@/lib/schema";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function AdminProductEditFormPage({ params }: PageProps) {
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
  };

  const serializedVariations = product.variations.map((variation) => ({
    id: variation.id,
    productId: variation.productId,
    name: variation.name,
    designName: variation.designName,
    variationType: (variation.variationType ?? "styling") as
      | "styling"
      | "colour",
    styleId: variation.styleId ?? null,
    image: variation.image ?? null,
    images: variation.images ?? [],
    price: variation.price,
    stock: variation.stock,
    deletedAt: null,
    createdAt: variation.createdAt.toISOString(),
    updatedAt: variation.updatedAt.toISOString(),
  }));

  const variationsInStock = serializedVariations.filter(
    (variation) => variation.stock > 0,
  ).length;

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Products", href: "/admin/products" },
        {
          label: serializedProduct.name,
          href: `/admin/products/${serializedProduct.id}`,
        },
        { label: "Edit Product" },
      ]}
      eyebrow="Catalog editing"
      title="Edit Product"
      description="Update product information, pricing, stock, and variations."
      actions={
        <Link
          href={`/admin/products/${serializedProduct.id}`}
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
        >
          Back to Overview
        </Link>
      }
      metrics={[
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
        {
          label: "In stock",
          value: String(variationsInStock),
          hint: "Variations with available stock.",
          tone: variationsInStock > 0 ? "emerald" : "rose",
        },
      ]}
    >
      <ProductEditPageForm product={serializedProduct} />
      <VariationList
        productId={serializedProduct.id}
        productPrice={serializedProduct.price}
        initialVariations={serializedVariations}
      />
    </AdminPageShell>
  );
}
