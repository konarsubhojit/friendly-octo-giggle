import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { drizzleDb } from "@/lib/db";
import { products } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import VariationList from "@/components/admin/VariationList";
import ProductEditForm from "@/components/admin/ProductEditForm";

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
      description="Review core product details, confirm pricing and stock, and manage associated variations from one place."
      actions={
        <Link
          href={`/admin/products/${serializedProduct.id}/edit`}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open Editing Workspace
        </Link>
      }
      metrics={[
        {
          label: "Base price",
          value: `$${serializedProduct.price.toFixed(2)}`,
          hint: "Stored in USD before display conversion.",
          tone: "emerald",
        },
        {
          label: "Base stock",
          value: String(serializedProduct.stock),
          hint: "Inventory before variation-level stock overrides.",
          tone: serializedProduct.stock > 0 ? "sky" : "rose",
        },
        {
          label: "Variations",
          value: String(serializedVariations.length),
          hint: "Active product options currently available.",
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
